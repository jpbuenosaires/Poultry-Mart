// admin/reports.js — admin portal: reports page
'use strict';

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

