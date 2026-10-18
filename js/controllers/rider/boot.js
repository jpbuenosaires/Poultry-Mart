// rider/boot.js — rider portal: boot sequence
'use strict';

/* ════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════*/

document.addEventListener('DOMContentLoaded', () => {
  // Restore session from sessionStorage (persists across page refreshes)
  const stored = sessionStorage.getItem('rider_user');
  if (stored) {
    try {
      rSession.user = JSON.parse(stored);
      initRiderApp();
    } catch {
      sessionStorage.removeItem('rider_user');
    }
  }

  // Sync any offline queue from a previous session
  if (navigator.onLine) offlineQueueSync();

  // Allow Enter key to submit login form
  ['r-email', 'r-pass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') riderLogin();
    });
  });
});