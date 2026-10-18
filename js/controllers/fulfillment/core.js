// fulfillment/core.js — fulfillment portal: state, API client, toast shorthand, and payment badge helper
/**
 * fulfillment.js — Fulfillment Staff Portal Controller
 *
 * Depends on (load before this file):
 *   shared/constants.js
 *   shared/utils.js
 *   shared/uiHelpers.js
 *   shared/apiService.js
 *
 * Responsibilities:
 *   • Owns `session` (logged-in user + cached data)
 *   • All network calls go through apiGet / apiPost / rawPost
 *   • All formatting delegated to utils.js
 *   • All toasts / modals delegated to uiHelpers.js
 *   • Zero raw fetch() or SQL anywhere in this file
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════*/

const session = {
  user:        null,
  riders:      [],
  orders:      { queue: [], packed: [], dispatch: [], all: [], returns: [] },
  inventory:   [],
  batchCache:  {},          // product_id → [batches]
  seenCancels: new Set(),   // notification/log ids already shown
  pollTimer:   null,
};

/** Per-modal pack state — reset on every openPackModal() call. */
const packState = {
  order:       null,
  deliveryFee: 0,
  discountAmt: 0,
  batchData:   {},  // product_id → fifo batch array
};

const assignState      = { orderId: null, orderNum: '', currentRiderId: null };
const adjustState      = { batchId: null };
const batchAssignState = { orderIds: [], zoneLabel: '' };

let zoneViewActive      = false;
let scanModeActive      = false;
let selectedQueueOrders = new Set();

/* ════════════════════════════════════════════════════════════
   API SERVICE
═══════════════════════════════════════════════════════════════*/

const FULFILLMENT_API = 'api/fulfillment_api.php';

const { apiGet, apiPost } = createApiService({
  baseUrl:     FULFILLMENT_API,
  callerKey:   'staff_id',
  getCallerId: () => session.user?.user_id ?? 0,
});

/* ── Toast shorthand ─────────────────────────────────────── */
const toast = (msg, type = '') => showToast(msg, type, 'staff-toast');

/* ── Fulfillment-specific pay badge ─────────────────────── */
function payBadge(ps) {
  const safe = ps || 'Unpaid';
  return `<span class="status-badge pay-status-${safe}">${safe}</span>`;
}

