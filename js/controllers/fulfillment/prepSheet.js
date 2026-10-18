// fulfillment/prepSheet.js — fulfillment portal: daily prep sheet
'use strict';

/* ════════════════════════════════════════════════════════════
   DAILY PREP SHEET
═══════════════════════════════════════════════════════════════*/

async function openPrepSheetModal() {
  const orderIds = [...selectedQueueOrders];
  if (!orderIds.length) {
    toast('Select at least one order using the checkboxes first.', 'error');
    return;
  }

  const overlay = document.getElementById('prep-sheet-modal-overlay');
  const content = document.getElementById('prep-sheet-content');
  document.getElementById('prep-sheet-subtitle').textContent =
    `Aggregating ${orderIds.length} order${orderIds.length > 1 ? 's' : ''} from the packing queue.`;
  overlay.style.display = 'flex';
  trapFocus(overlay.querySelector('.modal-box') || overlay);
  content.innerHTML     = spinnerHTML('Aggregating items');

  // Aggregate items across all selected orders
  const aggregated = {};
  for (const oid of orderIds) {
    const data = await apiGet('order', { id: oid });
    if (!data.success) continue;
    (data.data.items || []).forEach(i => {
      if (!aggregated[i.name]) {
        aggregated[i.name] = { name: i.name, total_kg: 0, qty: 0, catch_weight: i.pricing_model === 'catch_weight' };
      }
      aggregated[i.name].total_kg += parseFloat(i.estimated_weight || 0) * parseInt(i.quantity || 1);
      aggregated[i.name].qty      += parseInt(i.quantity || 1);
    });
  }

  const rows = Object.values(aggregated).sort((a, b) => a.name.localeCompare(b.name));
  if (!rows.length) { content.innerHTML = '<p>No items found.</p>'; return; }

  const now = new Date().toLocaleString('en-PH');
  content.innerHTML = `
    <div class="prep-sheet-meta">
      📅 Generated: ${now} &nbsp;·&nbsp; 🛒 Orders: ${orderIds.length}
    </div>
    <table class="staff-table prep-sheet-table" aria-label="Prep sheet items">
      <thead>
        <tr>
          <th>Product</th>
          <th style="text-align:right">Est. Total (kg)</th>
          <th style="text-align:center">Units</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td><strong>${escHtml(r.name)}</strong></td>
            <td style="text-align:right;font-weight:700;font-family:'Playfair Display',serif">
              ${r.total_kg.toFixed(3)}
            </td>
            <td style="text-align:center">${r.qty}</td>
            <td>
              ${r.catch_weight
                ? '<span class="pack-item-catch-tag">⚖ Catch-Weight</span>'
                : '<span class="pack-item-fixed-tag">Fixed</span>'}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  // Printable version
  document.getElementById('prep-sheet-print').innerHTML = `
    <div class="slip-header">
      <div class="slip-brand">🐓 PoultryMart</div>
      <div class="slip-portal">Daily Prep Sheet — ${now}</div>
    </div>
    <hr class="slip-hr"/>
    <table class="slip-items-table">
      <thead><tr><th>Product</th><th>Est. Total (kg)</th><th>Units</th><th>Type</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escHtml(r.name)}</td>
            <td>${r.total_kg.toFixed(3)}</td>
            <td>${r.qty}</td>
            <td>${r.catch_weight ? 'Catch-Weight' : 'Fixed'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="slip-footer">Orders: ${orderIds.join(', ')}<br/>PoultryMart Fulfillment</div>`;
}

function closePrepSheetModal(event) {
  if (event && event.target !== event.currentTarget) return;
  releaseFocusTrap();
  document.getElementById('prep-sheet-modal-overlay').style.display = 'none';
}

function printPrepSheet() {
  document.getElementById('print-slip').innerHTML     = '';
  document.getElementById('thermal-labels').innerHTML = '';
  document.querySelectorAll('[data-print-mode]').forEach(el => el.removeAttribute('data-print-mode'));
  const prepEl      = document.getElementById('prep-sheet-print');
  prepEl.setAttribute('data-print-mode', 'active');

  const afterPrint3 = () => {
    prepEl.removeAttribute('data-print-mode');
    window.removeEventListener('afterprint', afterPrint3);
  };
  window.addEventListener('afterprint', afterPrint3);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

