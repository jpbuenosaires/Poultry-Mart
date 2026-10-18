<?php
/**
 * PoultryMart — Customer API Controller
 *
 * Thin router: parse input → call service → emit Response.
 * No SQL lives here.
 */

// ── Guarantee a clean JSON response on every code path ───────────
// Without these three lines, any PHP notice/warning (e.g. "Undefined index",
// deprecated call, or an uncaught exception) gets prepended to the output as
// plain text.  The browser then receives "Notice: …{…json…}" which is not
// valid JSON, res.json() throws a SyntaxError, and products silently fail to
// load — intermittently, depending on which code path triggered the notice.
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');          // never mix PHP errors into our JSON
error_reporting(E_ALL);                  // still log them server-side

set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage(),
    ]);
    exit;
});

require_once __DIR__ . '/db.php';

// Ensure all API endpoints operate in local Philippine time
date_default_timezone_set('Asia/Manila');

$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// ── Service instances ────────────────────────────────────────────
$auth      = new AuthService($conn);
$users     = new UserService($conn);
$products  = new ProductService($conn);
$cart      = new CartService($conn);
$orders    = new OrderService($conn);
$notifs    = new NotificationService($conn);
$reports   = new ReportService($conn);

// ════════════════════════════════════════════════════════════════
//  AUTH — REGISTER
// ════════════════════════════════════════════════════════════════
if ($action === 'register') {
    $first = trim($body['first_name'] ?? '');
    $last  = trim($body['last_name']  ?? '');
    $email = trim($body['email']      ?? '');
    $phone = trim($body['phone']      ?? '');
    $pass  = $body['password']        ?? '';

    if (!$first || !$last || !$email || !$pass) {
        Response::error('first_name, last_name, email, and password are required.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Response::error('Invalid email address.', 422);
    }
    if (strlen($pass) < 8) {
        Response::error('Password must be at least 8 characters.', 422);
    }

    try {
        $newId = $users->saveUser(0, $first, $last, $email, $phone, 'Customer', $pass);
        Response::ok([
            'message' => 'Registration successful.',
            'user'    => [
                'user_id'    => $newId,
                'first_name' => $first,
                'last_name'  => $last,
                'email'      => $email,
                'role'       => 'Customer',
            ],
        ], 201);
    } catch (InvalidArgumentException $e) {
        Response::error($e->getMessage(), 422);
    } catch (RuntimeException $e) {
        // Duplicate email surfaces here from the DB unique constraint
        Response::error($e->getMessage(), 409);
    }
}

// ════════════════════════════════════════════════════════════════
//  AUTH — LOGIN
// ════════════════════════════════════════════════════════════════
if ($action === 'login') {
    $result = $auth->login(
        trim($body['email']    ?? ''),
        $body['password']      ?? ''
    );
    if (!$result['success']) {
        Response::error($result['message'], 401);
    }
    $_SESSION['customer_id'] = $result['user']['user_id'];
    Response::ok(['message' => $result['message'], 'user' => $result['user']]);
}

if ($action === 'logout') {
    unset($_SESSION['customer_id']);
    Response::ok(['message' => 'Logged out.']);
}

// ════════════════════════════════════════════════════════════════
//  AUTH — SESSION CHECK  (called on every page load / refresh)
//  Returns the current session user, or null if not logged in.
// ════════════════════════════════════════════════════════════════
if ($action === 'me') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    if (!$uid) {
        Response::ok(['user' => null]);
    }
    $profile = $users->getProfile($uid);
    if (!$profile) {
        unset($_SESSION['customer_id']); // stale session — clean it up
        Response::ok(['user' => null]);
    }
    Response::ok(['user' => $profile]);
}

// ════════════════════════════════════════════════════════════════
//  PROFILE — GET
// ════════════════════════════════════════════════════════════════
if ($action === 'profile' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    $profile = $users->getProfile($uid);
    if (!$profile) Response::error('User not found.', 404);
    Response::ok(['data' => $profile]);
}

// ════════════════════════════════════════════════════════════════
//  PROFILE — UPDATE
// ════════════════════════════════════════════════════════════════
if ($action === 'update_profile' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid   = (int) ($_SESSION['customer_id'] ?? 0);
    $first = trim($body['first_name']   ?? '');
    $last  = trim($body['last_name']    ?? '');
    $phone = trim($body['phone']        ?? '');
    if (!$uid) Response::error('Unauthorized.', 401);
    $users->updateProfile($uid, $first, $last, $phone);
    Response::ok(['message' => 'Profile updated.', 'data' => $users->getProfile($uid)]);
}

