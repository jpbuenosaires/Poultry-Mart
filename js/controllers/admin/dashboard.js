// admin/dashboard.js — admin portal: dashboard page
'use strict';

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

