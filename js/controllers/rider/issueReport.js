// rider/issueReport.js — rider portal: confirm dialog and report issue / failed delivery modal
'use strict';

/* ════════════════════════════════════════════════════════════
   CONFIRM DIALOG
═══════════════════════════════════════════════════════════════*/

function closeConfirm() {
  closeAccessibleModal('rider-confirm-overlay', rConfirm.previousFocus, null);
}

function confirmOk() {
  if (typeof rConfirm.onOk === 'function') rConfirm.onOk();
  rConfirm.onOk = null;
}

/* ════════════════════════════════════════════════════════════
   REPORT ISSUE / FAILED DELIVERY MODAL
═══════════════════════════════════════════════════════════════*/

function openIssueModal(orderId) {
  _issueOrderId = orderId;

  const reasonEl = document.getElementById('issue-reason');
  const notesEl  = document.getElementById('issue-notes');
  const errEl    = document.getElementById('issue-error');
  if (reasonEl) reasonEl.value    = '';
  if (notesEl)  notesEl.value     = '';
  if (errEl)  { errEl.hidden = true; errEl.textContent = ''; }

  // Inject partial delivery item selector if order items are available
  const order = rSession.orders.active.find(o => o.order_id == orderId)
             || rModal.order;
  const partialContainer = document.getElementById('partial-delivery-container');
  if (partialContainer && order?.items?.length) {
    partialContainer.hidden = false;
    const fullAmt = parseFloat(order.final_total ?? order.estimated_total ?? 0);
    partialContainer.innerHTML = `
      <div style="margin-top:1rem">
        <label style="font-weight:600;display:block;margin-bottom:.5rem">
          <span aria-hidden="true">📦</span> Partial Delivery — Select items to RETURN:
        </label>
        <div id="partial-items-list">
          ${(order.items || []).map((item, idx) => {
            const sub = parseFloat(item.final_subtotal ?? item.estimated_subtotal ?? 0);
            return `
              <label class="partial-item-row" style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border,#e5e7eb)">
                <input type="checkbox" class="partial-item-check" data-id="${item.order_item_id}" data-subtotal="${sub}"
                  onchange="recalcPartialCOD(${fullAmt})"
                  aria-label="Return ${escHtml(item.name)}">
                <span style="flex:1">${escHtml(item.name)} × ${escHtml(String(item.quantity))}</span>
                <strong>${fmtPrice(sub)}</strong>
              </label>`;
          }).join('')}
        </div>
        <div id="partial-cod-display" style="margin-top:.75rem;padding:.6rem;background:var(--surface-alt,#f3f4f6);border-radius:6px;font-weight:600;text-align:right">
          Adjusted COD to Collect: <span id="partial-cod-val">${fmtPrice(fullAmt)}</span>
        </div>
      </div>`;
  } else if (partialContainer) {
    partialContainer.hidden = true;
  }

  closeOrderModal();
  _issueModalCleanup = openAccessibleModal('rider-issue-modal-overlay', 'issue-reason');
}

function recalcPartialCOD(fullAmt) {
  const checks   = document.querySelectorAll('.partial-item-check:checked');
  let returned   = 0;
  checks.forEach(c => { returned += parseFloat(c.dataset.subtotal || 0); });
  const adjusted = Math.max(0, fullAmt - returned);
  const display  = document.getElementById('partial-cod-val');
  if (display) display.textContent = fmtPrice(adjusted);
}

function closeIssueModal() {
  closeAccessibleModal('rider-issue-modal-overlay', document.activeElement, _issueModalCleanup);
  _issueModalCleanup = null;
  _issueOrderId      = null;
}

async function submitFailedDelivery() {
  const reason = document.getElementById('issue-reason')?.value || '';
  const notes  = document.getElementById('issue-notes')?.value  || '';
  const errEl  = document.getElementById('issue-error');
  const btn    = document.getElementById('issue-confirm-btn');

  errEl.hidden = true;
  if (!reason) {
    errEl.textContent = 'Please select a reason.';
    errEl.hidden      = false;
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Submitting…';

  const partialChecks = [...document.querySelectorAll('.partial-item-check:checked')]
    .map(c => parseInt(c.dataset.id, 10));

  let res;
  try {
    res = await apiPost('failed_delivery', {
      order_id:        _issueOrderId,
      reason,
      notes,
      returned_items:  partialChecks,
    });
  } catch {
    res = { success: false, _network: true };
  }

  if (!res.success && res._network) {
    offlineQueueAdd('failed_delivery', {
      order_id:       _issueOrderId,
      reason,
      notes,
      returned_items: partialChecks,
    });
    closeIssueModal();
    toast('No signal — issue saved offline. Will sync when connected. 📶', 'warning');
    return;
  }

  if (res.success) {
    closeIssueModal();
    toast('Failed delivery recorded. Order has been cancelled.', 'info');
    refreshCurrentPage();
    loadDashboard();
  } else {
    errEl.textContent = res.message || 'Failed to record issue.';
    errEl.hidden      = false;
    btn.disabled      = false;
    btn.innerHTML     = '<span aria-hidden="true">⚠️</span> Confirm Failed Delivery';
  }
}

