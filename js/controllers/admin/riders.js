// admin/riders.js — admin portal: riders page
'use strict';

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