if ($action === 'change_password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid         = (int)   ($_SESSION['customer_id'] ?? 0);
    $currentPass = (string)($body['current_password'] ?? '');
    $newPass     = (string)($body['new_password']     ?? '');
 
    if (!$uid)              Response::error('Unauthorized.', 401);
    if (!$currentPass)      Response::error('current_password required.', 422);
    if (strlen($newPass) < 8) Response::error('New password must be at least 8 characters.', 422);
 
try {
        $users->changeCustomerPassword($uid, $currentPass, $newPass);
        Response::ok(['message' => 'Password changed successfully.']);
    } catch (InvalidArgumentException $e) {
        Response::error($e->getMessage(), 422);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 401);
    }
}

// ════════════════════════════════════════════════════════════════
//  SERVER TIME  (Asia/Manila) — used by client for slot validation
// ════════════════════════════════════════════════════════════════
if ($action === 'server_time') {
    Response::ok([
        'data' => [
            'date'  => date('Y-m-d'),        // e.g. "2025-04-10"
            'time'  => date('H:i'),           // e.g. "14:35"
            'dow'   => (int) date('w'),       // 0=Sun … 6=Sat
        ],
    ]);
}

if ($action === 'cart_stock') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
 
    $cartData   = $cart->getCart($uid);
    $productIds = array_column($cartData['items'], 'product_id');
 
    if (empty($productIds)) {
        Response::ok(['data' => []]);
    }
 
    $stockMap = $cart->getStockLevels(array_map('intval', $productIds));
    Response::ok(['data' => $stockMap]);
}

if ($action === 'product_stock') {
    $pid = (int) ($_GET['product_id'] ?? 0);
    if (!$pid) Response::error('product_id required.', 422);
 
    $map = $cart->getStockLevels([$pid]);
    Response::ok(['data' => ['product_id' => $pid, 'remaining_qty' => $map[$pid] ?? 0]]);
}

if ($action === 'products_with_stock') {
    $catId  = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
    $search = trim($_GET['search'] ?? '');
    $sort   = $_GET['sort'] ?? '';
 
    // Extend product data with remaining_qty from product_batches
    $page     = max(1, (int) ($_GET['page']      ?? 1));
    $pageSize = max(1, min(100, (int) ($_GET['page_size'] ?? 24))); // cap at 100
    $offset   = ($page - 1) * $pageSize;

    $data     = $products->getActiveWithStock($catId, $search, $sort, $pageSize, $offset);
    $total    = $products->countActiveWithStock($catId, $search);
    Response::ok([
        'data'       => $data,
        'count'      => count($data),
        'total'      => $total,
        'page'       => $page,
        'page_size'  => $pageSize,
        'has_more'   => ($offset + $pageSize) < $total,
    ]);
}
// ════════════════════════════════════════════════════════════════
//  PROFILE — ADD ADDRESS
// ════════════════════════════════════════════════════════════════
if ($action === 'add_address') {
    $uid          = (int) ($_SESSION['customer_id'] ?? 0);
    $label        = $body['label']        ?? 'Home';
    $street       = $body['street']       ?? '';
    $barangayId   = (int) ($body['barangay_id']   ?? 0);
    $municipalityId = (int) ($body['municipality_id'] ?? 0);
    $isDef        = !empty($body['is_default']);

    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$street || !$barangayId || !$municipalityId) {
        Response::error('street, barangay_id, and municipality_id are required.', 422);
    }
    $users->addAddress($uid, $label, $street, $barangayId, $municipalityId, $isDef);
    Response::ok(['message' => 'Address added.', 'data' => $users->getProfile($uid)]);
}

