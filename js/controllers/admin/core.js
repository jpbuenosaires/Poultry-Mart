// admin/core.js — admin portal: state, API client, toast shorthand, and modal helpers
/**
 * admin.js — PoultryMart Super Admin Portal Controller
 *
 * Architecture mirrors fulfillment.js exactly.
 * All DB calls go through apiGet / apiPost (never raw fetch).
 * All user strings rendered into innerHTML are wrapped in escHtml().
 * All monetary / date / status values use the shared util formatters.
 * All modals use openAccessibleModal / closeAccessibleModal.
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════*/

const session = {
  user: null,
  riders: [],
  categories: [],
  geoData: [],
  currentOrder: null,
  orders: { list: [], total: 0, page: 1, pages: 1, status: '', search: '' },
  // modal cleanup handles
  _modalCleanup: {},
  // polling
  _pollTimer: null,
  _notifIds: [],
};

/* ════════════════════════════════════════════════════════════
   API SERVICE
═══════════════════════════════════════════════════════════════*/

const { apiGet, apiPost } = createApiService({
  baseUrl: 'api/admin_api.php',
  callerKey: 'admin_id',
  getCallerId: () => session.user?.user_id ?? 0,
});

/* ════════════════════════════════════════════════════════════
   TOAST SHORTHAND
═══════════════════════════════════════════════════════════════*/

const toast = (msg, type = '') => showToast(msg, type, 'admin-toast');

/* ════════════════════════════════════════════════════════════
   MODAL HELPERS — thin wrappers around openAccessibleModal
═══════════════════════════════════════════════════════════════*/

function openModal(overlayId, firstFocusId) {
  // Directly set display:flex so the CSS rule
  // .modal-overlay[style*="flex"] activates the overlay.
  // openAccessibleModal may add class 'open', but no .modal-overlay.open
  // rule exists in the stylesheet, so the inline style is the safe trigger.
  const el = document.getElementById(overlayId);
  if (el) el.style.display = 'flex';
  const cleanup = openAccessibleModal(overlayId, firstFocusId);
  session._modalCleanup[overlayId] = cleanup;
}

function closeModal(overlayId, returnFocusEl = null) {
  const el = document.getElementById(overlayId);
  if (el) el.style.display = 'none';
  const cleanup = session._modalCleanup[overlayId] || null;
  closeAccessibleModal(overlayId, returnFocusEl, cleanup);
  delete session._modalCleanup[overlayId];
}

