<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>PoultryMart — Super Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>
  <!-- Shared design tokens from fulfillment portal -->
  <link rel="stylesheet" href="/css/fulfillment-entry.css"/>
  <!-- Admin-specific overrides -->
  <link rel="stylesheet" href="/css/admin-entry.css"/>
</head>
<body class="portal-body portal-body--admin">



<!-- ══════════════════════════════════════════════════════════════
     LOGIN SCREEN
══════════════════════════════════════════════════════════════ -->
<div id="portal-login-screen" class="portal-login" role="main" aria-label="Super Admin login">
  <div class="portal-login__card">
    <header class="portal-login__brand" aria-label="PoultryMart Admin Portal">
      <span class="brand-chicken" aria-hidden="true">🐓</span>
      <div>
        <div class="brand-wordmark">Poultry<strong>Mart</strong></div>
        <div class="brand-portal-label">Super Admin Portal</div>
      </div>
    </header>
    <h1 class="portal-login__heading">Admin Sign In</h1>
    <p class="portal-login__sub">Restricted to Super Admin accounts only.</p>
    <div class="form-group">
      <label for="admin-email">Email address</label>
      <input type="email" id="admin-email" class="form-input" placeholder="admin@poultrymart.com"
        autocomplete="email" required aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="admin-pass">Password</label>
      <input type="password" id="admin-pass" class="form-input" placeholder="••••••••"
        autocomplete="current-password" required aria-required="true"/>
    </div>
    <p id="admin-login-error" class="form-error" role="alert" hidden></p>
    <button id="admin-login-btn" class="btn-primary full-width btn--mt" onclick="adminLogin()">
      Sign In
    </button>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     ADMIN APP SHELL