// ════════════════════════════════════════════════════════════════
//  PROFILE — DELETE ADDRESS
// ════════════════════════════════════════════════════════════════
if ($action === 'delete_address') {
    $uid    = (int) ($_SESSION['customer_id'] ?? 0);
    $addrId = (int) ($body['address_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$addrId) Response::error('address_id is required.', 422);
    $users->deleteAddress($uid, $addrId);
    Response::ok(['message' => 'Address deleted.', 'data' => $users->getProfile($uid)]);
}

// ════════════════════════════════════════════════════════════════
//  PROFILE — UPDATE ADDRESS
// ════════════════════════════════════════════════════════════════
if ($action === 'update_address' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid      = (int) ($_SESSION['customer_id'] ?? 0);
    $addrId   = (int) ($body['address_id'] ?? 0);
    $label          = trim($body['label']           ?? 'Home');
    $street         = trim($body['street']          ?? '');
    $barangayId     = (int) ($body['barangay_id']   ?? 0);
    $municipalityId = (int) ($body['municipality_id'] ?? 0);
    $isDef          = !empty($body['is_default']);

    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$addrId || !$street || !$barangayId || !$municipalityId) {
        Response::error('address_id, street, barangay_id, and municipality_id are required.', 422);
    }
    try {
        $users->updateAddress($uid, $addrId, $label, $street, $barangayId, $municipalityId, $isDef);
        Response::ok(['message' => 'Address updated.', 'data' => $users->getProfile($uid)]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    }
}

// ════════════════════════════════════════════════════════════════
//  CATALOGUE — CATEGORIES
// ════════════════════════════════════════════════════════════════
if ($action === 'categories') {
    Response::ok(['data' => $products->getCategories()]);
}

// ════════════════════════════════════════════════════════════════
//  CATALOGUE — PRODUCTS LIST
// ════════════════════════════════════════════════════════════════
if ($action === 'products') {
    $catId  = isset($_GET['category_id']) ? (int) $_GET['category_id'] : null;
    $search = trim($_GET['search'] ?? '');
    $sort   = $_GET['sort'] ?? '';
    $data   = $products->getActiveProducts($catId, $search, $sort);
    Response::ok(['data' => $data, 'count' => count($data)]);
}

// ════════════════════════════════════════════════════════════════
//  CATALOGUE — SINGLE PRODUCT
// ════════════════════════════════════════════════════════════════
if ($action === 'product') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) Response::error('id required.', 422);
    $row = $products->getProduct($id);
    if (!$row) Response::error('Product not found.', 404);
    Response::ok(['data' => $row]);
}

// ════════════════════════════════════════════════════════════════
//  CART — GET
// ════════════════════════════════════════════════════════════════
if ($action === 'cart') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    Response::ok(['data' => $cart->getCart($uid)]);
}

// ════════════════════════════════════════════════════════════════
//  CART — ADD / UPDATE ITEM
// ════════════════════════════════════════════════════════════════
if ($action === 'cart_add') {
    $uid       = (int) ($_SESSION['customer_id'] ?? 0);
    $productId = (int) ($body['product_id'] ?? 0);
    $quantity  = (int) ($body['quantity']   ?? 1);
    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$productId || $quantity < 1) {
        Response::error('product_id and quantity (≥1) are required.', 422);
    }
    try {
        $cartData = $cart->addItem($uid, $productId, $quantity);
        Response::ok(['message' => 'Cart updated.', 'data' => $cartData]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 404);
    }
}

