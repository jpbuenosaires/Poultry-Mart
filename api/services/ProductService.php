<?php
/**
 * ProductService — product catalogue and product management.
 */
class ProductService extends BaseService
{
    // ── Public catalogue ──────────────────────────────────────────

    /**
     * Return all active categories with a product count.
     */
    public function getCategories(): array
    {
        return $this->fetchAll(
            "SELECT c.*, COUNT(p.product_id) AS product_count
             FROM categories c
             LEFT JOIN products p ON p.category_id = c.category_id AND p.status = 'active'
             GROUP BY c.category_id
             ORDER BY c.category_id ASC"
        );
    }

    /**
     * Return active products with optional category, search, and sort filters.
     */
    public function getActiveProducts(?int $categoryId, string $search, string $sort): array
    {
        $conditions = ["p.status = 'active'"];
        $types      = '';
        $params     = [];

        if ($categoryId) {
            $conditions[] = 'p.category_id = ?';
            $types .= 'i';
            $params[] = $categoryId;
        }
        if ($search !== '') {
            $conditions[] = 'p.name LIKE ?';
            $types .= 's';
            $params[] = "%$search%";
        }

        $where = implode(' AND ', $conditions);
        $orderBy = match ($sort) {
            'price_asc'  => 'p.base_price ASC',
            'price_desc' => 'p.base_price DESC',
            'az'         => 'p.name ASC',
            'za'         => 'p.name DESC',
            default      => 'p.is_featured DESC, p.product_id ASC',
        };

        return $this->fetchAll(
            "SELECT p.*, c.name AS category_name,
                    COALESCE(AVG(r.rating), 0) AS avg_rating,
                    COUNT(r.review_id)          AS review_count
             FROM products p
             JOIN categories c ON c.category_id = p.category_id
             LEFT JOIN reviews r ON r.product_id = p.product_id
             WHERE $where
             GROUP BY p.product_id
             ORDER BY $orderBy",
            $types,
            $params
        );
    }

    /**
     * Return a single active product with its reviews and wholesale tiers.
     */
    public function getProduct(int $id): ?array
    {
        $row = $this->fetchOne(
            "SELECT p.*, c.name AS category_name,
                    COALESCE(AVG(r.rating), 0) AS avg_rating,
                    COUNT(r.review_id)          AS review_count
             FROM products p
             JOIN categories c ON c.category_id = p.category_id
             LEFT JOIN reviews r ON r.product_id = p.product_id
             WHERE p.product_id = ? AND p.status = 'active'
             GROUP BY p.product_id
             LIMIT 1",
            'i',
            [$id]
        );

        if (!$row) {
            return null;
        }

        $row['reviews'] = $this->fetchAll(
            "SELECT r.rating, r.review_text, r.created_at, u.first_name, u.last_name
             FROM reviews r
             JOIN users u ON u.user_id = r.user_id
             WHERE r.product_id = ?
             ORDER BY r.created_at DESC LIMIT 5",
            'i',
            [$id]
        );

        $row['wholesale_tiers'] = $this->fetchAll(
            "SELECT min_qty, tier_unit, tier_unit_price
             FROM wholesale_tiers
             WHERE product_id = ? ORDER BY min_qty ASC",
            'i',
            [$id]
        );

        return $row;
    }

    // ── Admin catalogue ───────────────────────────────────────────

