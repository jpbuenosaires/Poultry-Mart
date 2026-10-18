<?php
/**
 * PoultryMart — Super Admin API Controller
 *
 * Thin router: parse input → call service → emit Response.
 * Zero raw mysqli_* calls anywhere in this file.
 * Zero SQL — every DB operation goes through a service class.
 *
 * Mirror of customer_api.php pattern; every non-login action
 * validates that the caller is an active Super Admin.
 */

// ── Guarantee a clean JSON response on every code path ───────────
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');
error_reporting(E_ALL);

set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage(),
    ]);
    exit;
});

require_once __DIR__ . '/db.php';

date_default_timezone_set('Asia/Manila');

$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// ── Service instances ─────────────────────────────────────────────
$auth      = new AuthService($conn);
$users     = new UserService($conn);
$products  = new ProductService($conn);
$inventory = new InventoryService($conn);
$orders    = new OrderService($conn);
$notifs    = new NotificationService($conn);
$reports   = new ReportService($conn);

// ════════════════════════════════════════════════════════════════
//  AUTH — LOGIN
// ════════════════════════════════════════════════════════════════
if ($action === 'login') {
    $result = $auth->login(
        trim($body['email']   ?? ''),
        $body['password']     ?? '',
        ['Super Admin']
    );
    if (!$result['success']) {
        Response::error($result['message'], 401);
    }
    $_SESSION['admin_id'] = $result['user']['user_id'];
    Response::ok(['message' => $result['message'], 'user' => $result['user']]);
}

if ($action === 'logout') {
    unset($_SESSION['admin_id']);
    Response::ok(['message' => 'Logged out.']);
}

