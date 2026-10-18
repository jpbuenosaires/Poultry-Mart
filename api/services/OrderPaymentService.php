<?php
/**
 * OrderPaymentService — Payment verification and rider cash remittance.
 *
 * Part of the OrderService split; callers use the OrderService facade.
 */
class OrderPaymentService extends BaseService
{
    /**
     * Mark a payment as verified.
     */
    public function verifyPayment(int $oid, int $verifiedBy): void
    {
        $this->execute(
            "UPDATE payments SET status = 'Paid', verified_by = ?, verified_at = NOW() WHERE order_id = ?",
            'ii',
            [$verifiedBy, $oid]
        );
    }

    /**
     * Submit a COD cash remittance record.
     */
    public function remitCash(int $riderId, float $amount, string $notes): void
    {
        if ($amount <= 0) {
            throw new InvalidArgumentException('Remittance amount must be greater than zero.');
        }
        $this->beginTransaction();
        try {
            $this->execute(
                "INSERT INTO cash_remittances (rider_id, amount, notes, remitted_at, status)
                 VALUES (?, ?, ?, NOW(), 'Pending')",
                'ids',
                [$riderId, $amount, $notes]
            );
            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'remit_cash', 'rider', ?, ?)",
                'iis',
                [$riderId, $riderId, "Rider submitted remittance of $amount"]
            );
            $this->commit();
        } catch (Throwable $ex) {
            $this->rollback();
            throw $ex;
        }
    }
}
