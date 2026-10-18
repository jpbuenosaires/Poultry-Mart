// fulfillment/init.js — fulfillment portal: DOMContentLoaded bootstrap
'use strict';

/* ════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════*/

document.addEventListener('DOMContentLoaded', () => {
  // Restore session from sessionStorage (survives page refresh, cleared on tab close)
  const saved = sessionStorage.getItem('pm_staff_session');
  if (saved) {
    try {
      session.user = JSON.parse(saved);
      initApp();
    } catch(e) {
      sessionStorage.removeItem('pm_staff_session');
    }
  }
  // Create mobile sidebar overlay dynamically (same pattern as original)
  const overlay = document.createElement('div');
  overlay.id        = 'portal-sidebar-overlay';
  overlay.className = 'portal-sidebar-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.addEventListener('click', closeSidebar);
  document.body.appendChild(overlay);

  // Lazy-load queue card items when cards appear in the DOM
  const queueObserver = new MutationObserver(() => {
    document.querySelectorAll('[id^="queue-items-"]').forEach(el => {
      const orderId = el.id.replace('queue-items-', '');
      if (!el.dataset.loaded) loadQueueCardItems(orderId);
    });
  });
  const ql = document.getElementById('queue-list');
  if (ql) queueObserver.observe(ql, { childList: true });
});