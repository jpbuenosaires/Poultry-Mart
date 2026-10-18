<?php
/**
 * OrderDeliveryService — Rider assignment, dispatch and delivery completion/failure (staff and rider sides).
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderDeliveryService extends BaseService
{
    private NotificationService $notifications;

    public function __construct(mysqli $conn)
    {
        parent::__construct($conn);
        $this->notifications = new NotificationService($conn);
    }

    /**
     * Assign (or re-assign) a rider to an order.
     */
    public function assignRider(int $oid, int $riderId, int $assignedBy): void
    {
        $ord = $this->fetchOne("SELECT status FROM orders WHERE order_id = ? LIMIT 1", 'i', [$oid]);
        if (!$ord) {
            throw new RuntimeException('Order not found.');
        }
        if ($ord['status'] !== 'Packed') {
            throw new RuntimeException('A rider can only be assigned to a Packed order. Current status: ' . $ord['status']);
        }

        $this->beginTransaction();
        try {
            $this->execute(
                "INSERT INTO deliveries (order_id, rider_id, assigned_by, status)
                 VALUES (?, ?, ?, 'Assigned')
                 ON DUPLICATE KEY UPDATE rider_id = ?, assigned_by = ?, status = 'Assigned'",
                'iiiii',
                [$oid, $riderId, $assignedBy, $riderId, $assignedBy]
            );
            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'assign_rider', 'order', ?, ?)",
                'iis',
                [$assignedBy, $oid, "Rider $riderId assigned to order $oid by $assignedBy"]
            );
            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Assign one rider to many orders at once (zone-based dispatch).
     *
     * @param int[] $orderIds
     * @return int  Number of successfully assigned orders.
     */
    public function batchAssignRiders(array $orderIds, int $riderId, int $staffId): int
    {
        $this->beginTransaction();
        try {
            $assigned = 0;
            foreach ($orderIds as $oid) {
                $oid = (int) $oid;
                if (!$oid) continue;

                $ord = $this->fetchOne("SELECT status FROM orders WHERE order_id = ? LIMIT 1", 'i', [$oid]);
                if (!$ord || $ord['status'] !== 'Packed') {
                    continue; // Skip orders that are not packed
                }

                $this->execute(
                    "INSERT INTO deliveries (order_id, rider_id, assigned_by, status)
                     VALUES (?, ?, ?, 'Assigned')
                     ON DUPLICATE KEY UPDATE rider_id = ?, assigned_by = ?, status = 'Assigned'",
                    'iiiii',
                    [$oid, $riderId, $staffId, $riderId, $staffId]
                );
                $assigned++;
            }
            $this->commit();
            return $assigned;
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Mark an order as "Out for Delivery" and log the dispatch.
     */
    public function dispatchOrder(int $oid, int $staffId): void
    {
        $this->beginTransaction();
        try {
            // Check status first to prevent partial ghost updates on invalid states
            $ord = $this->fetchOne("SELECT status, user_id, order_number FROM orders WHERE order_id = ? FOR UPDATE", 'i', [$oid]);
            if (!$ord || $ord['status'] !== 'Packed') {
                throw new RuntimeException('Only Packed orders can be dispatched.');
            }

            $this->execute(
                "UPDATE orders SET status = 'Out for Delivery' WHERE order_id = ?",
                'i',
                [$oid]
            );
            $this->execute(
                "UPDATE deliveries SET status = 'Out for Delivery', dispatched_at = NOW() WHERE order_id = ?",
                'i',
                [$oid]
            );
            if ($ord) {
                $this->notifications->send(
                    (int) $ord['user_id'],
                    "Your order {$ord['order_number']} is now out for delivery! 🛵",
                    'dispatched'
                );
            }

            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'dispatch_order', 'order', ?, ?)",
                'iis',
                [$staffId, $oid, "Order $oid dispatched by staff $staffId"]
            );

            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Mark a delivery as complete (fulfillment staff action).
     */
    public function completeDeliveryStaff(int $oid, int $staffId): void
    {
        $this->beginTransaction();
        try {
            $this->execute(
                "UPDATE orders SET status = 'Completed' WHERE order_id = ?",
                'i',
                [$oid]
            );
            $this->execute(
                "UPDATE deliveries SET status = 'Delivered', delivered_at = NOW() WHERE order_id = ?",
                'i',
                [$oid]
            );
            
            // Ensure COD is marked paid if staff completes it
            $ord = $this->fetchOne("SELECT payment_method FROM orders WHERE order_id = ?", 'i', [$oid]);
            if ($ord && strtolower($ord['payment_method']) === 'cod') {
                $this->execute(
                    "UPDATE payments SET status = 'Paid', verified_by = ?, verified_at = NOW() WHERE order_id = ? AND status = 'Unpaid'",
                    'ii',
                    [$staffId, $oid]
                );
            }

            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'complete_delivery', 'order', ?, ?)",
                'iis',
                [$staffId, $oid, "Order $oid marked completed by staff $staffId"]
            );
            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Verify that an order belongs to (is assigned to) a specific rider.
     */
    public function verifyRiderAssignment(int $oid, int $riderId): bool
    {
        $row = $this->fetchOne(
            "SELECT delivery_id FROM deliveries WHERE order_id = ? AND rider_id = ? LIMIT 1",
            'ii',
            [$oid, $riderId]
        );
        return $row !== null;
    }

    /**
     * Update an order status by a rider (Out for Delivery | Arrived at Location).
     */
    public function riderUpdateStatus(int $oid, int $riderId, string $status): void
    {
        $allowed = ['Out for Delivery', 'Arrived at Location'];
        if (!in_array($status, $allowed, true)) {
            throw new InvalidArgumentException('Invalid status.');
        }

        $current = $this->fetchOne("SELECT status FROM orders WHERE order_id = ? LIMIT 1", 'i', [$oid]);
        if ($current && $current['status'] === $status) {
            return; // Prevent duplicate updates and spam notifications if already in this status
        }

        $this->beginTransaction();
        try {
            $this->execute(
                "UPDATE orders SET status = ? WHERE order_id = ?",
                'si',
                [$status, $oid]
            );

            if ($status === 'Out for Delivery') {
                $this->execute(
                    "UPDATE deliveries SET status = 'Out for Delivery', dispatched_at = NOW()
                     WHERE order_id = ? AND rider_id = ?",
                    'ii',
                    [$oid, $riderId]
                );
            } else {
                $this->execute(
                    "UPDATE deliveries SET status = 'Arrived at Location'
                     WHERE order_id = ? AND rider_id = ?",
                    'ii',
                    [$oid, $riderId]
                );
            }

            $ord = $this->fetchOne(
                "SELECT user_id, order_number FROM orders WHERE order_id = ? LIMIT 1",
                'i',
                [$oid]
            );
            if ($ord) {
                $msg = $status === 'Out for Delivery'
                    ? "Your order #{$ord['order_number']} is now out for delivery! 🚴"
                    : "Your rider has arrived at your location for order #{$ord['order_number']}.";
                $this->notifications->send((int) $ord['user_id'], $msg, 'dispatched');
            }

            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'update_status', 'order', ?, ?)",
                'iis',
                [$riderId, $oid, "Rider set status to $status"]
            );

            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Complete an order delivery: set Completed, update delivery record, mark COD payment.
     */
    public function riderCompleteOrder(int $oid, int $riderId, string $proofUrl): void
    {
        $del = $this->fetchOne(
            "SELECT d.delivery_id, o.status, o.user_id, o.order_number, o.payment_method
             FROM deliveries d
             JOIN orders o ON o.order_id = d.order_id
             WHERE d.order_id = ? AND d.rider_id = ? LIMIT 1",
            'ii',
            [$oid, $riderId]
        );
        if (!$del) {
            throw new RuntimeException('Order not assigned to you.');
        }
        if (!in_array($del['status'], ['Out for Delivery', 'Arrived at Location'], true)) {
            throw new RuntimeException('Order must be Out for Delivery or Arrived at Location to complete.');
        }

        $this->beginTransaction();
        try {
            $this->execute(
                "UPDATE orders SET status = 'Completed' WHERE order_id = ?",
                'i',
                [$oid]
            );
            $this->execute(
                "UPDATE deliveries
                 SET status = 'Completed', delivered_at = NOW(), proof_of_delivery_url = ?
                 WHERE order_id = ? AND rider_id = ?",
                'sii',
                [$proofUrl ?: null, $oid, $riderId]
            );

            if (strtolower($del['payment_method'] ?? '') === 'cod') {
                $this->execute(
                    "UPDATE payments SET status = 'Paid', verified_by = ?, verified_at = NOW()
                     WHERE order_id = ? AND status = 'Unpaid'",
                    'ii',
                    [$riderId, $oid]
                );
            }

            $msg = "Your order #{$del['order_number']} has been delivered and completed. Thank you! 🎉";
            $this->notifications->send((int) $del['user_id'], $msg, 'general');

            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'complete_order', 'order', ?, 'Rider completed order')",
                'ii',
                [$riderId, $oid]
            );

            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Upload a proof-of-delivery URL to the delivery record.
     */
    public function uploadPod(int $oid, int $riderId, string $proofUrl): void
    {
        $this->execute(
            "UPDATE deliveries SET proof_of_delivery_url = ? WHERE order_id = ? AND rider_id = ?",
            'sii',
            [$proofUrl, $oid, $riderId]
        );
    }

    /**
     * Record a failed delivery and cancel the order.
     */
    public function failedDelivery(int $oid, int $riderId, string $reason, string $notes): void
    {
        $del = $this->fetchOne(
            "SELECT d.delivery_id, o.user_id, o.order_number, o.status
             FROM deliveries d
             JOIN orders o ON o.order_id = d.order_id
             WHERE d.order_id = ? AND d.rider_id = ? LIMIT 1",
            'ii',
            [$oid, $riderId]
        );
        if (!$del) {
            throw new RuntimeException('Order not assigned to you.');
        }
        if (!in_array($del['status'], ['Out for Delivery', 'Arrived at Location'], true)) {
            throw new RuntimeException('Order must be Out for Delivery or Arrived at Location.');
        }

        $this->beginTransaction();
        try {
            $this->execute(
                "UPDATE orders SET status = 'Cancelled' WHERE order_id = ?",
                'i',
                [$oid]
            );
            $this->execute(
                "UPDATE deliveries SET status = 'Failed' WHERE order_id = ? AND rider_id = ?",
                'ii',
                [$oid, $riderId]
            );
            $this->execute(
                "INSERT INTO cancellation_logs (order_id, initiated_by, reason, notes, created_at)
                 VALUES (?, ?, ?, ?, NOW())",
                'iiss',
                [$oid, $riderId, $reason, $notes]
            );

            $msg = "We were unable to deliver order #{$del['order_number']}. Reason: $reason. Our team will contact you shortly.";
            $this->notifications->send((int) $del['user_id'], $msg, 'general');

            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'failed_delivery', 'order', ?, ?)",
                'iis',
                [$riderId, $oid, "Reason: $reason"]
            );

            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }
}
