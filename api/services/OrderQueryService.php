<?php
/**
 * OrderQueryService — Paginated order lists/details for staff, customers and riders, plus small count/list lookups.
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderQueryService extends BaseService
{
    /**
     * Paginated order list used by both admin and fulfillment staff.
     *
     * @param string $extraSelect  Additional SELECT columns (e.g. zone/slot cols for fulfillment).
     * @param string $extraJoin    Additional JOINs.
     * @param string $orderBy      ORDER BY clause.
     */
    public function getOrders(
        string $status,
        string $search,
        int    $page,
        int    $limit,
        string $extraSelect = '',
        string $extraJoin   = '',
        string $orderBy     = 'o.created_at DESC'
    ): array {
        $conditions = ['1=1'];
        $types      = '';
        $params     = [];

        if ($status !== '') {
            $conditions[] = 'o.status = ?';
            $types .= 's';
            $params[] = $status;
        }
        if ($search !== '') {
            $conditions[] = '(o.order_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
            $like = "%$search%";
            $types .= 'ssss';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $where  = implode(' AND ', $conditions);
        $offset = ($page - 1) * $limit;

        $countRow = $this->fetchOne(
            "SELECT COUNT(*) AS n
             FROM orders o
             JOIN users u ON u.user_id = o.user_id
             $extraJoin
             WHERE $where",
            $types,
            $params
        );
        $total = (int) ($countRow['n'] ?? 0);

        $listSql = "SELECT o.order_id, o.order_number, o.status,
                           o.estimated_total, o.final_total, o.discount_amount,
                           o.delivery_fee, o.payment_method, o.delivery_date, o.created_at,
                           u.first_name, u.last_name, u.email,
                           p.status AS pay_status
                           $extraSelect
                    FROM orders o
                    JOIN users    u ON u.user_id   = o.user_id
                    LEFT JOIN payments p ON p.order_id = o.order_id
                    $extraJoin
                    WHERE $where
                    ORDER BY $orderBy
                    LIMIT ? OFFSET ?";

        $listTypes  = $types . 'ii';
        $listParams = array_merge($params, [$limit, $offset]);
        $orders     = $this->fetchAll($listSql, $listTypes, $listParams);

        return [
            'orders' => $orders,
            'total'  => $total,
            'page'   => $page,
            'pages'  => (int) ceil($total / max(1, $limit)),
        ];
    }

    /**
     * Full detail of a single order including items (admin / fulfillment view).
     */
    public function getOrderDetail(int $oid): ?array
    {
        $order = $this->fetchOne(
            "SELECT o.*, u.first_name, u.last_name, u.email, u.phone,
                    a.label AS addr_label, a.street,
                    b.name AS barangay, m_addr.name AS city, 'Albay' AS province,
                    ts.slot_label,
                    m_zone.name AS zone_city, dz.delivery_fee AS zone_fee,
                    pc.code AS promo_code,
                    p.status AS pay_status, p.verified_at,
                    d.rider_id, d.status AS delivery_status, d.proof_of_delivery_url,
                    d.dispatched_at, d.delivered_at,
                    ru.first_name AS rider_first, ru.last_name AS rider_last, ru.phone AS rider_phone
             FROM orders o
             JOIN users    u  ON u.user_id     = o.user_id
             JOIN addresses a ON a.address_id  = o.address_id
             LEFT JOIN barangays      b      ON b.barangay_id        = a.barangay_id
             LEFT JOIN municipalities m_addr ON m_addr.municipality_id = a.municipality_id
             LEFT JOIN time_slots     ts ON ts.slot_id   = o.slot_id
             LEFT JOIN delivery_zones dz ON dz.zone_id   = o.zone_id
             LEFT JOIN municipalities m_zone ON m_zone.municipality_id = dz.municipality_id
             LEFT JOIN promo_codes    pc ON pc.promo_id   = o.promo_id
             LEFT JOIN payments        p ON p.order_id    = o.order_id
             LEFT JOIN deliveries      d ON d.order_id    = o.order_id
             LEFT JOIN users          ru ON ru.user_id    = d.rider_id
             WHERE o.order_id = ? LIMIT 1",
            'i',
            [$oid]
        );

        if (!$order) {
            return null;
        }

        $items = $this->fetchAll(
            "SELECT oi.order_item_id, oi.order_id, oi.product_id,
                    oi.quantity, oi.unit_price, oi.pricing_model,
                    oi.estimated_weight, oi.actual_weight,
                    oi.estimated_subtotal, oi.final_subtotal,
                    p.name, p.unit_of_measure, p.is_catch_weight,
                    c.name AS category_name,
                    oi.unit_price AS price_per_kg
             FROM order_items oi
             JOIN products   p ON p.product_id  = oi.product_id
             JOIN categories c ON c.category_id = p.category_id
             WHERE oi.order_id = ?",
            'i',
            [$oid]
        );

        $order['items'] = $items;
        return $order;
    }

    /**
     * Simplified order detail used by the customer-facing API.
     */
    public function getCustomerOrderDetail(int $oid): ?array
    {
        $order = $this->fetchOne(
            "SELECT o.*,
                    a.street,
                    b.name AS barangay, m_addr.name AS city, 'Albay' AS province,
                    ts.slot_label,
                    dz.delivery_fee AS zone_fee,
                    pay.status      AS pay_status,
                    pay.method      AS pay_method,
                    pay.verified_at AS pay_verified_at,
                    pay.gcash_reference,
                    pay.gcash_screenshot,
                    d.proof_of_delivery_url,
                    d.dispatched_at,
                    d.delivered_at
             FROM orders o
             LEFT JOIN addresses      a      ON a.address_id        = o.address_id
             LEFT JOIN barangays      b      ON b.barangay_id        = a.barangay_id
             LEFT JOIN municipalities m_addr ON m_addr.municipality_id = a.municipality_id
             LEFT JOIN time_slots     ts  ON ts.slot_id    = o.slot_id
             LEFT JOIN delivery_zones dz  ON dz.zone_id    = o.zone_id
             LEFT JOIN payments       pay ON pay.order_id  = o.order_id
             LEFT JOIN deliveries     d   ON d.order_id    = o.order_id
             WHERE o.order_id = ? LIMIT 1",
            'i',
            [$oid]
        );
 
        if (!$order) {
            return null;
        }
 
        $order['items'] = $this->fetchAll(
            "SELECT oi.*, p.name, p.pricing_model, p.unit_of_measure, p.is_catch_weight,
                    p.estimated_weight AS product_estimated_weight
             FROM order_items oi
             JOIN products p ON p.product_id = oi.product_id
             WHERE oi.order_id = ?",
            'i',
            [$oid]
        );
 
        // Dispute for this order (if any)
        $order['dispute'] = $this->fetchOne(
            "SELECT dispute_id, status AS dispute_status, description, evidence_url, created_at,
                    resolved_at
             FROM disputes
             WHERE order_id = ? AND user_id = ?
             ORDER BY dispute_id DESC LIMIT 1",
            'ii',
            [$oid, (int)$order['user_id']]
        );
 
        return $order;
    }

    /**
     * Full order detail for a rider (includes GPS coordinates, payment details).
     */
    public function getRiderOrderDetail(int $oid): ?array
    {
        $order = $this->fetchOne(
            "SELECT o.*,
                    u.first_name, u.last_name, u.email, u.phone,
                    a.label AS addr_label, a.street,
                    b.name AS barangay, m_addr.name AS city, 'Albay' AS province,
                    a.latitude, a.longitude,
                    ts.slot_label, ts.end_time AS slot_end_time,
                    dz.delivery_fee AS zone_fee,
                    pc.code AS promo_code,
                    pay.status AS pay_status, pay.method AS pay_method, pay.verified_at,
                    d.status AS delivery_status, d.proof_of_delivery_url,
                    d.dispatched_at, d.delivered_at
             FROM orders o
             JOIN users      u   ON u.user_id     = o.user_id
             JOIN addresses  a      ON a.address_id        = o.address_id
             LEFT JOIN barangays      b      ON b.barangay_id        = a.barangay_id
             LEFT JOIN municipalities m_addr ON m_addr.municipality_id = a.municipality_id
             LEFT JOIN time_slots     ts  ON ts.slot_id   = o.slot_id
             LEFT JOIN delivery_zones dz  ON dz.zone_id   = o.zone_id
             LEFT JOIN promo_codes    pc  ON pc.promo_id   = o.promo_id
             LEFT JOIN payments       pay ON pay.order_id  = o.order_id
             LEFT JOIN deliveries     d   ON d.order_id    = o.order_id
             WHERE o.order_id = ? LIMIT 1",
            'i',
            [$oid]
        );

        if (!$order) {
            return null;
        }

        $items = $this->fetchAll(
            "SELECT oi.*, p.name, p.is_catch_weight, p.estimated_weight AS product_est_weight
             FROM order_items oi
             JOIN products p ON p.product_id = oi.product_id
             WHERE oi.order_id = ?",
            'i',
            [$oid]
        );

        $order['items'] = $items;
        return $order;
    }

    /**
     * Return all orders assigned to a rider with optional status/date filters.
     */
    public function getRiderOrders(int $riderId, string $statusFilter, string $dateFilter): array
    {
        $conditions = ['d.rider_id = ?'];
        $types      = 'i';
        $params     = [$riderId];

        if ($statusFilter !== '' && $statusFilter !== 'all') {
            $conditions[] = 'o.status = ?';
            $types .= 's';
            $params[] = $statusFilter;
        }
        if ($dateFilter !== '') {
            $conditions[] = 'o.delivery_date = ?';
            $types .= 's';
            $params[] = $dateFilter;
        }

        $where = implode(' AND ', $conditions);
        $orders = $this->fetchAll(
            "SELECT o.order_id, o.order_number, o.delivery_date, o.status,
                    o.estimated_total, o.final_total, o.discount_amount,
                    o.delivery_fee, o.payment_method, o.special_instructions, o.created_at,
                    u.first_name, u.last_name, u.phone,
                    a.street,
                    b.name AS barangay, m_addr.name AS city, 'Albay' AS province,
                    a.latitude, a.longitude,
                    ts.slot_label, ts.end_time AS slot_end_time,
                    pay.status AS pay_status,
                    d.status AS delivery_status, d.proof_of_delivery_url,
                    d.dispatched_at, d.delivered_at
             FROM deliveries d
             JOIN orders o    ON o.order_id    = d.order_id
             JOIN users u     ON u.user_id     = o.user_id
             JOIN addresses a      ON a.address_id        = o.address_id
             LEFT JOIN barangays      b      ON b.barangay_id        = a.barangay_id
             LEFT JOIN municipalities m_addr ON m_addr.municipality_id = a.municipality_id
             LEFT JOIN time_slots ts  ON ts.slot_id  = o.slot_id
             LEFT JOIN payments  pay ON pay.order_id = o.order_id
             WHERE $where
             ORDER BY
               FIELD(o.status, 'Out for Delivery', 'Arrived at Location', 'Packed', 'Completed') ASC,
               o.delivery_date ASC,
               ts.start_time ASC",
            $types,
            $params
        );

        $countRows = $this->fetchAll(
            "SELECT o.status, COUNT(*) AS cnt
             FROM deliveries d
             JOIN orders o ON o.order_id = d.order_id
             WHERE d.rider_id = ?
               AND o.status IN ('Packed', 'Out for Delivery', 'Arrived at Location', 'Completed')
             GROUP BY o.status",
            'i',
            [$riderId]
        );
        $counts = [];
        foreach ($countRows as $row) {
            $counts[$row['status']] = (int) $row['cnt'];
        }

        return ['orders' => $orders, 'counts' => $counts];
    }

    public function getPendingGCash(): array
    {
        $rows = $this->fetchAll(
            "SELECT p.payment_id, p.order_id, p.amount, p.method,
                    p.status, p.gcash_reference, p.gcash_screenshot,
                    o.order_number, o.estimated_total, o.final_total,
                    o.created_at, o.status AS order_status,
                    u.first_name, u.last_name, u.email
             FROM payments p
             JOIN orders o ON o.order_id = p.order_id
             JOIN users  u ON u.user_id  = o.user_id
             WHERE p.method = 'GCash'
               AND p.status = 'Unpaid'
               AND o.status NOT IN ('Cancelled')
             ORDER BY o.created_at DESC"
        );
        $count = $this->fetchOne(
            "SELECT COUNT(*) AS n FROM payments p
             JOIN orders o ON o.order_id = p.order_id
             WHERE p.method = 'GCash' AND p.status = 'Unpaid'
               AND o.status NOT IN ('Cancelled')"
        );
        return ['rows' => $rows, 'count' => (int)($count['n'] ?? 0)];
    }

    public function countPendingGCash(): int
    {
        $row = $this->fetchOne(
            "SELECT COUNT(*) AS n FROM payments p
             JOIN orders o ON o.order_id = p.order_id
             WHERE p.method = 'GCash' AND p.status = 'Unpaid'
               AND o.status NOT IN ('Cancelled')"
        );
        return (int)($row['n'] ?? 0);
    }

    public function getUserOrders(int $uid): array
    {
        return $this->fetchAll(
            "SELECT o.order_id, o.order_number, o.delivery_date, o.status,
                    o.estimated_total, o.final_total, o.discount_amount,
                    o.delivery_fee, o.payment_method, o.created_at
             FROM orders o
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC",
            'i',
            [$uid]
        );
    }
}
