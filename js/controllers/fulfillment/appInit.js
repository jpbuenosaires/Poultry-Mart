// fulfillment/appInit.js — fulfillment portal: app initialisation after login
'use strict';

/* ════════════════════════════════════════════════════════════
   APP INIT
═══════════════════════════════════════════════════════════════*/

function initApp() {
  document.getElementById('portal-login-screen').hidden = true;
  document.getElementById('portal-app').hidden          = false;

  const u = session.user;
  document.getElementById('staff-user-name').textContent      = `${u.first_name} ${u.last_name}`;
  document.getElementById('staff-avatar-initial').textContent = u.first_name.charAt(0).toUpperCase();

  startClock('staff-clock');
  loadRidersCache();
  startActiveOrderPoll();
  
  // 1. ADD THIS LINE: Fetch counts for inactive tabs on startup
  loadSidebarCounts(); 

  showPage('queue');
}

// 2. ADD THIS NEW FUNCTION:
async function loadSidebarCounts() {
  // Silently fetch Active Dispatch count
  apiGet('orders', { status: 'Out for Delivery', page: 1 }).then(data => {
    if (data.success) {
      session.orders.dispatch = data.data || [];
      updateDispatchBadge();
    }
  });

  // Silently fetch Returns & Restock count
  apiGet('orders', { status: 'Cancelled', page: 1 }).then(data => {
    if (data.success) {
      session.orders.returns = data.data || [];
      const badge = document.getElementById('nav-badge-returns');
      if (badge) {
        badge.textContent = session.orders.returns.length > 0 ? session.orders.returns.length : '';
      }
    }
  });
}

async function loadRidersCache() {
  const data = await apiGet('riders');
  if (data.success) session.riders = data.data;
}