// ════════════════════════════════════════════════════════════════
//  CART — REMOVE ITEM
// ════════════════════════════════════════════════════════════════
if ($action === 'cart_remove') {
    $uid       = (int) ($_SESSION['customer_id'] ?? 0);
    $productId = (int) ($body['product_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$productId) Response::error('product_id is required.', 422);
    $cartData = $cart->removeItem($uid, $productId);
    Response::ok(['message' => 'Item removed.', 'data' => $cartData]);
}

// ════════════════════════════════════════════════════════════════
//  CART — CLEAR
// ════════════════════════════════════════════════════════════════
if ($action === 'cart_clear') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    $cart->clearCart($uid);
    Response::ok(['message' => 'Cart cleared.']);
}

// ════════════════════════════════════════════════════════════════
//  CHECKOUT — META
// ════════════════════════════════════════════════════════════════
if ($action === 'checkout_meta') {
    Response::ok(['data' => $reports->getCheckoutMeta()]);
}

if ($action === 'validate_promo') {
    $code        = strtoupper(trim($body['code']        ?? ''));
    $orderTotal  = (float) ($body['order_total']        ?? 0);
 
    if (!$code) {
        Response::error('Promo code is required.', 422);
    }
 
    $promo = $reports->findPromoByCode($code);
 
    if (!$promo) {
        Response::error('Promo code not found.', 404);
    }
    if (!$promo['is_active']) {
        Response::error('This promo code is no longer active.', 422);
    }
 
    $today = date('Y-m-d');
    if ($promo['valid_from'] && $today < $promo['valid_from']) {
        Response::error('This promo code is not yet valid.', 422);
    }
    if ($promo['valid_to'] && $today > $promo['valid_to']) {
        Response::error('This promo code has expired.', 422);
    }
    if ($promo['usage_limit'] !== null && (int)$promo['times_used'] >= (int)$promo['usage_limit']) {
        Response::error('This promo code has reached its usage limit.', 422);
    }
    if ($promo['min_order_value'] > 0 && $orderTotal < (float)$promo['min_order_value']) {
        Response::error(
            'Minimum order of ' . number_format($promo['min_order_value'], 2) . ' required for this promo.',
            422
        );
    }
 
    // Calculate preview discount
    $discount = 0;
    if ($promo['discount_type'] === 'percentage') {
        $discount = round($orderTotal * $promo['discount_value'] / 100, 2);
    } else {
        $discount = round((float) $promo['discount_value'], 2);
    }
    $discount = min($discount, $orderTotal);
 
    Response::ok([
        'message'        => 'Promo code applied successfully!',
        'promo'          => [
            'promo_id'       => (int)   $promo['promo_id'],
            'code'           => $promo['code'],
            'discount_type'  => $promo['discount_type'],
            'discount_value' => (float) $promo['discount_value'],
            'min_order_value'=> (float) $promo['min_order_value'],
        ],
        'discount_amount'=> $discount,
        'new_total'      => round($orderTotal - $discount, 2),
    ]);
}

// ════════════════════════════════════════════════════════════════
//  ORDERS — PLACE
// ════════════════════════════════════════════════════════════════
if ($action === 'place_order') {
    $uid    = (int) ($_SESSION['customer_id'] ?? 0);
    $addrId = (int) ($body['address_id'] ?? 0);
    $slotId = (int) ($body['slot_id']    ?? 0);
    $zoneId = (int) ($body['zone_id']    ?? 0);
    $pm     = $body['payment_method']           ?? 'COD';
    $dd     = $body['delivery_date']            ?? date('Y-m-d', strtotime('+1 day'));
    $si     = $body['special_instructions']     ?? '';
    $promo  = $body['promo_code']               ?? '';
    $gcashRef = $body['gcash_reference']        ?? null;
    $gcashRec = $body['gcash_receipt']          ?? null;

    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$addrId) Response::error('address_id is required.', 422);
    if (!in_array($pm, ['COD', 'GCash'], true)) Response::error('payment_method must be COD or GCash.', 422);
 
    // [NEW] Mid-session account-status guard
    try { $users->checkUserActive($uid); } catch (RuntimeException $e) { Response::error($e->getMessage(), 403); }
 
    try {
        $result = $orders->placeOrder($uid, $addrId, $slotId, $zoneId, $pm, $dd, $si, $promo, $gcashRef, $gcashRec);
        Response::ok([
            'message'         => 'Order placed successfully!',
            'order_number'    => $result['order_number'],
            'order_id'        => $result['order_id'],
            'estimated_total' => $result['estimated_total'],
        ]);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// ════════════════════════════════════════════════════════════════
//  ORDERS — EDIT PENDING
// ════════════════════════════════════════════════════════════════
if ($action === 'edit_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid      = (int)    ($_SESSION['customer_id'] ?? 0);
    $oid      = (int)    ($body['order_id']             ?? 0);
    $date     = (string) ($body['delivery_date']        ?? '');
    $slotId   = (int)    ($body['slot_id']              ?? 0);
    $zoneId   = (int)    ($body['zone_id']              ?? 0);
    $pm       = (string) ($body['payment_method']       ?? 'COD');
    $si       = (string) ($body['special_instructions'] ?? '');

    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$oid || !$date) {
        Response::error('order_id and delivery_date are required.', 422);
    }
    try {
        $orders->updatePendingOrder($oid, $uid, $date, $slotId, $zoneId, $pm, $si);
        Response::ok(['message' => 'Order updated successfully.']);
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 422);
    }
}

// ════════════════════════════════════════════════════════════════
//  ORDERS — LIST (customer)
// ════════════════════════════════════════════════════════════════
if ($action === 'orders') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);

    $userOrders = $orders->getUserOrders($uid);

    Response::ok(['data' => $userOrders]);
}

