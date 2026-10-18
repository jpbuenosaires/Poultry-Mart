// rider/activeOrders.js — rider portal: active orders page
'use strict';

/* ════════════════════════════════════════════════════════════
   ACTIVE ORDERS PAGE
═══════════════════════════════════════════════════════════════*/

async function loadActiveOrders(silent = false) {
  const listEl  = document.getElementById('active-orders-list');
  const dateVal = document.getElementById('active-date-filter')?.value || '';
  const tabVal  = document.getElementById('active-tab-value')?.value   || '';

  if (!silent) listEl.innerHTML = spinnerHTML('Loading orders');

  const params = { action: 'my_orders' };
  if (dateVal)                       params.date   = dateVal;
  if (tabVal && tabVal !== 'all')    params.status = tabVal;

  const res = await apiGet('my_orders', params);
  if (!res.success) { listEl.innerHTML = errorHTML(res.message); return; }

  const orders = (res.data || []).filter(
    o => o.status !== 'Completed' && o.status !== 'Cancelled');
  rSession.orders.active = orders;
  updateNavBadge(orders.length);

  if (!orders.length) {
    listEl.innerHTML = emptyStateHTML('📭', 'No active deliveries', 'You have no deliveries matching this filter.');
    return;
  }

  // Group by zone_barangay (fall back to barangay field)
  const groups = {};
  orders.forEach(o => {
    const zone = o.zone_barangay || o.barangay || 'Unassigned Zone';
    if (!groups[zone]) groups[zone] = [];
    groups[zone].push(o);
  });

  listEl.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, zoneOrders]) => `
      <div class="zone-group" aria-label="Zone: ${escHtml(zone)}">
        <h4 class="zone-group-heading" style="margin:1rem 0 .4rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted,#6b7280);border-bottom:1px solid var(--border,#e5e7eb);padding-bottom:.25rem">
          <span aria-hidden="true">📍</span> ${escHtml(zone)} (${zoneOrders.length})
        </h4>
        ${zoneOrders.map(renderDeliveryCard).join('')}
      </div>`)
    .join('');
}

/* Tab filter */
function setActiveTab(status) {
  document.getElementById('active-tab-value').value = status;
  document.querySelectorAll('#active-status-tabs .tab-btn').forEach(b => {
    const selected = b.dataset.tab === status;
    b.classList.toggle('active', selected);
    b.setAttribute('aria-selected', String(selected));
  });
  loadActiveOrders();
}

