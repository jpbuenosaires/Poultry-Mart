<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>PoultryMart — Fulfillment Staff</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

  <!-- Portal specific -->
  <link rel="stylesheet" href="/css/fulfillment-entry.css"/>

</head>
<body class="portal-body portal-body--fulfillment">

<!-- ══════════════════════════════════════════════════════════════
     LOGIN SCREEN
══════════════════════════════════════════════════════════════ -->
<div id="portal-login-screen" class="portal-login" role="main" aria-label="Staff login">
  <div class="portal-login__card">
    <header class="portal-login__brand" aria-label="PoultryMart Fulfillment Portal">
      <span class="brand-chicken" aria-hidden="true">🐓</span>
      <div>
        <div class="brand-wordmark">Poultry<strong>Mart</strong></div>
        <div class="brand-portal-label">Fulfillment Portal</div>
      </div>
    </header>
    <h1 class="portal-login__heading">Staff Sign In</h1>
    <p class="portal-login__sub">For Fulfillment Staff accounts only.</p>
    <div class="form-group">
      <label for="sf-email">Email address</label>
      <input type="email" id="sf-email" class="form-input" placeholder="staff@poultrymart.com"
        autocomplete="email" required aria-required="true"
        onkeydown="if(event.key==='Enter')document.getElementById('sf-pass').focus()"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="sf-pass">Password</label>
      <input type="password" id="sf-pass" class="form-input" placeholder="••••••••"
        autocomplete="current-password" required aria-required="true"
        onkeydown="if(event.key==='Enter')staffLogin()"/>
    </div>
    <p id="sf-login-error" class="form-error" role="alert" hidden></p>
    <button id="sf-login-btn" class="btn-primary full-width btn--mt" onclick="staffLogin()">
      Sign In
    </button>
    <p class="portal-login__hint">
      <strong>Demo:</strong> <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="364542575050764659435a42444f5b5744421855595b">[email&#160;protected]</a> / password123
    </p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     STAFF APP SHELL
══════════════════════════════════════════════════════════════ -->
<div id="portal-app" hidden aria-label="Fulfillment Staff Application">

  <!-- ── SIDEBAR ──────────────────────────────────────────────── -->
  <nav id="staff-sidebar" class="portal-sidebar" aria-label="Main navigation">
    <a href="#" class="portal-sidebar__header" aria-label="PoultryMart Staff Home">
      <span class="logo-icon" aria-hidden="true">🐓</span>
      <span class="logo-text">Poultry<strong>Mart</strong></span>
      <span class="staff-tag" aria-label="Staff panel">Staff</span>
    </a>

    <div class="portal-user-pill" id="staff-user-pill">
      <div class="portal-avatar" id="staff-avatar-initial" aria-hidden="true">S</div>
      <div class="portal-user-info">
        <div class="portal-user-name" id="staff-user-name">Staff</div>
        <div class="portal-role-tag">Fulfillment Staff</div>
      </div>
    </div>

    <nav class="portal-nav" aria-label="Staff sections">
      
      <span class="portal-nav__section" aria-hidden="true">Fulfillment</span>
      <button class="portal-nav__btn active" data-page="queue" onclick="showPage('queue')" aria-current="page">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        Packing Queue
        <span class="nav-badge" id="nav-badge-queue" aria-label="pending orders"></span>
      </button>
      <button class="portal-nav__btn" data-page="packed" onclick="showPage('packed')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
        </svg>
        Assign Riders
      </button>

      <span class="portal-nav__section" aria-hidden="true">Logistics & Records</span>
      <button class="portal-nav__btn" data-page="dispatch" onclick="showPage('dispatch')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        Active Dispatch
        <span class="nav-badge nav-badge-orange" id="nav-badge-dispatch" aria-label="orders out for delivery"></span>
      </button>
      <button class="portal-nav__btn" data-page="all-orders" onclick="showPage('all-orders')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
        All Orders
      </button>

      <span class="portal-nav__section" aria-hidden="true">Stock Management</span>
      <button class="portal-nav__btn" data-page="inventory" onclick="showPage('inventory')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        Inventory
      </button>
      <button class="portal-nav__btn" data-page="returns" onclick="showPage('returns')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
        </svg>
        Returns &amp; Restock
        <span class="nav-badge nav-badge-red" id="nav-badge-returns" aria-label="failed deliveries awaiting review"></span>
      </button>

    </nav>

    <div class="portal-sidebar__footer">
      <button class="portal-nav__logout" onclick="staffLogout()" aria-label="Sign out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign Out
      </button>
    </div>
  </nav>

  <!-- ── MAIN CONTENT ──────────────────────────────────────────── -->
  <div class="portal-main" id="staff-main">

    <!-- Topbar -->
    <header class="portal-topbar" role="banner">
      <button class="topbar-menu-btn icon-btn" onclick="toggleSidebar()" aria-label="Toggle navigation menu"
        aria-controls="staff-sidebar" aria-expanded="false" id="staff-menu-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div class="topbar-title" id="staff-topbar-title">
        Packing Queue
        <small>Fulfillment Portal</small>
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
        <!-- Notification Bell -->
        <button class="notif-bell-btn" id="notif-bell-btn" onclick="toggleNotifPanel()"
          aria-label="Notifications" title="Alerts">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="notif-bell-badge" id="notif-bell-badge" style="display:none"></span>
        </button>

        <button class="staff-refresh-btn" onclick="refreshCurrentPage()" aria-label="Refresh current view" title="Refresh">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
        <span class="staff-topbar-clock" id="staff-clock" aria-live="polite" aria-label="Current time"></span>
      </div>
    </header>

    <!-- Notification panel -->
    <div id="notif-panel" class="notif-panel" style="display:none" role="region" aria-label="Cancellation Alerts">
      <div class="notif-panel-header">
        <strong>🔔 Cancellation Alerts</strong>
        <button onclick="dismissAllAlerts()" class="notif-dismiss-all">Mark all read</button>
      </div>
      <div id="notif-panel-body">
        <p>No recent alerts.</p>
      </div>
    </div>

    <!-- Cancellation overlay (full-screen warning) -->
    <div id="cancel-overlay" class="cancel-overlay" style="display:none" role="alertdialog"
      aria-labelledby="cancel-overlay-title" aria-live="assertive">
      <div class="cancel-overlay-inner">
        <div class="cancel-overlay-icon" aria-hidden="true">🚨</div>
        <h2 id="cancel-overlay-title">Order Cancelled!</h2>
        <p id="cancel-overlay-msg"></p>
        <button class="btn-primary" onclick="dismissCancelOverlay()">Acknowledge</button>
      </div>
    </div>

    <!-- ── PAGE: PACKING QUEUE ──────────────────────────────── -->
    <section id="page-queue" class="staff-page active" aria-label="Packing Queue" role="region">
      <div class="staff-page-header">
        <div>
          <h2>Packing Queue</h2>
          <p class="staff-page-sub">Pending orders awaiting physical weighing and packing.</p>
        </div>
        <div class="staff-filter-row" role="search">
          <label for="queue-date-filter" class="sr-only">Filter by delivery date</label>
          <input type="date" id="queue-date-filter" class="form-input staff-filter-input"
            onchange="filterQueue()" aria-label="Filter by delivery date"/>
          <div class="search-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="queue-search" class="form-input" placeholder="Search order #, customer…"
              oninput="filterQueue()" aria-label="Search orders" />
          </div>
          <!-- Bulk actions -->
          <button class="btn-outline btn-sm" id="select-all-btn" onclick="toggleSelectAll()"
            title="Select / deselect all visible orders">
            ☑️ Select All
          </button>
          <button class="btn-outline btn-sm" id="prep-sheet-btn" onclick="openPrepSheetModal()"
            title="Generate daily prep sheet for selected orders">
            📋 Prep Sheet
          </button>
        </div>
      </div>

      <!-- Summary bar -->
      <div class="queue-summary-bar" id="queue-summary-bar" aria-live="polite" aria-atomic="true"></div>

      <!-- Queue list -->
      <div id="queue-list" aria-label="Pending orders list" aria-live="polite"></div>
    </section>

    <!-- ── PAGE: ASSIGN RIDERS ──────────────────────────────── -->
    <section id="page-packed" class="staff-page" aria-label="Assign Riders" role="region">
      <div class="staff-page-header">
        <div>
          <h2>Assign Riders</h2>
          <p class="staff-page-sub">Packed orders ready for delivery assignment.</p>
        </div>
        <div class="staff-filter-row">
          <!-- Zone grouping toggle -->
          <button class="btn-outline btn-sm" id="zone-view-btn" onclick="toggleZoneView()"
            aria-pressed="false">
            🗺️ Zone View
          </button>
          <label for="packed-search" class="sr-only">Search packed orders</label>
          <input type="text" id="packed-search" class="form-input staff-filter-input"
            placeholder="Order # or customer…" oninput="filterPacked()" aria-label="Search packed orders"/>
        </div>
      </div>
      <div id="packed-list" aria-label="Packed orders list" aria-live="polite"></div>
    </section>

    <!-- ── PAGE: ACTIVE DISPATCH ────────────────────────────── -->
    <section id="page-dispatch" class="staff-page" aria-label="Active Dispatch" role="region">
      <div class="staff-page-header">
        <div>
          <h2>Active Dispatch</h2>
          <p class="staff-page-sub">Orders currently out for delivery. Monitor and confirm completion.</p>
        </div>
        <div class="staff-filter-row">
          <label for="dispatch-search" class="sr-only">Search dispatched orders</label>
          <input type="text" id="dispatch-search" class="form-input staff-filter-input"
            placeholder="Order # or customer…" oninput="filterDispatch()" aria-label="Search dispatched orders"/>
        </div>
      </div>
      <div id="dispatch-list" aria-label="Dispatched orders" aria-live="polite"></div>
    </section>

    <!-- ── PAGE: ALL ORDERS ──────────────────────────────────── -->
<section id="page-all-orders" class="staff-page" aria-label="All Orders" role="region">
      <div class="staff-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">All Orders</h2>
            <p class="panel-hint">Full order history across all statuses.</p>
          </div>
          <div class="filter-bar">
            <label for="ao-status-filter" class="sr-only">Filter by status</label>
            <select id="ao-status-filter" class="form-input staff-filter-input"
              onchange="loadAllOrders()" aria-label="Filter by order status">
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Packed">Packed</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Arrived at Location">Arrived at Location</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <label for="ao-search" class="sr-only">Search all orders</label>
            <input type="text" id="ao-search" class="form-input staff-filter-input"
              placeholder="Order # or customer…" oninput="loadAllOrders()" aria-label="Search all orders"/>
          </div>
        </div>
        
        <div class="panel-body no-pad">
          <table class="data-table" id="all-orders-table" aria-label="All orders">
          <thead>
            <tr>
              <th scope="col">Order #</th>
              <th scope="col">Customer</th>
              <th scope="col">Delivery Date</th>
              <th scope="col">Time Slot</th>
              <th scope="col">Est. Total</th>
              <th scope="col">Final Total</th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody id="all-orders-tbody">
            <tr><td colspan="9" class="table-loading">Loading…</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── PAGE: INVENTORY ──────────────────────────────────── -->
    <section id="page-inventory" class="staff-page" aria-label="Inventory Batches" role="region">
      <div class="staff-page-header">
        <div>
          <h2>Inventory Batches</h2>
          <p class="staff-page-sub">FIFO stock levels. Low stock items highlighted in amber.</p>
        </div>
      </div>

      <!-- Low stock alert -->
      <div id="inventory-alerts" aria-live="polite" aria-label="Low stock alerts"></div>

      <div class="staff-panel">
        <div class="panel-body no-pad">
          <table class="data-table" id="inventory-table" aria-label="Inventory batches">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Category</th>
              <th scope="col">Batch #</th>
              <th scope="col">Batch Date</th>
              <th scope="col">Received (kg)</th>
              <th scope="col">Remaining (kg)</th>
              <th scope="col">Stock Level</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody id="inventory-tbody">
            <tr><td colspan="8" class="table-loading">Loading…</td></tr>
          </tbody>
        </table>
      </div>
    </section>

  <!-- ── PAGE: RETURNS & RESTOCK ──────────────────────── -->
    <section id="page-returns" class="staff-page" aria-label="Returns and Restock" role="region">
      <div class="staff-page-header">
        <div>
          <h2>Returns &amp; Restock</h2>
          <p class="staff-page-sub">Failed deliveries returned by riders. Inspect goods and restock or mark as spoiled.</p>
        </div>
        <div class="staff-filter-row">
          <label for="returns-search" class="sr-only">Search returns</label>
          <input type="text" id="returns-search" class="form-input staff-filter-input"
            placeholder="Order # or customer…" oninput="filterReturns()" aria-label="Search returned orders"/>
        </div>
      </div>
      <div id="returns-list" aria-label="Returned orders" aria-live="polite"></div>
    </section>

  </div><!-- /staff-main -->
</div><!-- /staff-app -->

<!-- ══════════════════════════════════════════════════════════════
     PACK ORDER MODAL (Enhanced with FIFO batch display)
══════════════════════════════════════════════════════════════ -->
<div id="pack-modal-overlay" class="staff-modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="pack-modal-title" onclick="closePackModal(event)">
  <div class="staff-modal pack-modal-box" onclick="event.stopPropagation()">
    
    <div class="modal-header">
      <h3 id="pack-modal-title" tabindex="-1">
        <span aria-hidden="true">⚖</span> Pack Order
      </h3>
      <div class="pack-modal-order-meta" id="pack-modal-meta" ></div>
      <button class="modal-close-btn" onclick="closePackModalDirect()" aria-label="Close packing modal">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body">

    <!-- Customer info strip -->
    <div class="pack-customer-strip" id="pack-customer-strip"></div>

    <!-- Catch-weight items section -->
    <fieldset class="pack-items-fieldset">
      <legend class="pack-items-legend">
        Enter actual weighed weight for each catch-weight item
      </legend>
      <div id="pack-items-list" aria-label="Order items weight input"
        aria-live="polite" aria-atomic="false" aria-relevant="additions text"></div>
    </fieldset>

    <!-- Running final total -->
    <div class="pack-total-strip" aria-live="polite" aria-atomic="true" id="pack-total-strip">
      <div class="pack-total-row">
        <span>Items Subtotal</span>
        <span id="pack-items-subtotal">₱0.00</span>
      </div>
      <div class="pack-total-row">
        <span>Delivery Fee</span>
        <span id="pack-delivery-fee">₱0.00</span>
      </div>
      <div class="pack-total-row" id="pack-discount-row" style="display:none">
        <span>Discount</span>
        <span id="pack-discount-val" >−₱0.00</span>
      </div>
      <div class="pack-total-row pack-grand-total">
        <span>Final Total</span>
        <strong id="pack-grand-total-val">₱0.00</strong>
      </div>
    </div>

    </div>
    <div class="modal-footer">
      <div >
        <button class="btn-outline btn-sm" onclick="printPackingSlip()" aria-label="Print packing slip">🖨 Print Slip</button>
        <button class="btn-outline btn-sm" onclick="printItemLabels()" aria-label="Print thermal item labels">🏷️ Item Labels</button>
      </div>
      <button class="btn-primary" id="pack-confirm-btn" onclick="confirmPackOrder()">
        ✓ Confirm Pack &amp; Set Final Total
      </button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     ASSIGN RIDER MODAL
══════════════════════════════════════════════════════════════ -->
<div id="assign-modal-overlay" class="staff-modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="assign-modal-title" onclick="closeAssignModal(event)">
  <div class="staff-modal" onclick="event.stopPropagation()">
    
    <div class="modal-header">
      <h3 id="assign-modal-title" tabindex="-1">Assign Rider</h3>
      <button class="modal-close-btn" onclick="closeAssignModalDirect()" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    
    <div class="modal-body">
      <p class="panel-hint" id="assign-modal-order-info"></p>
    <div class="form-group">
      <label for="rider-select">Select Delivery Rider</label>
      <select id="rider-select" class="form-input" aria-required="true">
        <option value="">— Choose a rider —</option>
      </select>
    </div>
    <p id="assign-error" class="form-error" role="alert" style="display:none"></p>
    </div>
    <div class="modal-footer">
      <button class="btn-outline btn-sm" onclick="closeAssignModalDirect()">Cancel</button>
      <button class="btn-primary" onclick="confirmAssignRider()">Assign Rider</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     BATCH ASSIGN MODAL (zone-based, one rider → multiple orders)
══════════════════════════════════════════════════════════════ -->
<div id="batch-assign-modal-overlay" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="batch-assign-title" onclick="closeBatchAssignModal(event)">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeBatchAssignModal()" aria-label="Close">✕</button>
    <h2 id="batch-assign-title" >🗺️ Batch Assign Rider</h2>
    <p id="batch-assign-subtitle" class="staff-page-sub" ></p>
    <div class="zone-assign-order-list" id="batch-assign-orders"></div>
    <div class="form-group" >
      <label for="batch-rider-select">Assign All to Rider</label>
      <select id="batch-rider-select" class="form-input" aria-required="true">
        <option value="">— Choose a rider —</option>
      </select>
    </div>
    <p id="batch-assign-error" class="form-error" role="alert" style="display:none"></p>
    <div>
      <button class="btn-primary" onclick="confirmBatchAssign()">Assign All</button>
      <button class="btn-outline" onclick="closeBatchAssignModal()">Cancel</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     ORDER DETAIL MODAL (read-only)
══════════════════════════════════════════════════════════════ -->
<div id="detail-modal-overlay" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="detail-modal-title" onclick="closeDetailModal(event)">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeDetailModalDirect()" aria-label="Close order detail">✕</button>
    <div id="detail-modal-content"></div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     ADJUST STOCK MODAL (spoilage / shrinkage)
══════════════════════════════════════════════════════════════ -->
<div id="adjust-stock-modal-overlay" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="adjust-stock-title" onclick="closeAdjustStockModal(event)">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeAdjustStockModal()" aria-label="Close">✕</button>
    <h2 id="adjust-stock-title" >➖ Adjust Stock</h2>
    <p class="staff-page-sub" id="adjust-stock-info"></p>
    <div class="form-group">
      <label>Current Stock</label>
      <input type="text" id="adjust-stock-current" class="form-input" readonly aria-readonly="true"/>
    </div>
    <div class="form-group form-group--spaced">
      <label for="adjust-stock-new">Actual Physical Stock (kg)</label>
      <input type="number" id="adjust-stock-new" class="form-input"
        min="0" step="0.001" placeholder="0.000" aria-required="true"/>
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
      <label for="adjust-notes">Notes (optional)</label>
      <textarea id="adjust-notes" class="form-input" rows="2" placeholder="Additional details…"></textarea>
    </div>
    <p id="adjust-stock-error" class="form-error" role="alert" style="display:none"></p>
    <div>
      <button class="btn-primary" onclick="confirmAdjustStock()">Save Adjustment</button>
      <button class="btn-outline" onclick="closeAdjustStockModal()">Cancel</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     DAILY PREP SHEET MODAL
══════════════════════════════════════════════════════════════ -->
<div id="prep-sheet-modal-overlay" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="prep-sheet-title" onclick="closePrepSheetModal(event)">
  <div class="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closePrepSheetModal()" aria-label="Close">✕</button>
    <h2 id="prep-sheet-title">📋 Daily Prep Sheet</h2>
    <p class="staff-page-sub" id="prep-sheet-subtitle">
      Aggregate quantities needed from cold storage.
    </p>
    <div id="prep-sheet-content"></div>
    <div>
      <button class="btn-outline" onclick="printPrepSheet()">🖨 Print Sheet</button>
      <button class="btn-primary" onclick="closePrepSheetModal()">Close</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     PROOF OF DELIVERY MODAL
══════════════════════════════════════════════════════════════ -->
<div id="pod-modal-overlay" class="staff-modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="pod-modal-title" onclick="closePodModal(event)">
  <div class="staff-modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h3 id="pod-modal-title" tabindex="-1">📸 Proof of Delivery</h3>
      <button class="modal-close-btn" onclick="closePodModal()" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
    <img id="pod-modal-img" src="" alt="Proof of delivery photo"/>
    <p id="pod-modal-caption"></p>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     DISPATCH CONFIRM MODAL
══════════════════════════════════════════════════════════════ -->
<div id="dispatch-confirm-overlay" class="modal-overlay" style="display:none" role="dialog"
  aria-modal="true" aria-labelledby="dispatch-confirm-title" onclick="closeDispatchConfirm(event)">
  <div class="modal-box" onclick="event.stopPropagation()" >
    <button class="modal-close" onclick="closeDispatchConfirm()" aria-label="Close">✕</button>
    <div>🛵</div>
    <h2 id="dispatch-confirm-title" >Dispatch Order?</h2>
    <p id="dispatch-confirm-msg" class="staff-page-sub" ></p>
    <div>
      <button class="btn-primary" id="dispatch-confirm-btn">Dispatch Now</button>
      <button class="btn-outline" onclick="closeDispatchConfirm()">Cancel</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════
     PRINT PACKING SLIP (hidden, revealed on print)
══════════════════════════════════════════════════════════════ -->
<div id="print-slip" class="print-only" aria-hidden="true"></div>

<!-- ══════════════════════════════════════════════════════════════
     THERMAL LABEL PRINT AREA
══════════════════════════════════════════════════════════════ -->
<div id="thermal-labels" class="print-only thermal-labels-area" aria-hidden="true"></div>

<!-- ══════════════════════════════════════════════════════════════
     PREP SHEET PRINT AREA
══════════════════════════════════════════════════════════════ -->
<div id="prep-sheet-print" class="print-only" aria-hidden="true"></div>

<!-- ══════════════════════════════════════════════════════════════
     TOAST NOTIFICATION
══════════════════════════════════════════════════════════════ -->
<div id="staff-toast" class="toast" role="status" aria-live="polite" aria-atomic="true"></div>

<!-- Scripts -->
<script src="js/shared/constants.js"></script>
<script src="js/shared/utils.js"></script>
<script src="js/shared/uiHelpers.js"></script>
<script src="js/shared/apiService.js"></script>
<script src="js/controllers/fulfillment.js"></script>


</body>
</html>