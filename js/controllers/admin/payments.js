// admin/payments.js — admin portal: payments page
'use strict';

/* ════════════════════════════════════════════════════════════
   PAYMENTS
═══════════════════════════════════════════════════════════════*/

async function loadPayments() {
  setLoading('payments-table-wrap', 'Loading pending GCash payments…');
  const res = await apiGet('pending_gcash_payments');
  if (!res.success) { document.getElementById('payments-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderPaymentsTable(res.data || []);
}

function renderPaymentsTable(payments) {
  const wrap = document.getElementById('payments-table-wrap');
  if (!payments.length) {
    wrap.innerHTML = emptyStateHTML('✅', 'All Verified', 'No pending GCash payments to verify.');
    return;
  }

  const rows = payments.map(p => {
    const total    = fmtPrice(p.final_total || p.amount || p.estimated_total);
    const refCode  = p.gcash_reference
      ? `<code style="background:var(--info-pale);color:var(--info-text);padding:.15rem .4rem;border-radius:4px;font-size:.8rem;font-weight:700;letter-spacing:.03em">${escHtml(p.gcash_reference)}</code>`
      : `<span style="color:var(--text-muted);font-size:.8rem">— not yet submitted</span>`;
    const screenshot = p.gcash_screenshot
      ? `<a href="${escHtml(p.gcash_screenshot)}" target="_blank" class="btn-action btn-action-blue" style="text-decoration:none">🖼 View</a>`
      : `<span style="color:var(--text-muted);font-size:.8rem">—</span>`;
    return `<tr>
      <td><strong style="font-family:var(--font-display)">${escHtml(p.order_number)}</strong></td>
      <td>
        ${escHtml(p.first_name)} ${escHtml(p.last_name)}<br/>
        <small style="color:var(--text-muted)">${escHtml(p.email || '')}</small>
      </td>
      <td>${total}</td>
      <td>${refCode}</td>
      <td>${screenshot}</td>
      <td>${fmtDateTime(p.created_at)}</td>
      <td class="td-actions" style="white-space:nowrap">
        <button class="btn-action btn-action-green" onclick="confirmVerifyPayment(${p.order_id}, this)">
          ✓ Verify
        </button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Order #</th>
      <th>Customer</th>
      <th>Amount</th>
      <th>💙 GCash Reference</th>
      <th>Screenshot</th>
      <th>Placed</th>
      <th>Action</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function confirmVerifyPayment(orderId, btn) {
  if (!confirm('Mark this GCash payment as verified?')) return;
  const res = await apiPost('verify_payment', { order_id: orderId });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Payment verified! ✅', 'success');
  const row = btn.closest('tr');
  if (row) row.remove();
  // Update sidebar badge
  loadSidebarCounts();
}

