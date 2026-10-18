<?php
/**
 * OrderModificationService — Editing an existing order: customer edits of pending orders and admin edits.
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderModificationService extends BaseService
{
    private NotificationService $notifications;

    public function __construct(mysqli $conn)
    {
        parent::__construct($conn);
        $this->notifications = new NotificationService($conn);
    }

/**
     * Allow a customer to edit a Pending order's date, slot, zone, payment method,
     * and special instructions. Items are not editable here (cancel and reorder instead).
     *
     * @throws RuntimeException if the order is not Pending or does not belong to the user.
     */
public function updatePendingOrder(
        int    $orderId,
        int    $uid,
        string $deliveryDate,
        int    $slotId,
        int    $zoneId,
        string $paymentMethod,
        string $specialInstructions
    ): void {
        $order = $this->fetchOne(
            "SELECT o.order_id, o.status, o.user_id
             FROM orders o
             WHERE o.order_id = ? LIMIT 1",
            'i',
            [$orderId]
        );
        if (!$order) {
            throw new RuntimeException('Order not found.');
        }
        if ((int) $order['user_id'] !== $uid) {
            throw new RuntimeException('You do not have permission to edit this order.');
        }
        if ($order['status'] !== 'Pending') {
            throw new RuntimeException('Only Pending orders can be edited. This order is already ' . $order['status'] . '.');
        }
if (!in_array($paymentMethod, ['COD', 'GCash'], true)) {
            throw new RuntimeException('Invalid payment method.');
        }

        // Validate delivery date (same as placeOrder)
        $today = date('Y-m-d');
        if ($deliveryDate < $today) {
            throw new RuntimeException('Delivery date cannot be in the past.');
        }
        $dow = date('w', strtotime($deliveryDate));
        $operationalDay = $this->fetchOne(
            "SELECT day_of_week FROM operational_hours WHERE day_of_week = ? AND is_active = 1 LIMIT 1",
            'i',
            [$dow]
        );
        if (!$operationalDay) {
            throw new RuntimeException('Delivery is not available on the selected date.');
        }

        // Validate time slot (same as placeOrder)
        if ($slotId > 0) {
            $slot = $this->fetchOne(
                "SELECT slot_id, start_time, is_active FROM time_slots WHERE slot_id = ? LIMIT 1",
                'i',
                [$slotId]
            );
            if (!$slot || !$slot['is_active']) {
                throw new RuntimeException('Selected time slot is not available.');
            }
            if ($deliveryDate === $today) {
                $currentTime = date('H:i:s');
                if ($currentTime >= $slot['start_time']) {
                    throw new RuntimeException('The selected time slot has already passed for today.');
                }
            }
        }

        // Recalculate delivery fee AND verify zone matches address

        // Validate zone matches address (prevent zone manipulation)
// Recalculate delivery fee AND verify zone matches address
        $deliveryFee = 0.0;
        if ($zoneId > 0) {
            // Resolve address municipality so we can enforce the same zone-match rule
            // as placeOrder (prevents fee manipulation via crafted zone_id).
            $addrRow = $this->fetchOne(
                "SELECT a.municipality_id
                 FROM orders o
                 JOIN addresses a ON a.address_id = o.address_id
                 WHERE o.order_id = ? LIMIT 1",
                'i',
                [$orderId]
            );
            $zone = $this->fetchOne(
                "SELECT zone_id, delivery_fee FROM delivery_zones
                 WHERE zone_id = ? AND municipality_id = ? LIMIT 1",
                'ii',
                [$zoneId, (int) ($addrRow['municipality_id'] ?? 0)]
            );
            if (!$zone) {
                throw new RuntimeException('Delivery zone does not match your order address.');
            }
            $deliveryFee = (float) $zone['delivery_fee'];
        }

        // Fetch current subtotals of all items since items don't change in this flow
        $subtotalRow = $this->fetchOne(
            "SELECT COALESCE(SUM(estimated_subtotal), 0) AS sub FROM order_items WHERE order_id = ?",
            'i',
            [$orderId]
        );
        $itemSubtotal = (float) ($subtotalRow['sub'] ?? 0.0);

        // Re-validate promo against new subtotal to prevent promo abuse on zone changes
        $promoId    = null;
        $discount   = 0.0;
        $promoRow   = $this->fetchOne("SELECT promo_id, discount_amount FROM orders WHERE order_id = ? LIMIT 1", 'i', [$orderId]);
        if ($promoRow && $promoRow['promo_id']) {
            $promoId  = (int) $promoRow['promo_id'];
            $discount = min((float) $promoRow['discount_amount'], $itemSubtotal); // cap discount
        }
        $newTotal = max(0.0, round($itemSubtotal - $discount + $deliveryFee, 2));

        $this->execute(
            "UPDATE orders
             SET delivery_date        = ?,
                 slot_id              = ?,
                 zone_id              = ?,
                 delivery_fee         = ?,
                 estimated_total      = ?,
                 discount_amount      = ?,
                 payment_method       = ?,
                 special_instructions = ?,
                 updated_at           = NOW()
             WHERE order_id = ?",
            'siidddss' . 'i',
            [$deliveryDate, $slotId ?: null, $zoneId ?: null,
             $deliveryFee, $newTotal, $discount, $paymentMethod, $specialInstructions, $orderId]
        );

        // Ensure the payment ledger is updated with the new total and method
        $this->execute(
            "UPDATE payments SET amount = ?, method = ? WHERE order_id = ?",
            'dsi',
            [$newTotal, $paymentMethod, $orderId]
        );

        $updatedOrder = $this->fetchOne("SELECT order_number FROM orders WHERE order_id = ? LIMIT 1", 'i', [$orderId]);
        $this->notifications->send(
            $uid,
            "Your order #{$updatedOrder['order_number']} has been updated.",
            'order_updated'
        );
    }

    /**
     * Update an order's status (admin).
     */
    /**
     * Super-Admin order override: update item quantities, promo code, and/or schedule.
     *
     * - Re-calculates estimated_subtotal for every item whose quantity changed.
     * - Re-calculates estimated_total (sum of subtotals + delivery_fee - discount).
     * - Applies / removes promo code.
     * - Updates delivery_date and slot_id when supplied.
     * - Writes one audit-log row and notifies the customer.
     *
     * @throws RuntimeException on validation failure.
     */
    public function adminEditOrder(
        int    $orderId,
        array  $items,
        ?string $promoCode,
        ?string $deliveryDate,
        ?int   $slotId,
        int    $adminId
    ): void {
        $order = $this->fetchOne(
            "SELECT o.order_id, o.status, o.user_id, o.delivery_fee,
                    o.estimated_total, o.discount_amount, o.promo_id
             FROM orders o
             WHERE o.order_id = ? LIMIT 1",
            'i',
            [$orderId]
        );
        if (!$order) {
            throw new RuntimeException('Order not found.');
        }
        if (in_array($order['status'], ['Completed', 'Cancelled'], true)) {
            throw new RuntimeException('Completed or cancelled orders cannot be edited.');
        }

        foreach ($items as $it) {
            $itemId = (int) ($it['order_item_id'] ?? 0);
            $newQty = (int) ($it['quantity']      ?? 0);
            if ($itemId <= 0) {
                continue;
            }

            $row = $this->fetchOne(
                "SELECT oi.order_item_id, oi.unit_price, oi.pricing_model,
                        oi.estimated_weight, oi.quantity AS old_qty, oi.product_id
                 FROM order_items oi
                 WHERE oi.order_item_id = ? AND oi.order_id = ? LIMIT 1",
                'ii',
                [$itemId, $orderId]
            );
            if (!$row) {
                continue;
            }

            $unitPrice  = (float) $row['unit_price'];
            $estWeight  = (float) $row['estimated_weight'];
            $estSub     = $row['pricing_model'] === 'catch_weight'
                ? round($newQty * $estWeight * $unitPrice, 2)
                : round($newQty * $unitPrice, 2);

            $this->execute(
                "UPDATE order_items
                 SET quantity = ?, estimated_subtotal = ?
                 WHERE order_item_id = ? AND order_id = ?",
                'idii',
                [$newQty, $estSub, $itemId, $orderId]
            );

            $oldQty    = (int) $row['old_qty'];
            $productId = (int) $row['product_id'];
            $delta     = $newQty - $oldQty; // positive = more needed, negative = some freed

            if ($delta !== 0) {
                $deltaStock = $row['pricing_model'] === 'catch_weight'
                    ? abs($delta) * $estWeight
                    : (float) abs($delta);

                if ($delta > 0) {
                    // Admin increased qty — deduct extra from oldest batch
                    $batches = $this->fetchAll(
                        "SELECT batch_id, remaining_qty FROM product_batches
                         WHERE product_id = ? AND remaining_qty > 0 ORDER BY batch_date ASC",
                        'i', [$productId]
                    );
                    $need = $deltaStock;
                    foreach ($batches as $b) {
                        if ($need <= 0) break;
                        $deduct = min($need, (float) $b['remaining_qty']);
                        $this->execute(
                            "UPDATE product_batches SET remaining_qty = remaining_qty - ? WHERE batch_id = ?",
                            'di', [$deduct, (int) $b['batch_id']]
                        );
                        $need -= $deduct;
                    }
                } else {
                    // Admin decreased qty — restore freed stock to oldest batch
                    $batch = $this->fetchOne(
                        "SELECT batch_id FROM product_batches WHERE product_id = ? ORDER BY batch_date ASC LIMIT 1",
                        'i', [$productId]
                    );
                    if ($batch) {
                        $this->execute(
                            "UPDATE product_batches SET remaining_qty = remaining_qty + ? WHERE batch_id = ?",
                            'di', [$deltaStock, (int) $batch['batch_id']]
                        );
                    }
                }
                $this->execute(
                    "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                     VALUES (?, 'admin_qty_adjustment', 'order_item', ?, ?)",
                    'iis',
                    [$adminId, $itemId, "Qty changed from {$oldQty} to {$newQty}, stock delta={$delta} for product #{$productId}"]
                );
            }
        }

        $sumRow   = $this->fetchOne(
            "SELECT COALESCE(SUM(estimated_subtotal), 0) AS subtotal_sum
             FROM order_items WHERE order_id = ?",
            'i',
            [$orderId]
        );
        $subtotal    = (float) $sumRow['subtotal_sum'];
        $deliveryFee = (float) $order['delivery_fee'];

        $discount = 0.0;
        $promoId  = null;

        if ($promoCode !== null && trim($promoCode) !== '') {
            $pc = strtoupper(trim($promoCode));
            $promo = $this->fetchOne(
                "SELECT pc.promo_id, pc.is_active, pc.valid_to,
                        pc.usage_limit, pc.discount_type, pc.discount_value,
                        pc.min_order_value,
                        (SELECT COUNT(*) FROM orders
                         WHERE promo_id = pc.promo_id
                           AND status NOT IN ('Cancelled')
                           AND order_id <> ?) AS times_used
                 FROM promo_codes pc WHERE pc.code = ? LIMIT 1",
                'is',
                [$orderId, $pc]
            );
            if (!$promo) {
                throw new RuntimeException("Promo code \"{$pc}\" does not exist.");
            }
            if (!$promo['is_active']) {
                throw new RuntimeException("Promo code \"{$pc}\" is no longer active.");
            }
            if ($promo['valid_to'] && date('Y-m-d') > $promo['valid_to']) {
                throw new RuntimeException("Promo code \"{$pc}\" has expired.");
            }
            if ($promo['usage_limit'] !== null
                && (int) $promo['times_used'] >= (int) $promo['usage_limit']) {
                throw new RuntimeException("Promo code \"{$pc}\" has reached its usage limit.");
            }
            if ($subtotal < (float) $promo['min_order_value']) {
                throw new RuntimeException(
                    "Order subtotal must be at least ₱" .
                    number_format($promo['min_order_value'], 2) .
                    " to use promo code \"{$pc}\"."
                );
            }
            $promoId  = (int) $promo['promo_id'];
            $discount = $promo['discount_type'] === 'percentage'
                ? round($subtotal * (float) $promo['discount_value'] / 100, 2)
                : (float) $promo['discount_value'];
            $discount = min($discount, $subtotal);
        }
        // promoCode === null means "leave promo as-is"; empty string means "remove promo"
        $clearPromo = ($promoCode !== null && trim($promoCode) === '');
        if ($clearPromo) {
            $promoId  = null;
            $discount = 0.0;
        } elseif ($promoCode === null) {
            // keep existing promo
            $promoId  = $order['promo_id'] ? (int) $order['promo_id'] : null;
            $discount = (float) $order['discount_amount'];
        }

        $newTotal = max(0.0, round($subtotal + $deliveryFee - $discount, 2));

        $setParts  = [
            'estimated_total  = ?',
            'discount_amount  = ?',
            'promo_id         = ?',
            'updated_at       = NOW()',
        ];
        $types  = 'ddi';
        $params = [$newTotal, $discount, $promoId];

        if ($deliveryDate !== null && $deliveryDate !== '') {
            $setParts[] = 'delivery_date = ?';
            $types     .= 's';
            $params[]   = $deliveryDate;
        }
        if ($slotId !== null && $slotId > 0) {
            $setParts[] = 'slot_id = ?';
            $types     .= 'i';
            $params[]   = $slotId;
        }

        $params[] = $orderId;
        $types   .= 'i';
        $this->execute(
            "UPDATE orders SET " . implode(', ', $setParts) . " WHERE order_id = ?",
            $types,
            $params
        );

        // Keep payment ledger in sync
        $this->execute(
            "UPDATE payments SET amount = ? WHERE order_id = ?",
            'di',
            [$newTotal, $orderId]
        );

        $detail = "Admin override: qty/promo/schedule updated. "
                . "new_total={$newTotal} discount={$discount}";
        $this->execute(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, 'admin_edit_order', 'order', ?, ?)",
            'iis',
            [$adminId, $orderId, $detail]
        );

        $num = $this->fetchOne(
            "SELECT order_number FROM orders WHERE order_id = ? LIMIT 1",
            'i',
            [$orderId]
        );
        if ($num) {
            $this->notifications->send(
                (int) $order['user_id'],
                "Your order {$num['order_number']} was updated by an administrator.",
                'general'
            );
        }
    }
}
