// rider/history.js — rider portal: delivery history page and payment badge helper
'use strict';

/* ════════════════════════════════════════════════════════════
   DELIVERY HISTORY
═══════════════════════════════════════════════════════════════*/

async function loadHistory() {
  const tbodyEl  = document.getElementById('history-tbody');
  const dateFrom = document.getElementById('hist-date-from')?.value || '';
  const dateTo   = document.getElementById('hist-date-to')?.value   || '';

  tbodyEl.innerHTML = `<tr><td colspan="7">${spinnerHTML('Loading history')}</td></tr>`;

  const res = await apiGet('my_orders', { status: 'Completed' });
  if (!res.success) {
    tbodyEl.innerHTML = `<tr><td colspan="7">${errorHTML(res.message)}</td></tr>`;
    return;
  }

  let orders = res.data || [];
  if (dateFrom) orders = orders.filter(o => o.delivery_date >= dateFrom);
  if (dateTo)   orders = orders.filter(o => o.delivery_date <= dateTo);
  rSession.orders.completed = orders;

  if (!orders.length) {
    tbodyEl.innerHTML =
      `<tr><td colspan="7">${emptyStateHTML('📋', '', 'No completed deliveries found.')}</td></tr>`;
    return;
  }

  tbodyEl.innerHTML = orders.map(o => `
    <tr>
      <td class="order-num">${escHtml(o.order_number)}</td>
      <td>${escHtml(o.first_name + ' ' + o.last_name)}</td>
      <td>${escHtml(o.barangay + ', ' + o.city)}</td>
      <td>${fmtDate(o.delivery_date)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>
        <strong>${fmtPrice(o.final_total ?? o.estimated_total)}</strong><br>
        <small>${payBadge(o.pay_status)}</small>
      </td>
      <td>
        <button class="btn-outline btn-sm"
          onclick="openOrderModal(${o.order_id})"
          aria-label="View details for order ${escHtml(o.order_number)}"
          type="button">View</button>
      </td>
    </tr>`).join('');
}

/* ── Pay badge helper ───────────────────────────────────── */
function payBadge(payStatus) {
  const safe = payStatus || 'Unpaid';
  return `<span class="pay-status-badge pay-status-${safe}" aria-label="Payment status: ${safe}">${safe}</span>`;
}