    /**
     * Return all products (including archived) with optional filters.
     */
    public function getAdminProducts(string $search, int $categoryId, string $status): array
    {
        $conditions = ['1=1'];
        $types      = '';
        $params     = [];

        if ($search !== '') {
            $conditions[] = 'p.name LIKE ?';
            $types .= 's';
            $params[] = "%$search%";
        }
        if ($categoryId > 0) {
            $conditions[] = 'p.category_id = ?';
            $types .= 'i';
            $params[] = $categoryId;
        }
        if ($status !== '') {
            $conditions[] = 'p.status = ?';
            $types .= 's';
            $params[] = $status;
        }

        $where = implode(' AND ', $conditions);

        return $this->fetchAll(
            "SELECT p.product_id, p.category_id, p.name, p.description,
                    p.base_price, p.pricing_model, p.unit_of_measure,
                    p.estimated_weight, p.is_featured, p.is_catch_weight,
                    p.status, p.created_at,
                    c.name AS category_name,
                    COALESCE(SUM(pb.remaining_qty), 0) AS stock_qty
             FROM products p
             JOIN categories c ON c.category_id = p.category_id
             LEFT JOIN product_batches pb ON pb.product_id = p.product_id
             WHERE $where
             GROUP BY p.product_id
             ORDER BY p.category_id ASC, p.name ASC",
            $types,
            $params
        );
    }