══════════════════════════════════════════════════════════════ -->
<div id="portal-app" hidden aria-label="Super Admin Application">

  <!-- ── SIDEBAR ──────────────────────────────────────────────── -->
  <nav id="admin-sidebar" class="portal-sidebar" aria-label="Main navigation">
    <a href="#" class="portal-sidebar__header" aria-label="PoultryMart Admin Home">
      <span class="logo-icon" aria-hidden="true">🐓</span>
      <span class="logo-text">Poultry<strong>Mart</strong></span>
      <span class="staff-tag admin-tag" aria-label="Admin panel">Admin</span>
    </a>

    <div class="portal-user-pill" id="admin-user-pill">
      <div class="portal-avatar" id="admin-avatar-initial" aria-hidden="true">A</div>
      <div class="portal-user-info">
        <div class="portal-user-name" id="admin-user-name">Admin</div>
        <div class="portal-role-tag">Super Admin</div>
      </div>
    </div>

    <nav class="portal-nav" aria-label="Admin sections">

      <span class="portal-nav__section" aria-hidden="true">Overview</span>
      <button class="portal-nav__btn active" data-page="dashboard" onclick="showPage('dashboard')" aria-current="page">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Dashboard
      </button>

      <span class="portal-nav__section" aria-hidden="true">Orders</span>
      <button class="portal-nav__btn" data-page="orders" onclick="showPage('orders')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Orders
        <span class="nav-badge" id="nav-badge-orders" style="display:none" aria-label="pending orders"></span>
      </button>
      <button class="portal-nav__btn" data-page="returns" onclick="showPage('returns')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Returns
        <span class="nav-badge nav-badge-red" id="nav-badge-returns" style="display:none" aria-label="failed deliveries"></span>
      </button>
      <button class="portal-nav__btn" data-page="disputes" onclick="showPage('disputes')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Disputes
        <span class="nav-badge nav-badge-orange" id="nav-badge-disputes" style="display:none" aria-label="Open disputes"></span>
      </button>
      <button class="portal-nav__btn" data-page="payments" onclick="showPage('payments')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        Payments
        <span class="nav-badge nav-badge-orange" id="nav-badge-payments" style="display:none" aria-label="GCash payments pending verification"></span>
      </button>

      <span class="portal-nav__section" aria-hidden="true">Catalogue</span>
      <button class="portal-nav__btn" data-page="products" onclick="showPage('products')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        Products
      </button>
      <button class="portal-nav__btn" data-page="categories" onclick="showPage('categories')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Categories
      </button>
      <button class="portal-nav__btn" data-page="inventory" onclick="showPage('inventory')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Inventory
      </button>
      <button class="portal-nav__btn" data-page="promos" onclick="showPage('promos')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
        Promos
      </button>

      <span class="portal-nav__section" aria-hidden="true">People</span>
      <button class="portal-nav__btn" data-page="users" onclick="showPage('users')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Users
      </button>
      <button class="portal-nav__btn" data-page="riders" onclick="showPage('riders')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
        Riders
      </button>
      <button class="portal-nav__btn" data-page="notifications" onclick="showPage('notifications')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        Notifications
        <span class="nav-badge nav-badge-orange" id="nav-badge-notif" style="display:none" aria-label="unread alerts"></span>
      </button>

      <span class="portal-nav__section" aria-hidden="true">Reports &amp; Config</span>
      <button class="portal-nav__btn" data-page="reports" onclick="showPage('reports')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Reports
      </button>
      <button class="portal-nav__btn" data-page="settings" onclick="showPage('settings')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Settings
      </button>
      <button class="portal-nav__btn" data-page="audit-log" onclick="showPage('audit-log')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Audit Log
      </button>

    </nav>

    <div class="portal-sidebar__footer">
      <button class="portal-nav__logout" onclick="adminLogout()" aria-label="Sign out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign Out
      </button>
    </div>
  </nav>

  <!-- ── SIDEBAR OVERLAY (mobile) ─────────────────────────────── -->
  <!-- ID must be "sidebar-overlay" — referenced by toggleSidebarUI('admin-sidebar','sidebar-overlay') in admin.js -->
  <div id="sidebar-overlay" class="portal-sidebar-overlay" onclick="toggleAdminSidebar()"></div>

  <!-- ── MAIN CONTENT ──────────────────────────────────────────── -->
  <div class="portal-main" id="admin-main">

    <!-- ── TOPBAR ────────────────────────────────────────────────── -->
    <header class="portal-topbar" role="banner">
      <button class="topbar-menu-btn icon-btn" onclick="toggleAdminSidebar()" aria-label="Toggle navigation menu"
        aria-controls="admin-sidebar" aria-expanded="false" id="admin-menu-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div class="topbar-title" id="admin-topbar-title">
        Dashboard
        <small>Super Admin</small>
      </div>

      <!-- Scan Mode toggle -->
      <div class="topbar-scan-area" id="topbar-scan-area">
        <button class="scan-mode-btn" id="scan-mode-btn" onclick="toggleScanMode()" title="Toggle Barcode Scan Mode" aria-label="Toggle scan mode" aria-pressed="false">
          <span aria-hidden="true">🔍</span> Scan Mode
        </button>
        <input type="text" id="scan-input" class="scan-input-hidden" aria-label="Barcode scanner input"
          placeholder="Scan barcode…" autocomplete="off" oninput="handleScanInput(this.value)"/>
      </div>

      <div class="topbar-actions">
        <!-- Notification bell — id="notif-bell" required by updateNotifBell() in admin.js -->
        <button class="notif-bell-btn icon-btn" id="notif-bell" onclick="toggleNotifPanel()"
          aria-label="Notifications" aria-haspopup="true" aria-expanded="false" title="Alerts">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="notif-bell-badge" id="notif-bell-badge" style="display:none" aria-hidden="true"></span>
        </button>

        <button class="staff-refresh-btn" onclick="refreshCurrentPage()" aria-label="Refresh current view" title="Refresh">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>

        <!-- Live clock — id="admin-clock" required by startClock() in admin.js -->
        <time class="staff-topbar-clock" id="admin-clock" aria-live="polite" aria-label="Current time"></time>
      </div>
    </header>

    <!-- Notification panel (toggled by toggleNotifPanel in uiHelpers) -->
    <div id="notif-panel" class="notif-panel" style="display:none" role="region" aria-label="Alerts">
      <div class="notif-panel-header">
        <strong>🚨 Alerts</strong>
        <button class="notif-dismiss-all" onclick="dismissAllAlerts()">Mark all read</button>
      </div>
      <div id="notif-panel-body">
        <p class="notif-empty">No new alerts.</p>
      </div>
    </div>

    <!-- ══════════════════════════════════════════
         PAGE SECTIONS
    ══════════════════════════════════════════ -->

    <!-- ── DASHBOARD ──────────────────────────────────────────── -->
    <!-- dashboard-content is required by renderDashboard() in admin.js -->
    <section id="page-dashboard" class="staff-page" aria-label="Dashboard" role="region">
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Dashboard</h2>
          <p class="staff-page-sub">Overview of store operations.</p>
        </div>
      </div>
      <div id="dashboard-content"></div>
    </section>

    <!-- ── ORDERS ──────────────────────────────────────────────── -->
    <!-- order-filter-status & order-search required by filterOrders() -->
    <!-- zone-view-btn required by toggleZoneView() -->
    <section id="page-orders" class="staff-page" aria-label="All Orders" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">All Orders</h2>
          <p class="staff-page-sub">View, manage and process customer orders.</p>
        </div>
        <div class="staff-filter-row">
          <select id="order-filter-status" class="form-input staff-filter-input" onchange="filterOrders()" aria-label="Filter by status">
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Packed">Packed</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Arrived at Location">Arrived at Location</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <div class="search-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="order-search" class="form-input" placeholder="Search order #, customer…"
              aria-label="Search orders"/>
          </div>
          <button class="btn-outline btn-sm" id="zone-view-btn" onclick="toggleZoneView()" aria-pressed="false">
            🗺️ Zone View
          </button>
          <button class="btn-outline btn-sm" onclick="toggleScanMode()" aria-label="Toggle scan mode">
            🔍 Scan
          </button>
        </div>
      </div>
      <div id="orders-table-wrap" aria-live="polite" style="background:transparent;border:none;box-shadow:none;padding:0;"></div>
      <div id="orders-pagination" class="pagination-bar"></div>
    </section>
    <section id="page-returns" class="staff-page" aria-label="Returns &amp; Restock" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Returns &amp; Restock</h2>
          <p class="staff-page-sub">Failed deliveries awaiting review. Restock goods or mark as spoiled.</p>
        </div>
        <div class="staff-filter-row">
          <label for="returns-search" class="sr-only">Search returns</label>
          <input type="text" id="returns-search" class="form-input staff-filter-input"
            placeholder="Order # or customer…" oninput="filterAdminReturns()" aria-label="Search returned orders"/>
        </div>
      </div>
      <div class="panel-body no-pad">
        <div id="returns-table-wrap" aria-live="polite"></div>
      </div>
    </section>
    <!-- ── RETURNS ─────────────────────────────────────────────── -->


    <!-- ── DISPUTES ────────────────────────────────────────────── -->
    <!-- disputes-table-wrap required by renderDisputesTable() -->
    <section id="page-disputes" class="staff-page" aria-label="Disputes" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Disputes</h2>
          <p class="staff-page-sub">Customer dispute management.</p>
        </div>
      </div>
      <div class="filter-tabs">
        <button class="filter-tab active" id="btn-dispute-all" onclick="setDisputeFilter('')">All</button>
        <button class="filter-tab" id="btn-dispute-open" onclick="setDisputeFilter('Open')">Open</button>
        <button class="filter-tab" id="btn-dispute-review" onclick="setDisputeFilter('Under Review')">Under Review</button>
        <button class="filter-tab" id="btn-dispute-resolved" onclick="setDisputeFilter('Resolved')">Resolved</button>
        <button class="filter-tab" id="btn-dispute-rejected" onclick="setDisputeFilter('Rejected')">Rejected</button>
      </div>
      <div id="disputes-table-wrap" aria-live="polite"></div>
    </section>

    <!-- ── PAYMENTS ────────────────────────────────────────────── -->
    <section id="page-payments" class="staff-page" aria-label="Payment Verification" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Payment Verification</h2>
          <p class="staff-page-sub">Review and verify pending customer payments.</p>
        </div>
      </div>
      <div id="payments-table-wrap" aria-live="polite"></div>
    </section>

    <!-- ── PRODUCTS ────────────────────────────────────────────── -->
    <!-- product-search, product-cat-filter, product-status-filter required by loadProducts() -->
    <section id="page-products" class="staff-page" aria-label="Products" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Products</h2>
          <p class="staff-page-sub">Manage your product catalogue.</p>
        </div>
        <button class="btn-primary" onclick="openProductModal(0)">+ Add Product</button>
      </div>
      <div class="staff-filter-row">
        <select id="product-cat-filter" class="form-input staff-filter-input" onchange="loadProducts()" aria-label="Filter by category">
          <option value="">All Categories</option>
        </select>
        <select id="product-status-filter" class="form-input staff-filter-input" onchange="loadProducts()" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <div class="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="product-search" class="form-input" placeholder="Search products…"
            oninput="loadProducts()" aria-label="Search products"/>
        </div>
      </div>
      <div id="products-table-wrap" aria-live="polite"></div>
    </section>

    <!-- ── CATEGORIES ─────────────────────────────────────────── -->
    <!-- categories-table-wrap required by renderCategoriesTable() -->
    <section id="page-categories" class="staff-page" aria-label="Categories" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Categories</h2>
          <p class="staff-page-sub">Manage product categories.</p>
        </div>
        <button class="btn-primary" onclick="openCategoryModal()">+ Add Category</button>
      </div>
      <div id="categories-table-wrap" aria-live="polite"></div>
    </section>

    <!-- ── INVENTORY ───────────────────────────────────────────── -->
    <!-- inventory-table-wrap required by renderInventoryTable() -->
    <section id="page-inventory" class="staff-page" aria-label="Inventory" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Inventory</h2>
          <p class="staff-page-sub">Stock batches and levels.</p>
        </div>
        <button class="btn-primary" onclick="openAddBatchModal()">+ Add Batch</button>
      </div>
      <div id="inventory-table-wrap" aria-live="polite"></div>
    </section>

    <!-- ── PROMOS ──────────────────────────────────────────────── -->
    <!-- promos-table-wrap required by renderPromosTable() -->
    <section id="page-promos" class="staff-page" aria-label="Promo Codes" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Promo Codes</h2>
          <p class="staff-page-sub">Discount and promotional codes.</p>
        </div>
        <button class="btn-primary" onclick="openPromoModal()">+ Add Promo</button>
      </div>
      <div id="promos-table-wrap" aria-live="polite"></div>
    </section>

    <!-- ── USERS ───────────────────────────────────────────────── -->
    <!-- user-role-filter, user-search, user-status-filter required by loadUsers() -->
    <section id="page-users" class="staff-page" aria-label="User Management" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">User Management</h2>
          <p class="staff-page-sub">Manage all portal user accounts.</p>
        </div>
        <button class="btn-primary" onclick="openUserModal()">+ Add User</button>
      </div>
      <div class="staff-filter-row">
        <select id="user-role-filter" class="form-input staff-filter-input" onchange="loadUsers()" aria-label="Filter by role">
          <option value="">All Roles</option>
          <option value="Customer">Customer</option>
          <option value="Fulfillment Staff">Fulfillment Staff</option>
          <option value="Delivery Rider">Delivery Rider</option>
          <option value="Super Admin">Super Admin</option>
        </select>
        <select id="user-status-filter" class="form-input staff-filter-input" onchange="loadUsers()" aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div class="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="user-search" class="form-input" placeholder="Search name, email…"
            oninput="loadUsers()" aria-label="Search users"/>
        </div>
      </div>
      <div id="users-table-wrap" aria-live="polite"></div>
    </section>

    <!-- ── RIDERS ─────────────────────────────────────────────── -->
    <!-- riders-table-wrap, remit-rider-filter, remittances-table-wrap required by loadRiders/loadRemittances -->
    <section id="page-riders" class="staff-page" aria-label="Riders" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Riders</h2>
          <p class="staff-page-sub">Delivery riders and performance tracking.</p>
        </div>
      </div>
      <div id="riders-table-wrap" aria-live="polite"></div>

      <div class="section-card" style="margin-top:1.5rem">
        <div class="section-card__header">
          <h3 class="section-card__title">💵 Cash Remittances</h3>
          <div class="staff-filter-row" style="margin:0">
            <select id="remit-rider-filter" class="form-input staff-filter-input" onchange="loadRemittances()" aria-label="Filter by rider">
              <option value="0">All Riders</option>
            </select>
          </div>
        </div>
        <div id="remittances-table-wrap" aria-live="polite"></div>
      </div>
    </section>

    <!-- ── NOTIFICATIONS ──────────────────────────────────────── -->
    <!-- notif-send-area required by loadNotifications() in admin.js -->
    <section id="page-notifications" class="staff-page" aria-label="Notifications" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Notifications</h2>
          <p class="staff-page-sub">Send and manage user notifications.</p>
        </div>
        <button class="btn-primary" onclick="openSendNotifModal()">+ Send Notification</button>
      </div>
      <div id="notif-send-area" class="section-card" style="display:none">
        <p class="staff-page-sub" style="padding:1rem">
          Use the <strong>+ Send Notification</strong> button above to compose and send a message to any user.<br/>
          Cancellation alerts appear in the bell icon at the top of the page.
        </p>
      </div>
      <!-- notification list — rendered by loadNotifications() -->
      <div id="notif-list-wrap"></div>

      <!-- The notif-send-area is shown by loadNotifications() — it just needs to exist -->
    </section>

    <!-- ── SETTINGS ───────────────────────────────────────────── -->
    <!-- settings-content required by setLoading/errorHTML in loadSettings() -->
    <!-- settings-hours-wrap, settings-zones-wrap, settings-slots-wrap required by render helpers -->
    <section id="page-settings" class="staff-page" aria-label="Settings" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Settings</h2>
          <p class="staff-page-sub">Operational hours, delivery zones and time slots.</p>
        </div>
      </div>
      <div id="settings-content">
        <div class="dashboard-grid" style="margin-bottom:1.5rem">
          <div class="section-card">
            <h3 class="section-card__title">🕐 Operational Hours</h3>
            <div id="settings-hours-wrap"></div>
          </div>
          <div class="section-card">
            <h3 class="section-card__title">🗺️ Delivery Zones</h3>
            <div id="settings-zones-wrap"></div>
          </div>
        </div>
        <div class="section-card">
          <h3 class="section-card__title">⏰ Time Slots</h3>
          <div id="settings-slots-wrap"></div>
        </div>
      </div>
    </section>

    <!-- ── REPORTS ────────────────────────────────────────────── -->
    <!-- report-days-select, report-charts required by loadReports/renderReportCharts() -->
    <!-- prep-date-input, prep-table-wrap required by loadDailyPrep() -->
    <section id="page-reports" class="staff-page" aria-label="Sales Reports" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Sales Reports</h2>
          <p class="staff-page-sub">Revenue, orders and product performance analytics.</p>
        </div>
        <div class="staff-filter-row">
          <select id="report-days-select" class="form-input staff-filter-input"
            onchange="fetchReport(parseInt(this.value))" aria-label="Report period">
            <option value="7">Last 7 days</option>
            <option value="30" selected>Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
          </select>
        </div>
      </div>

      <!-- Main report output — renderReportCharts() writes here -->
      <div id="report-charts" aria-live="polite"></div>

      <!-- Daily Prep Sheet sub-section -->
      <div class="section-card" style="margin-top:1.5rem">
        <div class="section-card__header">
          <h3 class="section-card__title">📋 Daily Prep Sheet</h3>
          <div class="staff-filter-row" style="margin:0">
            <input type="date" id="prep-date-input" class="form-input staff-filter-input" aria-label="Prep date"/>
            <button class="btn-outline btn-sm" onclick="loadDailyPrep()">Load</button>
            <button class="btn-outline btn-sm" onclick="printPrepSheet()">🖨 Print</button>
          </div>
        </div>
        <div id="prep-table-wrap" aria-live="polite"></div>
      </div>
    </section>

    <!-- ── AUDIT LOG ──────────────────────────────────────────── -->
    <!-- audit-action-filter, audit-entity-filter, audit-date-from, audit-date-to required by filterAuditLog() -->
    <!-- audit-table-wrap, audit-pagination required by renderAuditTable() -->
    <section id="page-audit-log" class="staff-page" aria-label="Audit Log" role="region" hidden>
      <div class="staff-page-header">
        <div>
          <h2 class="staff-page-title">Audit Log</h2>
          <p class="staff-page-sub">Full history of admin actions.</p>
        </div>
      </div>
      <div class="staff-filter-row">
        <input type="text" id="audit-action-filter" class="form-input staff-filter-input"
          placeholder="Filter by action…" oninput="filterAuditLog()" aria-label="Filter by action"/>
        <select id="audit-entity-filter" class="form-input staff-filter-input" onchange="filterAuditLog()" aria-label="Filter by entity type">
          <option value="">All Entities</option>
          <option value="order">Order</option>
          <option value="product">Product</option>
          <option value="product_batch">Batch</option>
          <option value="dispute">Dispute</option>
          <option value="rider">Rider</option>
          <option value="user">User</option>
          <option value="promo">Promo</option>
          <option value="zone">Zone</option>
        </select>
        <input type="date" id="audit-date-from" class="form-input staff-filter-input"
          onchange="filterAuditLog()" aria-label="From date"/>
        <input type="date" id="audit-date-to" class="form-input staff-filter-input"
          onchange="filterAuditLog()" aria-label="To date"/>
        <button class="btn-outline btn-sm" onclick="filterAuditLog()">Apply</button>
        <button class="btn-outline btn-sm" onclick="exportAuditLogCSV()">📥 Export CSV</button>
      </div>
      <div id="audit-table-wrap" aria-live="polite"></div>
      <div id="audit-pagination" class="pagination-bar"></div>
    </section>

  </div><!-- /portal-main -->
