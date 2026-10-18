// fulfillment/allOrders.js — fulfillment portal: all orders page
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE: ALL ORDERS
═══════════════════════════════════════════════════════════════*/

async function loadAllOrders() {
  const tbody = document.getElementById('all-orders-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Loading…</td></tr>';

  const status = document.getElementById('ao-status-filter')?.value || '';
  const search = document.getElementById('ao-search')?.value        || '';
  const data   = await apiGet('orders', { status, search, page: 1 });

  if (!data.success) {
    tbody.innerHTML =
      `<tr><td colspan="9" class="table-loading" style="color:var(--error)">${escHtml(data.message)}</td></tr>`;
    return;
  }
  session.orders.all = data.data || [];

  if (!session.orders.all.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-loading">No orders found.</td></tr>';
    return;
  }

  tbody.innerHTML = session.orders.all.map(o => {
    const name     = `${o.first_name} ${o.last_name}`;
    const isPacked = ['Packed', 'Out for Delivery', 'Arrived at Location', 'Completed'].includes(o.status);
    return `
      <tr>
        <td><strong style="font-family:'Playfair Display',serif">${escHtml(o.order_number)}</strong></td>
        <td>
          ${escHtml(name)}<br/>
          <small style="color:var(--text-muted)">${escHtml(o.email || '')}</small>
        </td>
        <td>${fmtDate(o.delivery_date)}</td>
        <td>${escHtml(o.slot_label || '—')}</td>
        <td>${fmtPrice(o.estimated_total)}</td>
        <td>
          ${isPacked && o.final_total
            ? `<strong style="color:var(--green)">${fmtPrice(o.final_total)}</strong>`
            : '<span style="color:var(--text-muted)">—</span>'}
        </td>
        <td>${statusBadge(o.status)}</td>
        <td>${payBadge(o.pay_status)}</td>
        <td>
          <div class="btn-actions-row">
            <button class="btn-action btn-action-muted"
              onclick="openDetailModal(${o.order_id})">👁 View</button>
            ${o.status === 'Pending'
              ? `<button class="btn-action btn-action-green"
                   onclick="openPackModal(${o.order_id})">⚖ Pack</button>` : ''}
            ${o.status === 'Packed'
              ? `<button class="btn-action btn-action-blue"
                   onclick="openAssignModal(${o.order_id},'${escHtml(o.order_number)}')">🛵 Assign</button>` : ''}
            ${o.status === 'Out for Delivery'
              ? `<button class="btn-action btn-action-green"
                   onclick="markDelivered(${o.order_id},'${escHtml(o.order_number)}')">✅ Delivered</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

