<?php
/**
 * ReportService — dashboard stats, sales reports, and operational settings.
 */
class ReportService extends BaseService
{
    /**
     * Build the full admin dashboard payload.
     */
    public function getDashboard(): array
    {
        // Summary stats
        $totalOrders   = (int) ($this->fetchOne("SELECT COUNT(*) AS n FROM orders")['n'] ?? 0);
        $pendingCount  = (int) ($this->fetchOne("SELECT COUNT(*) AS n FROM orders WHERE status = 'Pending'")['n'] ?? 0);
        $completedRev  = (float) ($this->fetchOne(
            "SELECT COALESCE(SUM(final_total), 0) AS n FROM orders WHERE status = 'Completed'"
        )['n'] ?? 0);
        $productCount  = (int) ($this->fetchOne("SELECT COUNT(*) AS n FROM products WHERE status = 'active'")['n'] ?? 0);
        $customerCount = (int) ($this->fetchOne(
            "SELECT COUNT(*) AS n FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE r.role_name = 'Customer'"
        )['n'] ?? 0);
        $todayOrders   = (int) ($this->fetchOne(
            "SELECT COUNT(*) AS n FROM orders WHERE DATE(created_at) = CURDATE()"
        )['n'] ?? 0);
        $todayRev      = (float) ($this->fetchOne(
            "SELECT COALESCE(SUM(final_total), 0) AS n FROM orders WHERE status = 'Completed' AND DATE(created_at) = CURDATE()"
        )['n'] ?? 0);

        // Recent 10 ACTIVE orders (excludes Completed/Cancelled — admins need actionable items)
        $recent = $this->fetchAll(
            "SELECT o.order_id, o.order_number, o.status, o.estimated_total, o.final_total,
                    o.payment_method, o.delivery_date, o.created_at,
                    u.first_name, u.last_name
             FROM orders o
             JOIN users u ON u.user_id = o.user_id
             WHERE o.status NOT IN ('Completed','Cancelled')
             ORDER BY o.created_at DESC LIMIT 10"
        );

        // Weekly revenue (last 7 days)
        $weeklyRaw = $this->fetchAll(
            "SELECT DATE(created_at) AS d, COALESCE(SUM(final_total), 0) AS rev
             FROM orders
             WHERE status = 'Completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             GROUP BY DATE(created_at)
             ORDER BY d ASC"
        );
        // Index results by date, then build a full 7-day series (oldest → today)
        // so days with zero sales appear as 0 rather than being absent from the chart.
        $revByDate = [];
        foreach ($weeklyRaw as $row) {
            $revByDate[$row['d']] = $row['rev'];
        }
        $weekly = [];
        for ($i = 6; $i >= 0; $i--) {
            $date     = date('Y-m-d', strtotime("-{$i} days"));
            $weekly[] = ['d' => $date, 'rev' => $revByDate[$date] ?? '0'];
        }

        // Low stock — mirrors inventory "red" rule: remaining ≤ 20% of original qty
        $lowStock = $this->fetchAll(
            "SELECT p.name, p.unit_of_measure,
                    COALESCE(SUM(pb.remaining_qty), 0)                          AS total_remaining,
                    COALESCE(SUM(pb.quantity), 0)                               AS total_original,
                    CASE
                        WHEN COALESCE(SUM(pb.quantity), 0) = 0 THEN 0
                        ELSE ROUND(
                            COALESCE(SUM(pb.remaining_qty), 0)
                            / SUM(pb.quantity) * 100
                        , 1)
                    END                                                          AS stock_pct,
                    c.name AS category_name
             FROM products p
             JOIN categories c ON c.category_id = p.category_id
             LEFT JOIN product_batches pb ON pb.product_id = p.product_id
             WHERE p.status = 'active'
             GROUP BY p.product_id
             HAVING stock_pct <= 20
             ORDER BY stock_pct ASC, total_remaining ASC
             LIMIT 15"
        );
        // Status distribution (single GROUP BY query instead of N separate queries)
        $distRows = $this->fetchAll(
            "SELECT status, COUNT(*) AS n FROM orders
             WHERE status IN ('Pending','Packed','Out for Delivery','Arrived at Location','Completed','Cancelled')
             GROUP BY status"
        );
        $dist = array_fill_keys(
            ['Pending', 'Packed', 'Out for Delivery', 'Arrived at Location', 'Completed', 'Cancelled'],
            0
        );
        foreach ($distRows as $row) {
            $dist[$row['status']] = (int) $row['n'];
        }

        return [
            'stats' => [
                'total_orders'  => $totalOrders,
                'pending'       => $pendingCount,
                'revenue'       => $completedRev,
                'products'      => $productCount,
                'customers'     => $customerCount,
                'today_orders'  => $todayOrders,
                'today_revenue' => $todayRev,
            ],
            'recent_orders'  => $recent,
            'weekly_revenue' => $weekly,
            'low_stock'      => $lowStock,
            'status_dist'    => $dist,
        ];
    }