</div><!-- /portal-app -->

<!-- ══════════════════════════════════════════════════════════════
     MODALS
     IMPORTANT: Every overlay id, focus-target id, and inner
     element id below must exactly match what admin.js references.
══════════════════════════════════════════════════════════════ -->

<!-- ──────────────────────────────────────────────────────────
     ORDER DETAIL MODAL
     openModal('order-detail-modal', 'order-modal-close')
     renderOrderDetail → document.getElementById('order-detail-body')
────────────────────────────────────────────────────────────── -->
<div id="order-detail-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="order-detail-modal-title"
  onclick="if(event.target===this)closeModal('order-detail-modal')">
  <div class="modal-box modal-box--wide" onclick="event.stopPropagation()">
    <button class="modal-close" id="order-modal-close"
      onclick="closeModal('order-detail-modal')" aria-label="Close">✕</button>
    <h2 id="order-detail-modal-title" class="sr-only">Order Detail</h2>
    <div id="order-detail-body"></div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     PACK ORDER MODAL
     openModal('pack-order-modal', 'pack-modal-close')
     openPackModal → document.getElementById('pack-modal-body')
     confirmPackOrder → closeModal('pack-order-modal')
     pack-error required by confirmPackOrder()
────────────────────────────────────────────────────────────── -->
<div id="pack-order-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="pack-order-modal-title"
  onclick="if(event.target===this)closeModal('pack-order-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="pack-modal-close"
      onclick="closeModal('pack-order-modal')" aria-label="Close">✕</button>
    <h2 id="pack-order-modal-title">⚖️ Pack Order</h2>
    <div id="pack-modal-body"></div>
    <p id="pack-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmPackOrder()">✅ Confirm Pack</button>
      <button class="btn-outline" onclick="closeModal('pack-order-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     EDIT ORDER MODAL
     openModal('edit-order-modal', 'edit-modal-close')
     openEditOrderModal → document.getElementById('edit-order-body')
     Dynamic fields (edit-delivery-date, edit-promo-code, edit-order-error)
     are injected by openEditOrderModal — no need to pre-declare them.
