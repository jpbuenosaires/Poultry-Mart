// admin/auth.js — admin portal: login and session handling
'use strict';

/* ════════════════════════════════════════════════════════════
   LOGIN / SESSION
═══════════════════════════════════════════════════════════════*/

async function adminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-pass').value;
  const errEl = document.getElementById('admin-login-error');
  const btn = document.getElementById('admin-login-btn');

  errEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const res = await loginFetch('api/admin_api.php', email, password);

  btn.disabled = false;
  btn.textContent = 'Sign In';

  if (!res.success) {
    errEl.textContent = res.message || 'Login failed.';
    errEl.hidden = false;
    return;
  }

  session.user = res.user;
  sessionStorage.setItem('pm_admin_session', JSON.stringify(res.user));
  document.getElementById('portal-login-screen').hidden = true;
  document.getElementById('portal-app').hidden = false;
  initApp();
}

function adminLogout() {
  session.user = null;
  session.riders = [];
  session.categories = [];
  session.currentOrder = null;
  if (session._pollTimer) { clearInterval(session._pollTimer); session._pollTimer = null; }
  sessionStorage.removeItem('pm_admin_session');
  document.getElementById('portal-app').hidden = true;
  document.getElementById('portal-login-screen').hidden = false;
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-pass').value = '';
}

function initApp() {
  // Display user info in sidebar
  const u = session.user;
  document.getElementById('admin-user-name').textContent = `${u.first_name} ${u.last_name}`;
  document.getElementById('admin-avatar-initial').textContent = u.first_name?.[0]?.toUpperCase() || 'A';

  startClock('admin-clock');
  startCancellationPoll();
  loadSidebarCounts();
  showPage('dashboard');
}

function showPage(pageId) {
  // Update nav buttons
  document.querySelectorAll('.portal-nav__btn').forEach(btn => {
    const active = btn.dataset.page === pageId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  if (pageId !== 'orders' && typeof scanModeActive !== 'undefined' && scanModeActive) {
    toggleScanMode();
  }

  // Show / hide pages
  document.querySelectorAll('.staff-page').forEach(el => {
    const isActive = el.id === `page-${pageId}`;
    el.hidden = !isActive;
    el.classList.toggle('active', isActive);
  });

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    orders: 'All Orders',
    returns: 'Returns & Restock',
    products: 'Products',
    categories: 'Categories',
    inventory: 'Inventory',
    users: 'User Management',
    riders: 'Riders',
    payments: 'Payment Verification',
    promos: 'Promo Codes',
    settings: 'Settings',
    reports: 'Sales Reports',
    disputes: 'Disputes',
    notifications: 'Notifications',
    'audit-log': 'Audit Log',
  };
  document.getElementById('admin-topbar-title').textContent = titles[pageId] || pageId;

  // Load page data
  const loaders = {
    dashboard: loadDashboard,
    orders: loadOrders,
    returns: loadReturns,
    products: loadProducts,
    categories: loadCategories,
    inventory: loadInventory,
    users: loadUsers,
    riders: loadRiders,
    payments: loadPayments,
    promos: loadPromos,
    settings: loadSettings,
    reports: loadReports,
    disputes: loadDisputes,
    notifications: loadNotifications,
    'audit-log': loadAuditLog,
  };
  // P3-03: Reset scan mode when navigating away from the orders page
  if (scanModeActive && pageId !== 'orders') {
    toggleScanMode();
  }
  if (loaders[pageId]) loaders[pageId]();
}

function refreshCurrentPage() {
  const active = document.querySelector('.staff-page.active');
  if (!active) return;
  const pageId = active.id.replace('page-', '');
  showPage(pageId);
}

async function loadSidebarCounts() {
  const res = await apiGet('orders', { status: 'Pending', page: 1, limit: 1 });
  if (res.success) {
    const badge = document.getElementById('nav-badge-orders');
    if (badge) {
      badge.textContent = res.data.total > 0 ? res.data.total : '';
      badge.style.display = res.data.total > 0 ? '' : 'none';
    }
  }
  const rRes = await apiGet('returns_count');
  if (rRes.success) {
    const n = rRes.data?.count ?? 0;
    const rb = document.getElementById('nav-badge-returns');
    if (rb) { rb.textContent = n > 0 ? n : ''; rb.style.display = n > 0 ? '' : 'none'; }
  }
  // GCash payment verification badge
  const pRes = await apiGet('payments_count');
  if (pRes.success) {
    const n = pRes.data?.count ?? 0;
    const pb = document.getElementById('nav-badge-payments');
    if (pb) { pb.textContent = n > 0 ? n : ''; pb.style.display = n > 0 ? '' : 'none'; }
  }
  // Disputes badge
  const dRes = await apiGet('disputes_count');
  if (dRes.success) {
    const n = dRes.data?.count ?? 0;
    const db = document.getElementById('nav-badge-disputes');
    if (db) { db.textContent = n > 0 ? n : ''; db.style.display = n > 0 ? '' : 'none'; }
  }
  const nRes = await apiGet('notifications_poll');
  if (nRes.success) {
    const n = (nRes.data?.data || []).filter(item => item.notification_id).length;
    const nb = document.getElementById('nav-badge-notif');
    if (nb) { nb.textContent = n > 0 ? n : ''; nb.style.display = n > 0 ? '' : 'none'; }
  }
}

function toggleAdminSidebar() {
  toggleSidebarUI('admin-sidebar', 'sidebar-overlay');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) pollCancellations(); // refresh content whenever panel opens
}