    /**
     * Daily prep sheet — aggregate pending-order quantities per product for a given date.
     */
    public function getDailyPrep(string $date): array
    {
        return $this->fetchAll(
            "SELECT p.name AS product_name, c.name AS category_name,
                    p.unit_of_measure, p.pricing_model, p.estimated_weight,
                    COUNT(DISTINCT oi.order_id) AS order_count,
                    SUM(
                        CASE
                            WHEN p.pricing_model = 'catch_weight'
                                THEN oi.quantity * p.estimated_weight
                            ELSE oi.quantity
                        END
                    ) AS total_qty
             FROM order_items oi
             JOIN orders    o ON o.order_id    = oi.order_id
             JOIN products  p ON p.product_id  = oi.product_id
             JOIN categories c ON c.category_id = p.category_id
             WHERE o.status IN ('Pending', 'Packed')
               AND o.delivery_date = ?
             GROUP BY oi.product_id
             ORDER BY c.name ASC, p.name ASC",
            's',
            [$date]
        );
    }

    /**
     * Sales report for a given number of days.
     */
    public function getReport(int $days, string $dateFrom = '', string $dateTo = ''): array
    {
        $days = max(7, min(365, $days));

        // Explicit date range overrides the rolling $days window
        if ($dateFrom !== '' && $dateTo !== '') {
            $dateWhere  = "created_at BETWEEN ? AND ?";
            $dateTypes  = 'ss';
            $dateParams = [$dateFrom, $dateTo . ' 23:59:59'];
        } else {
            $dateWhere  = "created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
            $dateTypes  = 'i';
            $dateParams = [$days];
        }

        $daily = $this->fetchAll(
            "SELECT DATE(created_at) AS d,
                    COUNT(*) AS order_count,
                    COALESCE(SUM(final_total), 0) AS revenue
             FROM orders
             WHERE status = 'Completed'
               AND $dateWhere
             GROUP BY DATE(created_at)
             ORDER BY d ASC",
            $dateTypes,
            $dateParams
        );

        $byCategory = $this->fetchAll(
            "SELECT c.name AS category,
                    COUNT(oi.order_item_id) AS items_sold,
                    COALESCE(SUM(oi.final_subtotal), SUM(oi.estimated_subtotal)) AS revenue
             FROM order_items oi
             JOIN products p ON p.product_id = oi.product_id
             JOIN categories c ON c.category_id = p.category_id
             JOIN orders o ON o.order_id = oi.order_id
             WHERE o.status = 'Completed'
               AND o.$dateWhere
             GROUP BY c.category_id
             ORDER BY revenue DESC",
            $dateTypes,
            $dateParams
        );

        $topProducts = $this->fetchAll(
            "SELECT p.name, c.name AS category,
                    COUNT(oi.order_item_id) AS times_ordered,
                    SUM(oi.quantity) AS total_qty
             FROM order_items oi
             JOIN products p ON p.product_id = oi.product_id
             JOIN categories c ON c.category_id = p.category_id
             JOIN orders o ON o.order_id = oi.order_id
             WHERE o.$dateWhere
             GROUP BY oi.product_id
             ORDER BY total_qty DESC LIMIT 10",
            $dateTypes,
            $dateParams
        );

        $totals = $this->fetchOne(
            "SELECT COUNT(*) AS total_orders,
                    COALESCE(SUM(final_total), 0)      AS total_revenue,
                    COALESCE(SUM(discount_amount), 0)  AS total_discounts,
                    COALESCE(SUM(delivery_fee), 0)     AS total_delivery_fees
             FROM orders
             WHERE status = 'Completed'
               AND $dateWhere",
            $dateTypes,
            $dateParams
        );

        return [
            'daily'        => $daily,
            'by_category'  => $byCategory,
            'top_products' => $topProducts,
            'totals'       => $totals,
        ];
    }

