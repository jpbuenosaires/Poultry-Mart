// rider/statusActions.js — rider portal: start / arrived / undo / generic status actions
'use strict';

/* ════════════════════════════════════════════════════════════
   ACTION: START DELIVERY  (Packed → Out for Delivery)
═══════════════════════════════════════════════════════════════*/

function confirmStartDelivery(orderId, orderNum) {
  document.getElementById('rider-confirm-title').textContent  = 'Start Delivery';
  document.getElementById('rider-confirm-body').textContent   =
    `Are you ready to pick up and deliver Order ${orderNum}?`;
  document.getElementById('rider-confirm-icon').textContent   = '🚴';
  document.getElementById('rider-confirm-amount').hidden      = true;
  document.getElementById('rider-confirm-ok').textContent     = 'Yes, Start';
  document.getElementById('rider-confirm-ok').className       = 'btn-primary';

  rConfirm.previousFocus = document.activeElement;
  rConfirm.onOk          = async () => {
    closeConfirm();
    await updateOrderStatus(orderId, 'Out for Delivery');
  };

  openAccessibleModal('rider-confirm-overlay', 'rider-confirm-ok');
}

/* ════════════════════════════════════════════════════════════
   ACTION: MARK ARRIVED  (Out for Delivery → Arrived at Location)
═══════════════════════════════════════════════════════════════*/

async function markArrived(orderId) {
  await updateOrderStatus(orderId, 'Arrived at Location');
}

/* ════════════════════════════════════════════════════════════
   ACTION: UNDO  (revert to a previous status)
═══════════════════════════════════════════════════════════════*/

function undoStatus(orderId, targetStatus, orderNum) {
  document.getElementById('rider-confirm-title').textContent  = 'Undo Status';
  document.getElementById('rider-confirm-body').textContent   =
    `Revert Order ${orderNum} back to "${targetStatus}"?`;
  document.getElementById('rider-confirm-icon').textContent   = '↩️';
  document.getElementById('rider-confirm-amount').hidden      = true;
  document.getElementById('rider-confirm-ok').textContent     = 'Yes, Undo';
  document.getElementById('rider-confirm-ok').className       = 'btn-outline';

  rConfirm.previousFocus = document.activeElement;
  rConfirm.onOk          = async () => {
    closeConfirm();
    await updateOrderStatus(orderId, targetStatus);
  };

  openAccessibleModal('rider-confirm-overlay', 'rider-confirm-ok');
}

/* ════════════════════════════════════════════════════════════
   GENERIC STATUS UPDATE
═══════════════════════════════════════════════════════════════*/

async function updateOrderStatus(orderId, newStatus) {
  const res = await apiPost('update_status', { order_id: orderId, status: newStatus });
  if (res.success) {
    toast(res.message || `Status updated to ${newStatus}.`, 'success');
    closeOrderModal();
    refreshCurrentPage();
  } else {
    toast(res.message || 'Failed to update status.', 'error');
  }
}