────────────────────────────────────────────────────────────── -->
<div id="edit-order-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="edit-order-modal-title"
  onclick="if(event.target===this)closeModal('edit-order-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="edit-modal-close"
      onclick="closeModal('edit-order-modal')" aria-label="Close">✕</button>
    <h2 id="edit-order-modal-title">✏️ Edit Order</h2>
    <div id="edit-order-body"></div>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmEditOrder()">Save Changes</button>
      <button class="btn-outline" onclick="closeModal('edit-order-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     CANCEL ORDER MODAL
     openModal('cancel-order-modal', 'cancel-modal-close')
     openCancelModal → cancel-order-num, cancel-reason-input, cancel-error
────────────────────────────────────────────────────────────── -->
<div id="cancel-order-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="cancel-order-modal-title"
  onclick="if(event.target===this)closeModal('cancel-order-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="cancel-modal-close"
      onclick="closeModal('cancel-order-modal')" aria-label="Close">✕</button>
    <h2 id="cancel-order-modal-title">🚫 Cancel Order</h2>
    <p class="staff-page-sub">
      Cancel order <strong id="cancel-order-num"></strong>? This cannot be undone.
    </p>
    <div class="form-group form-group--spaced">
      <label for="cancel-reason-input">Reason for cancellation</label>
      <textarea id="cancel-reason-input" class="form-input" rows="3"
        placeholder="Enter reason…" aria-required="true"></textarea>
    </div>
    <p id="cancel-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" style="background:var(--error)" onclick="confirmCancel()">Confirm Cancel</button>
      <button class="btn-outline" onclick="closeModal('cancel-order-modal')">Back</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     STATUS OVERRIDE MODAL
     openModal('status-override-modal', 'status-modal-close')
     openStatusModal → status-select, status-override-error