    /**
     * Operational settings: hours, zones, and time slots.
     */
    public function getSettings(): array
    {
        return [
            'hours' => $this->fetchAll("SELECT * FROM operational_hours ORDER BY day_of_week ASC"),
            'zones' => $this->fetchAll(
            "SELECT dz.zone_id, dz.municipality_id, dz.delivery_fee,
                    m.name AS municipality_name
             FROM delivery_zones dz
             JOIN municipalities m ON m.municipality_id = dz.municipality_id
             ORDER BY dz.delivery_fee ASC"
        ),
            'slots' => $this->fetchAll("SELECT * FROM time_slots ORDER BY start_time ASC"),
        ];
    }

    /**
     * Checkout meta: active zones, active slots, active hours.
     */
    public function getCheckoutMeta(): array
    {
        return [
            'zones' => $this->fetchAll(
            "SELECT dz.zone_id, dz.municipality_id, dz.delivery_fee,
                    m.name AS municipality_name
             FROM delivery_zones dz
             JOIN municipalities m ON m.municipality_id = dz.municipality_id
             ORDER BY dz.delivery_fee ASC"
        ),
            'slots' => $this->fetchAll("SELECT * FROM time_slots WHERE is_active = 1 ORDER BY start_time ASC"),
            'hours' => $this->fetchAll("SELECT * FROM operational_hours WHERE is_active = 1 ORDER BY day_of_week ASC"),
        ];
    }

    /**
     * Promo codes list (admin view).
     */
    public function getPromos(): array
    {
        return $this->fetchAll(
            "SELECT pc.promo_id, pc.code, pc.discount_type, pc.discount_value,
                    pc.min_order_value, pc.is_active, pc.valid_from, pc.valid_to,
                    pc.usage_limit, pc.created_by,
                    u.first_name, u.last_name,
                    (SELECT COUNT(*) FROM orders o
                     WHERE o.promo_id = pc.promo_id
                       AND o.status NOT IN ('Cancelled')) AS times_used
             FROM promo_codes pc
             JOIN users u ON u.user_id = pc.created_by
             ORDER BY pc.promo_id DESC"
        );
    }

