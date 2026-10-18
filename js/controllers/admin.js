/**
 * admin.js — PoultryMart Super Admin Portal Controller
 *
 * Architecture mirrors fulfillment.js exactly.
 * All DB calls go through apiGet / apiPost (never raw fetch).
 * All user strings rendered into innerHTML are wrapped in escHtml().
 * All monetary / date / status values use the shared util formatters.
 * All modals use openAccessibleModal / closeAccessibleModal.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════*/

const session = {
  user: null,
  riders: [],
  categories: [],
  geoData: [],
  currentOrder: null,
  orders: { list: [], total: 0, page: 1, pages: 1, status: '', search: '' },
  // modal cleanup handles
  _modalCleanup: {},
  // polling
  _pollTimer: null,
  _notifIds: [],
};

/* ════════════════════════════════════════════════════════════
   API SERVICE
═══════════════════════════════════════════════════════════════*/

const { apiGet, apiPost } = createApiService({
  baseUrl: 'api/admin_api.php',
  callerKey: 'admin_id',
  getCallerId: () => session.user?.user_id ?? 0,
});

/* ════════════════════════════════════════════════════════════
   TOAST SHORTHAND
═══════════════════════════════════════════════════════════════*/

const toast = (msg, type = '') => showToast(msg, type, 'admin-toast');

/* ════════════════════════════════════════════════════════════
   MODAL HELPERS — thin wrappers around openAccessibleModal
═══════════════════════════════════════════════════════════════*/

function openModal(overlayId, firstFocusId) {
  // Directly set display:flex so the CSS rule
  // .modal-overlay[style*="flex"] activates the overlay.
  // openAccessibleModal may add class 'open', but no .modal-overlay.open
  // rule exists in the stylesheet, so the inline style is the safe trigger.
  const el = document.getElementById(overlayId);
  if (el) el.style.display = 'flex';
  const cleanup = openAccessibleModal(overlayId, firstFocusId);
  session._modalCleanup[overlayId] = cleanup;
}

function closeModal(overlayId, returnFocusEl = null) {
  const el = document.getElementById(overlayId);
  if (el) el.style.display = 'none';
  const cleanup = session._modalCleanup[overlayId] || null;
  closeAccessibleModal(overlayId, returnFocusEl, cleanup);
  delete session._modalCleanup[overlayId];
}

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

/* ════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════*/

window.jumpToOrders = function(status) {
  session.orders.status = status;
  session.orders.page = 1;
  showPage('orders');
  // Sync the dropdown AFTER showPage so the element is visible
  requestAnimationFrame(() => {
    const filterEl = document.getElementById('order-filter-status');
    if (filterEl) filterEl.value = status;
  });
};

async function loadDashboard() {
  setLoading('dashboard-content', 'Loading dashboard…');
  const res = await apiGet('dashboard');
  if (!res.success) { document.getElementById('dashboard-content').innerHTML = errorHTML(res.message); return; }
  renderDashboard(res.data);
}

