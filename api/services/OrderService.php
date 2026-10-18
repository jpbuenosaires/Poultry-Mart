<?php
/**
 * OrderService — facade over the Order*Service classes.
 *
 * Keeps the original public API so controllers are unchanged; each method
 * only delegates. Logic lives in:
 *   OrderQueryService — Paginated order lists/details for staff, customers and riders, plus small count/list lookups.
 *   OrderCheckoutService — Customer order placement (stock locking, promo, proof upload, notifications).
 *   OrderModificationService — Editing an existing order: customer edits of pending orders and admin edits.
 *   OrderPackingService — Packing orders (admin and FIFO fulfillment) and out-of-stock handling.
 *   OrderLifecycleService — Order status state machine and cancellation.
 *   OrderDeliveryService — Rider assignment, dispatch and delivery completion/failure (staff and rider sides).
 *   OrderPaymentService — Payment verification and rider cash remittance.
 *   OrderDisputeService — Customer disputes, failed-delivery returns, restock and spoilage.
 */
class OrderService extends BaseService
{
    private OrderQueryService $query;
    private OrderCheckoutService $checkout;
    private OrderModificationService $modification;
    private OrderPackingService $packing;
    private OrderLifecycleService $lifecycle;
    private OrderDeliveryService $delivery;
    private OrderPaymentService $payment;
    private OrderDisputeService $dispute;

    public function __construct(mysqli $conn)
    {
        parent::__construct($conn);
        $this->query = new OrderQueryService($conn);
        $this->checkout = new OrderCheckoutService($conn);
        $this->modification = new OrderModificationService($conn);
        $this->packing = new OrderPackingService($conn);
        $this->lifecycle = new OrderLifecycleService($conn);
        $this->delivery = new OrderDeliveryService($conn);
        $this->payment = new OrderPaymentService($conn);
        $this->dispute = new OrderDisputeService($conn);
    }

    public function getOrders(string $status, string $search, int $page, int $limit, string $extraSelect = '', string $extraJoin = '', string $orderBy = 'o.created_at DESC'): array
    {
        return $this->query->getOrders($status, $search, $page, $limit, $extraSelect, $extraJoin, $orderBy);
    }

    public function getOrderDetail(int $oid): ?array
    {
        return $this->query->getOrderDetail($oid);
    }

    public function getCustomerOrderDetail(int $oid): ?array
    {
        return $this->query->getCustomerOrderDetail($oid);
    }

    public function getRiderOrderDetail(int $oid): ?array
    {
        return $this->query->getRiderOrderDetail($oid);
    }

    public function placeOrder(int $uid, int $addressId, int $slotId, int $zoneId, string $paymentMethod, string $deliveryDate, string $specialInstructions, string $promoCode, ?string $gcashReference = null, ?string $gcashReceiptBase64 = null): array
    {
        return $this->checkout->placeOrder($uid, $addressId, $slotId, $zoneId, $paymentMethod, $deliveryDate, $specialInstructions, $promoCode, $gcashReference, $gcashReceiptBase64);
    }

    public function updatePendingOrder(int $orderId, int $uid, string $deliveryDate, int $slotId, int $zoneId, string $paymentMethod, string $specialInstructions): void
    {
        $this->modification->updatePendingOrder($orderId, $uid, $deliveryDate, $slotId, $zoneId, $paymentMethod, $specialInstructions);
    }

    public function packOrderAdmin(int $oid, array $items, int $actorId): float
    {
        return $this->packing->packOrderAdmin($oid, $items, $actorId);
    }

    public function packOrderFulfillment(int $oid, array $items, int $staffId): array
    {
        return $this->packing->packOrderFulfillment($oid, $items, $staffId);
    }

    public function cancelOrder(int $oid, int $initiatorId, string $reason, bool $customerInitiated = false): void
    {
        $this->lifecycle->cancelOrder($oid, $initiatorId, $reason, $customerInitiated);
    }

