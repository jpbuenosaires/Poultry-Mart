<?php
/**
 * OrderCheckoutService — Customer order placement (stock locking, promo, proof upload, notifications).
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderCheckoutService extends BaseService
{
    private NotificationService $notifications;

    public function __construct(mysqli $conn)
    {
        parent::__construct($conn);
        $this->notifications = new NotificationService($conn);
    }

    /**
     * Place a new order from a user's cart.
     */
public function placeOrder(
        int    $uid,
        int    $addressId,
        int    $slotId,
        int    $zoneId,
        string $paymentMethod,
        string $deliveryDate,
        string $specialInstructions,
        string $promoCode,
        ?string $gcashReference = null,
        ?string $gcashReceiptBase64 = null
    ): array {
// Verify address ownership
        $addressCheck = $this->fetchOne(
            "SELECT address_id, barangay_id, municipality_id FROM addresses WHERE address_id = ? AND user_id = ? LIMIT 1",
            'ii',
            [$addressId, $uid]
        );
        if (!$addressCheck) {
            throw new RuntimeException('Invalid address selection. Please choose one of your saved addresses.');
        }

        // Load cart
        $cart = $this->fetchOne(
            "SELECT cart_id FROM carts WHERE user_id = ? LIMIT 1",
            'i',
            [$uid]
        );
        if (!$cart) {
            throw new RuntimeException('Cart not found.');
        }
        $cartId = (int) $cart['cart_id'];

        $cartItems = $this->fetchAll(
            "SELECT ci.cart_item_id, ci.product_id, ci.quantity,
                    p.name, p.base_price, p.pricing_model, p.estimated_weight, p.unit_of_measure
             FROM cart_items ci
             JOIN products p ON p.product_id = ci.product_id
             WHERE ci.cart_id = ?",
            'i',
            [$cartId]
        );

        if (empty($cartItems)) {
            throw new RuntimeException('Cart is empty.');
        }
 
        // [NEW] Reject order if any product is archived
        $productIds   = array_map(fn($i) => (int) $i['product_id'], $cartItems);
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $types        = str_repeat('i', count($productIds));
        $archivedRows = $this->fetchAll(
            "SELECT name FROM products
             WHERE product_id IN ($placeholders) AND status = 'archived'",
            $types,
            $productIds
        );
        if (!empty($archivedRows)) {
            $names = implode(', ', array_column($archivedRows, 'name'));
            throw new RuntimeException(
                "The following item(s) are no longer available and must be removed from your cart before checking out: $names"
            );
        }

// Stock validation with row-level locking to prevent overselling
        $this->beginTransaction();
        try {
            // Sort IDs to prevent MySQL deadlocks during concurrent multi-item checkouts
            sort($productIds);
            $stockPlaceholders = implode(',', array_fill(0, count($productIds), '?'));
            $stockRows = $this->fetchAll(
                "SELECT product_id, COALESCE(SUM(remaining_qty), 0) AS total
                 FROM product_batches
                 WHERE product_id IN ($stockPlaceholders)
                 GROUP BY product_id
                 FOR UPDATE",
                str_repeat('i', count($productIds)),
                $productIds
            );

            $stockMap = [];
            foreach ($stockRows as $sr) {
                $stockMap[(int) $sr['product_id']] = (float) $sr['total'];
            }

            $shortItems = [];
            foreach ($cartItems as $item) {
                $pid       = (int) $item['product_id'];
                $available = $stockMap[$pid] ?? 0.0;
                if ((float) $item['quantity'] > $available) {
                    $shortItems[] = $item['name'] . ' (available: ' . floor($available) . ', requested: ' . $item['quantity'] . ')';
                }
            }

            if (!empty($shortItems)) {
                $this->rollback();
                throw new RuntimeException(
                    'Insufficient stock for the following item(s): ' . implode('; ', $shortItems) .
                    '. Please update your cart before checking out.'
                );
            }

            // Delivery Fee — look up the zone by ID and strictly enforce municipality match
            $deliveryFee = 0.0;
            if ($zoneId > 0) {
                $zone = $this->fetchOne(
                    "SELECT zone_id, delivery_fee FROM delivery_zones WHERE zone_id = ? AND municipality_id = ? LIMIT 1",
                    'ii',
                    [$zoneId, $addressCheck['municipality_id']]
                );
                if (!$zone) {
                    throw new RuntimeException('Delivery zone manipulation detected or zone is invalid. Please refresh and try again.');
                }
                $deliveryFee = (float) $zone['delivery_fee'];
            }

            // Estimated total
            $estTotal = 0.0;
            foreach ($cartItems as &$item) {
                $pid = (int) $item['product_id'];
                $qty = (int) $item['quantity'];
                
                $tier = $this->fetchOne(
                    "SELECT tier_unit_price FROM wholesale_tiers WHERE product_id = ? AND min_qty <= ? ORDER BY min_qty DESC LIMIT 1",
                    'ii',
                    [$pid, $qty]
                );
                
                $unitPrice = $tier ? (float) $tier['tier_unit_price'] : (float) $item['base_price'];
                $item['resolved_price'] = $unitPrice;

                $estTotal += CartService::estimatedSubtotal(
                    $item['pricing_model'],
                    $qty,
                    $unitPrice,
                    (float) $item['estimated_weight']
                );
            }
            unset($item);

            // Promo validation
            $discount = 0.0;
            $promoId  = null;

            if ($promoCode !== '') {
                $promoExists = $this->fetchOne(
                    "SELECT pc.promo_id, pc.is_active, pc.valid_from, pc.valid_to,
                            pc.usage_limit, pc.discount_type, pc.discount_value, pc.min_order_value,
                            (SELECT COUNT(*) FROM orders
                             WHERE promo_id = pc.promo_id
                               AND status NOT IN ('Cancelled')) AS times_used
                     FROM promo_codes pc WHERE pc.code = ? FOR UPDATE LIMIT 1",
                    's',
                    [strtoupper($promoCode)]
                );
                if (!$promoExists) {
                    throw new RuntimeException("Promo code \"{$promoCode}\" does not exist.");
                }
                $today = date('Y-m-d');
                if (!$promoExists['is_active']) {
                    throw new RuntimeException("Promo code \"{$promoCode}\" is no longer active.");
                }
                if ($promoExists['valid_to'] && $today > $promoExists['valid_to']) {
                    throw new RuntimeException("Promo code \"{$promoCode}\" has expired.");
                }
                if ($promoExists['usage_limit'] !== null
                    && (int) $promoExists['times_used'] >= (int) $promoExists['usage_limit']) {
                    throw new RuntimeException("Promo code \"{$promoCode}\" has reached its usage limit.");
                }
                if ($estTotal < (float) $promoExists['min_order_value']) {
                    throw new RuntimeException(
                        "Your cart total must be at least ₱" .
                        number_format($promoExists['min_order_value'], 2) .
                        " to use promo code \"{$promoCode}\"."
                    );
                }
                $promoId  = (int) $promoExists['promo_id'];
                $discount = $promoExists['discount_type'] === 'percentage'
                    ? round($estTotal * (float) $promoExists['discount_value'] / 100, 2)
                    : (float) $promoExists['discount_value'];
                $discount = min($discount, $estTotal);
            }

            // Validate delivery date
            $today = date('Y-m-d');
            if ($deliveryDate < $today) {
                throw new RuntimeException('Delivery date cannot be in the past.');
            }
            $dow            = date('w', strtotime($deliveryDate));
            $operationalDay = $this->fetchOne(
                "SELECT day_of_week FROM operational_hours
                 WHERE day_of_week = ? AND is_active = 1 LIMIT 1",
                'i',
                [$dow]
            );
            if (!$operationalDay) {
                throw new RuntimeException('Delivery is not available on the selected date. Please choose a day when the store is open.');
            }

            // Validate time slot
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
                        throw new RuntimeException('The selected time slot has already passed for today. Please choose a later slot or a future date.');
                    }
                }
            }

            $estimatedTotal = round($estTotal - $discount + $deliveryFee, 2);
            $orderNumber    = 'PM-' . strtoupper(substr(md5(uniqid('', true)), 0, 8));

            $oid = $this->insertGetId(
                "INSERT INTO orders
                     (user_id, address_id, promo_id, zone_id, slot_id,
                      order_number, delivery_date, estimated_total,
                      discount_amount, delivery_fee, payment_method,
                      special_instructions, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')",
                'iiiiissdddss',
                [
                    $uid, $addressId,
                    $promoId ?: null, $zoneId ?: null, $slotId ?: null,
                    $orderNumber, $deliveryDate, $estimatedTotal,
                    $discount, $deliveryFee, $paymentMethod, $specialInstructions,
                ]
            );

            foreach ($cartItems as $item) {
                $qty       = (int) $item['quantity'];
                $unitPrice = (float) ($item['resolved_price'] ?? $item['base_price']);
                $estWeight = (float) $item['estimated_weight'];
                $pm        = $item['pricing_model'];
                $estSub    = CartService::estimatedSubtotal($pm, $qty, $unitPrice, $estWeight);
                $pid       = (int) $item['product_id'];

                $orderItemId = $this->insertGetId(
                    "INSERT INTO order_items
                         (order_id, product_id, quantity, unit_price, pricing_model,
                          estimated_weight, estimated_subtotal)
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    'iiidsdd',
                    [$oid, $pid, $qty, $unitPrice, $pm, $estWeight, $estSub]
                );

                $remaining = $pm === 'catch_weight' ? (float) ($qty * $estWeight) : (float) $qty;
                $batches   = $this->fetchAll(
                    "SELECT batch_id, remaining_qty
                     FROM product_batches
                     WHERE product_id = ? AND remaining_qty > 0
                     ORDER BY batch_date ASC",
                    'i',
                    [$pid]
                );

                foreach ($batches as $batch) {
                    if ($remaining <= 0) break;
                    $batchId   = (int) $batch['batch_id'];
                    $available = (float) $batch['remaining_qty'];
                    $deduct    = min($remaining, $available);
                    $newQty    = $available - $deduct;
                    $this->execute(
                        "UPDATE product_batches SET remaining_qty = ? WHERE batch_id = ?",
                        'di',
                        [$newQty, $batchId]
                    );
                    $remaining -= $deduct;
                    $this->execute(
                        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                         VALUES (?, 'stock_reservation', 'product_batch', ?, ?)",
                        'iis',
                        [$uid, $batchId, "Reserved {$deduct} units for order_item #{$orderItemId} (order pending)"]
                    );
                }

                if ($remaining > 0) {
                    throw new RuntimeException("Stock reservation failed for {$item['name']}. Please contact support.");
                }
            }

            $receiptPath = null;
            if ($paymentMethod === 'GCash' && $gcashReceiptBase64) {
                if (preg_match('/^data:image\/(\w+);base64,/', $gcashReceiptBase64, $matches)) {
                    $b64 = substr($gcashReceiptBase64, strpos($gcashReceiptBase64, ',') + 1);
                } else {
                    $b64 = $gcashReceiptBase64;
                }
                $b64     = str_replace(' ', '+', $b64);
                $decoded = base64_decode($b64, true);
                if ($decoded === false) {
                    throw new RuntimeException('Invalid receipt file: could not decode the uploaded image.');
                }
                $info = @getimagesizefromstring($decoded);
                if ($info === false || !in_array($info['mime'], ['image/jpeg','image/png','image/gif','image/webp'], true)) {
                    throw new RuntimeException('Invalid receipt file: only JPEG, PNG, GIF, or WebP images are accepted.');
                }
                $uploadsDir = __DIR__ . '/../../uploads/receipts';
                if (!is_dir($uploadsDir)) {
                    mkdir($uploadsDir, 0755, true);
                }
                $ext      = explode('/', $info['mime'])[1];
                $ext      = $ext === 'jpeg' ? 'jpg' : $ext;
                $filename = 'gcash_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                file_put_contents($uploadsDir . '/' . $filename, $decoded);
                $receiptPath = 'uploads/receipts/' . $filename;
            }

            $this->execute(
                "INSERT INTO payments (order_id, amount, method, status, gcash_reference, gcash_screenshot) VALUES (?, ?, ?, 'Unpaid', ?, ?)",
                'idsss',
                [$oid, $estimatedTotal, $paymentMethod, $gcashReference ?: null, $receiptPath]
            );

            // Removed the UPDATE query for times_used. 
            // Usage limit is dynamically calculated via COUNT() on the orders table, 
            // so inserting the order above naturally increments the usage.

            $this->execute(
                "DELETE FROM cart_items WHERE cart_id = ?",
                'i',
                [$cartId]
            );

            $this->notifications->send(
                $uid,
                "Your order #$orderNumber has been placed! Estimated total: ₱$estimatedTotal",
                'order_placed'
            );

            $this->commit();
            return [
                'order_id'        => $oid,
                'order_number'    => $orderNumber,
                'estimated_total' => $estimatedTotal,
            ];
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }
}
