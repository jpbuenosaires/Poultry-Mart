// rider/performance.js — rider portal: performance page
'use strict';

/* ════════════════════════════════════════════════════════════
   PERFORMANCE PAGE
═══════════════════════════════════════════════════════════════*/

async function loadPerformance() {
  const statsBar = document.getElementById('perf-stats-bar');
  const tbody    = document.getElementById('perf-daily-tbody');

  const today    = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const fromEl = document.getElementById('perf-date-from');
  const toEl   = document.getElementById('perf-date-to');
  if (fromEl && !fromEl.value) fromEl.value = monthAgo;
  if (toEl   && !toEl.value)   toEl.value   = today;

  const dateFrom = fromEl?.value || monthAgo;
  const dateTo   = toEl?.value   || today;

  statsBar.innerHTML = spinnerHTML('Loading performance');
  tbody.innerHTML    = `<tr><td colspan="4">${spinnerHTML('Loading')}</td></tr>`;

  const res = await apiGet('performance', { date_from: dateFrom, date_to: dateTo });

  if (!res.success) {
    statsBar.innerHTML = errorHTML(res.message);
    tbody.innerHTML    = '';
    return;
  }

  const s      = res.data;
  const avgMin = s.avg_delivery_minutes != null ? `${s.avg_delivery_minutes} min` : '—';

  // Estimated commission: ₱15 per completed drop (platform default — adjust as needed)
  const COMMISSION_PER_DROP = 15;
  const estCommission       = (s.completed || 0) * COMMISSION_PER_DROP;
  const failedPct           = s.total_deliveries > 0
    ? Math.round(((s.failed || 0) / s.total_deliveries) * 100)
    : 0;

  const riderStatCard = (colorClass, icon, value, label) => `
    <div class="stat-card">
      <div class="stat-icon ${colorClass}" aria-hidden="true">${icon}</div>
      <div class="stat-info">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
      </div>
    </div>`;

  statsBar.innerHTML =
    riderStatCard('green',  '✅', s.completed         || 0, 'Completed')        +
    riderStatCard('orange', '❌', s.failed            || 0, 'Failed')            +
    riderStatCard('blue',   '📦', s.total_deliveries  || 0, 'Total')             +
    riderStatCard('purple', '⏱️', avgMin,                   'Avg. Delivery Time') +
    riderStatCard('green',  '🎯', (s.completion_rate || 0) + '%', 'Completion Rate') +
    riderStatCard('purple', '💵', fmtPrice(estCommission),  'Est. Commission')   +
    riderStatCard('orange', '📉', failedPct + '%',           'Failed Rate');

  const daily = res.daily || [];
  if (!daily.length) {
    tbody.innerHTML =
      `<tr><td colspan="4">${emptyStateHTML('📋', '', 'No data for this period.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = daily.map(d => {
    const rate = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
    return `
      <tr>
        <td>${fmtDate(d.delivery_date)}</td>
        <td>${d.total}</td>
        <td>${d.completed}</td>
        <td>
          <div class="perf-rate-bar">
            <div class="perf-rate-fill" style="width:${rate}%" aria-hidden="true"></div>
            <span>${rate}%</span>
          </div>
        </td>
      </tr>`;
  }).join('');
}