    /**
     * Create or update a promo code.
     *
     * @return int  promo_id of the saved record.
     */
    public function savePromo(
        int     $pid,
        string  $code,
        string  $discountType,
        float   $discountValue,
        float   $minOrderValue,
        bool    $isActive,
        ?string $validFrom,
        ?string $validTo,
        ?int    $usageLimit,
        int     $createdBy
    ): int {
        $type = in_array($discountType, ['percentage', 'flat'], true) ? $discountType : 'flat';

        if ($pid > 0) {
            $this->execute(
                "UPDATE promo_codes
                 SET code = ?, discount_type = ?, discount_value = ?,
                     min_order_value = ?, is_active = ?,
                     valid_from = ?, valid_to = ?, usage_limit = ?
                 WHERE promo_id = ?",
            'ssddissii',
            [$code, $type, $discountValue, $minOrderValue, (int) $isActive,
             $validFrom, $validTo, $usageLimit, $pid]
            );
            return $pid;
        }

        return $this->insertGetId(
            "INSERT INTO promo_codes
                (created_by, code, discount_type, discount_value,
                 min_order_value, is_active, valid_from, valid_to, usage_limit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            'issddissi',
            [$createdBy, $code, $type, $discountValue, $minOrderValue,
             (int) $isActive, $validFrom, $validTo, $usageLimit]
        );
    }

    public function deletePromo(int $promoId): void
    {
        $this->execute("UPDATE promo_codes SET is_active=0 WHERE promo_id=?", 'i', [$promoId]);
    }

    public function saveHours(int $dow, ?int $isActive, ?string $openTime, ?string $closeTime): void
    {
        if ($openTime !== null && $closeTime !== null) {
            $this->execute(
                "UPDATE operational_hours SET open_time=?, close_time=? WHERE day_of_week=?",
                'ssi', [$openTime, $closeTime, $dow]
            );
        } elseif ($isActive !== null) {
            $this->execute(
                "UPDATE operational_hours SET is_active=? WHERE day_of_week=?",
                'ii', [$isActive, $dow]
            );
        }
    }

    public function saveZone(int $zoneId, int $muniId, float $fee): int
    {
        if ($zoneId > 0) {
            $this->execute(
                "UPDATE delivery_zones SET municipality_id=?, delivery_fee=? WHERE zone_id=?",
                'idi', [$muniId, $fee, $zoneId]
            );
            return $zoneId;
        }
        return $this->insertGetId(
            "INSERT INTO delivery_zones (municipality_id, delivery_fee) VALUES (?,?)",
            'id', [$muniId, $fee]
        );
    }

    public function deleteZone(int $zoneId): void
    {
        $this->execute("DELETE FROM delivery_zones WHERE zone_id=?", 'i', [$zoneId]);
    }

    public function saveSlot(int $slotId, string $label, string $start, string $end, int $active): int
    {
        if ($slotId > 0) {
            $this->execute(
                "UPDATE time_slots SET slot_label=?, start_time=?, end_time=?, is_active=? WHERE slot_id=?",
                'sssii', [$label, $start, $end, $active, $slotId]
            );
            return $slotId;
        }
        return $this->insertGetId(
            "INSERT INTO time_slots (slot_label, start_time, end_time, is_active) VALUES (?,?,?,?)",
            'sssi', [$label, $start, $end, $active]
        );
    }

    public function deleteSlot(int $slotId): void
    {
        $this->execute("DELETE FROM time_slots WHERE slot_id=?", 'i', [$slotId]);
    }

    /**
     * Delivery zones grouped with packed order counts and time slots
     * (for the fulfillment zone-dispatch view).
     */
    public function getDeliveryZones(): array
    {
        $zones = $this->fetchAll(
            "SELECT dz.zone_id, dz.municipality_id, dz.delivery_fee,
                    m.name AS municipality_name,
                    COUNT(o.order_id) AS packed_count
             FROM delivery_zones dz
             JOIN municipalities m ON m.municipality_id = dz.municipality_id
             LEFT JOIN orders o ON o.zone_id = dz.zone_id AND o.status = 'Packed'
             GROUP BY dz.zone_id
             ORDER BY m.name ASC"
        );

        $slots = $this->fetchAll(
            "SELECT slot_id, slot_label, start_time, end_time FROM time_slots ORDER BY start_time ASC"
        );

        return ['zones' => $zones, 'slots' => $slots];
    }

    /**
     * Rider delivery performance summary.
     */
    public function getRiderPerformance(int $riderId, string $dateFrom, string $dateTo): array
    {
        $summary = $this->fetchOne(
            "SELECT
               COUNT(*) AS total_deliveries,
               SUM(CASE WHEN o.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
               SUM(CASE WHEN o.status = 'Cancelled' THEN 1 ELSE 0 END) AS failed,
               AVG(CASE
                 WHEN d.dispatched_at IS NOT NULL AND d.delivered_at IS NOT NULL
                 THEN TIMESTAMPDIFF(MINUTE, d.dispatched_at, d.delivered_at)
               END) AS avg_delivery_minutes
             FROM deliveries d
             JOIN orders o ON o.order_id = d.order_id
             WHERE d.rider_id = ?
               AND o.delivery_date BETWEEN ? AND ?",
            'iss',
            [$riderId, $dateFrom, $dateTo]
        ) ?: [];

        $daily = $this->fetchAll(
            "SELECT o.delivery_date,
                    COUNT(*) AS total,
                    SUM(CASE WHEN o.status = 'Completed' THEN 1 ELSE 0 END) AS completed
             FROM deliveries d
             JOIN orders o ON o.order_id = d.order_id
             WHERE d.rider_id = ?
               AND o.delivery_date BETWEEN ? AND ?
             GROUP BY o.delivery_date
             ORDER BY o.delivery_date ASC",
            'iss',
            [$riderId, $dateFrom, $dateTo]
        );

        $total = (int) ($summary['total_deliveries'] ?? 0);
        $done  = (int) ($summary['completed']        ?? 0);
        $summary['completion_rate']        = $total > 0 ? round(($done / $total) * 100, 1) : 0;
        $summary['avg_delivery_minutes']   = isset($summary['avg_delivery_minutes']) && $summary['avg_delivery_minutes'] !== null
            ? round((float) $summary['avg_delivery_minutes'], 1)
            : null;

        return ['summary' => $summary, 'daily' => $daily];
    }

    /**
     * Rider today's summary (stat pills on rider dashboard).
     */
    public function getRiderDailySummary(int $riderId): array
    {
        $today = date('Y-m-d');
        $row   = $this->fetchOne(
            "SELECT
               COUNT(*) AS total_assigned,
               SUM(CASE WHEN o.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
               SUM(CASE WHEN o.status = 'Out for Delivery' THEN 1 ELSE 0 END) AS in_transit,
               SUM(CASE WHEN o.status IN ('Packed', 'Assigned') THEN 1 ELSE 0 END) AS pending_pickup,
               SUM(CASE WHEN o.status = 'Completed' AND pay.status = 'Paid'
                   THEN COALESCE(o.final_total, o.estimated_total) ELSE 0 END) AS collected_today
             FROM deliveries d
             JOIN orders o ON o.order_id = d.order_id
             LEFT JOIN payments pay ON pay.order_id = o.order_id
             WHERE d.rider_id = ? AND o.delivery_date = ?",
            'is',
            [$riderId, $today]
        );
        return $row ?: [];
    }

    /**
     * Rider remittance history.
     *
     * @param int $riderId  Pass 0 to return all riders' records (admin overview).
     */
    public function getRemittanceHistory(int $riderId): array
    {
        if ($riderId > 0) {
            return $this->fetchAll(
                "SELECT cr.remittance_id, cr.rider_id, cr.amount, cr.notes,
                        cr.remitted_at, cr.status, cr.confirmed_by, cr.confirmed_at,
                        CONCAT(u.first_name, ' ', u.last_name) AS rider_name
                 FROM cash_remittances cr
                 JOIN users u ON u.user_id = cr.rider_id
                 WHERE cr.rider_id = ?
                 ORDER BY cr.remitted_at DESC
                 LIMIT 30",
                'i',
                [$riderId]
            );
        }

        return $this->fetchAll(
            "SELECT cr.remittance_id, cr.rider_id, cr.amount, cr.notes,
                    cr.remitted_at, cr.status, cr.confirmed_by, cr.confirmed_at,
                    CONCAT(u.first_name, ' ', u.last_name) AS rider_name
             FROM cash_remittances cr
             JOIN users u ON u.user_id = cr.rider_id
             ORDER BY cr.remitted_at DESC
             LIMIT 100"
        );
    }

    public function confirmRemittance(int $remitId, int $adminId): void
    {
        $this->execute(
            "UPDATE cash_remittances
             SET status='Confirmed', confirmed_by=?, confirmed_at=NOW()
             WHERE remittance_id=?",
            'ii', [$adminId, $remitId]
        );
    }

    public function getAuditLogs(string $actionFilter, string $entityType, string $dateFrom, string $dateTo, int $page, int $limit): array
    {
        $cond   = ['1=1'];
        $types  = '';
        $params = [];
        if ($actionFilter !== '') {
            $cond[] = 'al.action LIKE ?';
            $types .= 's';
            $params[] = "%$actionFilter%";
        }
        if ($entityType !== '') {
            $cond[] = 'al.entity_type = ?';
            $types .= 's';
            $params[] = $entityType;
        }
        if ($dateFrom !== '') {
            $cond[] = 'DATE(al.created_at) >= ?';
            $types .= 's';
            $params[] = $dateFrom;
        }
        if ($dateTo !== '') {
            $cond[] = 'DATE(al.created_at) <= ?';
            $types .= 's';
            $params[] = $dateTo;
        }
        $where  = implode(' AND ', $cond);
        $offset = ($page - 1) * $limit;
        $countRow = $this->fetchOne(
            "SELECT COUNT(*) AS n FROM audit_logs al WHERE $where",
            $types, $params
        );
        $total = (int) ($countRow['n'] ?? 0);
        $limitSql = $limit > 0 ? "LIMIT ? OFFSET ?" : "";
        $sqlParams = $limit > 0 ? array_merge($params, [$limit, $offset]) : $params;
        $sqlTypes = $limit > 0 ? $types . 'ii' : $types;

        $rows  = $this->fetchAll(
            "SELECT al.log_id, al.action, al.entity_type, al.entity_id,
                    al.details, al.created_at,
                    CONCAT(u.first_name, ' ', u.last_name) AS actor_name
             FROM audit_logs al
             LEFT JOIN users u ON u.user_id = al.user_id
             WHERE $where
             ORDER BY al.created_at DESC
             $limitSql",
            $sqlTypes, $sqlParams
        );
        return ['logs' => $rows, 'total' => $total, 'page' => $page,
                'pages' => $limit > 0 ? (int) ceil($total / max(1, $limit)) : 1];
    }

    public function findPromoByCode(string $code): ?array
    {
        return $this->fetchOne(
            "SELECT promo_id, code, discount_type, discount_value,
                    min_order_value, is_active,
                    valid_from, valid_to, usage_limit,
                    (SELECT COUNT(*) FROM orders WHERE promo_id = promo_codes.promo_id
                     AND status NOT IN ('Cancelled')) AS times_used
             FROM promo_codes
             WHERE code = ? LIMIT 1",
            's',
            [$code]
        );
    }
}