────────────────────────────────────────────────────────────── -->
<div id="status-override-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="status-override-modal-title"
  onclick="if(event.target===this)closeModal('status-override-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="status-modal-close"
      onclick="closeModal('status-override-modal')" aria-label="Close">✕</button>
    <h2 id="status-override-modal-title">🔄 Override Status</h2>
    <div class="form-group">
      <label for="status-select">New Status</label>
      <select id="status-select" class="form-input" aria-required="true">
        <option value="">— Select status —</option>
        <option value="Pending">Pending</option>
        <option value="Packed">Packed</option>
        <option value="Out for Delivery">Out for Delivery</option>
        <option value="Arrived at Location">Arrived at Location</option>
        <option value="Completed">Completed</option>
        <option value="Cancelled">Cancelled</option>
      </select>
    </div>
    <p id="status-override-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmStatusOverride()">Update Status</button>
      <button class="btn-outline" onclick="closeModal('status-override-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     ASSIGN RIDER MODAL
     openModal('assign-rider-modal', 'assign-modal-close')
     openAssignModal → assign-rider-select, assign-rider-error
────────────────────────────────────────────────────────────── -->
<div id="assign-rider-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="assign-rider-modal-title"
  onclick="if(event.target===this)closeModal('assign-rider-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="assign-modal-close"
      onclick="closeModal('assign-rider-modal')" aria-label="Close">✕</button>
    <h2 id="assign-rider-modal-title">🛵 Assign Rider</h2>
    <div class="form-group">
      <label for="assign-rider-select">Select Rider</label>
      <select id="assign-rider-select" class="form-input" aria-required="true">
        <option value="">— Choose a rider —</option>
      </select>
    </div>
    <p id="assign-rider-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmAssign()">Assign</button>
      <button class="btn-outline" onclick="closeModal('assign-rider-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     BATCH ASSIGN MODAL
     openModal('batch-assign-modal', 'batch-modal-close')
     openBatchAssignModal → batch-assign-zone-label, batch-rider-select, batch-assign-error
────────────────────────────────────────────────────────────── -->
<div id="batch-assign-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="batch-assign-modal-title"
  onclick="if(event.target===this)closeModal('batch-assign-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="batch-modal-close"
      onclick="closeModal('batch-assign-modal')" aria-label="Close">✕</button>
    <h2 id="batch-assign-modal-title">🗺️ Batch Assign Rider</h2>
    <p class="staff-page-sub">
      Zone: <strong id="batch-assign-zone-label"></strong>
    </p>
    <div class="form-group form-group--spaced">
      <label for="batch-rider-select">Assign all orders to rider</label>
      <select id="batch-rider-select" class="form-input" aria-required="true">
        <option value="">— Choose a rider —</option>
      </select>
    </div>
    <p id="batch-assign-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmBatchAssign()">Assign All</button>
      <button class="btn-outline" onclick="closeModal('batch-assign-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     DISPATCH CONFIRM MODAL
     openModal('dispatch-confirm-modal', 'dispatch-modal-close')
     openDispatchModal → dispatch-confirm-msg
────────────────────────────────────────────────────────────── -->
<div id="dispatch-confirm-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="dispatch-confirm-modal-title"
  onclick="if(event.target===this)closeModal('dispatch-confirm-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="dispatch-modal-close"
      onclick="closeModal('dispatch-confirm-modal')" aria-label="Close">✕</button>
    <div class="modal-icon" aria-hidden="true">🛵</div>
    <h2 id="dispatch-confirm-modal-title">Dispatch Order?</h2>
    <p id="dispatch-confirm-msg" class="staff-page-sub"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmDispatch()">Dispatch Now</button>
      <button class="btn-outline" onclick="closeModal('dispatch-confirm-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     PRODUCT FORM MODAL
     openModal('product-modal', 'product-modal-close')
     openProductModal → product-modal-title, product-form-body (dynamic content)
