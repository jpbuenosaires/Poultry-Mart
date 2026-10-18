// rider/dashboard.js — rider portal: dashboard page
'use strict';

/* ════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════*/

async function loadDashboard() {
  // Local helper to match the Admin UI structure perfectly
  const riderStatCard = (colorClass, icon, value, label) => `
    <div class="stat-card">
      <div class="stat-icon ${colorClass}" aria-hidden="true">${icon}</div>
      <div class="stat-info">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
      </div>
    </div>`;

  const summaryEl  = document.getElementById('dash-summary-bar');
  const urgentEl   = document.getElementById('dash-urgent-list');
  const shiftEl    = document.getElementById('dash-shift-summary');
  summaryEl.innerHTML = spinnerHTML('Loading summary');
  urgentEl.innerHTML  = spinnerHTML('Loading deliveries');

  const [sumRes, ordRes] = await Promise.all([
    apiGet('summary'),
    apiGet('my_orders'),
  ]);

  // Summary pills using the new Admin format
  if (sumRes.success) {
    const s = sumRes.data;
    summaryEl.innerHTML =
      riderStatCard('orange', '🚴', s.in_transit      || 0, 'In Transit')      +
      riderStatCard('blue',   '📦', s.pending_pickup  || 0, 'Pending Pickup')  +
      riderStatCard('green',  '✅', s.completed       || 0, 'Delivered Today') +
      riderStatCard('purple', '💰', fmtPrice(s.collected_today), 'Collected Today');
  } else {
    summaryEl.innerHTML = errorHTML(sumRes.message);
  }

  // Shift Summary — Cleaned up to use CSS classes instead of inline styles!
  if (shiftEl && ordRes.success) {
    const completed = (ordRes.data || []).filter(o => o.status === 'Completed');
    let codTotal     = 0;
    let gcashTotal   = 0;
    let prepaidTotal = 0;
    completed.forEach(o => {
      const amt = parseFloat(o.final_total ?? o.estimated_total ?? 0);
      if (o.payment_method === 'COD' || o.payment_method === 'Cash on Delivery') codTotal += amt;
      else if (o.payment_method === 'GCash') gcashTotal += amt;
      else prepaidTotal += amt;
    });
    shiftEl.innerHTML = `
      <div class="shift-summary-card" aria-label="Shift cash summary">
        <h4><span aria-hidden="true">💼</span> Shift Summary — Today's Collections</h4>
        <div class="shift-stat-grid">
          <div class="shift-stat-box cod">
            <div class="shift-stat-val">${fmtPrice(codTotal)}</div>
            <div class="shift-stat-label">💵 Cash (COD) — Hand to Hub</div>
          </div>
          <div class="shift-stat-box gcash">
            <div class="shift-stat-val">${fmtPrice(gcashTotal)}</div>
            <div class="shift-stat-label">💙 GCash — Digital</div>
          </div>
          ${prepaidTotal > 0 ? `
          <div class="shift-stat-box prepaid">
            <div class="shift-stat-val">${fmtPrice(prepaidTotal)}</div>
            <div class="shift-stat-label">✅ Prepaid — No Collection</div>
          </div>` : ''}
        </div>
      </div>`;
  }

  // Active delivery cards
  if (ordRes.success) {
    const active = (ordRes.data || []).filter(o =>
      ['Packed', 'Out for Delivery', 'Arrived at Location'].includes(o.status));
    rSession.orders.active = active;
    urgentEl.innerHTML = active.length === 0
      ? emptyStateHTML('🎉', 'All clear!', 'No active deliveries right now. Check back soon.')
      : active.map(renderDeliveryCard).join('');
  } else {
    urgentEl.innerHTML = errorHTML(ordRes.message);
  }

  updateNavBadge();
}

