// fulfillment/navigation.js — fulfillment portal: page navigation
'use strict';

/* ════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════*/

const PAGE_TITLES = {
  'queue':      ['📦', 'Packing Queue'],
  'packed':     ['✅', 'Assign Riders'],
  'dispatch':   ['🛵', 'Active Dispatch'],
  'all-orders': ['📋', 'All Orders'],
  'inventory':  ['🏷️', 'Inventory'],
  'returns':    ['↩️', 'Returns & Restock'],
};

function showPage(pageId) {
  document.querySelectorAll('.staff-page').forEach(p => p.classList.remove('active'));
  
  // FIX: Use the correct class name matching your HTML
  document.querySelectorAll('.portal-nav__btn').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });

  document.getElementById('page-' + pageId)?.classList.add('active');

  const activeBtn = document.querySelector(`[data-page="${pageId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-current', 'page');
  }

  const [icon, title] = PAGE_TITLES[pageId] || ['📄', pageId];
  document.getElementById('staff-topbar-title').innerHTML =
    `<span aria-hidden="true">${icon}</span> ${title}`;

  if (window.innerWidth <= 900) closeSidebar();

  if (pageId === 'queue')      loadQueue();
  if (pageId === 'packed')     loadPacked();
  if (pageId === 'dispatch')   loadDispatch();
  if (pageId === 'all-orders') loadAllOrders();
  if (pageId === 'inventory')  loadInventory();
  if (pageId === 'returns')    loadReturns();
}

function toggleSidebar() {
  const sidebar = document.getElementById('portal-sidebar');
  const menuBtn = document.getElementById('staff-menu-btn');
  const overlay = document.getElementById('portal-sidebar-overlay');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  menuBtn.setAttribute('aria-expanded', String(!isOpen));
  overlay?.classList.toggle('visible', !isOpen);
}

function closeSidebar() {
  document.getElementById('portal-sidebar').classList.remove('open');
  document.getElementById('staff-menu-btn').setAttribute('aria-expanded', 'false');
  document.getElementById('portal-sidebar-overlay')?.classList.remove('visible');
}

function refreshCurrentPage() {
  const active = document.querySelector('.staff-page.active');
  if (!active) return;
  const pageId = active.id.replace('page-', '');
  // Invalidate the relevant session cache before reloading
  if (pageId === 'queue')      session.orders.queue    = [];
  if (pageId === 'packed')     session.orders.packed   = [];
  if (pageId === 'dispatch')   session.orders.dispatch = [];
  if (pageId === 'all-orders') session.orders.all      = [];
  if (pageId === 'inventory')  session.inventory       = [];
  if (pageId === 'returns')    session.orders.returns  = [];
  showPage(pageId);
}

