// admin/orderScan.js — admin portal: scan mode and zone view for orders
'use strict';

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

