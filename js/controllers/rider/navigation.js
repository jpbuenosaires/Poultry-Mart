// rider/navigation.js — rider portal: page navigation, mobile sidebar, and password toggle
'use strict';

/* ════════════════════════════════════════════════════════════
   PAGE NAVIGATION
═══════════════════════════════════════════════════════════════*/

const PAGE_TITLES = {
  dashboard:   'Dashboard',
  active:      'Active Deliveries',
  history:     'Delivery History',
  performance: 'My Performance',
  settings:    'Settings',
};

function showPage(pageId) {
  document.querySelectorAll('.rider-page').forEach(p => {
    p.classList.remove('active');
    p.hidden = true;
  });
  document.querySelectorAll('.portal-nav__btn').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });

  const page = document.getElementById('rider-page-' + pageId);
  if (page) {
    page.classList.add('active');
    page.hidden = false;
    page.focus();
  }

  const btn = document.querySelector(`.portal-nav__btn[data-page="${pageId}"]`);
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'page');
  }

  const titleEl = document.getElementById('rider-topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] || 'Rider Portal';

  closeMobileSidebar();

  if (pageId === 'dashboard')   loadDashboard();
  if (pageId === 'active')      loadActiveOrders();
  if (pageId === 'history')     loadHistory();
  if (pageId === 'performance') loadPerformance();
  if (pageId === 'settings')    loadSettings();
}

/* ════════════════════════════════════════════════════════════
   MOBILE SIDEBAR
═══════════════════════════════════════════════════════════════*/

function toggleMobileSidebar() {
  const sidebar = document.getElementById('portal-sidebar');
  const overlay = document.getElementById('portal-sidebar-overlay');
  const menuBtn = document.querySelector('.rider-menu-btn');
  const isOpen  = sidebar.classList.toggle('open');

  overlay.classList.toggle('open', isOpen);
  menuBtn?.setAttribute('aria-expanded', String(isOpen));

  if (isOpen) sidebar.querySelector('.portal-nav__btn')?.focus();
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('portal-sidebar');
  const overlay = document.getElementById('portal-sidebar-overlay');
  const menuBtn = document.querySelector('.rider-menu-btn');

  sidebar?.classList.remove('open');
  overlay?.classList.remove('open');
  menuBtn?.setAttribute('aria-expanded', 'false');
}

/* ════════════════════════════════════════════════════════════
   PASSWORD TOGGLE
═══════════════════════════════════════════════════════════════*/

function togglePasswordVisibility(btn) {
  const input   = document.getElementById('r-pass');
  const isShown = input.type === 'text';
  input.type    = isShown ? 'password' : 'text';
  btn.setAttribute('aria-pressed', String(!isShown));
  btn.setAttribute('aria-label',   isShown ? 'Show password' : 'Hide password');
}

