// fulfillment/focusTrap.js — fulfillment portal: WCAG AA modal focus trap
'use strict';

/* ════════════════════════════════════════════════════════════
   ACCESSIBILITY — WCAG AA FOCUS TRAP
═══════════════════════════════════════════════════════════════*/

const FOCUSABLE_SELECTORS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let _focusTrapActive   = null;   // currently trapped modal element
let _focusTrapHandler  = null;   // keydown handler reference for cleanup
let _previousFocus     = null;   // element that had focus before modal opened

/**
 * Trap keyboard focus inside `modalEl` per WCAG 2.1 SC 2.1.2.
 * Call once when a modal opens; call releaseFocusTrap() on close.
 */
function trapFocus(modalEl) {
  if (!modalEl) return;
  releaseFocusTrap();                          // clean up any prior trap

  _previousFocus    = document.activeElement;
  _focusTrapActive  = modalEl;

  const getFocusable = () =>
    [...modalEl.querySelectorAll(FOCUSABLE_SELECTORS)]
      .filter(el => !el.closest('[hidden]') && el.offsetParent !== null);

  // Initial focus: first focusable, or the modal box itself
  const first = getFocusable()[0] || modalEl;
  first.focus();

  _focusTrapHandler = e => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (!focusable.length) { e.preventDefault(); return; }
    const firstEl = focusable[0];
    const lastEl  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
    } else {
      if (document.activeElement === lastEl)  { e.preventDefault(); firstEl.focus(); }
    }
  };
  modalEl.addEventListener('keydown', _focusTrapHandler);

  // Announce opening to screen readers via the overlay's aria-label
  modalEl.setAttribute('aria-hidden', 'false');
}

/** Release the active focus trap and restore prior focus. */
function releaseFocusTrap() {
  if (_focusTrapActive && _focusTrapHandler) {
    _focusTrapActive.removeEventListener('keydown', _focusTrapHandler);
    _focusTrapActive.setAttribute('aria-hidden', 'true');
  }
  _focusTrapActive  = null;
  _focusTrapHandler = null;
  if (_previousFocus && typeof _previousFocus.focus === 'function') {
    _previousFocus.focus();
  }
  _previousFocus = null;
}

