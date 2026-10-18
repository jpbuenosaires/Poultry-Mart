// admin/returns.js — admin portal: returns page
'use strict';

/* ════════════════════════════════════════════════════════════
   RETURNS
═══════════════════════════════════════════════════════════════*/

async function loadReturns() {
  setLoading('returns-table-wrap', 'Loading returns…');
  const res = await apiGet('returns');
  if (!res.success) { document.getElementById('returns-table-wrap').innerHTML = errorHTML(res.message); return; }
  renderReturnsTable(res.data?.orders || []);
}

function renderReturnsTable(orders) {
  const wrap = document.getElementById('returns-table-wrap');
  if (!orders.length) {
    wrap.innerHTML = emptyStateHTML('🔄', 'No Returns', 'No failed deliveries pending review.');
    return;
  }
  wrap.innerHTML = orders.map(o => `
    <article class="queue-card" aria-label="Returned order ${escHtml(o.order_number)}">
      <header class="queue-card-header">
        <span class="queue-order-num">${escHtml(o.order_number)}</span>
        <span class="queue-delivery-badge" style="background:var(--error-bg,#fff0f0);color:var(--error,#d32f2f)">
          ↩ Failed Delivery
        </span>
        <div class="queue-card-header-actions">
          <button class="btn-action btn-action-muted" onclick="openOrderDetail(${o.order_id})"
            aria-label="View details for order ${escHtml(o.order_number)}">👁 View</button>
        </div>
      </header>
      <div class="queue-card-body">
        <div class="queue-customer-col">
          <div class="queue-col-label">Customer</div>
          <div class="queue-customer-name">${escHtml(o.first_name)} ${escHtml(o.last_name)}</div>
          <div class="queue-customer-detail">
            ${escHtml(o.payment_method || 'COD')} &nbsp;·&nbsp; ${escHtml(o.slot_label || fmtDate(o.delivery_date))}
          </div>
        </div>
        <div class="queue-items-col">
          <div class="queue-col-label">Rider Note</div>
          <div style="font-size:.85rem;color:var(--text-muted)">
            ${escHtml(o.failed_delivery_reason || 'No reason provided')}
          </div>
        </div>
        <div class="queue-action-col">
          <div class="queue-est-total">
            <span>Final Total</span>
            <strong>${fmtPrice(o.final_total || o.estimated_total)}</strong>
          </div>
          <button class="btn-primary" style="background:var(--green,#16a34a)"
            onclick="confirmRestock(${o.order_id})"
            aria-label="Restock goods from order ${escHtml(o.order_number)}">
            📦 Restock to Inventory
          </button>
          <button class="btn-outline" style="border-color:var(--error,#d32f2f);color:var(--error,#d32f2f)"
            onclick="confirmSpoiled(${o.order_id})"
            aria-label="Mark goods from order ${escHtml(o.order_number)} as spoiled">
            🚫 Mark as Spoiled
          </button>
        </div>
      </div>
    </article>`).join('');
}

function filterAdminReturns() {
  const q = (document.getElementById('returns-search')?.value || '').toLowerCase();
  const wrap = document.getElementById('returns-table-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('article.queue-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

async function confirmRestock(id) {
  if (!confirm('Restock this return to inventory?')) return;
  const res = await apiPost('restock_return', { order_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Restocked successfully.', 'success');
  loadReturns();
}

async function confirmSpoiled(id) {
  if (!confirm('Mark this return as spoiled? Stock will NOT be restored.')) return;
  const res = await apiPost('mark_spoiled', { order_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Marked as spoiled.', 'success');
  loadReturns();
}

