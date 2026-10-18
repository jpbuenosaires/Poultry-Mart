// fulfillment/keyboard.js — fulfillment portal: keyboard accessibility handlers
'use strict';

/* ════════════════════════════════════════════════════════════
   KEYBOARD ACCESSIBILITY
═══════════════════════════════════════════════════════════════*/

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('pack-modal-overlay').style.display        !== 'none') closePackModalDirect();
  if (document.getElementById('assign-modal-overlay').style.display      !== 'none') closeAssignModalDirect();
  if (document.getElementById('detail-modal-overlay').style.display      !== 'none') closeDetailModalDirect();
  if (document.getElementById('adjust-stock-modal-overlay').style.display !== 'none') closeAdjustStockModal();
  if (document.getElementById('batch-assign-modal-overlay').style.display !== 'none') closeBatchAssignModal();
  if (document.getElementById('prep-sheet-modal-overlay').style.display  !== 'none') closePrepSheetModal();
  if (document.getElementById('pod-modal-overlay').style.display         !== 'none') closePodModal();
  if (document.getElementById('dispatch-confirm-overlay').style.display  !== 'none') closeDispatchConfirm();
  if (document.getElementById('cancel-overlay').style.display            !== 'none') dismissCancelOverlay();
  const notifPanel = document.getElementById('notif-panel');
  if (notifPanel && notifPanel.style.display !== 'none') notifPanel.style.display = 'none';
});

