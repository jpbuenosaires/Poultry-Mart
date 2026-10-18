// rider/cashRemittance.js — rider portal: cash remittance
'use strict';

/* ════════════════════════════════════════════════════════════
   CASH REMITTANCE
═══════════════════════════════════════════════════════════════*/

async function submitRemittance() {
  const amount = parseFloat(document.getElementById('remit-amount')?.value || 0);
  const notes  = document.getElementById('remit-notes')?.value.trim() || '';
  const errEl  = document.getElementById('remit-error');
  const succEl = document.getElementById('remit-success');
  errEl.hidden  = true;
  succEl.hidden = true;

  if (!amount || amount <= 0) {
    errEl.textContent = 'Please enter a valid amount.';
    errEl.hidden      = false;
    return;
  }

  const res = await apiPost('remit_cash', { amount, notes });
  if (res.success) {
    succEl.textContent = res.message;
    succEl.hidden      = false;
    document.getElementById('remit-amount').value = '';
    document.getElementById('remit-notes').value  = '';
    toast('Remittance submitted!', 'success');
    loadRemittanceHistory();
  } else {
    errEl.textContent = res.message || 'Failed to submit remittance.';
    errEl.hidden      = false;
  }
}

async function loadRemittanceHistory() {
  const container = document.getElementById('remit-history');
  if (!container) return;

  container.innerHTML = spinnerHTML('Loading remittances');

  const res = await apiGet('remittance_history');
  if (!res.success) { container.innerHTML = errorHTML(res.message); return; }

  const rows = res.data || [];
  if (!rows.length) {
    container.innerHTML =
      `<p class="text-muted" style="font-size:.85rem">No remittances submitted yet.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="rider-table" aria-label="Remittance history">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Amount</th>
          <th scope="col">Status</th>
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${fmtDateTime(r.remitted_at)}</td>
            <td><strong>${fmtPrice(r.amount)}</strong></td>
            <td>
              <span class="remit-status remit-status-${escHtml(r.status)}">
                ${escHtml(r.status)}
              </span>
            </td>
            <td class="text-muted">${escHtml(r.notes || '—')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