// ── Global auth guard — every action beyond this point ───────────
$adminId = (int) ($_SESSION['admin_id'] ?? 0);
$admin   = $auth->verifySession($adminId, ['Super Admin']);
if (!$admin) {
    Response::error('Unauthorized. Super Admin access required.', 401);
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════
if ($action === 'dashboard') {
    Response::ok(['data' => $reports->getDashboard()]);
}

// ════════════════════════════════════════════════════════════════
//  ORDERS
// ════════════════════════════════════════════════════════════════
if ($action === 'orders') {
    $status = trim($_GET['status'] ?? '');
    $search = trim($_GET['search'] ?? '');
    $page   = max(1, (int) ($_GET['page']  ?? 1));
    $limit  = max(1, (int) ($_GET['limit'] ?? 25));
    
    $extraSelect = ", m_zone.name AS zone_city";
    $extraJoin   = "LEFT JOIN delivery_zones dz ON dz.zone_id = o.zone_id
                    LEFT JOIN municipalities m_zone ON m_zone.municipality_id = dz.municipality_id";

    Response::ok(['data' => $orders->getOrders($status, $search, $page, $limit, $extraSelect, $extraJoin)]);
}

if ($action === 'order') {
    $oid = (int) ($_GET['id'] ?? $_GET['order_id'] ?? 0);
    if (!$oid) Response::error('order_id required.', 422);
    
    $detail = $orders->getOrderDetail($oid);
    if (!$detail) Response::error('Order not found.', 404);
    
    Response::ok(['data' => $detail]);
}

if ($action === 'pack_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid   = (int) ($body['order_id'] ?? 0);
    $items = $body['items'] ?? [];
    if (!$oid || !is_array($items)) Response::error('order_id and items required.', 422);
    try {
        $finalTotal = $orders->packOrderAdmin($oid, $items, $adminId);
        Response::ok(['message' => 'Order packed.', 'final_total' => $finalTotal]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'edit_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid        = (int)    ($body['order_id']      ?? 0);
    $items      = $body['items']                   ?? [];
    $promoCode  = isset($body['promo_code']) ? (string) $body['promo_code'] : null;
    $date       = isset($body['delivery_date']) ? (string) $body['delivery_date'] : null;
    $slotId     = isset($body['slot_id'])  ? (int) $body['slot_id']  : null;
    if (!$oid) Response::error('order_id required.', 422);
    try {
        $orders->adminEditOrder($oid, $items, $promoCode, $date, $slotId, $adminId);
        Response::ok(['message' => 'Order updated.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'cancel_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid    = (int)    ($body['order_id'] ?? 0);
    $reason = trim($body['reason']        ?? 'Admin cancellation');
    if (!$oid) Response::error('order_id required.', 422);
    try {
        $orders->cancelOrder($oid, $adminId, $reason ?: 'Admin cancellation', false);
        Response::ok(['message' => 'Order cancelled.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'update_status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid    = (int)    ($body['order_id'] ?? 0);
    $status = trim($body['status']        ?? '');
    if (!$oid || !$status) Response::error('order_id and status required.', 422);
    try {
        $orders->updateOrderStatus($oid, $status, $adminId);
        Response::ok(['message' => 'Status updated.']);
    } catch (InvalidArgumentException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'assign_rider' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid     = (int) ($body['order_id'] ?? 0);
    $riderId = (int) ($body['rider_id'] ?? 0);
    if (!$oid || !$riderId) Response::error('order_id and rider_id required.', 422);
    try {
        $orders->assignRider($oid, $riderId, $adminId);
        Response::ok(['message' => 'Rider assigned.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'batch_assign_riders' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $orderIds = array_map('intval', $body['order_ids'] ?? []);
    $riderId  = (int) ($body['rider_id'] ?? 0);
    if (empty($orderIds) || !$riderId) Response::error('order_ids and rider_id required.', 422);
    try {
        $count = $orders->batchAssignRiders($orderIds, $riderId, $adminId);
        Response::ok(['message' => "$count order(s) assigned.", 'count' => $count]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'dispatch_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid = (int) ($body['order_id'] ?? 0);
    if (!$oid) Response::error('order_id required.', 422);
    try {
        $orders->dispatchOrder($oid, $adminId);
        Response::ok(['message' => 'Order dispatched.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'mark_delivered' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid = (int) ($body['order_id'] ?? 0);
    if (!$oid) Response::error('order_id required.', 422);
    try {
        $orders->completeDeliveryStaff($oid, $adminId);
        Response::ok(['message' => 'Order marked delivered.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'mark_oos' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid    = (int) ($body['order_id'] ?? 0);
    $itemId = (int) ($body['item_id']  ?? 0);
    if (!$oid || !$itemId) Response::error('order_id and item_id required.', 422);
    try {
        $newTotal = $orders->markOutOfStock($oid, $itemId, $adminId);
        Response::ok(['message' => 'Item marked OOS.', 'new_total' => $newTotal]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// ════════════════════════════════════════════════════════════════
//  RETURNS
// ════════════════════════════════════════════════════════════════
if ($action === 'returns') {
    $page  = max(1, (int) ($_GET['page']  ?? 1));
    $limit = max(1, (int) ($_GET['limit'] ?? 25));
    Response::ok(['data' => $orders->getFailedReturns($page, $limit)]);
}

if ($action === 'restock_return' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid = (int) ($body['order_id'] ?? 0);
    if (!$oid) Response::error('order_id required.', 422);
    // Restore items back to inventory via FIFO (reverse — add back to first batch)
    try {
        $orders->restockOrder($oid, $adminId);
        Response::ok(['message' => 'Items restocked to inventory.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'mark_spoiled' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid   = (int)    ($body['order_id'] ?? 0);
    $notes = trim($body['notes']         ?? 'Returned item marked as spoiled');
    if (!$oid) Response::error('order_id required.', 422);
    try {
        $orders->markSpoiled($oid, $adminId, $notes);
        Response::ok(['message' => 'Items recorded as spoiled.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// ════════════════════════════════════════════════════════════════
//  PRODUCTS
// ════════════════════════════════════════════════════════════════
if ($action === 'products') {
    $search     = trim($_GET['search']      ?? '');
    $categoryId = (int) ($_GET['category_id'] ?? 0);
    $status     = trim($_GET['status']      ?? '');
    Response::ok(['data' => $products->getAdminProducts($search, $categoryId, $status)]);
}

if ($action === 'product') {
    $pid = (int) ($_GET['product_id'] ?? 0);
    if (!$pid) Response::error('product_id required.', 422);
    $detail = $products->getAdminProduct($pid);
    if (!$detail) Response::error('Product not found.', 404);
    Response::ok(['data' => $detail]);
}

if ($action === 'save_product' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pid           = (int)    ($body['product_id']     ?? 0);
    $name          = trim($body['name']                ?? '');
    $description   = trim($body['description']         ?? '');
    $categoryId    = (int)    ($body['category_id']    ?? 0);
    $basePrice     = (float)  ($body['base_price']     ?? 0);
    $pricingModel  = trim($body['pricing_model']       ?? 'catch_weight');
    $estWeight     = (float)  ($body['estimated_weight'] ?? 0);
    $isFeatured    = (bool)   ($body['is_featured']    ?? false);
    $status        = trim($body['status']              ?? 'active');
    if (!$name || !$categoryId || $basePrice <= 0) {
        Response::error('name, category_id, and base_price are required.', 422);
    }
    try {
        $newPid = $products->saveProduct($pid, $name, $description, $categoryId,
                                         $basePrice, $pricingModel, $estWeight, $isFeatured, $status, $adminId);
        Response::ok(['message' => 'Product saved.', 'product_id' => $newPid]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'toggle_featured' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pid = (int) ($body['product_id'] ?? 0);
    if (!$pid) Response::error('product_id required.', 422);
    $newVal = $products->toggleFeatured($pid, $adminId);
    Response::ok(['message' => 'Featured toggled.', 'is_featured' => $newVal]);
}

if ($action === 'archive_product' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pid    = (int)    ($body['product_id'] ?? 0);
    $status = trim($body['status']          ?? 'archived');
    if (!$pid) Response::error('product_id required.', 422);
    $products->archiveProduct($pid, $status, $adminId);
    Response::ok(['message' => 'Product status updated.']);
}

if ($action === 'wholesale_tiers') {
    $pid = (int) ($_GET['product_id'] ?? 0);
    if (!$pid) Response::error('product_id required.', 422);
    Response::ok(['data' => $products->getTiers($pid)]);
}

if ($action === 'save_tier' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $tierId    = (int)   ($body['tier_id']        ?? 0);
    $pid       = (int)   ($body['product_id']     ?? 0);
    $minQty    = (int)   ($body['min_qty']         ?? 0);
    $tierUnit  = trim($body['tier_unit']           ?? '');
    $tierPrice = (float) ($body['tier_unit_price'] ?? 0);
    if (!$pid || $minQty <= 0 || $tierPrice <= 0) {
        Response::error('product_id, min_qty, and tier_unit_price are required.', 422);
    }
    $newId = $products->saveTier($tierId, $pid, $minQty, $tierUnit, $tierPrice);
    Response::ok(['message' => 'Tier saved.', 'tier_id' => $newId]);
}

if ($action === 'delete_tier' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $tierId = (int) ($body['tier_id']    ?? 0);
    $pid    = (int) ($body['product_id'] ?? 0);
    if (!$tierId || !$pid) Response::error('tier_id and product_id required.', 422);
    $products->deleteTier($tierId, $pid);
    Response::ok(['message' => 'Tier deleted.']);
}

// ════════════════════════════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════════════════════════════
if ($action === 'categories') {
    Response::ok(['data' => $products->getCategories()]);
}

if ($action === 'save_category' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $catId = (int)    ($body['category_id'] ?? 0);
    $name  = trim($body['name']             ?? '');
    if (!$name) Response::error('Category name required.', 422);
    $newId = $products->saveCategory($catId, $name);
    Response::ok(['message' => 'Category saved.', 'category_id' => $newId]);
}

if ($action === 'delete_category' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $catId = (int) ($body['category_id'] ?? 0);
    if (!$catId) Response::error('category_id required.', 422);
    try {
        $products->deleteCategory($catId);
        Response::ok(['message' => 'Category deleted.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// ════════════════════════════════════════════════════════════════
//  INVENTORY
// ════════════════════════════════════════════════════════════════
if ($action === 'inventory') {
    Response::ok(['data' => $inventory->getBatches()]);
}

if ($action === 'add_batch' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pid       = (int)    ($body['product_id'] ?? 0);
    $batchDate = trim($body['batch_date']      ?? '');
    $qty       = (float)  ($body['quantity']   ?? 0);
    if (!$pid || !$batchDate || $qty <= 0) {
        Response::error('product_id, batch_date, and quantity are required.', 422);
    }
    try {
        $result = $inventory->addBatch($pid, $batchDate, $qty);
        Response::ok(['message' => 'Batch added.', 'data' => $result]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'adjust_stock' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $batchId    = (int)    ($body['batch_id']   ?? 0);
    $newQty     = (float)  ($body['new_qty']    ?? 0);
    $reasonCode = trim($body['reason_code']     ?? 'Count Correction');
    $notes      = trim($body['notes']           ?? '');
    if (!$batchId) Response::error('batch_id required.', 422);
    try {
        $result = $inventory->adjustStock($batchId, $newQty, $reasonCode, $notes, $adminId);
        Response::ok(['message' => 'Stock adjusted.', 'data' => $result]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// ════════════════════════════════════════════════════════════════
//  USERS
// ════════════════════════════════════════════════════════════════
if ($action === 'users') {
    $role   = trim($_GET['role']   ?? '');
    $search = trim($_GET['search'] ?? '');
    $status = trim($_GET['status'] ?? '');
    Response::ok(['data' => $users->getAllUsers($role, $search, $status)]);
}

if ($action === 'save_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid   = (int)    ($body['user_id']    ?? 0);
    $first = trim($body['first_name']      ?? '');
    $last  = trim($body['last_name']       ?? '');
    $email = trim($body['email']           ?? '');
    $phone = trim($body['phone']           ?? '');
    $role  = trim($body['role']            ?? '');
    $pass  = $body['password']             ?? '';
    if (!$first || !$last || !$email || !$role) {
        Response::error('first_name, last_name, email, and role are required.', 422);
    }
    if ($uid === 0 && strlen($pass) < 8) {
        Response::error('Password must be at least 8 characters for new users.', 422);
    }
    try {
        $newId = $users->saveUser($uid, $first, $last, $email, $phone, $role, $pass, $adminId);
        Response::ok(['message' => 'User saved.', 'user_id' => $newId]);
    } catch (InvalidArgumentException $e) {
        Response::error($e->getMessage(), 422);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 409);
    }
}

if ($action === 'set_status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid    = (int)    ($body['user_id'] ?? 0);
    $status = trim($body['status']       ?? '');
    if (!$uid || !$status) Response::error('user_id and status required.', 422);
    try {
        $users->setUserStatus($uid, $status, $adminId);
        Response::ok(['message' => 'User status updated.']);
    } catch (InvalidArgumentException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// ════════════════════════════════════════════════════════════════
//  RIDERS
// ════════════════════════════════════════════════════════════════
if ($action === 'riders') {
    Response::ok(['data' => $users->getAllUsers('Delivery Rider', '', '')]);
}

if ($action === 'rider_performance') {
    $riderId  = (int)    ($_GET['rider_id']  ?? 0);
    $dateFrom = trim($_GET['date_from']      ?? '');
    $dateTo   = trim($_GET['date_to']        ?? '');
    if (!$riderId) Response::error('rider_id required.', 422);
    Response::ok(['data' => $reports->getRiderPerformance($riderId, $dateFrom, $dateTo)]);
}

if ($action === 'rider_summary') {
    $riderId = (int) ($_GET['rider_id'] ?? 0);
    if (!$riderId) Response::error('rider_id required.', 422);
    Response::ok(['data' => $reports->getRiderDailySummary($riderId)]);
}

if ($action === 'remittances') {
    $riderId = (int) ($_GET['rider_id'] ?? 0);
    // 0 means "all riders"; method handles it — never pass null to a typed int param.
    Response::ok(['data' => $reports->getRemittanceHistory($riderId)]);
}

if ($action === 'confirm_remittance' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $remitId = (int) ($body['remittance_id'] ?? 0);
    if (!$remitId) Response::error('remittance_id required.', 422);
    $reports->confirmRemittance($remitId, $adminId);
    Response::ok(['message' => 'Remittance confirmed.']);
}

// ════════════════════════════════════════════════════════════════
//  PAYMENTS
// ════════════════════════════════════════════════════════════════

// Pending GCash payments list (admin payment verification page)
if ($action === 'pending_gcash_payments') {
    $result = $orders->getPendingGCash();
    Response::ok(['data' => $result['rows'], 'count' => $result['count']]);
}

// Badge count only (used by loadSidebarCounts)
if ($action === 'payments_count') {
    Response::ok(['data' => ['count' => $orders->countPendingGCash()]]);
}

if ($action === 'verify_payment' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $oid = (int) ($body['order_id'] ?? 0);
    if (!$oid) Response::error('order_id required.', 422);
    $orders->verifyPayment($oid, $adminId);
    Response::ok(['message' => 'Payment verified.']);
}

// ════════════════════════════════════════════════════════════════
//  PROMOS
// ════════════════════════════════════════════════════════════════
if ($action === 'promos') {
    Response::ok(['data' => $reports->getPromos()]);
}

if ($action === 'save_promo' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pid          = (int)   ($body['promo_id']       ?? 0);
    $code         = trim($body['code']               ?? '');
    $discountType = trim($body['discount_type']      ?? 'flat');
    $discountVal  = (float) ($body['discount_value']  ?? 0);
    $minOrder     = (float) ($body['min_order_value'] ?? 0);
    $isActive     = (bool)  ($body['is_active']       ?? true);
    $validFrom    = ($body['valid_from'] ?? '') !== '' ? $body['valid_from'] : null;
    $validTo      = ($body['valid_to']   ?? '') !== '' ? $body['valid_to']   : null;
    $usageLimit   = isset($body['usage_limit']) && $body['usage_limit'] !== ''
                    ? (int) $body['usage_limit'] : null;
    if ($code === '') Response::error('Promo code is required.', 422);
    try {
        $promoId = $reports->savePromo(
            $pid, $code, $discountType, $discountVal,
            $minOrder, $isActive, $validFrom, $validTo, $usageLimit, $adminId
        );
        Response::ok(['message' => 'Promo saved.', 'promo_id' => $promoId]);
    } catch (InvalidArgumentException $e) {
        Response::error($e->getMessage(), 422);
    }
}

if ($action === 'delete_promo' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $promoId = (int) ($body['promo_id'] ?? 0);
    if (!$promoId) Response::error('promo_id required.', 422);
    $reports->deletePromo($promoId);
    Response::ok(['message' => 'Promo deactivated.']);
}

// ════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════
if ($action === 'settings') {
    Response::ok(['data' => $reports->getSettings()]);
}

if ($action === 'save_hours' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $dow       = (int)    ($body['day_of_week'] ?? -1);
    $isActive  = isset($body['is_active'])  ? (int) $body['is_active']  : null;
    $openTime  = isset($body['open_time'])  ? trim($body['open_time'])  : null;
    $closeTime = isset($body['close_time']) ? trim($body['close_time']) : null;
    if ($dow < 0 || $dow > 6) Response::error('day_of_week (0-6) required.', 422);
    $reports->saveHours($dow, $isActive, $openTime, $closeTime);
    Response::ok(['message' => 'Hours updated.']);
}

if ($action === 'save_zone' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $zoneId  = (int)   ($body['zone_id']        ?? 0);
    $muniId  = (int)   ($body['municipality_id'] ?? 0);
    $fee     = (float) ($body['delivery_fee']    ?? 0);
    if (!$muniId || $fee < 0) Response::error('municipality_id and delivery_fee required.', 422);
    $newId = $reports->saveZone($zoneId, $muniId, $fee);
    Response::ok(['message' => 'Zone saved.', 'zone_id' => $newId]);
}

if ($action === 'delete_zone' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $zoneId = (int) ($body['zone_id'] ?? 0);
    if (!$zoneId) Response::error('zone_id required.', 422);
    $reports->deleteZone($zoneId);
    Response::ok(['message' => 'Zone deleted.']);
}

if ($action === 'save_slot' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $slotId    = (int)    ($body['slot_id']    ?? 0);
    $label     = trim($body['slot_label']      ?? '');
    $startTime = trim($body['start_time']      ?? '');
    $endTime   = trim($body['end_time']        ?? '');
    $isActive  = (int)    ($body['is_active']  ?? 1);
    if (!$label || !$startTime || !$endTime) {
        Response::error('slot_label, start_time, and end_time required.', 422);
    }
    $newId = $reports->saveSlot($slotId, $label, $startTime, $endTime, $isActive);
    Response::ok(['message' => 'Slot saved.', 'slot_id' => $newId]);
}

if ($action === 'delete_slot' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $slotId = (int) ($body['slot_id'] ?? 0);
    if (!$slotId) Response::error('slot_id required.', 422);
    $reports->deleteSlot($slotId);
    Response::ok(['message' => 'Slot deleted.']);
}

// ════════════════════════════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════════════════════════════
if ($action === 'report') {
    $days     = max(1, (int) ($_GET['days']      ?? 30));
    $dateFrom = trim($_GET['date_from']          ?? '');
    $dateTo   = trim($_GET['date_to']            ?? '');
    Response::ok(['data' => $reports->getReport($days, $dateFrom, $dateTo)]);
}

if ($action === 'daily_prep') {
    $date = trim($_GET['date'] ?? date('Y-m-d'));
    Response::ok(['data' => $reports->getDailyPrep($date)]);
}

// ════════════════════════════════════════════════════════════════
//  DISPUTES
// ════════════════════════════════════════════════════════════════
if ($action === 'dispute') {
    $id = (int) ($_GET['id'] ?? $_GET['dispute_id'] ?? 0);
    if (!$id) Response::error('dispute_id required.', 422);
    $data = $orders->getDispute($id);
    if (!$data) Response::error('Dispute not found.', 404);
    Response::ok(['data' => $data]);
}

if ($action === 'disputes') {
    $status = trim($_GET['status'] ?? '');
    $page   = max(1, (int) ($_GET['page']  ?? 1));
    $limit  = max(1, (int) ($_GET['limit'] ?? 25));
    Response::ok(['data' => $orders->getDisputes($status, $page, $limit)]);
}

// Badge count for unresolved disputes (used by loadSidebarCounts)
if ($action === 'disputes_count') {
    Response::ok(['data' => ['count' => $orders->countOpenDisputes()]]);
}

if ($action === 'update_dispute' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $disputeId = (int)    ($body['dispute_id']       ?? 0);
    $notes     = trim($body['resolution_notes']       ?? '');
    $status    = trim($body['status']                 ?? '');
    
    if (!$disputeId || !in_array($status, ['Under Review', 'Resolved', 'Rejected'])) {
        Response::error('Invalid dispute data or status.', 422);
    }
    
    $orders->updateDispute($disputeId, $status, $notes, $adminId);
    Response::ok(['message' => 'Dispute updated successfully.']);
}

// ════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════════════
if ($action === 'send_notification' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid     = (int)    ($body['user_id'] ?? 0);
    $message = trim($body['message']      ?? '');
    $type    = trim($body['type']         ?? 'general');
    if (!$uid || !$message) Response::error('user_id and message required.', 422);
    $notifs->send($uid, $message, $type);
    Response::ok(['message' => 'Notification sent.']);
}

if ($action === 'notifications_poll') {
    Response::ok(['data' => $notifs->pollCancellations()]);
}

if ($action === 'notifications_count') {
    $data = $notifs->getForUser($adminId);
    Response::ok(['data' => ['unread_count' => $data['unread_count'] ?? 0]]);
}

if ($action === 'mark_notif_read' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $ids = array_map('intval', $body['notification_ids'] ?? []);
    if (empty($ids)) Response::error('notification_ids required.', 422);
    $notifs->markReadByIds($ids);
    Response::ok(['message' => 'Notifications marked read.']);
}

// ════════════════════════════════════════════════════════════════
//  AUDIT LOG
// ════════════════════════════════════════════════════════════════
if ($action === 'audit_log') {
    $page       = max(1, (int) ($_GET['page']        ?? 1));
    $actionFilter = trim($_GET['action_filter']       ?? '');
    $entityType = trim($_GET['entity_type']           ?? '');
    $dateFrom   = trim($_GET['date_from']             ?? '');
    $dateTo     = trim($_GET['date_to']               ?? '');
    $export     = (int) ($_GET['export']              ?? 0);
    $limit      = 50;


    if ($export === 1) {
        $res = $reports->getAuditLogs($actionFilter, $entityType, $dateFrom, $dateTo, 1, 0); // 0 limit = all
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=audit_log_' . date('Y-m-d') . '.csv');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'Details']);
        foreach ($res['logs'] as $log) {
            fputcsv($out, [
                $log['created_at'],
                $log['actor_name'] ?: 'System',
                $log['action'],
                $log['entity_type'],
                $log['entity_id'],
                $log['details']
            ]);
        }
        fclose($out);
        exit;
    }

    Response::ok(['data' => $reports->getAuditLogs($actionFilter, $entityType, $dateFrom, $dateTo, $page, $limit)]);
}


if ($action === 'returns_count') {
    Response::ok(['data' => ['count' => $orders->countFailedReturns()]]);
}

// ── Fallback ──────────────────────────────────────────────────────
Response::error('Invalid action.', 400);