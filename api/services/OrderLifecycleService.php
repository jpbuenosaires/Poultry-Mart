<?php
/**
 * OrderLifecycleService — Order status state machine and cancellation.
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderLifecycleService extends BaseService
{
    private NotificationService $notifications;

    public function __construct(mysqli $conn)
    {
        parent::__construct($conn);
        $this->notifications = new NotificationService($conn);
    }

    public function updateOrderStatus(int $oid, string $status, int $adminId): void
    {
        $allowed = ['Pending', 'Packed', 'Out for Delivery', 'Arrived at Location', 'Completed', 'Cancelled'];
        if (!in_array($status, $allowed, true)) {
            throw new InvalidArgumentException('Invalid status.');
        }

        $current = $this->fetchOne("SELECT status FROM orders WHERE order_id = ? LIMIT 1", 'i', [$oid]);
        if (!$current) {
            throw new RuntimeException('Order not found.');
        }
        $validTransitions = [
            'Pending'             => ['Packed', 'Cancelled'],
            'Packed'              => ['Out for Delivery', 'Cancelled'],
            'Out for Delivery'    => ['Arrived at Location', 'Completed', 'Cancelled'],
            'Arrived at Location' => ['Completed', 'Cancelled'],
            'Completed'           => [],   // terminal
            'Cancelled'           => [],   // terminal
        ];
        $allowed_next = $validTransitions[$current['status']] ?? [];
        if (!in_array($status, $allowed_next, true)) {
            throw new RuntimeException(
                "Invalid transition: cannot move order from '{$current['status']}' to '{$status}'." .
                " Allowed next states: " . (empty($allowed_next) ? 'none (terminal)' : implode(', ', $allowed_next))
            );
        }

        $this->execute(
            "UPDATE orders SET status = ? WHERE order_id = ?",
            'si',
            [$status, $oid]
        );

        if ($status === 'Out for Delivery') {
            $this->execute("UPDATE deliveries SET status = 'Out for Delivery', dispatched_at = NOW() WHERE order_id = ?", 'i', [$oid]);
        } elseif ($status === 'Arrived at Location') {
            $this->execute("UPDATE deliveries SET status = 'Arrived at Location' WHERE order_id = ?", 'i', [$oid]);
        }

        // When an admin closes an order, settle the payment and ensure
        // final_total is populated (mirrors what completeDelivery() does).
        if ($status === 'Completed') {
            $this->execute("UPDATE deliveries SET status = 'Completed', delivered_at = NOW() WHERE order_id = ?", 'i', [$oid]);
            
            $this->execute(
                "UPDATE payments
                 SET status = 'Paid', verified_by = ?, verified_at = NOW()
                 WHERE order_id = ? AND status = 'Unpaid'",
                'ii',
                [$adminId, $oid]
            );
            // If the order was never packed, final_total will be NULL.
            // Fall back to estimated_total so revenue reports are not broken.
            $this->execute(
                "UPDATE orders
                 SET final_total = COALESCE(final_total, estimated_total)
                 WHERE order_id = ?",
                'i',
                [$oid]
            );
        }

        $this->execute(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, 'update_status', 'order', ?, ?)",
            'iis',
            [$adminId, $oid, "Status changed to $status"]
        );
    }

    /**
     * Cancel an order. The customer can only cancel Pending orders.
     * Admin/staff can cancel any non-Completed order.
     */
    public function cancelOrder(int $oid, int $initiatorId, string $reason, bool $customerInitiated = false): void
    {
        $this->beginTransaction();
        try {
            // Fetch status INSIDE the transaction with FOR UPDATE to prevent double-cancels
            $ord = $this->fetchOne(
                "SELECT status, user_id, order_number FROM orders WHERE order_id = ? FOR UPDATE",
                'i',
                [$oid]
            );
            if (!$ord) {
                throw new RuntimeException('Order not found.');
            }
            if (in_array($ord['status'], ['Completed', 'Cancelled'], true)) {
                throw new RuntimeException('Cannot cancel this order. It is already ' . $ord['status'] . '.');
            }
            if ($customerInitiated) {
                if ($ord['status'] !== 'Pending') {
                    throw new RuntimeException('Only Pending orders can be cancelled by the customer.');
                }
                if ((int) $ord['user_id'] !== $initiatorId) {
                    throw new RuntimeException('You cannot cancel someone else\'s order.');
                }
            }
            $this->execute(
                "UPDATE orders SET status = 'Cancelled' WHERE order_id = ?",
                'i',
                [$oid]
            );
            $this->execute(
                "INSERT INTO cancellation_logs (order_id, cancelled_by, reason, created_at) VALUES (?, ?, ?, NOW())",
                'iis',
                [$oid, $initiatorId, $reason]
            );
            $this->notifications->send(
                (int) $ord['user_id'],
                "Your order {$ord['order_number']} has been cancelled. Reason: $reason",
                'cancelled'
            );

            // ── Restore reserved stock for all pre-completion statuses
            $activeStatuses = ['Pending', 'Packed', 'Out for Delivery', 'Arrived at Location'];
            if (in_array($ord['status'], $activeStatuses, true)) {
                $items = $this->fetchAll(
                    "SELECT oi.product_id, oi.quantity, oi.estimated_weight, oi.actual_weight, oi.pricing_model
                     FROM order_items oi
                     WHERE oi.order_id = ? AND (oi.quantity > 0 OR oi.estimated_weight > 0 OR oi.actual_weight > 0)",
                    'i',
                    [$oid]
                );
                foreach ($items as $item) {
                    $pid = (int) $item['product_id'];
                    $qtyToRestore = 0;
                    
                    if ($ord['status'] === 'Pending') {
                        $qtyToRestore = $item['pricing_model'] === 'catch_weight'
                            ? (float) ($item['quantity'] * $item['estimated_weight'])
                            : (float) $item['quantity'];
                    } else {
                        $qtyToRestore = $item['pricing_model'] === 'catch_weight'
                            ? (float) $item['actual_weight']
                            : (float) $item['quantity'];
                    }

                    if ($qtyToRestore <= 0) continue;

                    // Restore spread across batches FIFO (oldest first)
                    $batches = $this->fetchAll(
                        "SELECT batch_id, remaining_qty
                         FROM product_batches
                         WHERE product_id = ? ORDER BY batch_date ASC",
                        'i',
                        [$pid]
                    );
                    $remaining = $qtyToRestore;
                    foreach ($batches as $batch) {
                        if ($remaining <= 0) break;
                        $batchId = (int) $batch['batch_id'];
                        $this->execute(
                            "UPDATE product_batches SET remaining_qty = remaining_qty + ? WHERE batch_id = ?",
                            'di',
                            [$remaining, $batchId]
                        );
                        $this->execute(
                            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                             VALUES (?, 'stock_restoration', 'product_batch', ?, ?)",
                            'iis',
                            [$initiatorId, $batchId, "Restored {$qtyToRestore} units from cancelled order #{$oid} (status was {$ord['status']})"]  
                        );
                        // Only restore to first batch; subsequent batches not needed for simple reversal
                        break;
                    }
                }
            }

            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }
}