function renderDashboard(data) {
  const s = data.stats;
  const el = document.getElementById('dashboard-content');

  // ── Stat cards ───────────────────────────────────────────
  const stats = `
  <div class="stat-grid">
    <div class="stat-card stat-card--primary" style="cursor:pointer" onclick="jumpToOrders('')" title="View All Orders">
      <div class="stat-info"><span class="stat-val">${escHtml(s.total_orders)}</span><span class="stat-label">Total Orders</span></div>
      <div class="stat-icon-wrap">📦</div>
    </div>
    <div class="stat-card stat-card--warn" style="cursor:pointer" onclick="jumpToOrders('Pending')" title="View Pending Orders">
      <div class="stat-info"><span class="stat-val">${escHtml(s.pending)}</span><span class="stat-label">Pending</span></div>
      <div class="stat-icon-wrap">⏳</div>
    </div>
    <div class="stat-card stat-card--green" style="cursor:pointer" onclick="showPage('reports')" title="View Sales Reports">
      <div class="stat-info"><span class="stat-val">${fmtPrice(s.revenue)}</span><span class="stat-label">Total Revenue</span></div>
      <div class="stat-icon-wrap">💰</div>
    </div>
    <div class="stat-card stat-card--purple" style="cursor:pointer" onclick="showPage('products')" title="Manage Products">
      <div class="stat-info"><span class="stat-val">${escHtml(s.products)}</span><span class="stat-label">Active Products</span></div>
      <div class="stat-icon-wrap">🛍️</div>
    </div>
    <div class="stat-card stat-card--blue" style="cursor:pointer" onclick="showPage('users')" title="Manage Customers">
      <div class="stat-info"><span class="stat-val">${escHtml(s.customers)}</span><span class="stat-label">Customers</span></div>
      <div class="stat-icon-wrap">👥</div>
    </div>
    <div class="stat-card stat-card--primary" style="cursor:pointer" onclick="jumpToOrders('')" title="View Today's Orders">
      <div class="stat-info"><span class="stat-val">${escHtml(s.today_orders)}</span><span class="stat-label">Today's Orders</span></div>
      <div class="stat-icon-wrap">📅</div>
    </div>
    <div class="stat-card stat-card--green" style="cursor:pointer" onclick="showPage('reports')" title="View Today's Revenue">
      <div class="stat-info"><span class="stat-val">${fmtPrice(s.today_revenue)}</span><span class="stat-label">Today's Revenue</span></div>
      <div class="stat-icon-wrap">📈</div>
    </div>
  </div>`;

  // ── Weekly revenue bar chart (pure CSS/SVG) ───────────────
  const weekly = data.weekly_revenue || [];
  const maxRev = Math.max(...weekly.map(r => parseFloat(r.rev)), 1);
  const barCols = weekly.map(r => {
    const pct = Math.round((parseFloat(r.rev) / maxRev) * 100);
    const day = new Date(r.d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
    return `<div class="rev-bar-col">
      <div class="rev-bar" style="height:${pct}%" title="${escHtml(day)}: ${fmtPrice(r.rev)}"></div>
      <div class="rev-bar-label">${escHtml(new Date(r.d).toLocaleDateString('en-PH', { weekday: 'short' }))}</div>
    </div>`;
  }).join('');
  const chart = `<div class="section-card"><h3 class="section-card__title">📊 Weekly Revenue</h3>
    <div class="rev-bar-chart">${barCols || '<p class="text-muted" style="padding: 1rem 1.5rem">No data yet.</p>'}</div></div>`;

  // ── Status distribution pills ─────────────────────────────
  const dist = data.status_dist || {};
  const pills = STATUS_FLOW.map(st =>
    `<div class="status-dist-pill" style="cursor:pointer" onclick="jumpToOrders('${st}')" title="Filter by ${st}">${statusBadge(st)}<span class="dist-count">${escHtml(dist[st] ?? 0)}</span></div>`
  ).join('');
  const distHtml = `<div class="section-card"><h3 class="section-card__title">🗂️ Order Status Distribution</h3>
    <div class="status-dist-row">${pills}</div></div>`;

  // ── Low stock alert ───────────────────────────────────────
  const low = data.low_stock || [];
  let lowHtml = '';
  if (low.length) {
    const rows = low.map(p => `<tr style="cursor:pointer" onclick="showPage('inventory')" title="Manage Inventory">
      <td>${escHtml(p.name)}</td>
      <td>${escHtml(p.category_name)}</td>
      <td><strong>${parseFloat(p.total_remaining).toFixed(3)}</strong> <span class="text-muted">${escHtml(p.unit_of_measure)}</span></td>
      <td><span class="stock-pct-badge ${parseFloat(p.stock_pct) === 0 ? 'stock-pct--zero' : 'stock-pct--low'}">${escHtml(p.stock_pct)}%</span></td>
    </tr>`).join('');
    lowHtml = `<div class="section-card"><h3 class="section-card__title">⚠️ Low Stock Alert</h3>
      <div class="panel-body no-pad"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Remaining</th><th>Stock %</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
  }

  // ── Recent orders ─────────────────────────────────────────
  const recent = data.recent_orders || [];
  const recentRows = recent.map(o => `<tr>
    <td><button class="link-btn" style="font-weight:700" onclick="openOrderDetail(${escHtml(o.order_id)})">${escHtml(o.order_number)}</button></td>
    <td>${escHtml(o.first_name)} ${escHtml(o.last_name)}</td>
    <td>${statusBadge(o.status)}</td>
    <td><strong>${fmtPrice(o.final_total || o.estimated_total)}</strong></td>
    <td><span class="text-muted">${fmtDate(o.delivery_date)}</span></td>
  </tr>`).join('');
  const recentHtml = `<div class="section-card"><h3 class="section-card__title">🕐 Recent Orders</h3>
    <div class="panel-body no-pad"><table class="data-table"><thead><tr><th>Order #</th><th>Customer</th><th>Status</th><th>Total</th><th>Delivery</th></tr></thead>
    <tbody>${recentRows || '<tr><td colspan="5" class="text-muted text-center">No orders yet.</td></tr>'}</tbody></table></div></div>`;

  el.innerHTML = stats + `<div class="dashboard-grid">${chart}${distHtml}</div>` + lowHtml + recentHtml;
}

/* ════════════════════════════════════════════════════════════
   ORDERS
═══════════════════════════════════════════════════════════════*/

async function loadOrders() {
  setLoading('orders-table-wrap', 'Loading orders…');
  const { page, status, search } = session.orders;
  const res = await apiGet('orders', { status, search, page, limit: 30 });
  if (!res.success) { document.getElementById('orders-table-wrap').innerHTML = errorHTML(res.message); return; }
  session.orders.list = res.data.orders;
  session.orders.total = res.data.total;
  session.orders.pages = res.data.pages;
  renderOrdersTable(res.data);
}

function renderOrdersTable(data) {
  const wrap = document.getElementById('orders-table-wrap');
  const orders = data.orders || [];
  if (!orders.length) {
    wrap.innerHTML = emptyStateHTML('📦', 'No Orders', 'No orders match your filter.');
    document.getElementById('orders-pagination').innerHTML = '';
    return;
  }

  const isPacked = s => ['Packed','Out for Delivery','Arrived at Location','Completed'].includes(s);
  // Urgency: only flag Pending orders due today or tomorrow (matches fulfillment/utils.js)
  const checkUrgent = (d, status) => status === 'Pending' && (isToday(d) || isTomorrow(d));

  const cards = orders.map(o => {
    const name     = `${escHtml(o.first_name)} ${escHtml(o.last_name)}`;
    const total    = isPacked(o.status) && o.final_total
      ? `<strong style="color:var(--primary);font-family:var(--font-display)">${fmtPrice(o.final_total)}</strong>`
      : fmtPrice(o.estimated_total);
    const estTotal = fmtPrice(o.estimated_total);
    const urgent   = checkUrgent(o.delivery_date, o.status);

    let actions = `<button class="btn-outline" onclick="openOrderDetail(${o.order_id})" title="View details" aria-label="View details for order ${escHtml(o.order_number)}">👁 View Details</button>`;
    
    if (o.status === 'Pending') {
      actions += `<button class="btn-primary" onclick="openPackModal(${o.order_id})" title="Pack order">📦 Pack Order</button>`;
    } else if (o.status === 'Packed') {
      actions += `<button class="btn-action-blue" onclick="openAssignModal(${o.order_id})" title="Assign rider">🛵 Assign Rider</button>`;
    }
    // P4-02: Add Arrived at Location transition button
    if (o.status === 'Out for Delivery') {
      actions += `<button class="btn-action-blue" onclick="markArrivedAtLocation(${o.order_id})" title="Mark arrived">📍 Arrived</button>`;
    }
    if (['Packed','Out for Delivery','Arrived at Location'].includes(o.status)) {
      actions += `<button class="btn-action-green" onclick="markDelivered(${o.order_id})" title="Mark delivered">✅ Mark Delivered</button>`;
    }
    if (o.status !== 'Cancelled' && o.status !== 'Completed') {
      actions += `<button class="btn-action-red" onclick="openCancelModal(${o.order_id},'${escHtml(o.order_number)}')" title="Cancel">✕ Cancel Order</button>`;
    }
    actions += `<button class="btn-action-muted" onclick="printPackingSlip(${o.order_id})" title="Print slip">🖨 Print Slip</button>`;

    return `
      <article class="queue-card ${urgent ? 'priority-urgent' : 'priority-normal'}" style="margin-bottom: 1rem">
        <header class="queue-card-header">
          <span class="queue-order-num">${escHtml(o.order_number)}</span>
          ${statusBadge(o.status)}
          ${payBadge(o.pay_status)}
          <span class="queue-delivery-badge" style="margin-left:auto">${deliveryLabel(o.delivery_date)}</span>
          ${urgent ? '<span class="queue-urgency-badge">Urgent</span>' : ''}
        </header>
        <div class="queue-card-body">
          <div class="queue-customer-col" style="flex: 2">
            <div class="queue-col-label">Customer Details</div>
            <div class="queue-customer-name">${name}</div>
            <div class="queue-customer-detail">
              ${escHtml(o.email || '')} <br/>
              ${escHtml(o.payment_method)}
            </div>
          </div>
          <div class="queue-items-col" style="flex: 2">
            <div class="queue-col-label">Order Totals</div>
            <div class="queue-customer-detail" style="font-size: 0.95rem">
              <div style="margin-bottom: .25rem;">Est. Total: <span style="float:right">${estTotal}</span></div>
              <div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--border)">
                <strong>Final Total:</strong> <span style="float:right">${total}</span>
              </div>
            </div>
          </div>
          <div class="queue-action-col">
            ${actions}
          </div>
        </div>
      </article>
    `;
  }).join('');

  wrap.innerHTML = `<div class="orders-card-list">${cards}</div>`;
  
  renderPagination('orders-pagination', session.orders.page, data.pages, (p) => {
    session.orders.page = p;
    loadOrders();
  });
}


function filterOrders() {
  session.orders.page = 1;
  session.orders.status = document.getElementById('order-filter-status').value;
  session.orders.search = document.getElementById('order-search').value.trim();
  loadOrders();
}

async function openOrderDetail(id) {
  document.getElementById('order-detail-body').innerHTML = spinnerHTML();
  openModal('order-detail-modal', 'order-modal-close');
  const res = await apiGet('order', { id });
  if (!res.success) { document.getElementById('order-detail-body').innerHTML = errorHTML(res.message); return; }
  session.currentOrder = res.data;
  renderOrderDetail(res.data);
}

function renderOrderDetail(o) {
  const isPacked = ['Packed', 'Out for Delivery', 'Arrived at Location', 'Completed'].includes(o.status);
  const items    = o.items || [];
  let itemsTotal = 0;

  const itemRows = items.map(i => {
    const isCW = i.is_catch_weight == 1 || i.pricing_model === 'catch_weight';
    const sub = isPacked && i.final_subtotal
      ? parseFloat(i.final_subtotal)
      : parseFloat(i.estimated_subtotal);
    itemsTotal += sub;
    return `
      <tr>
        <td>
          ${escHtml(i.name)}
          ${isCW ? '<span style="font-size:.7rem;color:var(--orange);font-weight:700;margin-left:.3rem">⚖</span>' : ''}
        </td>
        <td style="text-align:center">${i.quantity}</td>
        <td>
          ${isCW
            ? (isPacked && i.actual_weight
                ? `<strong>${parseFloat(i.actual_weight).toFixed(3)} kg</strong>`
                : `~${parseFloat(i.estimated_weight || 0).toFixed(3)} kg`)
            : `${i.quantity} ${i.pricing_model === 'per_piece' ? 'pc' : 'pack'}`}
        </td>
        <td>${isCW
          ? fmtPrice(i.price_per_kg || i.unit_price) + '/kg'
          : fmtPrice(i.price_per_kg || i.unit_price) + '/' + (i.pricing_model === 'per_piece' ? 'pc' : 'pack')}</td>
        <td style="text-align:right;font-weight:700">
          ${isPacked && i.final_subtotal
            ? `<span style="color:var(--green)">${fmtPrice(i.final_subtotal)}</span>`
            : fmtPrice(i.estimated_subtotal)}
        </td>
      </tr>`;
  }).join('');

  const riderInfo = o.rider_first
    ? `${o.rider_first} ${o.rider_last} ${o.rider_phone ? `(${o.rider_phone})` : ''}`
    : 'Not assigned';
  const dispatchedAt = o.dispatched_at ? fmtDateTime(o.dispatched_at) : '—';
  const deliveredAt  = o.delivered_at  ? fmtDateTime(o.delivered_at)  : '—';

  document.getElementById('order-detail-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
      <h2 style="font-size:1.2rem;margin:0">${escHtml(o.order_number)}</h2>
      ${statusBadge(o.status)} ${payBadge(o.pay_status)}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Customer &amp; Delivery</div>
      <div class="detail-info-grid">
        <div class="detail-info-item">
          <div class="detail-info-label">Customer</div>
          <div class="detail-info-val">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Phone</div>
          <div class="detail-info-val">${escHtml(o.phone || '—')}</div>
        </div>
        <div class="detail-info-item" style="grid-column:1/-1">
          <div class="detail-info-label">Address</div>
          <div class="detail-info-val">
            ${escHtml(o.street)}, ${escHtml(o.barangay)}, ${escHtml(o.city)}, ${escHtml(o.province || 'Albay')}
          </div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Delivery Date</div>
          <div class="detail-info-val">${fmtDate(o.delivery_date)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Time Slot</div>
          <div class="detail-info-val">${escHtml(o.slot_label || '—')}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Payment Method</div>
          <div class="detail-info-val">${escHtml(o.payment_method)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Rider</div>
          <div class="detail-info-val">${escHtml(riderInfo)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Dispatched At</div>
          <div class="detail-info-val">${dispatchedAt}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Delivered At</div>
          <div class="detail-info-val">${deliveredAt}</div>
        </div>
        ${o.special_instructions ? `
        <div class="detail-info-item" style="grid-column:1/-1">
          <div class="detail-info-label">Special Instructions</div>
          <div class="detail-info-val" style="color:var(--orange)">${escHtml(o.special_instructions)}</div>
        </div>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Items (${items.length})</div>
      <table class="detail-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="text-align:center">Qty</th>
            <th>Weight</th>
            <th>Price/kg</th>
            <th style="text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="detail-total-rows">
        <div class="detail-total-row"><span>Items</span><span>${fmtPrice(itemsTotal)}</span></div>
        ${o.discount_amount > 0
          ? `<div class="detail-total-row" style="color:var(--green)">
               <span>Discount</span><span>−${fmtPrice(o.discount_amount)}</span>
             </div>` : ''}
        <div class="detail-total-row">
          <span>Delivery Fee</span><span>${fmtPrice(o.delivery_fee)}</span>
        </div>
        ${isPacked && o.final_total
          ? `<div class="detail-total-row grand">
               <span>✓ Final Total</span><span>${fmtPrice(o.final_total)}</span>
             </div>`
          : `<div class="detail-total-row grand">
               <span>Estimated Total</span><span>${fmtPrice(o.estimated_total)}</span>
             </div>`}
      </div>
    </div>

    <div class="modal-actions" style="margin-top:1.5rem">
      ${o.status === 'Pending' ? `<button class="btn-primary" onclick="closeModal('order-detail-modal');openPackModal(${o.order_id})">📦 Pack Order</button>` : ''}
      ${o.status === 'Packed' ? `<button class="btn-primary" onclick="closeModal('order-detail-modal');openAssignModal(${o.order_id})">🛵 Assign Rider</button>` : ''}
      <button class="btn-outline" onclick="printPackingSlip(${o.order_id})">🖨 Print Slip</button>
      <button class="btn-outline" onclick="printItemLabels(${o.order_id})">🏷 Print Labels</button>
    </div>`;
}

/* ── Pack Order ─────────────────────────────────────────────*/

let _packOrderId = 0;

async function openPackModal(id) {
  _packOrderId = id;
  document.getElementById('pack-modal-body').innerHTML = spinnerHTML();
  openModal('pack-order-modal', 'pack-modal-close');
  const res = await apiGet('order', { id });
  if (!res.success) { document.getElementById('pack-modal-body').innerHTML = errorHTML(res.message); return; }
  session.currentOrder = res.data;
  renderPackModal(res.data);
}

function renderPackModal(o) {
  const rows = (o.items || []).map(it => {
    const isCW = it.is_catch_weight == 1;
    return `<div class="pack-item-row" data-item-id="${it.order_item_id}" data-unit-price="${it.unit_price}" data-pricing-model="${escHtml(it.pricing_model)}" data-qty="${it.quantity}">
      <div class="pack-item-name">${productIcon(it.category_name)} ${escHtml(it.name)}</div>
      <div class="pack-item-controls">
        ${isCW ? `<label>Actual Weight (kg)<input type="number" class="form-input pack-weight-input" data-item="${it.order_item_id}" min="0" step="0.001" placeholder="${parseFloat(it.estimated_weight || 0).toFixed(3)}" oninput="recalcPackTotal()" /></label>` : `<span class="text-muted">Qty: ${escHtml(it.quantity)}</span>`}
        <label class="oos-toggle-label"><input type="checkbox" class="oos-checkbox" data-item="${it.order_item_id}" onchange="recalcPackTotal()" /> Out of Stock</label>
      </div>
    </div>`;
  }).join('');

  document.getElementById('pack-modal-body').innerHTML = `
    <div class="pack-items-fieldset">${rows}</div>
    <div class="pack-total-strip">Est. Final Total: <strong id="pack-running-total">${fmtPrice(o.estimated_total)}</strong></div>
    <p id="pack-error" class="form-error" style="display:none"></p>`;
}

function recalcPackTotal() {
  let total = 0;
  document.querySelectorAll('.pack-item-row').forEach(row => {
    const oos = row.querySelector('.oos-checkbox')?.checked;
    if (oos) return;
    const model = row.dataset.pricingModel;
    const qty = parseFloat(row.dataset.qty || 1);
    const price = parseFloat(row.dataset.unitPrice || 0);
    if (model === 'catch_weight') {
      const w = parseFloat(row.querySelector('.pack-weight-input')?.value || 0);
      total += w * price;
    } else {
      total += qty * price;
    }
  });
  const el = document.getElementById('pack-running-total');
  if (el) el.textContent = fmtPrice(total);
}

async function confirmPackOrder() {
  const errEl = document.getElementById('pack-error');
  errEl.style.display = 'none';

  const items = [];
  document.querySelectorAll('.pack-item-row').forEach(row => {
    const itemId = parseInt(row.dataset.itemId);
    const oos = row.querySelector('.oos-checkbox')?.checked ? 1 : 0;
    const wInp = row.querySelector('.pack-weight-input');
    const weight = wInp ? parseFloat(wInp.value || 0) : null;
    items.push({ order_item_id: itemId, actual_weight: weight, is_oos: oos });
  });

  const res = await apiPost('pack_order', { order_id: _packOrderId, items });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Order packed successfully!', 'success');
  closeModal('pack-order-modal');
  loadOrders();
  loadSidebarCounts();
}

/* ── Edit Order ─────────────────────────────────────────────*/

let _editOrderId = 0;

async function openEditOrderModal(id) {
  _editOrderId = id;
  document.getElementById('edit-order-body').innerHTML = spinnerHTML();
  openModal('edit-order-modal', 'edit-modal-close');
  const res = await apiGet('order', { id });
  if (!res.success) { document.getElementById('edit-order-body').innerHTML = errorHTML(res.message); return; }
  const o = res.data;
  document.getElementById('edit-order-body').innerHTML = `
    <div class="form-group"><label>Delivery Date</label><input type="date" id="edit-delivery-date" class="form-input" value="${escHtml(o.delivery_date?.slice(0, 10) || '')}" /></div>
    <div class="form-group form-group--spaced"><label>Promo Code</label><input type="text" id="edit-promo-code" class="form-input" value="${escHtml(o.promo_code || '')}" placeholder="Leave blank to remove" /></div>
    <p id="edit-order-error" class="form-error" style="display:none"></p>`;
}

async function confirmEditOrder() {
  const errEl = document.getElementById('edit-order-error');
  errEl.style.display = 'none';
  const res = await apiPost('edit_order', {
    order_id: _editOrderId,
    delivery_date: document.getElementById('edit-delivery-date').value,
    promo_code: document.getElementById('edit-promo-code').value.trim(),
  });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Order updated.', 'success');
  closeModal('edit-order-modal');
  loadOrders();
}

/* ── Cancel Order ───────────────────────────────────────────*/

let _cancelOrderId = 0;

function openCancelModal(id, orderNum) {
  _cancelOrderId = id;
  document.getElementById('cancel-order-num').textContent = orderNum;
  document.getElementById('cancel-reason-input').value = '';
  document.getElementById('cancel-error').style.display = 'none';
  openModal('cancel-order-modal', 'cancel-modal-close');
}

async function confirmCancel() {
  const reason = document.getElementById('cancel-reason-input').value.trim();
  const errEl = document.getElementById('cancel-error');
  if (!reason) { errEl.textContent = 'Please enter a reason.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('cancel_order', { order_id: _cancelOrderId, reason });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Order cancelled.', 'success');
  closeModal('cancel-order-modal');
  loadOrders();
  loadSidebarCounts();
}

/* ── Status Override ────────────────────────────────────────*/

let _statusOrderId = 0;

function openStatusModal(id) {
  _statusOrderId = id;
  document.getElementById('status-override-error').style.display = 'none';
  openModal('status-override-modal', 'status-modal-close');
}

async function confirmStatusOverride() {
  const newStatus = document.getElementById('status-select').value;
  const errEl = document.getElementById('status-override-error');
  if (!newStatus) { errEl.textContent = 'Select a status.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('update_status', { order_id: _statusOrderId, status: newStatus });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Status updated.', 'success');
  closeModal('status-override-modal');
  loadOrders();
}

/* ── Assign Rider ───────────────────────────────────────────*/

let _assignOrderId = 0;

async function openAssignModal(id) {
  _assignOrderId = id;
  document.getElementById('assign-rider-error').style.display = 'none';
  await refreshRiders();
  populateRiderSelect('assign-rider-select');
  openModal('assign-rider-modal', 'assign-modal-close');
}

async function confirmAssign() {
  const riderId = document.getElementById('assign-rider-select').value;
  const errEl = document.getElementById('assign-rider-error');
  if (!riderId) { errEl.textContent = 'Select a rider.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('assign_rider', { order_id: _assignOrderId, rider_id: riderId });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Rider assigned.', 'success');
  closeModal('assign-rider-modal');
  loadOrders();
}

/* ── Batch Assign ───────────────────────────────────────────*/

let _batchOrderIds = [];
let _batchZoneLabel = '';

async function openBatchAssignModal(orderIds, zoneLabel) {
  _batchOrderIds = orderIds;
  _batchZoneLabel = zoneLabel;
  document.getElementById('batch-assign-zone-label').textContent = zoneLabel;
  document.getElementById('batch-assign-error').style.display = 'none';
  await refreshRiders();
  populateRiderSelect('batch-rider-select');
  openModal('batch-assign-modal', 'batch-modal-close');
}

async function confirmBatchAssign() {
  const riderId = document.getElementById('batch-rider-select').value;
  const errEl = document.getElementById('batch-assign-error');
  if (!riderId) { errEl.textContent = 'Select a rider.'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  const res = await apiPost('batch_assign_riders', { order_ids: _batchOrderIds, rider_id: riderId });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(`Batch assigned to rider for zone: ${_batchZoneLabel}.`, 'success');
  closeModal('batch-assign-modal');
  loadOrders();
}

/* ── Dispatch ───────────────────────────────────────────────*/

let _dispatchOrderId = 0;
let _dispatchOrderNum = '';

function openDispatchModal(id, orderNum) {
  _dispatchOrderId = id;
  _dispatchOrderNum = orderNum;
  document.getElementById('dispatch-confirm-msg').textContent = `Send order ${orderNum} out for delivery?`;
  openModal('dispatch-confirm-modal', 'dispatch-modal-close');
}

async function confirmDispatch() {
  const res = await apiPost('dispatch_order', { order_id: _dispatchOrderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order dispatched!', 'success');
  closeModal('dispatch-confirm-modal');
  loadOrders();
}

/* ── Mark Arrived at Location ──────────────────────────────*/

async function markArrivedAtLocation(id) {
  if (!confirm('Mark this order as Arrived at Location?')) return;
  const res = await apiPost('update_status', { order_id: id, status: 'Arrived at Location' });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order marked as Arrived at Location.', 'success');
  loadOrders();
}

/* ── Mark Delivered ─────────────────────────────────────────*/

async function markDelivered(id) {
  if (!confirm('Mark this order as delivered / completed?')) return;
  const res = await apiPost('update_status', { order_id: id, status: 'Completed' });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order marked as delivered.', 'success');
  loadOrders();
}

async function markArrivedAtLocation(id) {
  if (!confirm('Mark this order as Arrived at Location?')) return;
  const res = await apiPost('update_status', { order_id: id, status: 'Arrived at Location' });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Order marked as Arrived at Location.', 'success');
  loadOrders();
}

async function confirmMarkDelivered(id) { await markDelivered(id); }

/* ── Scan Mode ──────────────────────────────────────────────*/

let scanModeActive = false;

function toggleScanMode() {
  scanModeActive = !scanModeActive;
  const btn   = document.getElementById('scan-mode-btn');
  const input = document.getElementById('scan-input');
  if(btn) btn.classList.toggle('scan-mode-active', scanModeActive);
  if(btn) btn.setAttribute('aria-pressed', String(scanModeActive));
  if (scanModeActive) {
    if(input) input.classList.add('scan-input-visible');
    if(input) input.value = '';
    if(input) input.focus();
    toast('🔍 Scan Mode active — scan an order barcode.', 'info');
  } else {
    if(input) input.classList.remove('scan-input-visible');
    if(input) input.value = '';
  }
}

function handleScanInput(_val) { /* committed on Enter — see keydown listener */ }

document.addEventListener('keydown', e => {
  if (!scanModeActive) return;
  // '\r' covers scanners that send a bare carriage-return instead of 'Enter'
  if (e.key !== 'Enter' && e.key !== '\r') return;
  const input = document.getElementById('scan-input');
  if (!input) return;
  const code = input.value.trim();
  if (!code) return;
  input.value = '';        // clear immediately so next scan starts fresh
  scanLookup(code);
});

async function scanLookup(orderNum) {
  toast(`🔍 Looking up ${orderNum}…`, 'info');
  session.orders.search = orderNum;
  session.orders.page = 1;
  await loadOrders();
  if (session.orders.list && session.orders.list.length === 1) {
    openOrderDetail(session.orders.list[0].order_id);
  } else if (!session.orders.list || session.orders.list.length === 0) {
    toast(`Order "${orderNum}" not found.`, 'error');
  } else {
    showPage('orders');
    toast(`Found multiple orders matching "${orderNum}".`, 'info');
  }
}

/* ── Zone View ──────────────────────────────────────────────*/

let _zoneViewActive = false;

function toggleZoneView() {
  _zoneViewActive = !_zoneViewActive;
  const btn = document.getElementById('zone-view-btn');
  if (btn) btn.textContent = _zoneViewActive ? '📋 List View' : '🗺️ Zone View';
  if (_zoneViewActive) {
    // Fetch ALL packed orders (no pagination cap) so no zone is missing
    _loadAllPackedForZoneView();
  } else {
    renderOrdersTable({ orders: session.orders.list, pages: session.orders.pages });
  }
}

async function _loadAllPackedForZoneView() {
  const wrap = document.getElementById('orders-table-wrap');
  if (wrap) wrap.innerHTML = spinnerHTML('Loading zone view…');
  const res = await apiGet('orders', { status: 'Packed', page: 1, limit: 200 });
  if (!res.success) { if (wrap) wrap.innerHTML = errorHTML(res.message); return; }
  renderZoneView(res.data?.orders || []);
}

function renderZoneView(orders) {
  const wrap = document.getElementById('orders-table-wrap');
  if (!orders.length) { wrap.innerHTML = emptyStateHTML('🗺️', 'No Packed Orders', 'No packed orders to group by zone.'); return; }
  const zones = {};
  orders.forEach(o => {
    const z = o.zone_city || 'Unknown Zone';
    if (!zones[z]) zones[z] = [];
    zones[z].push(o);
  });
  let html = '';
  for (const [zone, list] of Object.entries(zones)) {
    const ids = list.map(o => o.order_id);
    const rows = list.map(o => `<tr>
      <td><button class="link-btn" onclick="openOrderDetail(${o.order_id})">${escHtml(o.order_number)}</button></td>
      <td>${escHtml(o.first_name)} ${escHtml(o.last_name)}</td>
      <td>${fmtPrice(o.final_total || o.estimated_total)}</td>
    </tr>`).join('');
    html += `<div class="zone-group-card">
      <div class="zone-group-header">
        <strong>📍 ${escHtml(zone)}</strong> <span class="text-muted">${list.length} order(s)</span>
        <button class="btn-action btn-action-blue" onclick='openBatchAssignModal(${JSON.stringify(ids)}, "${escHtml(zone)}")'>🛵 Batch Assign</button>
      </div>
      <table class="data-table"><thead><tr><th>Order #</th><th>Customer</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }
  wrap.innerHTML = html;
}

/* ════════════════════════════════════════════════════════════
   RETURNS
═══════════════════════════════════════════════════════════════*/

async function loadReturns() {
  setLoading('returns-table-wrap', 'Loading returns…');
  const res = await apiGet('returns');
  if (!res.success) { document.getElementById('returns-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderReturnsTable(res.data?.orders || []);
}

function renderReturnsTable(orders) {
  const wrap = document.getElementById('returns-table-wrap');
  if (!orders.length) {
    wrap.innerHTML = emptyStateHTML('🔄', 'No Returns', 'No failed deliveries pending review.');
    return;
  }
  wrap.innerHTML = orders.map(o => `
    <article class="queue-card" aria-label="Returned order ${escHtml(o.order_number)}">
      <header class="queue-card-header">
        <span class="queue-order-num">${escHtml(o.order_number)}</span>
        <span class="queue-delivery-badge" style="background:var(--error-bg,#fff0f0);color:var(--error,#d32f2f)">
          ↩ Failed Delivery
        </span>
        <div class="queue-card-header-actions">
          <button class="btn-action btn-action-muted" onclick="openOrderDetail(${o.order_id})"
            aria-label="View details for order ${escHtml(o.order_number)}">👁 View</button>
        </div>
      </header>
      <div class="queue-card-body">
        <div class="queue-customer-col">
          <div class="queue-col-label">Customer</div>
          <div class="queue-customer-name">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
          <div class="queue-customer-detail">
            ${escHtml(o.payment_method || 'COD')} &nbsp;·&nbsp; ${escHtml(o.slot_label || fmtDate(o.delivery_date))}
          </div>
        </div>
        <div class="queue-items-col">
          <div class="queue-col-label">Rider Note</div>
          <div style="font-size:.85rem;color:var(--text-muted)">
            ${escHtml(o.failed_delivery_reason || 'No reason provided')}
          </div>
        </div>
        <div class="queue-action-col">
          <div class="queue-est-total">
            <span>Final Total</span>
            <strong>${fmtPrice(o.final_total || o.estimated_total)}</strong>
          </div>
          <button class="btn-primary" style="background:var(--green,#16a34a)"
            onclick="confirmRestock(${o.order_id})"
            aria-label="Restock goods from order ${escHtml(o.order_number)}">
            📦 Restock to Inventory
          </button>
          <button class="btn-outline" style="border-color:var(--error,#d32f2f);color:var(--error,#d32f2f)"
            onclick="confirmSpoiled(${o.order_id})"
            aria-label="Mark goods from order ${escHtml(o.order_number)} as spoiled">
            🚫 Mark as Spoiled
          </button>
        </div>
      </div>
    </article>`).join('');
}

function filterAdminReturns() {
  const q = (document.getElementById('returns-search')?.value || '').toLowerCase();
  const wrap = document.getElementById('returns-table-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('article.queue-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

async function confirmRestock(id) {
  if (!confirm('Restock this return to inventory?')) return;
  const res = await apiPost('restock_return', { order_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Restocked successfully.', 'success');
  loadReturns();
}

async function confirmSpoiled(id) {
  if (!confirm('Mark this return as spoiled? Stock will NOT be restored.')) return;
  const res = await apiPost('mark_spoiled', { order_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Marked as spoiled.', 'success');
  loadReturns();
}

/* ════════════════════════════════════════════════════════════
   PRODUCTS
═══════════════════════════════════════════════════════════════*/

async function loadProducts() {
  setLoading('products-table-wrap', 'Loading products…');
  await refreshCategories();
  // Populate category filter dropdown (no-op if already populated)
  const catFilter = document.getElementById('product-cat-filter');
  if (catFilter && catFilter.options.length <= 1) {
    session.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.category_id;
      opt.textContent = c.name;
      catFilter.appendChild(opt);
    });
  }
  const search = document.getElementById('product-search')?.value.trim() || '';
  const categoryId = document.getElementById('product-cat-filter')?.value || '';
  const status = document.getElementById('product-status-filter')?.value || '';
  const res = await apiGet('products', { search, category_id: categoryId, status });
  if (!res.success) { document.getElementById('products-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderProductsTable(res.data || []);
}

function renderProductsTable(products) {
  const wrap = document.getElementById('products-table-wrap');
  if (!products.length) { wrap.innerHTML = emptyStateHTML('🐓', 'No Products', 'No products found.'); return; }
  const rows = products.map(p => `<tr class="${p.status === 'archived' ? 'row-archived' : ''}">
    <td>${productIcon(p.category_name)} ${escHtml(p.name)}</td>
    <td>${escHtml(p.category_name)}</td>
    <td>${fmtPrice(p.base_price)}</td>
    <td><span class="badge badge-model">${escHtml(pricingModelLabel(p.pricing_model))}</span></td>
    <td>${parseFloat(p.stock_qty || 0).toFixed(3)} ${escHtml(p.unit_of_measure || '')}</td>
    <td><span class="status-badge ${p.status === 'active' ? 'status-Completed' : 'status-Cancelled'}">${escHtml(p.status)}</span></td>
    <td>
      <button class="btn-action" onclick="openProductModal(${p.product_id})" title="Edit">✏️</button>
      <button class="btn-action btn-action-${p.is_featured ? 'warn' : 'muted'}" onclick="toggleFeatured(${p.product_id}, this)" title="${p.is_featured ? 'Unfeature' : 'Feature'}">⭐</button>
      <button class="btn-action btn-action-blue" onclick="openTiersModal(${p.product_id})" title="Wholesale Tiers">💲</button>
      <button class="btn-action btn-action-${p.status === 'active' ? 'red' : 'green'}" onclick="archiveProduct(${p.product_id}, '${escHtml(p.status)}')" title="${p.status === 'active' ? 'Archive' : 'Unarchive'}">${p.status === 'active' ? '🗃' : '♻️'}</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Model</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

/* ── Product Modal ──────────────────────────────────────────*/

let _productId = 0;

async function openProductModal(id = 0) {
  _productId = id;
  await refreshCategories();
  const catOpts = session.categories.map(c =>
    `<option value="${c.category_id}">${escHtml(c.name)}</option>`).join('');

  document.getElementById('product-modal-title').textContent = id ? 'Edit Product' : 'Add Product';
  document.getElementById('product-form-body').innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" id="pf-name" class="form-input" /></div>
    <div class="form-group form-group--spaced"><label>Category *</label><select id="pf-cat" class="form-input"><option value="">— Select —</option>${catOpts}</select></div>
    <div class="form-group form-group--spaced"><label>Base Price (₱) *</label><input type="number" id="pf-price" class="form-input" min="0" step="0.01" /></div>
    <div class="form-group form-group--spaced"><label>Pricing Model *</label>
      <select id="pf-model" class="form-input"><option value="catch_weight">Catch-weight (per kg)</option><option value="fixed_pack">Fixed Pack</option><option value="per_piece">Per Piece</option></select></div>
    <div class="form-group form-group--spaced" id="pf-weight-group"><label>Estimated Weight (kg)</label><input type="number" id="pf-weight" class="form-input" min="0" step="0.001" value="0" /></div>
    <div class="form-group form-group--spaced"><label>Description</label><textarea id="pf-desc" class="form-input" rows="3"></textarea></div>
    <div class="form-group form-group--spaced form-row">
      <label><input type="checkbox" id="pf-featured" /> Featured</label>
      <label for="pf-status">Status</label>
      <select id="pf-status" class="form-input"><option value="active">Active</option><option value="archived">Archived</option></select>
    </div>
    <p id="product-form-error" class="form-error" style="display:none"></p>`;

  document.getElementById('pf-model').addEventListener('change', () => {
    const isCW = document.getElementById('pf-model').value === 'catch_weight';
    document.getElementById('pf-weight-group').style.display = isCW ? '' : 'none';
  });

  if (id > 0) {
    const res = await apiGet('product', { id });
    if (res.success) {
      const p = res.data;
      document.getElementById('pf-name').value = p.name || '';
      document.getElementById('pf-cat').value = p.category_id || '';
      document.getElementById('pf-price').value = p.base_price || '';
      document.getElementById('pf-model').value = p.pricing_model || 'catch_weight';
      document.getElementById('pf-weight').value = p.estimated_weight || 0;
      document.getElementById('pf-desc').value = p.description || '';
      document.getElementById('pf-featured').checked = !!p.is_featured;
      document.getElementById('pf-status').value = p.status || 'active';
      const isCW = p.pricing_model === 'catch_weight';
      document.getElementById('pf-weight-group').style.display = isCW ? '' : 'none';
    }
  }
  openModal('product-modal', 'product-modal-close');
}

async function confirmSaveProduct() {
  const errEl = document.getElementById('product-form-error');
  errEl.style.display = 'none';
  const body = {
    product_id: _productId,
    name: document.getElementById('pf-name').value.trim(),
    category_id: document.getElementById('pf-cat').value,
    base_price: document.getElementById('pf-price').value,
    pricing_model: document.getElementById('pf-model').value,
    estimated_weight: document.getElementById('pf-weight').value || 0,
    description: document.getElementById('pf-desc').value.trim(),
    is_featured: document.getElementById('pf-featured').checked ? 1 : 0,
    status: document.getElementById('pf-status').value,
  };
  if (!body.name || !body.category_id || !body.base_price) {
    errEl.textContent = 'Name, category, and price are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_product', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(_productId ? 'Product updated.' : 'Product added.', 'success');
  closeModal('product-modal');
  loadProducts();
}

async function toggleFeatured(id, btn) {
  const res = await apiPost('toggle_featured', { product_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  const isFeatured = res.is_featured;
  btn.className = `btn-action btn-action-${isFeatured ? 'warn' : 'muted'}`;
  btn.title = isFeatured ? 'Unfeature' : 'Feature';
  toast(isFeatured ? 'Marked as featured.' : 'Removed from featured.', 'success');
}

async function archiveProduct(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'archived' : 'active';
  if (!confirm(`${newStatus === 'archived' ? 'Archive' : 'Restore'} this product?`)) return;
  const res = await apiPost('archive_product', { product_id: id, status: newStatus });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Product status updated.', 'success');
  loadProducts();
}

/* ── Wholesale Tiers Modal ──────────────────────────────────*/

let _tiersProductId = 0;

async function openTiersModal(productId) {
  _tiersProductId = productId;
  document.getElementById('tiers-list').innerHTML = spinnerHTML();
  openModal('tiers-modal', 'tiers-modal-close');
  await loadTiersList();
}

async function loadTiersList() {
  const res = await apiGet('wholesale_tiers', { product_id: _tiersProductId });
  if (!res.success) { document.getElementById('tiers-list').innerHTML = errorHTML(res.message); return; }
  const tiers = res.data || [];
  if (!tiers.length) {
    document.getElementById('tiers-list').innerHTML = '<p class="text-muted">No tiers yet.</p>';
    return;
  }
  const rows = tiers.map(t => `<tr>
    <td>${escHtml(t.min_qty)} ${escHtml(t.tier_unit)}</td>
    <td>${fmtPrice(t.tier_unit_price)}</td>
    <td><button class="btn-action btn-action-red" onclick="deleteTier(${t.tier_id})">✕</button></td>
  </tr>`).join('');
  document.getElementById('tiers-list').innerHTML = `<table class="data-table"><thead><tr><th>Min Qty</th><th>Unit Price</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function saveTier() {
  const errEl = document.getElementById('tier-form-error');
  errEl.style.display = 'none';
  const body = {
    product_id: _tiersProductId,
    min_qty: document.getElementById('tier-min-qty').value,
    tier_unit: document.getElementById('tier-unit').value,
    tier_unit_price: document.getElementById('tier-price').value,
  };
  if (!body.min_qty || !body.tier_unit_price) {
    errEl.textContent = 'Min qty and price are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_tier', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Tier saved.', 'success');
  document.getElementById('tier-min-qty').value = '';
  document.getElementById('tier-price').value = '';
  await loadTiersList();
}

async function deleteTier(tierId) {
  if (!confirm('Delete this wholesale tier?')) return;
  const res = await apiPost('delete_tier', { tier_id: tierId, product_id: _tiersProductId });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Tier deleted.', 'success');
  await loadTiersList();
}

/* ════════════════════════════════════════════════════════════
   CATEGORIES
═══════════════════════════════════════════════════════════════*/

async function loadCategories() {
  setLoading('categories-table-wrap', 'Loading categories…');
  const res = await apiGet('categories');
  if (!res.success) { document.getElementById('categories-table-wrap').innerHTML = errorHTML(res.message); return; }
  session.categories = res.data || [];
  renderCategoriesTable(session.categories);
}

function renderCategoriesTable(cats) {
  const wrap = document.getElementById('categories-table-wrap');
  if (!cats.length) { wrap.innerHTML = emptyStateHTML('🗂️', 'No Categories', 'Add your first category.'); return; }
  const rows = cats.map(c => `<tr>
    <td>${productIcon(c.name)} ${escHtml(c.name)}</td>
    <td>${escHtml(c.product_count ?? 0)}</td>
    <td>
      <button class="btn-action" onclick="openCategoryModal(${c.category_id}, '${escHtml(c.name)}')">✏️</button>
      <button class="btn-action btn-action-red" onclick="deleteCategory(${c.category_id})">✕</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Products</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

let _categoryId = 0;

function openCategoryModal(id = 0, name = '') {
  _categoryId = id;
  document.getElementById('category-modal-title').textContent = id ? 'Edit Category' : 'Add Category';
  document.getElementById('cat-name-input').value = name;
  document.getElementById('cat-form-error').style.display = 'none';
  openModal('category-modal', 'cat-modal-close');
}

async function confirmSaveCategory() {
  const errEl = document.getElementById('cat-form-error');
  errEl.style.display = 'none';
  const name = document.getElementById('cat-name-input').value.trim();
  if (!name) { errEl.textContent = 'Category name is required.'; errEl.style.display = ''; return; }
  const res = await apiPost('save_category', { category_id: _categoryId, name });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(_categoryId ? 'Category updated.' : 'Category added.', 'success');
  closeModal('category-modal');
  session.categories = []; // invalidate cache — dropdowns will rebuild on next load
  loadCategories();
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? It must have no products assigned.')) return;
  const res = await apiPost('delete_category', { category_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Category deleted.', 'success');
  session.categories = []; // invalidate cache — dropdowns will rebuild on next load
  loadCategories();
}

/* ════════════════════════════════════════════════════════════
   INVENTORY
═══════════════════════════════════════════════════════════════*/

async function loadInventory() {
  setLoading('inventory-table-wrap', 'Loading inventory…');
  await refreshCategories();
  const res = await apiGet('inventory');
  if (!res.success) { document.getElementById('inventory-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderInventoryTable(res.data || []);
}

function renderInventoryTable(batches) {
  const wrap = document.getElementById('inventory-table-wrap');
  if (!batches.length) { wrap.innerHTML = emptyStateHTML('📦', 'No Batches', 'No stock batches found.'); return; }
  const rows = batches.map(b => {
    const remaining = parseFloat(b.remaining_qty || 0);
    const original = parseFloat(b.quantity || 0);
    const pct = original > 0 ? Math.round((remaining / original) * 100) : 0;
    const rowClass = remaining === 0 ? 'row-oos' : pct <= 20 ? 'row-low-stock' : '';
    const barClass = pct <= 20 ? 'stock-bar--low' : 'stock-bar--ok';
    return `<tr class="${rowClass}">
      <td>${escHtml(b.product_name)}</td>
      <td>${escHtml(b.category_name)}</td>
      <td>${fmtDate(b.batch_date)}</td>
      <td>${parseFloat(b.quantity).toFixed(3)} ${escHtml(b.batch_unit)}</td>
      <td>
        <div class="stock-bar-wrap"><div class="stock-bar ${barClass}" style="width:${pct}%"></div></div>
        ${remaining.toFixed(3)} ${escHtml(b.batch_unit)} (${pct}%)
      </td>
      <td>${fmtDateTime(b.created_at)}</td>
      <td>
        <button class="btn-action" onclick="openAdjustModal(${b.batch_id}, '${escHtml(b.product_name)}', ${remaining})">➖ Adjust</button>
      </td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Product</th><th>Category</th><th>Batch Date</th><th>Original Qty</th><th>Remaining</th><th>Added</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

/* ── Add Batch ──────────────────────────────────────────────*/

async function openAddBatchModal() {
  await refreshCategories();
  const prodRes = await apiGet('products', { status: 'active' });
  const opts = (prodRes.data || []).map(p =>
    `<option value="${p.product_id}">${escHtml(p.name)}</option>`).join('');
  document.getElementById('batch-product-select').innerHTML = `<option value="">— Select Product —</option>${opts}`;
  document.getElementById('batch-date-input').value = new Date().toISOString().slice(0, 10);
  document.getElementById('batch-qty-input').value = '';
  document.getElementById('batch-add-error').style.display = 'none';
  openModal('add-batch-modal', 'batch-add-modal-close');
}

async function confirmAddBatch() {
  const errEl = document.getElementById('batch-add-error');
  errEl.style.display = 'none';
  const body = {
    product_id: document.getElementById('batch-product-select').value,
    batch_date: document.getElementById('batch-date-input').value,
    quantity: document.getElementById('batch-qty-input').value,
  };
  if (!body.product_id || !body.batch_date || !body.quantity) {
    errEl.textContent = 'All fields are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('add_batch', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Batch added to inventory.', 'success');
  closeModal('add-batch-modal');
  loadInventory();
}

/* ── Adjust Stock ───────────────────────────────────────────*/

let _adjustBatchId = 0;

function openAdjustModal(batchId, productName, currentQty) {
  _adjustBatchId = batchId;
  document.getElementById('adjust-stock-title').textContent = `Adjust: ${productName}`;
  document.getElementById('adjust-stock-current').value = currentQty;
  document.getElementById('adjust-stock-new').value = '';
  document.getElementById('adjust-notes').value = '';
  document.getElementById('adjust-stock-error').style.display = 'none';
  openModal('adjust-stock-modal', 'adjust-modal-close');
}

async function confirmAdjust() {
  const errEl = document.getElementById('adjust-stock-error');
  errEl.style.display = 'none';
  const body = {
    batch_id: _adjustBatchId,
    new_qty: document.getElementById('adjust-stock-new').value,
    reason_code: document.getElementById('adjust-reason').value,
    notes: document.getElementById('adjust-notes').value.trim(),
  };
  if (body.new_qty === '') { errEl.textContent = 'New quantity is required.'; errEl.style.display = ''; return; }
  const res = await apiPost('adjust_stock', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(`Stock adjusted. Variance: ${res.data?.variance}`, 'success');
  closeModal('adjust-stock-modal');
  loadInventory();
}

/* ════════════════════════════════════════════════════════════
   USERS
═══════════════════════════════════════════════════════════════*/

async function loadUsers() {
  setLoading('users-table-wrap', 'Loading users…');
  const role = document.getElementById('user-role-filter')?.value || '';
  const search = document.getElementById('user-search')?.value.trim() || '';
  const status = document.getElementById('user-status-filter')?.value || '';
  const res = await apiGet('users', { role, search, status });
  if (!res.success) { document.getElementById('users-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderUsersTable(res.data || []);
}

function renderUsersTable(users) {
  const wrap = document.getElementById('users-table-wrap');
  if (!users.length) { wrap.innerHTML = emptyStateHTML('👥', 'No Users', 'No users match the filter.'); return; }
  const rows = users.map(u => `<tr>
    <td>${escHtml(u.first_name)} ${escHtml(u.last_name)}</td>
    <td>${escHtml(u.email)}</td>
    <td>${escHtml(u.phone || '—')}</td>
    <td><span class="role-badge">${escHtml(u.role_name)}</span></td>
    <td><span class="status-badge ${u.status === 'active' ? 'status-Completed' : 'status-Cancelled'}">${escHtml(u.status)}</span></td>
    <td>${fmtDate(u.created_at)}</td>
    <td>
      <button class="btn-action" onclick='openUserModal(${JSON.stringify(u)})'>✏️</button>
      <button class="btn-action btn-action-${u.status === 'active' ? 'red' : 'green'}"
        onclick="toggleUserStatus(${u.user_id}, '${escHtml(u.status)}')">${u.status === 'active' ? 'Deactivate' : 'Activate'}</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

let _userId = 0;

function openUserModal(userObj = null) {
  _userId = userObj?.user_id ?? 0;
  document.getElementById('user-modal-title').textContent = _userId ? 'Edit User' : 'Add User';
  document.getElementById('uf-first').value = userObj?.first_name || '';
  document.getElementById('uf-last').value = userObj?.last_name || '';
  document.getElementById('uf-email').value = userObj?.email || '';
  document.getElementById('uf-phone').value = userObj?.phone || '';
  document.getElementById('uf-role').value = userObj?.role_name || 'Customer';
  document.getElementById('uf-password').value = '';
  document.getElementById('uf-password-hint').textContent = _userId
    ? 'Leave blank to keep current password.'
    : 'Password required for new users.';
  document.getElementById('user-form-error').style.display = 'none';
  openModal('user-modal', 'user-modal-close');
}

async function confirmSaveUser() {
  const errEl = document.getElementById('user-form-error');
  errEl.style.display = 'none';
  const body = {
    user_id: _userId,
    first_name: document.getElementById('uf-first').value.trim(),
    last_name: document.getElementById('uf-last').value.trim(),
    email: document.getElementById('uf-email').value.trim(),
    phone: document.getElementById('uf-phone').value.trim(),
    role: document.getElementById('uf-role').value,
    password: document.getElementById('uf-password').value,
  };
  if (!body.first_name || !body.last_name || !body.email || !body.role) {
    errEl.textContent = 'Name, email, and role are required.'; errEl.style.display = ''; return;
  }
  if (!_userId && !body.password) {
    errEl.textContent = 'Password is required for new users.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_user', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  if (body.role === 'Delivery Rider') session.riders = [];
  toast(_userId ? 'User updated.' : 'User created.', 'success');
  closeModal('user-modal');
  loadUsers();
}

async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  if (!confirm(`Set user status to "${newStatus}"?`)) return;
  const res = await apiPost('set_status', { user_id: id, status: newStatus });
  if (!res.success) { toast(res.message, 'error'); return; }
  session.riders = [];
  toast('User status updated.', 'success');
  loadUsers();
}

/* ════════════════════════════════════════════════════════════
   RIDERS
═══════════════════════════════════════════════════════════════*/

async function loadRiders() {
  setLoading('riders-table-wrap', 'Loading riders…');
  const res = await apiGet('riders');
  if (!res.success) { document.getElementById('riders-table-wrap').innerHTML = errorHTML(res.message); return; }
  session.riders = res.data || [];
  renderRidersTable(session.riders);
  loadRemittances();
}

function renderRidersTable(riders) {
  const wrap = document.getElementById('riders-table-wrap');
  if (!riders.length) { wrap.innerHTML = emptyStateHTML('🛵', 'No Riders', 'No delivery riders found.'); return; }
  const rows = riders.map(r => `<tr>
    <td>${escHtml(r.first_name)} ${escHtml(r.last_name)}</td>
    <td>${escHtml(r.email)}</td>
    <td>${escHtml(r.phone || '—')}</td>
    <td><span class="status-badge ${r.status === 'active' ? 'status-Completed' : 'status-Cancelled'}">${escHtml(r.status)}</span></td>
    <td>
      <button class="btn-action" onclick="openRiderPerformance(${r.user_id}, '${escHtml(r.first_name)} ${escHtml(r.last_name)}')">📊 Performance</button>
      <button class="btn-action" onclick="loadRiderSummary(${r.user_id})">📋 Today</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

let _perfRiderId = 0;

async function openRiderPerformance(id, name) {
  _perfRiderId = id;
  document.getElementById('perf-rider-name').textContent = name;
  document.getElementById('perf-date-from').value = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  document.getElementById('perf-date-to').value = new Date().toISOString().slice(0, 10);
  document.getElementById('perf-body').innerHTML = spinnerHTML();
  openModal('rider-perf-modal', 'perf-modal-close');
  await fetchRiderPerformance();
}

async function fetchRiderPerformance() {
  const from = document.getElementById('perf-date-from').value;
  const to = document.getElementById('perf-date-to').value;
  const res = await apiGet('rider_performance', { rider_id: _perfRiderId, date_from: from, date_to: to });
  if (!res.success) { document.getElementById('perf-body').innerHTML = errorHTML(res.message); return; }

  const s = res.data?.summary || {};
  const d = res.data?.daily || [];
  const pills = `<div class="stat-grid stat-grid--sm">
    ${statPillHTML('', '📦', s.total_deliveries ?? 0, 'Total')}
    ${statPillHTML('rsp--green', '✅', s.completed ?? 0, 'Completed')}
    ${statPillHTML('rsp--red', '❌', s.failed ?? 0, 'Failed')}
    ${statPillHTML('rsp--blue', '⭐', (s.completion_rate ?? 0) + '%', 'Success Rate')}
    ${statPillHTML('', '⏱', s.avg_delivery_minutes ? s.avg_delivery_minutes + ' min' : '—', 'Avg Delivery Time')}
  </div>`;
  const dailyRows = d.map(row => `<tr>
    <td>${fmtDate(row.delivery_date)}</td>
    <td>${escHtml(row.total)}</td>
    <td>${escHtml(row.completed)}</td>
    <td>${row.total > 0 ? Math.round((row.completed / row.total) * 100) + '%' : '—'}</td>
  </tr>`).join('');
  document.getElementById('perf-body').innerHTML = pills + `
    <table class="data-table" style="margin-top:1rem">
      <thead><tr><th>Date</th><th>Assigned</th><th>Completed</th><th>Rate</th></tr></thead>
      <tbody>${dailyRows || '<tr><td colspan="4" class="text-muted text-center">No data.</td></tr>'}</tbody>
    </table>`;
}

async function loadRiderSummary(id) {
  const res = await apiGet('rider_summary', { rider_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  const s = res.data || {};
  const rider = session.riders.find(r => r.user_id === id) || {};
  const name = rider.first_name
    ? `${escHtml(rider.first_name)} ${escHtml(rider.last_name)}`
    : `Rider #${id}`;

  // Reuse the rider-perf-modal with a slim today-only summary view.
  // Date inputs stay visible but are not used for this summary call.
  _perfRiderId = id;
  document.getElementById('perf-rider-name').textContent = rider.first_name
    ? `${rider.first_name} ${rider.last_name}`
    : `Rider #${id}`;
  document.getElementById('perf-date-from').value = new Date().toISOString().slice(0, 10);
  document.getElementById('perf-date-to').value = new Date().toISOString().slice(0, 10);
  document.getElementById('perf-body').innerHTML = `
    <p class="text-muted" style="margin-bottom:.75rem">Today's snapshot — click Apply for a full date range.</p>
    <div class="stat-grid stat-grid--sm">
      ${statPillHTML('', '📦', s.total_assigned || 0, 'Assigned Today')}
      ${statPillHTML('rsp--green', '✅', s.completed || 0, 'Completed')}
      ${statPillHTML('rsp--blue', '💵', fmtPrice(s.collected_today || 0), 'Collected')}
    </div>`;
  openModal('rider-perf-modal', 'perf-modal-close');
}

async function loadRemittances() {
  setLoading('remittances-table-wrap', 'Loading remittances…');
  const riderId = document.getElementById('remit-rider-filter')?.value || 0;
  const res = await apiGet('remittances', { rider_id: riderId });
  if (!res.success) { document.getElementById('remittances-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderRemittancesTable(res.data || []);
}

function renderRemittancesTable(remits) {
  const wrap = document.getElementById('remittances-table-wrap');
  if (!remits.length) { wrap.innerHTML = emptyStateHTML('💵', 'No Remittances', 'No remittance records found.'); return; }
  const rows = remits.map(r => `<tr>
    <td>${escHtml(r.rider_name || `Rider #${r.rider_id}`)}</td>
    <td>${fmtPrice(r.amount)}</td>
    <td>${escHtml(r.notes || '—')}</td>
    <td>${fmtDateTime(r.remitted_at)}</td>
    <td><span class="status-badge ${r.status === 'Confirmed' ? 'status-Completed' : 'status-Pending'}">${escHtml(r.status)}</span></td>
    <td>
      ${r.status !== 'Confirmed' ? `<button class="btn-action btn-action-green" onclick="confirmRemittance(${r.remittance_id})">✓ Confirm</button>` : '—'}
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Rider</th><th>Amount</th><th>Notes</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

async function confirmRemittance(id) {
  if (!confirm('Confirm this cash remittance?')) return;
  const res = await apiPost('confirm_remittance', { remittance_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Remittance confirmed.', 'success');
  loadRemittances();
}

/* ════════════════════════════════════════════════════════════
   PAYMENTS
═══════════════════════════════════════════════════════════════*/

async function loadPayments() {
  setLoading('payments-table-wrap', 'Loading pending GCash payments…');
  const res = await apiGet('pending_gcash_payments');
  if (!res.success) { document.getElementById('payments-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderPaymentsTable(res.data || []);
}

function renderPaymentsTable(payments) {
  const wrap = document.getElementById('payments-table-wrap');
  if (!payments.length) {
    wrap.innerHTML = emptyStateHTML('✅', 'All Verified', 'No pending GCash payments to verify.');
    return;
  }

  const rows = payments.map(p => {
    const total    = fmtPrice(p.final_total || p.amount || p.estimated_total);
    const refCode  = p.gcash_reference
      ? `<code style="background:var(--info-pale);color:var(--info-text);padding:.15rem .4rem;border-radius:4px;font-size:.8rem;font-weight:700;letter-spacing:.03em">${escHtml(p.gcash_reference)}</code>`
      : `<span style="color:var(--text-muted);font-size:.8rem">— not yet submitted</span>`;
    const screenshot = p.gcash_screenshot
      ? `<a href="${escHtml(p.gcash_screenshot)}" target="_blank" class="btn-action btn-action-blue" style="text-decoration:none">🖼 View</a>`
      : `<span style="color:var(--text-muted);font-size:.8rem">—</span>`;
    return `<tr>
      <td><strong style="font-family:var(--font-display)">${escHtml(p.order_number)}</strong></td>
      <td>
        ${escHtml(p.first_name)} ${escHtml(p.last_name)}<br/>
        <small style="color:var(--text-muted)">${escHtml(p.email || '')}</small>
      </td>
      <td>${total}</td>
      <td>${refCode}</td>
      <td>${screenshot}</td>
      <td>${fmtDateTime(p.created_at)}</td>
      <td class="td-actions" style="white-space:nowrap">
        <button class="btn-action btn-action-green" onclick="confirmVerifyPayment(${p.order_id}, this)">
          ✓ Verify
        </button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Order #</th>
      <th>Customer</th>
      <th>Amount</th>
      <th>💙 GCash Reference</th>
      <th>Screenshot</th>
      <th>Placed</th>
      <th>Action</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function confirmVerifyPayment(orderId, btn) {
  if (!confirm('Mark this GCash payment as verified?')) return;
  const res = await apiPost('verify_payment', { order_id: orderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Payment verified! ✅', 'success');
  const row = btn.closest('tr');
  if (row) row.remove();
  // Update sidebar badge
  loadSidebarCounts();
}

/* ════════════════════════════════════════════════════════════
   PROMOS
═══════════════════════════════════════════════════════════════*/

async function loadPromos() {
  setLoading('promos-table-wrap', 'Loading promos…');
  const res = await apiGet('promos');
  if (!res.success) { document.getElementById('promos-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderPromosTable(res.data || []);
}

function renderPromosTable(promos) {
  const wrap = document.getElementById('promos-table-wrap');
  if (!promos.length) { wrap.innerHTML = emptyStateHTML('🏷', 'No Promos', 'No promo codes yet.'); return; }
  const rows = promos.map(p => `<tr>
    <td><strong>${escHtml(p.code)}</strong></td>
    <td>${escHtml(p.discount_type === 'percentage' ? p.discount_value + '%' : fmtPrice(p.discount_value))}</td>
    <td>${fmtPrice(p.min_order_value || 0)}</td>
    <td>${p.valid_from ? fmtDate(p.valid_from) : '—'} → ${p.valid_to ? fmtDate(p.valid_to) : '—'}</td>
    <td>${escHtml(p.times_used ?? 0)} / ${p.usage_limit ?? '∞'}</td>
    <td><span class="status-badge ${p.is_active ? 'status-Completed' : 'status-Cancelled'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
    <td>
      <button class="btn-action" onclick='openPromoModal(${JSON.stringify(p)})'>✏️</button>
      <button class="btn-action btn-action-${p.is_active ? 'red' : 'green'}" onclick="togglePromo(${p.promo_id}, ${p.is_active}, this)">${p.is_active ? 'Disable' : 'Enable'}</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Valid</th><th>Usage</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

let _promoId = 0;

function openPromoModal(promoObj = null) {
  _promoId = promoObj?.promo_id ?? 0;
  document.getElementById('promo-modal-title').textContent = _promoId ? 'Edit Promo' : 'Add Promo';
  document.getElementById('prom-code').value = promoObj?.code || '';
  document.getElementById('prom-type').value = promoObj?.discount_type || 'flat';
  document.getElementById('prom-value').value = promoObj?.discount_value || '';
  document.getElementById('prom-min').value = promoObj?.min_order_value || 0;
  document.getElementById('prom-from').value = promoObj?.valid_from?.slice(0, 10) || '';
  document.getElementById('prom-to').value = promoObj?.valid_to?.slice(0, 10) || '';
  document.getElementById('prom-limit').value = promoObj?.usage_limit ?? '';
  document.getElementById('prom-active').checked = promoObj?.is_active ?? true;
  document.getElementById('promo-form-error').style.display = 'none';
  updatePromoTypeLabel();
  openModal('promo-modal', 'promo-modal-close');
}

function updatePromoTypeLabel() {
  const type = document.getElementById('prom-type')?.value;
  const lbl = document.getElementById('prom-value-label');
  if (lbl) lbl.textContent = type === 'percentage' ? 'Discount %' : 'Discount Amount (₱)';
}

async function confirmSavePromo() {
  const errEl = document.getElementById('promo-form-error');
  errEl.style.display = 'none';
  const body = {
    promo_id: _promoId,
    code: document.getElementById('prom-code').value.trim().toUpperCase(),
    discount_type: document.getElementById('prom-type').value,
    discount_value: document.getElementById('prom-value').value,
    min_order_value: document.getElementById('prom-min').value || 0,
    valid_from: document.getElementById('prom-from').value || null,
    valid_to: document.getElementById('prom-to').value || null,
    usage_limit: document.getElementById('prom-limit').value || null,
    is_active: document.getElementById('prom-active').checked ? 1 : 0,
  };
  if (!body.code || !body.discount_value) {
    errEl.textContent = 'Code and discount value are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_promo', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast(_promoId ? 'Promo updated.' : 'Promo created.', 'success');
  closeModal('promo-modal');
  loadPromos();
}

async function togglePromo(id, currentActive, btn) {
  const newActive = currentActive ? 0 : 1;
  const res = await apiPost('save_promo', { promo_id: id, is_active: newActive, _toggle_only: 1 });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast(newActive ? 'Promo enabled.' : 'Promo disabled.', 'success');
  loadPromos();
}

/* ════════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════════*/

async function loadSettings() {
  // Do NOT call setLoading('settings-content', …) — that replaces the entire
  // innerHTML and destroys settings-hours-wrap / settings-zones-wrap /
  // settings-slots-wrap before the render helpers can find them.
  setLoading('settings-hours-wrap', 'Loading…');
  setLoading('settings-zones-wrap', 'Loading…');
  setLoading('settings-slots-wrap', 'Loading…');
  const res = await apiGet('settings');
  if (!res.success) { document.getElementById('settings-content').innerHTML = errorHTML(res.message); return; }
  renderHours(res.data?.hours || []);
  renderZones(res.data?.zones || []);
  renderSlots(res.data?.slots || []);
}

function renderHours(hours) {
  const wrap = document.getElementById('settings-hours-wrap');
  if (!wrap) return;
  const rows = hours.map(h => `<tr>
    <td>${DAY_NAMES[h.day_of_week] || h.day_of_week}</td>
    <td>${fmtTime12(h.open_time)} — ${fmtTime12(h.close_time)}</td>
    <td>
      <label class="toggle-switch">
        <input type="checkbox" ${h.is_active ? 'checked' : ''} onchange="toggleHour(${h.day_of_week}, this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </td>
    <td><button class="btn-action" onclick='openHourModal(${JSON.stringify(h)})'>✏️</button></td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Day</th><th>Hours</th><th>Active</th><th>Edit</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function toggleHour(dayOfWeek, isActive) {
  const res = await apiPost('save_hours', { day_of_week: dayOfWeek, is_active: isActive ? 1 : 0 });
  if (!res.success) { toast(res.message, 'error'); }
}

function renderZones(zones) {
  const wrap = document.getElementById('settings-zones-wrap');
  if (!wrap) return;
  const rows = zones.map(z => `<tr>
    <td>${escHtml(z.municipality_name)}</td>
    <td>${fmtPrice(z.delivery_fee)}</td>
    <td>
      <button class="btn-action" onclick='openZoneModal(${JSON.stringify(z)})'>✏️</button>
      <button class="btn-action btn-action-red" onclick="deleteZone(${z.zone_id})">✕</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Municipality</th><th>Fee</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <button class="btn-outline" style="margin-top:.75rem" onclick="openZoneModal()">+ Add Zone</button>`;
}

let _zoneId = 0;

function openZoneModal(zoneObj = null) {
  _zoneId = zoneObj?.zone_id ?? 0;
  document.getElementById('zone-modal-title').textContent = _zoneId ? 'Edit Delivery Zone' : 'Add Delivery Zone';
  document.getElementById('zone-muni-id').value = zoneObj?.municipality_id || '';
  document.getElementById('zone-fee-input').value = zoneObj?.delivery_fee || '';
  document.getElementById('zone-form-error').style.display = 'none';
  openModal('zone-modal', 'zone-modal-close');
}

async function confirmSaveZone() {
  const errEl = document.getElementById('zone-form-error');
  errEl.style.display = 'none';
  const body = {
    zone_id: _zoneId,
    municipality_id: document.getElementById('zone-muni-id').value,
    delivery_fee: document.getElementById('zone-fee-input').value,
  };
  if (!body.municipality_id || body.delivery_fee === '') {
    errEl.textContent = 'Municipality and fee are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_zone', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Zone saved.', 'success');
  closeModal('zone-modal');
  loadSettings();
}

async function deleteZone(id) {
  if (!confirm('Delete this delivery zone?')) return;
  const res = await apiPost('delete_zone', { zone_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Zone deleted.', 'success');
  loadSettings();
}

function renderSlots(slots) {
  const wrap = document.getElementById('settings-slots-wrap');
  if (!wrap) return;
  const rows = slots.map(s => `<tr>
    <td>${escHtml(s.slot_label)}</td>
    <td>${fmtTime12(s.start_time)} — ${fmtTime12(s.end_time)}</td>
    <td><span class="status-badge ${s.is_active ? 'status-Completed' : 'status-Cancelled'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
    <td>
      <button class="btn-action" onclick='openSlotModal(${JSON.stringify(s)})'>✏️</button>
      <button class="btn-action btn-action-red" onclick="deleteSlot(${s.slot_id})">✕</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Label</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <button class="btn-outline" style="margin-top:.75rem" onclick="openSlotModal()">+ Add Slot</button>`;
}

let _slotId = 0;

function openSlotModal(slotObj = null) {
  _slotId = slotObj?.slot_id ?? 0;
  document.getElementById('slot-modal-title').textContent = _slotId ? 'Edit Time Slot' : 'Add Time Slot';
  document.getElementById('slot-label-input').value = slotObj?.slot_label || '';
  document.getElementById('slot-start-input').value = slotObj?.start_time || '';
  document.getElementById('slot-end-input').value = slotObj?.end_time || '';
  document.getElementById('slot-active-chk').checked = slotObj?.is_active ?? true;
  document.getElementById('slot-form-error').style.display = 'none';
  openModal('slot-modal', 'slot-modal-close');
}

async function confirmSaveSlot() {
  const errEl = document.getElementById('slot-form-error');
  errEl.style.display = 'none';
  const body = {
    slot_id: _slotId,
    slot_label: document.getElementById('slot-label-input').value.trim(),
    start_time: document.getElementById('slot-start-input').value,
    end_time: document.getElementById('slot-end-input').value,
    is_active: document.getElementById('slot-active-chk').checked ? 1 : 0,
  };
  if (!body.slot_label || !body.start_time || !body.end_time) {
    errEl.textContent = 'All fields are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_slot', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Slot saved.', 'success');
  closeModal('slot-modal');
  loadSettings();
}

async function deleteSlot(id) {
  if (!confirm('Delete this time slot?')) return;
  const res = await apiPost('delete_slot', { slot_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Slot deleted.', 'success');
  loadSettings();
}

/* ── Operational Hours Edit ─────────────────────────────────*/

let _hourDayOfWeek = -1;

function openHourModal(hourObj) {
  _hourDayOfWeek = hourObj.day_of_week;
  document.getElementById('hour-modal-title').textContent =
    `Edit Hours — ${DAY_NAMES[_hourDayOfWeek] || _hourDayOfWeek}`;
  document.getElementById('hour-open-input').value = hourObj.open_time || '';
  document.getElementById('hour-close-input').value = hourObj.close_time || '';
  document.getElementById('hour-form-error').style.display = 'none';
  openModal('hour-modal', 'hour-modal-close');
}

async function confirmSaveHour() {
  const errEl = document.getElementById('hour-form-error');
  errEl.style.display = 'none';
  const openTime = document.getElementById('hour-open-input').value;
  const closeTime = document.getElementById('hour-close-input').value;
  if (!openTime || !closeTime) {
    errEl.textContent = 'Both open and close times are required.';
    errEl.style.display = '';
    return;
  }
  const res = await apiPost('save_hours', {
    day_of_week: _hourDayOfWeek,
    open_time: openTime,
    close_time: closeTime,
  });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Hours updated.', 'success');
  closeModal('hour-modal');
  loadSettings();
}

/* ════════════════════════════════════════════════════════════
   REPORTS
═══════════════════════════════════════════════════════════════*/

async function loadReports() {
  const days = parseInt(document.getElementById('report-days-select')?.value || 30);
  await fetchReport(days);
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('prep-date-input').value = today;
  loadDailyPrep(); // auto-populate prep sheet with today's data on page entry
}

async function fetchReport(days) {
  setLoading('report-charts', 'Loading report…');
  const res = await apiGet('report', { days });
  if (!res.success) { document.getElementById('report-charts').innerHTML = errorHTML(res.message); return; }
  renderReportCharts(res.data);
}

function renderReportCharts(data) {
  const t = data.totals || {};
  const daily = data.daily || [];
  const cats = data.by_category || [];
  const prods = data.top_products || [];

  // Summary cards
  const summary = `<div class="stat-grid">
    <div class="stat-card stat-card--green"><div class="stat-icon">💰</div><div class="stat-info"><span class="stat-val">${fmtPrice(t.total_revenue || 0)}</span><span class="stat-label">Total Revenue (${escHtml(data.period_days)} days)</span></div></div>
    <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-info"><span class="stat-val">${escHtml(t.total_orders || 0)}</span><span class="stat-label">Orders</span></div></div>
    <div class="stat-card stat-card--warn"><div class="stat-icon">🏷</div><div class="stat-info"><span class="stat-val">${fmtPrice(t.total_discounts || 0)}</span><span class="stat-label">Discounts Given</span></div></div>
    <div class="stat-card"><div class="stat-icon">🚴</div><div class="stat-info"><span class="stat-val">${fmtPrice(t.total_delivery_fees || 0)}</span><span class="stat-label">Delivery Fees</span></div></div>
  </div>`;

  // Daily revenue bar chart
  const maxRev = Math.max(...daily.map(d => parseFloat(d.revenue)), 1);
  const bars = daily.map(d => {
    const pct = Math.round((parseFloat(d.revenue) / maxRev) * 100);
    const lbl = new Date(d.d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    return `<div class="rev-bar-col" title="${escHtml(lbl)}: ${fmtPrice(d.revenue)} / ${escHtml(d.order_count)} orders">
      <div class="rev-bar" style="height:${pct}%"></div>
      <div class="rev-bar-label">${escHtml(lbl)}</div>
    </div>`;
  }).join('');
  const barChart = `<div class="section-card"><h3 class="section-card__title">📊 Daily Revenue</h3>
    <div class="rev-bar-chart">${bars || '<p class="text-muted">No completed orders in period.</p>'}</div></div>`;

  // Category breakdown
  const catMaxRev = Math.max(...cats.map(c => parseFloat(c.revenue)), 1);
  const catRows = cats.map(c => {
    const pct = Math.round((parseFloat(c.revenue) / catMaxRev) * 100);
    return `<tr>
      <td>${productIcon(c.category)} ${escHtml(c.category)}</td>
      <td>${escHtml(c.items_sold)}</td>
      <td>${fmtPrice(c.revenue)}</td>
      <td><div class="inline-bar"><div class="inline-bar__fill" style="width:${pct}%"></div></div></td>
    </tr>`;
  }).join('');
  const catTable = `<div class="section-card"><h3 class="section-card__title">🗂️ Revenue by Category</h3>
    <table class="data-table"><thead><tr><th>Category</th><th>Items Sold</th><th>Revenue</th><th></th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="4" class="text-muted text-center">No data.</td></tr>'}</tbody></table></div>`;

  // Top products
  const prodRows = prods.map((p, i) => `<tr>
    <td>${i + 1}</td>
    <td>${escHtml(p.name)}</td>
    <td>${escHtml(p.category)}</td>
    <td>${escHtml(p.times_ordered)}</td>
    <td>${parseFloat(p.total_qty || 0).toFixed(3)}</td>
  </tr>`).join('');
  const prodTable = `<div class="section-card"><h3 class="section-card__title">🏆 Top Products</h3>
    <table class="data-table"><thead><tr><th>#</th><th>Product</th><th>Category</th><th>Times Ordered</th><th>Total Qty</th></tr></thead>
    <tbody>${prodRows || '<tr><td colspan="5" class="text-muted text-center">No data.</td></tr>'}</tbody></table></div>`;

  document.getElementById('report-charts').innerHTML = summary + barChart + catTable + prodTable;
}

async function loadDailyPrep() {
  const date = document.getElementById('prep-date-input')?.value || new Date().toISOString().slice(0, 10);
  setLoading('prep-table-wrap', 'Loading prep sheet…');
  const res = await apiGet('daily_prep', { date });
  if (!res.success) { document.getElementById('prep-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderPrepSheet(res.data || [], date);
}

function renderPrepSheet(items, date) {
  const wrap = document.getElementById('prep-table-wrap');
  if (!items.length) { wrap.innerHTML = emptyStateHTML('📋', 'Nothing to Prep', `No pending orders for ${fmtDate(date)}.`); return; }
  const rows = items.map(it => `<tr>
    <td>${escHtml(it.category_name)}</td>
    <td>${productIcon(it.category_name)} ${escHtml(it.product_name)}</td>
    <td>${escHtml(it.order_count)}</td>
    <td>${parseFloat(it.total_qty || 0).toFixed(3)} ${escHtml(it.unit_of_measure)}</td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table" id="prep-printable-table">
    <thead><tr><th>Category</th><th>Product</th><th>Orders</th><th>Total Qty Needed</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function printPrepSheet() {
  const tableEl = document.getElementById('prep-printable-table');
  if (!tableEl) return;
  const date = document.getElementById('prep-date-input')?.value || '';

  document.getElementById('print-slip').innerHTML     = '';
  document.getElementById('thermal-labels').innerHTML = '';
  document.querySelectorAll('[data-print-mode]').forEach(el => el.removeAttribute('data-print-mode'));

  const prepEl = document.getElementById('prep-sheet-print');
  prepEl.innerHTML = `
    <div class="slip-header">
      <div class="slip-brand">🐓 PoultryMart</div>
      <div class="slip-portal">Daily Prep Sheet</div>
    </div>
    <hr class="slip-hr"/>
    <div class="prep-sheet-meta">Date: ${fmtDate(date)} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-PH')}</div>
    ${tableEl.outerHTML}`;
  prepEl.setAttribute('data-print-mode', 'active');

  const afterPrint = () => {
    prepEl.innerHTML = '';
    prepEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint);
  };
  window.addEventListener('afterprint', afterPrint);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

/* ════════════════════════════════════════════════════════════
   DISPUTES
═══════════════════════════════════════════════════════════════*/

let _currentDisputeFilter = '';

function setDisputeFilter(status) {
  _currentDisputeFilter = status;
  // Update active pill
  ['all', 'open', 'review', 'resolved', 'rejected'].forEach(id => {
    const el = document.getElementById('btn-dispute-' + id);
    if (el) el.classList.remove('active');
  });
  let activeId = 'all';
  if (status === 'Open') activeId = 'open';
  else if (status === 'Under Review') activeId = 'review';
  else if (status === 'Resolved') activeId = 'resolved';
  else if (status === 'Rejected') activeId = 'rejected';
  
  const activeEl = document.getElementById('btn-dispute-' + activeId);
  if (activeEl) activeEl.classList.add('active');
  
  loadDisputes();
}

async function loadDisputes() {
  setLoading('disputes-table-wrap', 'Loading disputes…');
  const res = await apiGet('disputes', { status: _currentDisputeFilter, limit: 100 });
  if (!res.success) { document.getElementById('disputes-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderDisputesTable(res.data?.disputes || []);
}

function renderDisputesTable(disputes) {
  const wrap = document.getElementById('disputes-table-wrap');
  if (!disputes.length) { wrap.innerHTML = emptyStateHTML('⚖️', 'No Disputes', 'No disputes found.'); return; }
  
  const getBadgeClass = (status) => {
      if (status === 'Open') return 'status-Cancelled'; // Red-ish
      if (status === 'Under Review') return 'status-Assigned'; // Blue-ish
      if (status === 'Resolved') return 'status-Completed'; // Green
      if (status === 'Rejected') return 'status-Pending'; // Gray
      return '';
  };

  const rows = disputes.map(d => `<tr>
    <td><button class="link-btn" onclick="openOrderDetail(${d.order_id})">${escHtml(d.order_number)}</button></td>
    <td>${escHtml((d.first_name || '') + ' ' + (d.last_name || '')).trim() || '—'}</td>
    <td class="dispute-desc">${escHtml(d.description?.slice(0, 80))}${d.description?.length > 80 ? '…' : ''}</td>
    <td><span class="status-badge ${getBadgeClass(d.status)}">${escHtml(d.status)}</span></td>
    <td>${fmtDateTime(d.created_at)}</td>
    <td>
      <button class="btn-action" onclick="openDisputeDetail(${d.dispute_id})">👁 View</button>
      ${(d.status === 'Open' || d.status === 'Under Review') ? `<button class="btn-action btn-action-green" onclick="openUpdateDisputeModal(${d.dispute_id}, '${d.status}')">✎ Update</button>` : ''}
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Order #</th><th>Customer</th><th>Description</th><th>Status</th><th>Filed</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

async function openDisputeDetail(id) {
  document.getElementById('dispute-detail-body').innerHTML = spinnerHTML();
  openModal('dispute-modal', 'dispute-modal-close');
  const res = await apiGet('dispute', { id });
  const d = res.data;
  if (!res.success || !d) { document.getElementById('dispute-detail-body').innerHTML = errorHTML('Not found.'); return; }
  
  const contactInfo = `📱 ${escHtml(d.phone || 'N/A')} &nbsp;|&nbsp; ✉️ ${escHtml(d.email || 'N/A')}`;
  
  document.getElementById('dispute-detail-body').innerHTML = `
    ${detailRow('Order', `<button class="link-btn" onclick="closeModal('dispute-modal'); openOrderDetail(${d.order_id})">${escHtml(d.order_number)}</button>`)}
    ${detailRow('Customer', escHtml((d.first_name || '') + ' ' + (d.last_name || '')).trim() || '—')}
    ${detailRow('Contact', contactInfo)}
    ${detailRow('Filed', fmtDateTime(d.created_at))}
    ${detailRow('Status', d.status)}
    ${detailRow('Description', escHtml(d.description))}
    ${d.evidence_url ? `<div class="detail-info-item"><span class="detail-info-label">Evidence</span><div style="margin-top:.5rem"><img src="${escHtml(d.evidence_url)}" alt="Dispute evidence" style="max-width:100%;max-height:320px;border-radius:6px;border:1px solid var(--border);display:block" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'" /><a href="${escHtml(d.evidence_url)}" target="_blank" class="link-btn" style="display:none">⚠ Image failed to load — open directly ↗</a></div></div>` : ''}
    ${d.resolved_at ? detailRow('Resolved', fmtDateTime(d.resolved_at)) : ''}
    ${d.resolution_notes ? detailRow('Resolution', escHtml(d.resolution_notes)) : ''}
    ${(d.status === 'Open' || d.status === 'Under Review') ? `<div style="margin-top:1rem"><button class="btn-primary" onclick="closeModal('dispute-modal');openUpdateDisputeModal(${d.dispute_id}, '${d.status}')">✎ Update Status</button></div>` : ''}`;
}

let _updateDisputeId = 0;

function openUpdateDisputeModal(id, currentStatus) {
  _updateDisputeId = id;
  const statusEl = document.getElementById('ud-status');
  if (statusEl) statusEl.value = currentStatus === 'Open' ? 'Under Review' : currentStatus;
  document.getElementById('ud-notes').value = '';
  document.getElementById('ud-error').style.display = 'none';
  openModal('update-dispute-modal', 'update-modal-close');
}

async function submitUpdateDispute() {
  const errEl = document.getElementById('ud-error');
  errEl.style.display = 'none';
  const status = document.getElementById('ud-status').value;
  const notes = document.getElementById('ud-notes').value.trim();
  if (!notes) { errEl.textContent = 'Notes are required.'; errEl.style.display = ''; return; }
  
  const res = await apiPost('update_dispute', { dispute_id: _updateDisputeId, status, resolution_notes: notes });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  
  toast('Dispute updated.', 'success');
  closeModal('update-dispute-modal');
  loadDisputes();
  loadSidebarCounts();
}

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════════════*/

async function loadNotifications() {
  document.getElementById('notif-send-area').style.display = '';
  const wrap = document.getElementById('notif-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = spinnerHTML();
  const res = await apiGet('notifications_poll');
  const items = res.success ? (res.data?.data || []) : [];
  if (!items.length) {
    wrap.innerHTML = emptyStateHTML('🔔', 'All Clear', 'No unread alerts.');
    updateNotifBell(0);
    const nb = document.getElementById('nav-badge-notif');
    if (nb) { nb.textContent = ''; nb.style.display = 'none'; }
    return;
  }
  const rows = items.map(n => `<div class="notif-item">
      <div class="notif-item-msg">${escHtml(n.message || n.reason || "")}</div>
      <div class="notif-item-meta">
        ${n.order_number ? `<span class="badge">#${escHtml(n.order_number)}</span>` : ""}
        <span class="text-muted">${fmtDateTime(n.created_at)}</span>
      </div>
    </div>`).join("");
  wrap.innerHTML = `<div class="notif-list">${rows}</div>
    <div style="margin-top:1rem">
      <button class="btn-outline" onclick="dismissAllAlerts()">
        ✓ Mark All as Read</button></div>`;
  session._notifIds = items
    .map(n => n.notification_id).filter(Boolean);
  updateNotifBell(session._notifIds.length);
  const nb = document.getElementById('nav-badge-notif');
  if (nb) {
    nb.textContent = session._notifIds.length > 0 ? session._notifIds.length : '';
    nb.style.display = session._notifIds.length > 0 ? '' : 'none';
  }
}

function openSendNotifModal() {
  document.getElementById('notif-user-id').value = '';
  document.getElementById('notif-message').value = '';
  document.getElementById('notif-type').value = 'general';
  document.getElementById('send-notif-error').style.display = 'none';
  openModal('send-notif-modal', 'notif-modal-close');
}

async function confirmSendNotif() {
  const errEl = document.getElementById('send-notif-error');
  errEl.style.display = 'none';
  const body = {
    user_id: document.getElementById('notif-user-id').value,
    message: document.getElementById('notif-message').value.trim(),
    type: document.getElementById('notif-type').value,
  };
  if (!body.user_id || !body.message) {
    errEl.textContent = 'User ID and message are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('send_notification', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Notification sent.', 'success');
  closeModal('send-notif-modal');
}

function startCancellationPoll() {
  if (session._pollTimer) clearInterval(session._pollTimer);
  pollCancellations();
  session._pollTimer = setInterval(pollCancellations, POLL_INTERVAL_MS);
}

async function pollCancellations() {
  const res = await apiGet('notifications_poll');
  if (!res.success) return;
  const items = res.data?.data || [];
  if (items.length) {
    session._notifIds = items.map(n => n.notification_id).filter(Boolean);
    updateNotifBell(session._notifIds.length);
    // Keep sidebar nav badge in sync with the live poll
    const nb = document.getElementById('nav-badge-notif');
    if (nb) {
      nb.textContent = session._notifIds.length > 0 ? session._notifIds.length : '';
      nb.style.display = session._notifIds.length > 0 ? '' : 'none';
    }
  }
}

function updateNotifBell(count) {
  const bell = document.getElementById('notif-bell');
  const badge = document.getElementById('notif-bell-badge');
  if (!bell || !badge) return;
  badge.textContent = count > 0 ? count : '';
  badge.style.display = count > 0 ? '' : 'none';
  bell.classList.toggle('bell-active', count > 0);
}

async function dismissAllAlerts() {
  if (!session._notifIds.length) return;
  const res = await apiPost('mark_notif_read',
    { notification_ids: session._notifIds });
  if (res.success) {
    session._notifIds = [];
    updateNotifBell(0);
    // Clear sidebar badge too
    const nb = document.getElementById('nav-badge-notif');
    if (nb) { nb.textContent = ''; nb.style.display = 'none'; }
    toast('Notifications cleared.', 'success');
    loadNotifications(); // refresh the empty state
  }
}

/* ════════════════════════════════════════════════════════════
   AUDIT LOG
═══════════════════════════════════════════════════════════════*/

const auditState = { page: 1, action: '', entity: '', from: '', to: '' };

async function loadAuditLog() {
  setLoading('audit-table-wrap', 'Loading audit log…');
  const params = {
    page: auditState.page,
    action_filter: auditState.action,
    entity_type: auditState.entity,
    date_from: auditState.from,
    date_to: auditState.to,
  };
  const res = await apiGet('audit_log', params);
  if (!res.success) { document.getElementById('audit-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderAuditTable(res.data);
}

function renderAuditTable(res) {
  const wrap = document.getElementById('audit-table-wrap');
  const logs = res.logs || [];
  if (!logs.length) { wrap.innerHTML = emptyStateHTML('📋', 'No Logs', 'No audit records found.'); document.getElementById('audit-pagination').innerHTML = ''; return; }
  const rows = logs.map(l => {
    const detailShort = (l.details || '').slice(0, 100);
    const hasMore = (l.details || '').length > 100;
    return `<tr>
      <td>${fmtDateTime(l.created_at)}</td>
      <td>${escHtml(l.actor_name || `User #${l.user_id}`)}</td>
      <td><code>${escHtml(l.action)}</code></td>
      <td>${escHtml(l.entity_type)}</td>
      <td>${escHtml(l.entity_id)}</td>
      <td class="audit-detail">
        <span id="audit-short-${l.log_id}">${escHtml(detailShort)}${hasMore ? '…' : ''}</span>
        ${hasMore ? `<button class="link-btn" id="audit-toggle-${l.log_id}" onclick="expandAuditRow(${l.log_id}, '${encodeURIComponent(l.details)}')">more</button><span id="audit-full-${l.log_id}" hidden>${escHtml(l.details)}</span>` : ''}
      </td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Details</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  renderPagination('audit-pagination', auditState.page, res.pages || 1, (p) => {
    auditState.page = p;
    loadAuditLog();
  });
}

function expandAuditRow(logId, encodedDetail) {
  const shortEl = document.getElementById(`audit-short-${logId}`);
  const fullEl = document.getElementById(`audit-full-${logId}`);
  const toggleEl = document.getElementById(`audit-toggle-${logId}`);
  if (!fullEl) return;
  const isExpanded = !fullEl.hidden;   // true  → currently open, about to collapse
  fullEl.hidden = isExpanded;
  if (shortEl) shortEl.hidden = !isExpanded;
  if (toggleEl) toggleEl.textContent = isExpanded ? 'more' : 'less';
}

function filterAuditLog() {
  auditState.page = 1;
  auditState.action = document.getElementById('audit-action-filter')?.value.trim() || '';
  auditState.entity = document.getElementById('audit-entity-filter')?.value.trim() || '';
  auditState.from = document.getElementById('audit-date-from')?.value || '';
  auditState.to = document.getElementById('audit-date-to')?.value || '';
  loadAuditLog();
}

function exportAuditLogCSV() {
  const params = new URLSearchParams({
    action_filter: auditState.action,
    entity_type: auditState.entity,
    date_from: auditState.from,
    date_to: auditState.to,
    export: 1
  });
  window.open('/api/admin_api.php?action=audit_log&' + params.toString(), '_blank');
}

/* ════════════════════════════════════════════════════════════
   PRINT HELPERS
═══════════════════════════════════════════════════════════════*/

async function printPackingSlip(orderId) {
  const res = await apiGet('order', { id: orderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  const o   = res.data;
  const now = new Date().toLocaleString('en-PH');

  let subtotal = 0;
  const itemRows = (o.items || []).map(it => {
    const isCW       = it.is_catch_weight == 1 || it.pricing_model === 'catch_weight';
    const price      = parseFloat(it.price_per_kg || it.unit_price || 0);
    const qty        = parseInt(it.quantity || 1);
    const unitSuffix = it.pricing_model === 'per_piece' ? 'pc' : 'pack';
    let sub, wtDisplay, priceDisplay;
    if (isCW) {
      const wt     = parseFloat(it.actual_weight || it.estimated_weight || 0) * qty;
      sub          = price * wt;
      wtDisplay    = wt.toFixed(3) + ' kg';
      priceDisplay = fmtPrice(price) + '/kg';
    } else {
      sub          = price * qty;
      wtDisplay    = `${qty} ${unitSuffix}`;
      priceDisplay = fmtPrice(price) + '/' + unitSuffix;
    }
    subtotal += sub;
    return `<tr>
      <td>${escHtml(it.name)}</td>
      <td>${qty}</td>
      <td>${wtDisplay}</td>
      <td>${priceDisplay}</td>
      <td>${fmtPrice(sub)}</td>
    </tr>`;
  }).join('');

  const discount = parseFloat(o.discount_amount || 0);
  const delivery = parseFloat(o.delivery_fee    || 0);
  const grand    = Math.max(0, subtotal - discount) + delivery;

  document.getElementById('thermal-labels').innerHTML   = '';
  document.getElementById('prep-sheet-print').innerHTML = '';

  const slipEl = document.getElementById('print-slip');
  slipEl.innerHTML = `
    <div class="slip-header">
      <div class="slip-brand">🐓 PoultryMart</div>
      <div class="slip-portal">Admin Packing Slip</div>
    </div>
    <hr class="slip-hr"/>
    <div class="slip-title">Order: ${escHtml(o.order_number)}</div>
    <div class="slip-meta-grid">
      <div class="slip-meta-item">
        <div class="slip-meta-label">Customer</div>
        <div class="slip-meta-val">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Phone</div>
        <div class="slip-meta-val">${escHtml(o.phone || '—')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Delivery Date</div>
        <div class="slip-meta-val">${fmtDate(o.delivery_date)}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Time Slot</div>
        <div class="slip-meta-val">${escHtml(o.slot_label || '—')}</div>
      </div>
      <div class="slip-meta-item" style="grid-column:1/-1">
        <div class="slip-meta-label">Address</div>
        <div class="slip-meta-val">${escHtml(o.street || '')}, ${escHtml(o.barangay || '')}, ${escHtml(o.city || '')}, ${escHtml(o.province || 'Albay')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Payment</div>
        <div class="slip-meta-val">${escHtml(o.payment_method || '—')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Status</div>
        <div class="slip-meta-val">${escHtml(o.status || '—')}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Rider</div>
        <div class="slip-meta-val">${o.rider_first ? escHtml(o.rider_first) + ' ' + escHtml(o.rider_last) : 'Not yet assigned'}</div>
      </div>
      <div class="slip-meta-item">
        <div class="slip-meta-label">Printed</div>
        <div class="slip-meta-val">${now}</div>
      </div>
    </div>
    <hr class="slip-hr"/>
    <table class="slip-items-table">
      <thead><tr><th>Product</th><th>Qty</th><th>Weight/Units</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="slip-hr"/>
    <div class="slip-totals">
      <div class="slip-total-row"><span>Items Subtotal</span><span>${fmtPrice(subtotal)}</span></div>
      ${discount > 0 ? `<div class="slip-total-row"><span>Discount</span><span>−${fmtPrice(discount)}</span></div>` : ''}
      <div class="slip-total-row"><span>Delivery Fee</span><span>${fmtPrice(delivery)}</span></div>
      <div class="slip-total-row slip-grand-row"><span>FINAL TOTAL</span><span>${fmtPrice(grand)}</span></div>
    </div>
    ${o.special_instructions ? `<div class="slip-notes"><strong>Special Instructions:</strong> ${escHtml(o.special_instructions)}</div>` : ''}
    <div class="slip-footer">PoultryMart · Fresh Poultry Delivered in Albay</div>`;

  slipEl.setAttribute('data-print-mode', 'active');
  const afterPrint2 = () => {
    slipEl.innerHTML = '';
    slipEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint2);
  };
  window.addEventListener('afterprint', afterPrint2);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

async function printItemLabels(orderId) {
  const res = await apiGet('order', { id: orderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  const o = res.data;

  const labelsHtml = (o.items || []).map(it => {
    const isCW  = it.is_catch_weight == 1 || it.pricing_model === 'catch_weight';
    const price = parseFloat(it.price_per_kg || it.unit_price || 0);
    const qty   = parseInt(it.quantity || 1);
    let sub, wtDisplay;
    if (isCW) {
      const wt = parseFloat(it.actual_weight || it.estimated_weight || 0) * qty;
      sub       = price * wt;
      wtDisplay = wt.toFixed(3) + ' kg';
    } else {
      sub       = price * qty;
      wtDisplay = `${qty} ${it.pricing_model === 'per_piece' ? 'pc' : 'pack'}`;
    }
    return `
      <div class="thermal-label">
        <div class="tl-brand">🐓 PoultryMart</div>
        <div class="tl-product">${escHtml(it.name)}</div>
        <div class="tl-order">${escHtml(o.order_number)}</div>
        <div class="tl-weight">${wtDisplay}</div>
        <div class="tl-price">${fmtPrice(sub)}</div>
        <div class="tl-customer">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
        <div class="tl-date">Deliver: ${fmtDate(o.delivery_date)}</div>
      </div>`;
  }).join('');

  document.getElementById('print-slip').innerHTML        = '';
  document.getElementById('prep-sheet-print').innerHTML  = '';

  const labelsEl = document.getElementById('thermal-labels');
  labelsEl.innerHTML = labelsHtml;
  labelsEl.setAttribute('data-print-mode', 'active');

  const afterPrint3 = () => {
    labelsEl.innerHTML = '';
    labelsEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint3);
  };
  window.addEventListener('afterprint', afterPrint3);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

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
