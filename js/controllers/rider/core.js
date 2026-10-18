// rider/core.js — rider portal: state, API client, and toast shorthand
/**
 * rider.js — Delivery Rider Portal Controller
 *
 * Depends on (load before this file):
 *   shared/constants.js
 *   shared/utils.js
 *   shared/uiHelpers.js
 *   shared/apiService.js
 *
 * Responsibilities:
 *   • Owns `rSession` (logged-in user + cached orders/notifications)
 *   • All network calls go through apiGet / apiPost from apiService
 *   • All formatting delegated to utils.js
 *   • All toasts / accessible-modal helpers delegated to uiHelpers.js
 *   • Fully WCAG AA: focus trap, aria-hidden, live regions, aria-current
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════*/

const rSession = {
  user:          null,
  notifications: [],
  orders: {
    active:    [],
    completed: [],
  },
};

/** Per-modal state — reset on open. */
const rModal = {
  order:   null,   // currently open order object
  podData: null,   // base64 image data for POD
  podMime: null,
};

/** Confirm-dialog state. */
const rConfirm = {
  onOk:          null,
  previousFocus: null,
};

/* Cleanup references for focus traps — one per modal. */
let _orderModalCleanup    = null;
let _completeModalCleanup = null;
let _issueModalCleanup    = null;
let _issueOrderId         = null;

/* ════════════════════════════════════════════════════════════
   API SERVICE
═══════════════════════════════════════════════════════════════*/

const RIDER_API = 'api/rider_api.php';

const { apiGet, apiPost } = createApiService({
  baseUrl:     RIDER_API,
  callerKey:   'rider_id',
  getCallerId: () => rSession.user?.user_id ?? 0,
});

/* ── Toast shorthand (stacked toasts) ───────────────────── */
const toast = (msg, type = 'info') => showToastStack(msg, type, 'portal-toast-stack');