────────────────────────────────────────────────────────────── -->
<div id="product-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="product-modal-title"
  onclick="if(event.target===this)closeModal('product-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="product-modal-close"
      onclick="closeModal('product-modal')" aria-label="Close">✕</button>
    <h2 id="product-modal-title">Product</h2>
    <!-- product-form-body is populated dynamically by openProductModal() -->
    <div id="product-form-body"></div>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSaveProduct()">Save Product</button>
      <button class="btn-outline" onclick="closeModal('product-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     WHOLESALE TIERS MODAL
     openModal('tiers-modal', 'tiers-modal-close')
     tiers-list, tier-min-qty, tier-unit, tier-price, tier-form-error
────────────────────────────────────────────────────────────── -->
<div id="tiers-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="tiers-modal-title"
  onclick="if(event.target===this)closeModal('tiers-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="tiers-modal-close"
      onclick="closeModal('tiers-modal')" aria-label="Close">✕</button>
    <h2 id="tiers-modal-title">💲 Wholesale Tiers</h2>
    <div id="tiers-list" style="margin-bottom:1rem"></div>
    <hr style="margin:.75rem 0"/>
    <h3 style="margin-bottom:.5rem;font-size:.95rem">Add Tier</h3>
    <div class="form-group">
      <label for="tier-min-qty">Min Quantity</label>
      <input type="number" id="tier-min-qty" class="form-input" min="1" step="0.001" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="tier-unit">Unit</label>
      <input type="text" id="tier-unit" class="form-input" placeholder="kg / pack / piece" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="tier-price">Tier Price (₱)</label>
      <input type="number" id="tier-price" class="form-input" min="0" step="0.01" aria-required="true"/>
    </div>
    <p id="tier-form-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="saveTier()">Save Tier</button>
      <button class="btn-outline" onclick="closeModal('tiers-modal')">Close</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     CATEGORY FORM MODAL
     openModal('category-modal', 'cat-modal-close')
     openCategoryModal → category-modal-title, cat-name-input, cat-form-error
────────────────────────────────────────────────────────────── -->
<div id="category-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="category-modal-title"
  onclick="if(event.target===this)closeModal('category-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="cat-modal-close"
      onclick="closeModal('category-modal')" aria-label="Close">✕</button>
    <h2 id="category-modal-title">Add Category</h2>
    <div class="form-group">
      <label for="cat-name-input">Category Name</label>
      <input type="text" id="cat-name-input" class="form-input" aria-required="true" placeholder="e.g. Whole Chicken"/>
    </div>
    <p id="cat-form-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSaveCategory()">Save</button>
      <button class="btn-outline" onclick="closeModal('category-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     ADD BATCH MODAL
     openModal('add-batch-modal', 'batch-add-modal-close')
     openAddBatchModal → batch-product-select, batch-date-input, batch-qty-input, batch-add-error
────────────────────────────────────────────────────────────── -->
<div id="add-batch-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="add-batch-modal-title"
  onclick="if(event.target===this)closeModal('add-batch-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="batch-add-modal-close"
      onclick="closeModal('add-batch-modal')" aria-label="Close">✕</button>
    <h2 id="add-batch-modal-title">➕ Add Stock Batch</h2>
    <div class="form-group">
      <label for="batch-product-select">Product</label>
      <select id="batch-product-select" class="form-input" aria-required="true">
        <option value="">— Select Product —</option>
      </select>
    </div>
    <div class="form-group form-group--spaced">
      <label for="batch-date-input">Batch Date</label>
      <input type="date" id="batch-date-input" class="form-input" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="batch-qty-input">Quantity</label>
      <input type="number" id="batch-qty-input" class="form-input" min="0" step="0.001" aria-required="true" placeholder="e.g. 25.000"/>
    </div>
    <p id="batch-add-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmAddBatch()">Add Batch</button>
      <button class="btn-outline" onclick="closeModal('add-batch-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     ADJUST STOCK MODAL
     openModal('adjust-stock-modal', 'adjust-modal-close')
     openAdjustModal → adjust-stock-title, adjust-stock-current, adjust-stock-new,
                        adjust-reason, adjust-notes, adjust-stock-error
────────────────────────────────────────────────────────────── -->
<div id="adjust-stock-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="adjust-stock-title"
  onclick="if(event.target===this)closeModal('adjust-stock-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="adjust-modal-close"
      onclick="closeModal('adjust-stock-modal')" aria-label="Close">✕</button>
    <h2 id="adjust-stock-title">➖ Adjust Stock</h2>
    <div class="form-group">
      <label for="adjust-stock-current">Current Quantity</label>
      <input type="text" id="adjust-stock-current" class="form-input" readonly aria-readonly="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="adjust-stock-new">New Physical Quantity</label>
      <input type="number" id="adjust-stock-new" class="form-input" min="0" step="0.001" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="adjust-reason">Reason Code</label>
      <select id="adjust-reason" class="form-input" aria-required="true">
        <option value="Shrinkage/Water Loss">Shrinkage / Water Loss</option>
        <option value="Spoilage">Spoilage</option>
        <option value="Damaged in Handling">Damaged in Handling</option>
        <option value="Count Correction">Count Correction</option>
      </select>
    </div>
    <div class="form-group form-group--spaced">
      <label for="adjust-notes">Notes</label>
      <textarea id="adjust-notes" class="form-input" rows="2" placeholder="Optional details…"></textarea>
    </div>
    <p id="adjust-stock-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmAdjust()">Save Adjustment</button>
      <button class="btn-outline" onclick="closeModal('adjust-stock-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     USER FORM MODAL
     openModal('user-modal', 'user-modal-close')
     openUserModal → user-modal-title, uf-first, uf-last, uf-email, uf-phone,
                      uf-role, uf-password, uf-password-hint, user-form-error
