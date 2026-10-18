// rider/appInit.js — rider portal: app initialisation after login
'use strict';

/* ════════════════════════════════════════════════════════════
   APP INIT
═══════════════════════════════════════════════════════════════*/

function initRiderApp() {
  const u = rSession.user;
  document.getElementById('rider-user-name').textContent    =
    `${u.first_name} ${u.last_name}`;
  document.getElementById('rider-avatar-initial').textContent =
    (u.first_name?.[0] || 'R').toUpperCase();

  document.getElementById('portal-login-screen').hidden = true;
  document.getElementById('portal-app').hidden          = false;

  startClock('rider-clock');
  showPage('dashboard');

  pollNotifications();
  setInterval(pollNotifications, 30_000);

  // Silently refresh active orders every 60 s when that page is visible
  setInterval(() => {
    const activeBtn = document.querySelector('.portal-nav__btn[data-page="active"].active');
    if (activeBtn) loadActiveOrders(true);
  }, 60_000);

  // Cancellation poll — check active orders for mid-route cancellations every 30 s
  setInterval(pollCancellations, 30_000);
}

