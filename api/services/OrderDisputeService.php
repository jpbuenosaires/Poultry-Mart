<?php
/**
 * OrderDisputeService — Customer disputes, failed-delivery returns, restock and spoilage.
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderDisputeService extends BaseService
{
    /**
     * File a customer dispute against a completed order.
     */
    public function fileDispute(int $uid, int $oid, string $description, string $evidenceUrl): int
    {
        $ord = $this->fetchOne(
            "SELECT status FROM orders WHERE order_id = ? AND user_id = ? LIMIT 1",
            'ii',
            [$oid, $uid]
        );
        if (!$ord) {
            throw new RuntimeException('Order not found.');
        }
        if ($ord['status'] !== 'Completed') {
            throw new RuntimeException('Disputes can only be filed for completed orders.');
        }

        $existing = $this->fetchOne("SELECT dispute_id FROM disputes WHERE order_id = ? LIMIT 1", 'i', [$oid]);
        if ($existing) {
            throw new RuntimeException('A dispute has already been filed for this order.');
        }

        return $this->insertGetId(
            "INSERT INTO disputes (order_id, user_id, description, evidence_url, status)
             VALUES (?, ?, ?, ?, 'Open')",
            'iiss',
            [$oid, $uid, $description, $evidenceUrl ?: null]
        );
    }

    /**
     * Get a single dispute by ID.
     */
    public function getDispute(int $id): ?array
    {
        return $this->fetchOne(
            "SELECT di.dispute_id, di.order_id, di.status, di.description,
                    di.evidence_url, di.created_at, di.resolved_at, di.resolution_notes,
                    o.order_number, u.first_name, u.last_name, u.email, u.phone
             FROM disputes di
             JOIN orders o ON o.order_id = di.order_id
             JOIN users  u ON u.user_id  = di.user_id
             WHERE di.dispute_id = ? LIMIT 1",
            'i', [$id]
        );
    }

    /**
     * Get disputes with optional status filter.
     */
    public function getDisputes(string $status, int $page, int $limit): array
    {
        $cond   = ['1=1'];
        $types  = '';
        $params = [];
        if ($status !== '') {
            $cond[] = 'di.status = ?';
            $types .= 's';
            $params[] = $status;
        }
        $where  = implode(' AND ', $cond);
        $offset = ($page - 1) * $limit;
        $countRow = $this->fetchOne(
            "SELECT COUNT(*) AS n FROM disputes di WHERE $where",
            $types, $params
        );
        $total = (int) ($countRow['n'] ?? 0);
        $rows  = $this->fetchAll(
            "SELECT di.dispute_id, di.order_id, di.status, di.description,
                    di.evidence_url, di.created_at, di.resolved_at, di.resolution_notes,
                    o.order_number, u.first_name, u.last_name
             FROM disputes di
             JOIN orders o ON o.order_id = di.order_id
             JOIN users  u ON u.user_id  = di.user_id
             WHERE $where
             ORDER BY (CASE WHEN di.status = 'Open' THEN 1 ELSE 2 END) ASC, di.created_at DESC
             LIMIT ? OFFSET ?",
            $types . 'ii', array_merge($params, [$limit, $offset])
        );
        return [
            'disputes' => $rows, 
            'total' => $total, 
            'page' => $page,
            'pages' => (int) ceil($total / max(1, $limit))
        ];
    }

    /**
     * Count open or under review disputes.
     */
    public function countOpenDisputes(): int
    {
        $row = $this->fetchOne(
            "SELECT COUNT(*) AS n FROM disputes WHERE status IN ('Open', 'Under Review')"
        );
        return (int)($row['n'] ?? 0);
    }

    /**
     * Update dispute status and resolution notes.
     */
    public function updateDispute(int $disputeId, string $status, string $notes, int $adminId): void
    {
        $resolvedAt = in_array($status, ['Resolved', 'Rejected']) ? 'NOW()' : 'NULL';
        $this->execute(
            "UPDATE disputes SET status=?, resolved_at=$resolvedAt, resolution_notes=?,
             resolved_by=? WHERE dispute_id=?",
            'ssii', [$status, $notes, $adminId, $disputeId]
        );
        $this->execute(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, 'update_dispute', 'dispute', ?, ?)",
            'iis', [$adminId, $disputeId, "Status updated to $status" . ($notes ? " with notes: $notes" : "")]
        );
    }

    /**
     * Get failed returns for the admin returns page.
     */
    public function getFailedReturns(int $page, int $limit): array
    {
        $offset   = ($page - 1) * $limit;
        $countRow = $this->fetchOne(
            "SELECT COUNT(*) AS n
             FROM orders o
             JOIN users u ON u.user_id = o.user_id
             JOIN deliveries d ON d.order_id = o.order_id
             WHERE o.status = 'Cancelled'
               AND d.status = 'Failed'"
        );
        $total = (int) ($countRow['n'] ?? 0);
        $rows  = $this->fetchAll(
            "SELECT o.order_id, o.order_number, o.status, o.final_total,
                    o.estimated_total, o.delivery_date, o.created_at,
                    o.payment_method,
                    u.first_name, u.last_name,
                    d.status AS delivery_status, d.delivered_at,
                    CONCAT(ru.first_name, ' ', ru.last_name) AS rider_name,                       
                    cl.reason AS failed_delivery_reason
             FROM orders o
             JOIN users u ON u.user_id = o.user_id
             LEFT JOIN deliveries d ON d.order_id = o.order_id
             LEFT JOIN users ru ON ru.user_id = d.rider_id
             LEFT JOIN cancellation_logs cl ON cl.order_id = o.order_id
             WHERE o.status = 'Cancelled'
             GROUP BY o.order_id
             ORDER BY o.created_at DESC
             LIMIT ? OFFSET ?",
            'ii',
            [$limit, $offset]
        );
        return [
            'orders' => $rows,
            'total'  => $total,
            'page'   => $page,
            'pages'  => (int) ceil($total / max(1, $limit)),
        ];
    }

    public function countFailedReturns(): int
    {
        $row = $this->fetchOne(
            "SELECT COUNT(*) AS n
             FROM orders o
             JOIN users u ON u.user_id = o.user_id
             WHERE o.status = 'Cancelled'"
        );
        return (int)($row['n'] ?? 0);
    }

    /**
     * Restock items from a cancelled/failed order.
     */
    public function restockOrder(int $oid, int $adminId): void
    {
        $items = $this->fetchAll(
            "SELECT oi.product_id, oi.quantity, oi.pricing_model, oi.estimated_weight,
                    oi.actual_weight
             FROM order_items oi
             WHERE oi.order_id = ? AND oi.quantity > 0",
            'i',
            [$oid]
        );
        $this->beginTransaction();
        try {
            foreach ($items as $item) {
                $pid = (int) $item['product_id'];
                $qty = $item['pricing_model'] === 'catch_weight'
                    ? (float) ($item['actual_weight'] ?: ($item['quantity'] * $item['estimated_weight']))
                    : (float) $item['quantity'];
                if ($qty <= 0) continue;
                $batch = $this->fetchOne(
                    "SELECT batch_id FROM product_batches WHERE product_id = ? ORDER BY batch_date ASC LIMIT 1",
                    'i',
                    [$pid]
                );
                if (!$batch) continue;
                $this->execute(
                    "UPDATE product_batches SET remaining_qty = remaining_qty + ? WHERE batch_id = ?",
                    'di',
                    [$qty, (int) $batch['batch_id']]
                );
                $this->execute(
                    "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                     VALUES (?, 'restock_return', 'order', ?, ?)",
                    'iis',
                    [$adminId, $oid, "Restocked {$qty} units for product #{$pid} from order #{$oid}"]
                );
            }
            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }

    /**
     * Mark items from a failed order as spoiled instead of restocking.
     */
    public function markSpoiled(int $oid, int $adminId, string $notes): void
    {
        $items = $this->fetchAll(
            "SELECT oi.product_id, oi.quantity, oi.pricing_model, oi.estimated_weight
             FROM order_items oi WHERE oi.order_id = ? AND oi.quantity > 0",
            'i',
            [$oid]
        );
        $this->beginTransaction();
        try {
            foreach ($items as $item) {
                $pid = (int) $item['product_id'];
                $qty = $item['pricing_model'] === 'catch_weight'
                    ? (float) ($item['quantity'] * $item['estimated_weight'])
                    : (float) $item['quantity'];
                $this->execute(
                    "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                     VALUES (?, 'mark_spoiled', 'order', ?, ?)",
                    'iis',
                    [$adminId, $oid, "Spoilage: {$qty} units of product #{$pid} from order #{$oid}. Notes: {$notes}"]
                );
            }
            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }
}
