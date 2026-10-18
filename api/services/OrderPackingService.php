<?php
/**
 * OrderPackingService — Packing orders (admin and FIFO fulfillment) and out-of-stock handling.
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderPackingService extends BaseService
{
    private NotificationService $notifications;
    private InventoryService    $inventory;

    public function __construct(mysqli $conn)
    {
        parent::__construct($conn);
        $this->notifications = new NotificationService($conn);
        $this->inventory     = new InventoryService($conn);
    }

    /**
     * Pack an order (admin view): compute final totals, no batch FIFO deduction.
     */

        // getStockLevels method removed to resolve duplication with CartService.
    public function packOrderAdmin(int $oid, array $items, int $actorId): float
    {
        // Wrap the fulfillment packing logic which correctly handles FIFO deduction, OOS restoration, and variance
        $result = $this->packOrderFulfillment($oid, $items, $actorId);
        return $result['final_total'];
    }

    /**
     * Pack an order (fulfillment view): FIFO batch deduction + audit trail.
     *
     * @return array  ['final_total' => float, 'batch_alerts' => string[]]
     */
    public function packOrderFulfillment(int $oid, array $items, int $staffId): array
    {
        $this->beginTransaction();
        try {
            $finalSubtotalSum = 0.0;
            $batchAlerts      = [];

            foreach ($items as $item) {
                $itemId = (int) ($item['order_item_id'] ?? 0);
                if (!$itemId) {
                    continue;
                }

                $snap = $this->fetchOne(
                    "SELECT oi.unit_price, oi.pricing_model, oi.quantity, oi.product_id, oi.estimated_weight
                     FROM order_items oi WHERE oi.order_item_id = ? LIMIT 1",
                    'i',
                    [$itemId]
                );
                if (!$snap) {
                    continue;
                }

                $qty       = (int) $snap['quantity'];
                $unitPrice = (float) $snap['unit_price'];
                $pm        = $snap['pricing_model'] ?? 'fixed_pack';
                $productId = (int) $snap['product_id'];
                $estWeight = (float) $snap['estimated_weight'];

                if (!empty($item['out_of_stock'])) {
                    $this->execute(
                        "UPDATE order_items SET quantity = 0, actual_weight = 0, final_subtotal = 0 WHERE order_item_id = ?",
                        'i',
                        [$itemId]
                    );
                    
                    // Restore reserved stock for OOS item
                    $reservedQty = $pm === 'catch_weight' ? ($qty * $estWeight) : $qty;
                    if ($reservedQty > 0) {
                        $this->execute(
                            "UPDATE product_batches SET remaining_qty = remaining_qty + ? WHERE product_id = ? ORDER BY batch_date ASC LIMIT 1",
                            'di',
                            [$reservedQty, $productId]
                        );
                    }
                    continue;
                }

                if ($pm === 'catch_weight') {
                    $actualW = (float) ($item['actual_weight'] ?? 0);
                    if ($actualW <= 0) {
                        $actualW = $estWeight * $qty;
                    }

                    $finalSub = round($unitPrice * $actualW, 2);
                    $this->execute(
                        "UPDATE order_items SET actual_weight = ?, final_subtotal = ? WHERE order_item_id = ?",
                        'ddi',
                        [$actualW, $finalSub, $itemId]
                    );

                    // FIFO batch variance adjustment (placeOrder already reserved estWeight * qty)
                    $variance = $actualW - ($estWeight * $qty);
                    if ($variance > 0) {
                        $alerts = $this->inventory->fifoDeduct(
                            $productId,
                            $variance,
                            $staffId,
                            $itemId,
                            $item['batch_overrides'] ?? null
                        );
                        $batchAlerts = array_merge($batchAlerts, $alerts);
                    } elseif ($variance < 0) {
                        // Restore negative variance back to the oldest active batch
                        $this->execute(
                            "UPDATE product_batches SET remaining_qty = remaining_qty + ? WHERE product_id = ? ORDER BY batch_date ASC LIMIT 1",
                            'di',
                            [abs($variance), $productId]
                        );
                    }

                    // Weight-variance audit
                    $variance  = round($actualW - ($estWeight * $qty), 4);
                    $varDetail = "order_item_id=$itemId | est_weight=" . ($estWeight * $qty) .
                                 " | actual_weight=$actualW | variance=$variance";
                    $this->execute(
                        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                         VALUES (?, 'weight_variance', 'order_item', ?, ?)",
                        'iis',
                        [$staffId, $itemId, $varDetail]
                    );
                } else {
                    $finalSub = round($unitPrice * $qty, 2);
                    $this->execute(
                        "UPDATE order_items SET final_subtotal = ? WHERE order_item_id = ?",
                        'di',
                        [$finalSub, $itemId]
                    );
                }

                $finalSubtotalSum += $finalSub;
            }

            $ord        = $this->fetchOne(
                "SELECT delivery_fee, discount_amount, user_id, order_number FROM orders WHERE order_id = ? LIMIT 1",
                'i',
                [$oid]
            );
            
            // Cap the discount so it never exceeds the actual packed subtotal
            $appliedDiscount = min((float) $ord['discount_amount'], $finalSubtotalSum);
            $finalTotal = round($finalSubtotalSum - $appliedDiscount + (float) $ord['delivery_fee'], 2);

            $this->execute(
                "UPDATE orders SET status = 'Packed', final_total = ? WHERE order_id = ?",
                'di',
                [$finalTotal, $oid]
            );
            $this->execute(
                "UPDATE payments SET amount = ? WHERE order_id = ?",
                'di',
                [$finalTotal, $oid]
            );

            $this->notifications->send(
                (int) $ord['user_id'],
                "Your order {$ord['order_number']} has been packed. Final total: ₱$finalTotal",
                'packed'
            );

            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'pack_order', 'order', ?, ?)",
                'iis',
                [$staffId, $oid, "Order #$oid packed by staff #$staffId. Final total: $finalTotal"]
            );

            $this->commit();
            return ['final_total' => $finalTotal, 'batch_alerts' => $batchAlerts];
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Zero out one order item (out-of-stock) and recalculate the order total.
     */
    public function markOutOfStock(int $oid, int $itemId, int $staffId): float
    {
        $this->beginTransaction();
        try {
            $this->execute(
                "UPDATE order_items SET actual_weight = 0, final_subtotal = 0, quantity = 0
                 WHERE order_item_id = ? AND order_id = ?",
                'ii',
                [$itemId, $oid]
            );

            $allItems = $this->fetchAll(
                "SELECT order_item_id, final_subtotal, estimated_subtotal, quantity
                 FROM order_items WHERE order_id = ?",
                'i',
                [$oid]
            );
            $totalItems = 0.0;
            foreach ($allItems as $i) {
                if ((int) $i['order_item_id'] === $itemId || (int) $i['quantity'] === 0) {
                    continue;
                }
                $sub         = (float) $i['final_subtotal'] > 0 ? (float) $i['final_subtotal'] : (float) $i['estimated_subtotal'];
                $totalItems += $sub;
            }

            $ord      = $this->fetchOne(
                "SELECT delivery_fee, discount_amount, user_id, order_number FROM orders WHERE order_id = ? LIMIT 1",
                'i',
                [$oid]
            );
            
            // Cap the discount so it never exceeds the actual remaining subtotal, preventing freebies
            $appliedDiscount = min((float) $ord['discount_amount'], $totalItems);
            $newTotal = round($totalItems - $appliedDiscount + (float) $ord['delivery_fee'], 2);
            if ($newTotal < 0) {
                $newTotal = 0.0;
            }

            $this->execute(
                "UPDATE orders SET final_total = ? WHERE order_id = ?",
                'di',
                [$newTotal, $oid]
            );
            $this->execute(
                "UPDATE payments SET amount = ? WHERE order_id = ?",
                'di',
                [$newTotal, $oid]
            );

            $detail = "order_item_id=$itemId marked Out of Stock by staff $staffId. New total: $newTotal";
            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'mark_out_of_stock', 'order_item', ?, ?)",
                'iis',
                [$staffId, $itemId, $detail]
            );

            $this->notifications->send(
                (int) $ord['user_id'],
                "We could not fulfil an item in order {$ord['order_number']} (out of stock). Your updated total is ₱$newTotal.",
                'partial_fulfillment'
            );

            $this->commit();
            return $newTotal;
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }
}
