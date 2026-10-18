// fulfillment/scanMode.js — fulfillment portal: barcode / scan mode
'use strict';

/* ════════════════════════════════════════════════════════════
   BARCODE / SCAN MODE
═══════════════════════════════════════════════════════════════*/

function toggleScanMode() {
  scanModeActive = !scanModeActive;
  const btn   = document.getElementById('scan-mode-btn');
  const input = document.getElementById('scan-input');
  btn.classList.toggle('scan-mode-active', scanModeActive);
  btn.setAttribute('aria-pressed', String(scanModeActive));
  if (scanModeActive) {
    input.classList.add('scan-input-visible');
    input.value = '';
    input.focus();
    toast('🔍 Scan Mode active — scan an order barcode.', 'info');
  } else {
    input.classList.remove('scan-input-visible');
    input.value = '';
  }
}

/**
 * handleScanInput is intentionally a no-op.
 * Commercial barcode scanners terminate every scan with a carriage-return / Enter
 * keystroke. All commit logic lives in the keydown listener below, which fires
 * reliably regardless of scanner hardware latency or USB HID buffering speed.
 * The old 120 ms debounce was unreliable because slow scanners spread characters
 * across multiple input events, causing the timer to fire on a partial buffer.
 */
function handleScanInput(_val) { /* committed on Enter — see keydown listener */ }

document.addEventListener('keydown', e => {
  if (!scanModeActive) return;
  // '\r' covers scanners that send a bare carriage-return instead of 'Enter'
  if (e.key !== 'Enter' && e.key !== '\r') return;
  const input = document.getElementById('scan-input');
  if (!input) return;
  const code = input.value.trim();
  if (!code) return;
  input.value = '';        // clear immediately so next scan starts fresh
  scanLookup(code);
});

async function scanLookup(orderNum) {
  toast(`🔍 Looking up ${orderNum}…`, 'info');
  const data = await apiGet('orders', { search: orderNum, page: 1 });
  if (!data.success || !data.data?.length) {
    toast(`Order "${orderNum}" not found.`, 'error');
    return;
  }
  const o = data.data[0];
  if (o.status === 'Pending') { openPackModal(o.order_id); return; }
  if (o.status === 'Packed')  { openAssignModal(o.order_id, o.order_number); return; }
  openDetailModal(o.order_id);
}