    /**
     * Create or update a product.
     *
     * @return int  product_id of the saved record.
     */
    public function saveProduct(
        int    $pid,
        string $name,
        string $description,
        int    $categoryId,
        float  $basePrice,
        string $pricingModel,
        float  $estimatedWeight,
        bool   $isFeatured,
        string $status,
        int    $actorId = 0
    ): int {
        $allowedModels = ['catch_weight', 'fixed_pack', 'per_piece'];
        if (!in_array($pricingModel, $allowedModels, true)) {
            $pricingModel = 'catch_weight';
        }

        $uomMap        = ['catch_weight' => 'kg', 'fixed_pack' => 'pack', 'per_piece' => 'piece'];
        $unitOfMeasure = $uomMap[$pricingModel];
        $isCatchWeight = ($pricingModel === 'catch_weight') ? 1 : 0;
        $featInt       = (int) $isFeatured;

        if ($pid > 0) {
            $this->execute(
                "UPDATE products SET
                    category_id = ?, name = ?, description = ?,
                    base_price = ?, pricing_model = ?, unit_of_measure = ?,
                    estimated_weight = ?, is_featured = ?, is_catch_weight = ?, status = ?
                 WHERE product_id = ?",
                'issdssdiisi',
                [
                    $categoryId, $name, $description,
                    $basePrice, $pricingModel, $unitOfMeasure,
                    $estimatedWeight, $featInt, $isCatchWeight, $status,
                    $pid,
                ]
            );
            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'update_product', 'product', ?, ?)",
                'iis',
                [$actorId, $pid, "Product #$pid updated: name=$name, status=$status, price=$basePrice"]
            );
            return $pid;
        }

        $newPid = $this->insertGetId(
            "INSERT INTO products
                (category_id, name, description, base_price, pricing_model,
                 unit_of_measure, estimated_weight, is_featured, is_catch_weight, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            'issdssdiis',
            [
                $categoryId, $name, $description, $basePrice, $pricingModel,
                $unitOfMeasure, $estimatedWeight, $featInt, $isCatchWeight, $status,
            ]
        );
        $this->execute(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, 'create_product', 'product', ?, ?)",
            'iis',
            [$actorId, $newPid, "Product created: name=$name, price=$basePrice, status=$status"]
        );
        return $newPid;
    }

    /**
     * Toggle the is_featured flag. Returns the new value.
     */
    public function toggleFeatured(int $pid, int $actorId = 0): int
    {
        $this->execute(
            "UPDATE products SET is_featured = 1 - is_featured WHERE product_id = ?",
            'i',
            [$pid]
        );
        $row = $this->fetchOne(
            "SELECT is_featured FROM products WHERE product_id = ? LIMIT 1",
            'i',
            [$pid]
        );
        $newVal = (int) ($row['is_featured'] ?? 0);
        $this->execute(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, 'toggle_featured', 'product', ?, ?)",
            'iis',
            [$actorId, $pid, "Product #$pid is_featured set to $newVal"]
        );
        return $newVal;
    }

    /**
     * Set a product's status to 'active' or 'archived'.
     */
    public function archiveProduct(int $pid, string $status, int $actorId = 0): void
    {
        $status = ($status === 'active') ? 'active' : 'archived';
        $this->execute(
            "UPDATE products SET status = ? WHERE product_id = ?",
            'si',
            [$status, $pid]
        );
        $this->execute(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, 'archive_product', 'product', ?, ?)",
            'iis',
            [$actorId, $pid, "Product #$pid status set to $status"]
        );
    }

    /**
     * Get product details for the admin view.
     */
    public function getAdminProduct(int $pid): ?array
    {
        $row = $this->fetchOne(
            "SELECT p.*, c.name AS category_name,
                    COALESCE(AVG(r.rating), 0) AS avg_rating,
                    COUNT(DISTINCT r.review_id) AS review_count,
                    COALESCE(SUM(pb.remaining_qty), 0) AS stock_qty
             FROM products p
             JOIN categories c ON c.category_id = p.category_id
             LEFT JOIN reviews r ON r.product_id = p.product_id
             LEFT JOIN product_batches pb ON pb.product_id = p.product_id
             WHERE p.product_id = ?
             GROUP BY p.product_id
             LIMIT 1",
            'i',
            [$pid]
        );
        if (!$row) return null;
        $row['wholesale_tiers'] = $this->fetchAll(
            "SELECT tier_id, min_qty, tier_unit, tier_unit_price
             FROM wholesale_tiers WHERE product_id = ? ORDER BY min_qty ASC",
            'i',
            [$pid]
        );
        return $row;
    }

    /**
     * Fetch wholesale tiers for a product.
     */
    public function getTiers(int $pid): array
    {
        return $this->fetchAll(
            "SELECT tier_id, product_id, min_qty, tier_unit, tier_unit_price
             FROM wholesale_tiers WHERE product_id = ? ORDER BY min_qty ASC",
            'i', [$pid]
        );
    }

    /**
     * Save a wholesale tier.
     */
    public function saveTier(int $tierId, int $pid, int $minQty, string $unit, float $price): int
    {
        if ($tierId > 0) {
            $this->execute(
                "UPDATE wholesale_tiers SET min_qty=?, tier_unit=?, tier_unit_price=?
                 WHERE tier_id=? AND product_id=?",
                'iidii', [$minQty, $unit, $price, $tierId, $pid]
            );
            return $tierId;
        }
        return $this->insertGetId(
            "INSERT INTO wholesale_tiers (product_id, min_qty, tier_unit, tier_unit_price) VALUES (?,?,?,?)",
            'iisd', [$pid, $minQty, $unit, $price]
        );
    }

    /**
     * Delete a wholesale tier.
     */
    public function deleteTier(int $tierId, int $pid): void
    {
        $this->execute(
            "DELETE FROM wholesale_tiers WHERE tier_id=? AND product_id=?",
            'ii', [$tierId, $pid]
        );
    }

    /**
     * Save a category.
     */
    public function saveCategory(int $catId, string $name): int
    {
        if ($catId > 0) {
            $this->execute(
                "UPDATE categories SET name=? WHERE category_id=?",
                'si', [$name, $catId]
            );
            return $catId;
        }
        return $this->insertGetId(
            "INSERT INTO categories (name) VALUES (?)",
            's', [$name]
        );
    }

    /**
     * Delete a category.
     */
    public function deleteCategory(int $catId): void
    {
        $check = $this->fetchOne(
            "SELECT COUNT(*) AS n FROM products WHERE category_id=?",
            'i', [$catId]
        );
        if ((int) ($check['n'] ?? 0) > 0) {
            throw new RuntimeException('Cannot delete category with assigned products.');
        }
        $this->execute("DELETE FROM categories WHERE category_id=?", 'i', [$catId]);
    }

    /**
     * Add a customer product review (enforces one review per user/product/order).
     */
    public function addReview(int $uid, int $productId, int $orderId, int $rating, string $text): void
    {
        // Verify order is completed and belongs to user
        $ord = $this->fetchOne(
            "SELECT status FROM orders WHERE order_id = ? AND user_id = ? LIMIT 1",
            'ii',
            [$orderId, $uid]
        );
        if (!$ord || $ord['status'] !== 'Completed') {
            throw new RuntimeException('You can only review products from your completed orders.');
        }

        // Verify product was in that order
        $inOrder = $this->fetchOne(
            "SELECT order_item_id FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1",
            'ii',
            [$orderId, $productId]
        );
        if (!$inOrder) {
            throw new RuntimeException('This product was not part of the specified order.');
        }

        $affected = $this->execute(
            "INSERT IGNORE INTO reviews (user_id, product_id, order_id, rating, review_text)
             VALUES (?, ?, ?, ?, ?)",
            'iiiis',
            [$uid, $productId, $orderId, $rating, $text]
        );

        if ($affected === 0) {
            throw new RuntimeException('You have already reviewed this product for this order.');
        }
    }

    public function getActiveWithStock(
        ?int $categoryId, string $search, string $sort,
        int $limit = 24, int $offset = 0
    ): array {
        $conditions = ["p.status = 'active'"];
        $types      = '';
        $params     = [];

        if ($categoryId) {
            $conditions[] = 'p.category_id = ?';
            $types .= 'i';
            $params[] = $categoryId;
        }
        if ($search !== '') {
            $conditions[] = '(p.name LIKE ? OR p.description LIKE ?)';
            $types .= 'ss';
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $where   = implode(' AND ', $conditions);
        $orderBy = match ($sort) {
            'price_asc'  => 'p.base_price ASC',
            'price_desc' => 'p.base_price DESC',
            'az'         => 'p.name ASC',
            'za'         => 'p.name DESC',
            default      => 'p.is_featured DESC, p.product_id ASC',
        };

        // Append pagination to params — LIMIT and OFFSET use integer binding
        $types   .= 'ii';
        $params[] = $limit;
        $params[] = $offset;

        return $this->fetchAll(
            "SELECT p.*, c.name AS category_name,
                    COALESCE(AVG(r.rating), 0)         AS avg_rating,
                    COUNT(DISTINCT r.review_id)         AS review_count,
                    COALESCE(SUM(pb.remaining_qty), 0)  AS remaining_qty,
                    (SELECT MIN(wt.tier_unit_price)
                     FROM wholesale_tiers wt
                     WHERE wt.product_id = p.product_id
                     ORDER BY wt.min_qty ASC LIMIT 1)   AS best_wholesale_price,
                    (SELECT COUNT(*) FROM wholesale_tiers wt WHERE wt.product_id = p.product_id) AS wholesale_tier_count
             FROM products p
             JOIN categories c  ON c.category_id   = p.category_id
             LEFT JOIN reviews r ON r.product_id   = p.product_id
             LEFT JOIN product_batches pb ON pb.product_id = p.product_id
             WHERE $where
             GROUP BY p.product_id
             ORDER BY $orderBy
             LIMIT ? OFFSET ?",
            $types,
            $params
        );
    }

    public function countActiveWithStock(?int $categoryId, string $search): int {
        $conditions = ["p.status = 'active'"];
        $types      = '';
        $params     = [];
        if ($categoryId) { $conditions[] = 'p.category_id = ?'; $types .= 'i'; $params[] = $categoryId; }
        if ($search !== '') { $conditions[] = '(p.name LIKE ? OR p.description LIKE ?)'; $types .= 'ss'; $params[] = "%$search%"; $params[] = "%$search%"; }
        $where = implode(' AND ', $conditions);
        $row = $this->fetchOne(
            "SELECT COUNT(DISTINCT p.product_id) AS n
             FROM products p
             JOIN categories c ON c.category_id = p.category_id
             WHERE $where",
            $types, $params
        );
        return (int) ($row['n'] ?? 0);
    }
}