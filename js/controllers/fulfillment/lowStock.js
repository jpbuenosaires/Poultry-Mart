// fulfillment/lowStock.js — fulfillment portal: persistent low-stock alert panel
'use strict';

/* ════════════════════════════════════════════════════════════
   PERSISTENT LOW-STOCK ALERT PANEL
═══════════════════════════════════════════════════════════════*/

/**
 * Inject (or update) a persistent, dismissible "Action Required: Low Stock"
 * summary panel at the top of the Packing Queue page.
 * Replaces the old approach of spamming individual ephemeral toasts.
 *
 * @param {string[]} alerts  Array of human-readable alert strings from the API.
 */
function injectLowStockPanel(alerts) {
  if (!alerts?.length) return;

  const queuePage = document.getElementById('page-queue');
  if (!queuePage) return;

  // Reuse an existing panel if one is already displayed
  let panel = document.getElementById('low-stock-alert-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'low-stock-alert-panel';
    panel.setAttribute('role', 'alert');
    panel.setAttribute('aria-live', 'polite');
    panel.setAttribute('aria-atomic', 'true');
    panel.style.cssText =
      'background:var(--warning-bg,#fffbeb);border:2px solid var(--warning,#f59e0b);' +
      'border-radius:var(--radius-md,8px);padding:.85rem 1rem 1rem;margin:0 0 1rem;' +
      'position:relative;';
    // Insert before the summary bar so it appears at the top of the queue body
    const summaryBar = document.getElementById('queue-summary-bar');
    if (summaryBar) {
      queuePage.insertBefore(panel, summaryBar);
    } else {
      queuePage.prepend(panel);
    }
  }

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
      <strong style="color:var(--warning-dark,#b45309);font-size:.95rem">
        ⚠ Action Required: Low Stock
      </strong>
      <button
        onclick="document.getElementById('low-stock-alert-panel').remove()"
        aria-label="Dismiss low stock alert"
        style="background:none;border:none;cursor:pointer;font-size:1rem;
               color:var(--warning-dark,#b45309);line-height:1;padding:.1rem .3rem">
        ✕
      </button>
    </div>
    <ul style="margin:0;padding-left:1.25rem;font-size:.88rem;
               color:var(--warning-dark,#b45309);line-height:1.6">
      ${alerts.map(a => `<li>${escHtml(a)}</li>`).join('')}
    </ul>
    <p style="margin:.6rem 0 0;font-size:.8rem;color:var(--text-muted,#666)">
      These batches require immediate re-ordering. Contact your supplier.
    </p>`;
}