────────────────────────────────────────────────────────────── -->
<div id="user-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="user-modal-title"
  onclick="if(event.target===this)closeModal('user-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="user-modal-close"
      onclick="closeModal('user-modal')" aria-label="Close">✕</button>
    <h2 id="user-modal-title">Add User</h2>
    <div class="form-group">
      <label for="uf-first">First Name</label>
      <input type="text" id="uf-first" class="form-input" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="uf-last">Last Name</label>
      <input type="text" id="uf-last" class="form-input" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="uf-email">Email</label>
      <input type="email" id="uf-email" class="form-input" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="uf-phone">Phone</label>
      <input type="tel" id="uf-phone" class="form-input"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="uf-role">Role</label>
      <select id="uf-role" class="form-input" aria-required="true">
        <option value="Customer">Customer</option>
        <option value="Fulfillment Staff">Fulfillment Staff</option>
        <option value="Delivery Rider">Delivery Rider</option>
        <option value="Super Admin">Super Admin</option>
      </select>
    </div>
    <div class="form-group form-group--spaced">
      <label for="uf-password">
        Password
        <span id="uf-password-hint" class="form-hint"></span>
      </label>
      <input type="password" id="uf-password" class="form-input" placeholder="Leave blank to keep existing"/>
    </div>
    <p id="user-form-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSaveUser()">Save User</button>
      <button class="btn-outline" onclick="closeModal('user-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     RIDER PERFORMANCE MODAL
     openModal('rider-perf-modal', 'perf-modal-close')
     openRiderPerformance → perf-rider-name, perf-date-from, perf-date-to, perf-body
     Note: original admin.php had typo iid= instead of id= on the close button
────────────────────────────────────────────────────────────── -->
<div id="rider-perf-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="rider-perf-modal-title"
  onclick="if(event.target===this)closeModal('rider-perf-modal')">
  <div class="modal-box modal-box--wide" onclick="event.stopPropagation()">
    <button class="modal-close" id="perf-modal-close"
      onclick="closeModal('rider-perf-modal')" aria-label="Close">✕</button>
    <h2 id="rider-perf-modal-title">
      🏍️ Rider Performance — <span id="perf-rider-name"></span>
    </h2>
    <div class="staff-filter-row" style="margin-bottom:1rem">
      <input type="date" id="perf-date-from" class="form-input staff-filter-input" aria-label="From date"/>
      <input type="date" id="perf-date-to" class="form-input staff-filter-input" aria-label="To date"/>
      <button class="btn-action btn-action-blue" onclick="fetchRiderPerformance()">Apply</button>
    </div>
    <input type="hidden" id="rider-perf-id"/>
    <div id="perf-body"></div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     PROMO FORM MODAL
     openModal('promo-modal', 'promo-modal-close')
     openPromoModal → promo-modal-title, prom-code, prom-type, prom-value-label,
                       prom-value, prom-min, prom-from, prom-to, prom-limit,
                       prom-active, promo-form-error
────────────────────────────────────────────────────────────── -->
<div id="promo-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="promo-modal-title"
  onclick="if(event.target===this)closeModal('promo-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="promo-modal-close"
      onclick="closeModal('promo-modal')" aria-label="Close">✕</button>
    <h2 id="promo-modal-title">Add Promo</h2>
    <div class="form-group">
      <label for="prom-code">Promo Code</label>
      <input type="text" id="prom-code" class="form-input" placeholder="e.g. SAVE10" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="prom-type">Discount Type</label>
      <select id="prom-type" class="form-input" aria-required="true">
        <option value="flat">Flat Amount (₱)</option>
        <option value="percentage">Percentage (%)</option>
      </select>
    </div>
    <div class="form-group form-group--spaced">
      <!-- prom-value-label must be a label element — updatePromoTypeLabel() sets its textContent -->
      <label id="prom-value-label" for="prom-value">Discount Amount (₱)</label>
      <input type="number" id="prom-value" class="form-input" min="0" step="0.01" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="prom-min">Minimum Order Value (₱)</label>
      <input type="number" id="prom-min" class="form-input" min="0" step="0.01" value="0"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="prom-from">Valid From</label>
      <input type="date" id="prom-from" class="form-input"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="prom-to">Valid To</label>
      <input type="date" id="prom-to" class="form-input"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="prom-limit">Usage Limit (blank = unlimited)</label>
      <input type="number" id="prom-limit" class="form-input" min="1"/>
    </div>
    <div class="form-group form-group--spaced">
      <label class="toggle-label">
        <input type="checkbox" id="prom-active" checked/> Active
      </label>
    </div>
    <p id="promo-form-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSavePromo()">Save Promo</button>
      <button class="btn-outline" onclick="closeModal('promo-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     DELIVERY ZONE MODAL
     openModal('zone-modal', 'zone-modal-close')
     openZoneModal → zone-modal-title, zone-muni-id, zone-fee-input, zone-form-error
────────────────────────────────────────────────────────────── -->
<div id="zone-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="zone-modal-title"
  onclick="if(event.target===this)closeModal('zone-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="zone-modal-close"
      onclick="closeModal('zone-modal')" aria-label="Close">✕</button>
    <h2 id="zone-modal-title">Delivery Zone</h2>
    <div class="form-group">
      <label for="zone-muni-id">Municipality</label>
      <select id="zone-muni-id" class="form-input" aria-required="true">
        <option value="">— Select municipality —</option>
      </select>
    </div>
    <div class="form-group form-group--spaced">
      <label for="zone-fee-input">Delivery Fee (₱)</label>
      <input type="number" id="zone-fee-input" class="form-input" min="0" step="0.01" aria-required="true"/>
    </div>
    <p id="zone-form-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSaveZone()">Save Zone</button>
      <button class="btn-outline" onclick="closeModal('zone-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     OPERATIONAL HOURS EDIT MODAL
     openModal('hour-modal', 'hour-modal-close')
     openHourModal → hour-modal-title, hour-open-input,
                     hour-close-input, hour-form-error
