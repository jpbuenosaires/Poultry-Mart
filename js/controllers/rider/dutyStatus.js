// rider/dutyStatus.js — rider portal: duty status toggle and nav badge
'use strict';

/* ════════════════════════════════════════════════════════════
   DUTY STATUS TOGGLE
═══════════════════════════════════════════════════════════════*/

let _riderOnDuty = true;

async function toggleDutyStatus() {
  _riderOnDuty = !_riderOnDuty;
  const btn    = document.getElementById('rider-duty-toggle');
  const icon   = document.getElementById('rider-duty-icon');
  const label  = document.getElementById('rider-duty-label');

  if (btn) {
    btn.setAttribute('aria-pressed', String(_riderOnDuty));
    btn.setAttribute('aria-label', `Toggle duty status — currently ${_riderOnDuty ? 'On Duty' : 'Off Duty'}`);
  }
  if (icon)  icon.textContent  = _riderOnDuty ? '🟢' : '🔴';
  if (label) label.textContent = _riderOnDuty ? 'On Duty' : 'Off Duty';

  const res = await apiPost('set_duty_status', { on_duty: _riderOnDuty ? 1 : 0 });
  if (res.success) {
    toast(_riderOnDuty ? 'Status: On Duty ✅' : 'Status: Off Duty 🔴', 'info');
  } else {
    // Revert on failure
    _riderOnDuty = !_riderOnDuty;
    if (icon)  icon.textContent  = _riderOnDuty ? '🟢' : '🔴';
    if (label) label.textContent = _riderOnDuty ? 'On Duty' : 'Off Duty';
    toast(res.message || 'Failed to update duty status.', 'error');
  }
}

/* ════════════════════════════════════════════════════════════
   NAV BADGE
═══════════════════════════════════════════════════════════════*/

function updateNavBadge(count) {
  const badge = document.getElementById('active-orders-badge');
  if (!badge) return;
  const n = count !== undefined
    ? count
    : rSession.orders.active.filter(o =>
        ['Packed', 'Out for Delivery', 'Arrived at Location'].includes(o.status)).length;
  badge.textContent = n > 0 ? String(n) : '';
  badge.setAttribute('aria-label', n > 0 ? `${n} active orders` : '');
}

