// admin/init.js — admin portal: shared helpers and DOMContentLoaded bootstrap
'use strict';

/* ════════════════════════════════════════════════════════════
   SHARED HELPERS
═══════════════════════════════════════════════════════════════*/

async function refreshRiders() {
  if (session.riders.length) return;
  const res = await apiGet('riders');
  if (res.success) session.riders = res.data || [];
}

function populateRiderSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Choose a rider —</option>' +
    session.riders.filter(r => r.status === 'active').map(r =>
      `<option value="${r.user_id}">${escHtml(r.first_name)} ${escHtml(r.last_name)}</option>`
    ).join('');
}

async function refreshCategories() {
  if (session.categories.length) return;
  const res = await apiGet('categories');
  if (res.success) session.categories = res.data || [];
}

/* ════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════*/

document.addEventListener('DOMContentLoaded', () => {
  // ── Session restore on page refresh ──────────────────────────
  const saved = sessionStorage.getItem('pm_admin_session');
  if (saved) {
    try {
      session.user = JSON.parse(saved);
      // Verify the PHP session is still alive before showing the app.
      // A stale sessionStorage entry (after a server restart or session timeout)
      // would otherwise render the app in a broken "Unauthorized" state.
      coreFetch('api/admin_api.php?action=dashboard').then(res => {
        if (res && res.success === false &&
            typeof res.message === 'string' &&
            res.message.toLowerCase().includes('unauthorized')) {
          // PHP session expired — force re-login
          session.user = null;
          sessionStorage.removeItem('pm_admin_session');
          document.getElementById('portal-login-screen').hidden = false;
          document.getElementById('portal-app').hidden = true;
        } else {
          document.getElementById('portal-login-screen').hidden = true;
          document.getElementById('portal-app').hidden = false;
          initApp();
        }
      });
    } catch {
      sessionStorage.removeItem('pm_admin_session');
    }
  }

  // Allow Enter key on login
  document.getElementById('admin-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });
  document.getElementById('admin-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('admin-pass')?.focus();
  });

  // Order filter live-search
  let searchTimeout;
  document.getElementById('order-search')?.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterOrders, 300);
  });

  // Sidebar overlay click to close on mobile
  document.getElementById('sidebar-overlay')?.addEventListener('click', toggleAdminSidebar);

  // ESC key closes topmost open modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal-overlay.open, .modal-overlay[style*="flex"]');
    if (open) closeModal(open.id);
  });

  // Promo type toggle
  document.getElementById('prom-type')?.addEventListener('change', updatePromoTypeLabel);
});
