// rider/keyboard.js — rider portal: global keyboard handlers
'use strict';

/* ════════════════════════════════════════════════════════════
   GLOBAL KEYBOARD HANDLERS
═══════════════════════════════════════════════════════════════*/

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  if (document.getElementById('rider-issue-modal-overlay').classList.contains('open')) {
    closeIssueModal();
  } else if (document.getElementById('rider-complete-modal-overlay').classList.contains('open')) {
    closeCompleteModal();
  } else if (document.getElementById('rider-order-modal-overlay').classList.contains('open')) {
    closeOrderModal();
  } else if (document.getElementById('rider-confirm-overlay').classList.contains('open')) {
    closeConfirm();
  }
});