────────────────────────────────────────────────────────────── -->
<div id="hour-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="hour-modal-title"
  onclick="if(event.target===this)closeModal('hour-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="hour-modal-close"
      onclick="closeModal('hour-modal')" aria-label="Close">✕</button>
    <h2 id="hour-modal-title">Edit Hours</h2>
    <div class="form-group">
      <label for="hour-open-input">Open Time</label>
      <input type="time" id="hour-open-input" class="form-input" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="hour-close-input">Close Time</label>
      <input type="time" id="hour-close-input" class="form-input" aria-required="true"/>
    </div>
    <p id="hour-form-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSaveHour()">Save Hours</button>
      <button class="btn-outline" onclick="closeModal('hour-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     TIME SLOT MODAL
     openModal('slot-modal', 'slot-modal-close')
     openSlotModal → slot-modal-title, slot-label-input, slot-start-input,
                      slot-end-input, slot-active-chk, slot-form-error
────────────────────────────────────────────────────────────── -->
<div id="slot-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="slot-modal-title"
  onclick="if(event.target===this)closeModal('slot-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="slot-modal-close"
      onclick="closeModal('slot-modal')" aria-label="Close">✕</button>
    <h2 id="slot-modal-title">Time Slot</h2>
    <div class="form-group">
      <label for="slot-label-input">Slot Label</label>
      <input type="text" id="slot-label-input" class="form-input"
        placeholder="e.g. Morning (8AM–12PM)" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="slot-start-input">Start Time</label>
      <input type="time" id="slot-start-input" class="form-input" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="slot-end-input">End Time</label>
      <input type="time" id="slot-end-input" class="form-input" aria-required="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label class="toggle-label">
        <input type="checkbox" id="slot-active-chk" checked/> Active
      </label>
    </div>
    <p id="slot-form-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSaveSlot()">Save Slot</button>
      <button class="btn-outline" onclick="closeModal('slot-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     DISPUTE DETAIL MODAL (view only)
     openModal('dispute-modal', 'dispute-modal-close')
     openDisputeDetail → dispute-detail-body
────────────────────────────────────────────────────────────── -->
<div id="dispute-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="dispute-modal-title"
  onclick="if(event.target===this)closeModal('dispute-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="dispute-modal-close"
      onclick="closeModal('dispute-modal')" aria-label="Close">✕</button>
    <h2 id="dispute-modal-title">⚠️ Dispute Detail</h2>
    <div id="dispute-detail-body"></div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     UPDATE DISPUTE MODAL
     openModal('update-dispute-modal', 'update-modal-close')
     openUpdateDisputeModal → ud-notes, ud-status, ud-error
────────────────────────────────────────────────────────────── -->
<div id="update-dispute-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="update-dispute-modal-title"
  onclick="if(event.target===this)closeModal('update-dispute-modal')">
  <div class="modal-box modal-box-sm" onclick="event.stopPropagation()">
    <button class="modal-close" id="update-modal-close"
      onclick="closeModal('update-dispute-modal')" aria-label="Close">✕</button>
    <h2 id="update-dispute-modal-title">Update Dispute Status</h2>
    <div class="form-group">
      <label for="ud-status">Status</label>
      <select id="ud-status" class="form-input">
        <option value="Under Review">🟡 Under Review</option>
        <option value="Resolved">🟢 Resolved</option>
        <option value="Rejected">⚫ Rejected</option>
      </select>
    </div>
    <div class="form-group">
      <label for="ud-notes">Notes <span class="required-mark">*</span></label>
      <textarea id="ud-notes" class="form-input" rows="4"
        placeholder="Enter resolution details, reasons, or next steps…" aria-required="true"></textarea>
    </div>
    <p id="ud-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="submitUpdateDispute()">Save Changes</button>
      <button class="btn-outline" onclick="closeModal('update-dispute-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────
     SEND NOTIFICATION MODAL
     openModal('send-notif-modal', 'notif-modal-close')
     openSendNotifModal → notif-user-id, notif-message, notif-type, send-notif-error
────────────────────────────────────────────────────────────── -->
<div id="send-notif-modal" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="send-notif-modal-title"
  onclick="if(event.target===this)closeModal('send-notif-modal')">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" id="notif-modal-close"
      onclick="closeModal('send-notif-modal')" aria-label="Close">✕</button>
    <h2 id="send-notif-modal-title">🔔 Send Notification</h2>
    <div class="form-group">
      <label for="notif-user-id">User ID</label>
      <input type="number" id="notif-user-id" class="form-input" min="1" aria-required="true" placeholder="e.g. 42"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="notif-message">Message</label>
      <textarea id="notif-message" class="form-input" rows="3" aria-required="true"
        placeholder="Enter notification message…"></textarea>
    </div>
    <div class="form-group form-group--spaced">
      <label for="notif-type">Type</label>
      <select id="notif-type" class="form-input">
        <option value="general">General</option>
        <option value="order_placed">Order Placed</option>
        <option value="packed">Packed</option>
        <option value="dispatched">Dispatched</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
    <p id="send-notif-error" class="form-error" role="alert" style="display:none"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="confirmSendNotif()">Send</button>
      <button class="btn-outline" onclick="closeModal('send-notif-modal')">Cancel</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     PRINT AREAS (hidden; shown only on print)
══════════════════════════════════════════════════════════════ -->
<div id="print-slip" class="print-only" aria-hidden="true"></div>
<div id="thermal-labels" class="print-only" aria-hidden="true"></div>
<div id="prep-sheet-print" class="print-only" aria-hidden="true"></div>

<!-- ══════════════════════════════════════════════════════════════
     TOAST NOTIFICATION
══════════════════════════════════════════════════════════════ -->
<div id="admin-toast" class="toast" role="status" aria-live="polite" aria-atomic="true"></div>

<!-- ══════════════════════════════════════════════════════════════
     SCRIPTS
══════════════════════════════════════════════════════════════ -->
<script src="js/shared/constants.js"></script>
<script src="js/shared/utils.js"></script>
<script src="js/shared/uiHelpers.js"></script>
<script src="js/shared/apiService.js"></script>
<script src="js/controllers/admin.js"></script>

</body>
</html>