// ════════════════════════════════════════════════════════════════
//  ORDERS — SINGLE DETAIL (customer)
// ════════════════════════════════════════════════════════════════
if ($action === 'order') {
    $oid = (int) ($_GET['order_id'] ?? 0);
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    
    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$oid) Response::error('order_id is required.', 422);
    
    $order = $orders->getCustomerOrderDetail($oid);
    if (!$order) Response::error('Order not found.', 404);
    
    // Security constraint: Ensure the order belongs to the requesting user
    if ((int) $order['user_id'] !== $uid) {
        Response::error('You do not have permission to view this order.', 403);
    }
    
    Response::ok(['data' => $order]);
}

// ════════════════════════════════════════════════════════════════
//  ORDERS — CANCEL (customer; Pending only)
// ════════════════════════════════════════════════════════════════
if ($action === 'cancel_order') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    $oid = (int) ($body['order_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$oid) Response::error('order_id is required.', 422);
    try {
        $reason = trim($body['reason'] ?? 'Customer cancellation');
        $orders->cancelOrder($oid, $uid, $reason ?: 'Customer cancellation', true);
        Response::ok(['message' => 'Order cancelled successfully.']);
    } catch (RuntimeException $e) {
        $code = str_contains($e->getMessage(), 'not found') ? 404 : 422;
        Response::error($e->getMessage(), $code);
    }
}

// ════════════════════════════════════════════════════════════════
//  REVIEWS — ADD
// ════════════════════════════════════════════════════════════════
if ($action === 'add_review') {
    $uid       = (int) ($_SESSION['customer_id'] ?? 0);
    $productId = (int) ($body['product_id']  ?? 0);
    $oid       = (int) ($body['order_id']    ?? 0);
    $rating    = (int) ($body['rating']      ?? 0);
    $text      = trim($body['review_text']   ?? '');

    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$productId || !$oid || $rating < 1 || $rating > 5) {
        Response::error('product_id, order_id, and a rating 1–5 are required.', 422);
    }
    try {
        $products->addReview($uid, $productId, $oid, $rating, $text);
        Response::ok(['message' => 'Review submitted. Thank you!']);
    } catch (RuntimeException $e) {
        $code = str_contains($e->getMessage(), 'already') ? 409 : 403;
        Response::error($e->getMessage(), $code);
    }
}

// ════════════════════════════════════════════════════════════════
//  DISPUTES — FILE
// ════════════════════════════════════════════════════════════════
if ($action === 'file_dispute') {
    $uid         = (int) ($_SESSION['customer_id'] ?? 0);
    $oid         = (int) ($body['order_id']     ?? 0);
    $description = trim($body['description']    ?? '');
    // Support the base64 evidence_data payload sent by the frontend
    $evidence    = trim($body['evidence_data']  ?? $body['evidence_url'] ?? '');

    if (!$uid) Response::error('Unauthorized.', 401);
    if (!$oid || !$description) {
        Response::error('order_id and description are required.', 422);
    }
    try {
        $disputeId = $orders->fileDispute($uid, $oid, $description, $evidence);
        Response::ok([
            'message'    => 'Dispute filed successfully. Our team will review it shortly.',
            'dispute_id' => $disputeId,
        ]);
    } catch (RuntimeException $e) {
        $code = str_contains($e->getMessage(), 'not found') ? 404 : 422;
        Response::error($e->getMessage(), $code);
    }
}

// ════════════════════════════════════════════════════════════════
//  NOTIFICATIONS — GET
// ════════════════════════════════════════════════════════════════
if ($action === 'notifications') {
    $uid = (int) ($_SESSION['customer_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    $data = $notifs->getForUser($uid);
    Response::ok(['data' => $data['notifications'], 'unread_count' => $data['unread_count']]);
}

// ════════════════════════════════════════════════════════════════
//  NOTIFICATIONS — MARK READ
// ════════════════════════════════════════════════════════════════
if ($action === 'mark_read') {
    $uid   = (int) ($_SESSION['customer_id'] ?? 0);
    $notif = (int) ($body['notification_id'] ?? 0);
    if (!$uid) Response::error('Unauthorized.', 401);
    $notifs->markRead($uid, $notif);
    Response::ok(['message' => 'Notification(s) marked as read.']);
}

// ════════════════════════════════════════════════════════════════
//  GEO DATA — municipalities and their barangays
// ════════════════════════════════════════════════════════════════
if ($action === 'geo_data') {
    Response::ok(['data' => $users->getGeoData()]);
}

Response::error('Invalid action.', 400);