    public function adminEditOrder(int $orderId, array $items, ?string $promoCode, ?string $deliveryDate, ?int $slotId, int $adminId): void
    {
        $this->modification->adminEditOrder($orderId, $items, $promoCode, $deliveryDate, $slotId, $adminId);
    }

    public function updateOrderStatus(int $oid, string $status, int $adminId): void
    {
        $this->lifecycle->updateOrderStatus($oid, $status, $adminId);
    }

    public function verifyPayment(int $oid, int $verifiedBy): void
    {
        $this->payment->verifyPayment($oid, $verifiedBy);
    }

    public function assignRider(int $oid, int $riderId, int $assignedBy): void
    {
        $this->delivery->assignRider($oid, $riderId, $assignedBy);
    }

    public function batchAssignRiders(array $orderIds, int $riderId, int $staffId): int
    {
        return $this->delivery->batchAssignRiders($orderIds, $riderId, $staffId);
    }

    public function dispatchOrder(int $oid, int $staffId): void
    {
        $this->delivery->dispatchOrder($oid, $staffId);
    }

    public function completeDeliveryStaff(int $oid, int $staffId): void
    {
        $this->delivery->completeDeliveryStaff($oid, $staffId);
    }

    public function markOutOfStock(int $oid, int $itemId, int $staffId): float
    {
        return $this->packing->markOutOfStock($oid, $itemId, $staffId);
    }

    public function getRiderOrders(int $riderId, string $statusFilter, string $dateFilter): array
    {
        return $this->query->getRiderOrders($riderId, $statusFilter, $dateFilter);
    }

    public function verifyRiderAssignment(int $oid, int $riderId): bool
    {
        return $this->delivery->verifyRiderAssignment($oid, $riderId);
    }

    public function riderUpdateStatus(int $oid, int $riderId, string $status): void
    {
        $this->delivery->riderUpdateStatus($oid, $riderId, $status);
    }

    public function riderCompleteOrder(int $oid, int $riderId, string $proofUrl): void
    {
        $this->delivery->riderCompleteOrder($oid, $riderId, $proofUrl);
    }

    public function uploadPod(int $oid, int $riderId, string $proofUrl): void
    {
        $this->delivery->uploadPod($oid, $riderId, $proofUrl);
    }

    public function failedDelivery(int $oid, int $riderId, string $reason, string $notes): void
    {
        $this->delivery->failedDelivery($oid, $riderId, $reason, $notes);
    }

    public function remitCash(int $riderId, float $amount, string $notes): void
    {
        $this->payment->remitCash($riderId, $amount, $notes);
    }

    public function fileDispute(int $uid, int $oid, string $description, string $evidenceUrl): int
    {
        return $this->dispute->fileDispute($uid, $oid, $description, $evidenceUrl);
    }

    public function getDispute(int $id): ?array
    {
        return $this->dispute->getDispute($id);
    }

    public function getDisputes(string $status, int $page, int $limit): array
    {
        return $this->dispute->getDisputes($status, $page, $limit);
    }

    public function countOpenDisputes(): int
    {
        return $this->dispute->countOpenDisputes();
    }

    public function updateDispute(int $disputeId, string $status, string $notes, int $adminId): void
    {
        $this->dispute->updateDispute($disputeId, $status, $notes, $adminId);
    }

    public function getFailedReturns(int $page, int $limit): array
    {
        return $this->dispute->getFailedReturns($page, $limit);
    }

    public function restockOrder(int $oid, int $adminId): void
    {
        $this->dispute->restockOrder($oid, $adminId);
    }

    public function markSpoiled(int $oid, int $adminId, string $notes): void
    {
        $this->dispute->markSpoiled($oid, $adminId, $notes);
    }

    public function getPendingGCash(): array
    {
        return $this->query->getPendingGCash();
    }

    public function countPendingGCash(): int
    {
        return $this->query->countPendingGCash();
    }

    public function countFailedReturns(): int
    {
        return $this->dispute->countFailedReturns();
    }

    public function getUserOrders(int $uid): array
    {
        return $this->query->getUserOrders($uid);
    }
}
