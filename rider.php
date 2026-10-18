<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="PoultryMart Delivery Rider Portal — Manage and complete your assigned deliveries."/>
  <title>PoultryMart — Delivery Rider Portal</title>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

  <!-- Portal specific -->
  <link rel="stylesheet" href="/css/rider-entry.css"/>
</head>
<body class="portal-body portal-body--rider">

<!-- ══════════════════════════════════════════════════════
     SKIP NAVIGATION (WCAG 2.4.1)
══════════════════════════════════════════════════════ -->
<a class="skip-link" href="#rider-main-content">Skip to main content</a>

<!-- ══════════════════════════════════════════════════════
     LOGIN SCREEN
     Shown when no session exists.
══════════════════════════════════════════════════════ -->
<div id="portal-login-screen" class="portal-login" role="main" aria-labelledby="login-screen-title">
  <div class="portal-login__card">

    <header class="portal-login__brand" aria-label="PoultryMart Rider Portal brand">
      <span class="brand-motorcycle" aria-hidden="true">🏍️</span>
      <div>
        <div class="brand-wordmark">Poultry<strong>Mart</strong></div>
        <div class="brand-portal-label">Rider Portal</div>
      </div>
    </header>

    <h1 class="portal-login__heading" id="login-screen-title">Rider Sign In</h1>
    <p class="portal-login__sub">For Delivery Rider accounts only.</p>

    <div class="form-group">
      <label for="r-email">Email address</label>
      <input
        type="email"
        id="r-email"
        class="form-input"
        placeholder="rider@poultrymart.com"
        autocomplete="email"
        required
        aria-required="true"
        aria-describedby="r-login-error"
      />
    </div>

    <div class="form-group">
      <label for="r-pass">Password</label>
      <div class="password-field-wrap">
        <input
          type="password"
          id="r-pass"
          class="form-input"
          placeholder="••••••••"
          autocomplete="current-password"
          required
          aria-required="true"
          aria-describedby="r-login-error"
        />
        <button
          type="button"
          class="password-toggle"
          aria-label="Show password"
          aria-pressed="false"
          onclick="togglePasswordVisibility(this)"
        >
          <span aria-hidden="true">👁</span>
        </button>
      </div>
    </div>

    <p id="r-login-error" class="form-error" role="alert" aria-live="assertive" hidden></p>

    <button
      id="r-login-btn"
      class="btn-primary full-width"
      type="button"
      onclick="riderLogin()"
      aria-live="polite"
    >
      <span id="r-login-btn-text">Sign In</span>
    </button>

  </div>
</div>


<!-- ══════════════════════════════════════════════════════
     RIDER APP SHELL  (visible after login)
══════════════════════════════════════════════════════ -->
<div id="portal-app" hidden>

  <!-- Mobile sidebar backdrop -->
  <div
    id="portal-sidebar-overlay"
    class="portal-sidebar-overlay"
    onclick="closeMobileSidebar()"
    aria-hidden="true"
    tabindex="-1"
  ></div>

  <!-- ── SIDEBAR ────────────────────────────────────── -->
  <nav id="portal-sidebar" class="portal-sidebar" aria-label="Rider navigation">

<a href="#" class="portal-sidebar__header" aria-label="PoultryMart Rider Home">
      <span class="logo-icon" aria-hidden="true">🏍️</span>
      <span class="logo-text">Poultry<strong>Mart</strong></span>
      <span class="rider-tag" aria-label="Rider panel">Rider</span>
    </a>

    <div class="portal-user-pill" aria-label="Signed in rider information">
      <div class="portal-avatar" id="rider-avatar-initial" aria-hidden="true">R</div>
      <div class="portal-user-info">
        <div class="portal-user-name" id="rider-user-name">Rider</div>
        <div class="portal-role-tag">Delivery Rider</div>
      </div>
    </div>

    <!-- Primary navigation -->
    <nav class="portal-nav" aria-label="Rider sections">
      
      <span class="portal-nav__section" aria-hidden="true">Deliveries</span>
      <button class="portal-nav__btn active" data-page="dashboard" onclick="showPage('dashboard')" aria-current="page" type="button">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        Dashboard
      </button>
      <button class="portal-nav__btn" data-page="active" onclick="showPage('active')" type="button">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        Active Deliveries
        <span class="nav-badge" id="active-orders-badge" aria-label="active orders count" aria-live="polite"></span>
      </button>

      <span class="portal-nav__section" aria-hidden="true">Records</span>
      <button class="portal-nav__btn" data-page="history" onclick="showPage('history')" type="button">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
        History
      </button>
      <button class="portal-nav__btn" data-page="performance" onclick="showPage('performance')" type="button">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
        </svg>
        Performance
      </button>

      <span class="portal-nav__section" aria-hidden="true">Account</span>
      <button class="portal-nav__btn" data-page="settings" onclick="showPage('settings')" type="button">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 1.41 13.93M4.93 4.93a10 10 0 0 0-1.41 13.93"/><path d="M12 2a10 10 0 0 1 7.07 17.07M12 22a10 10 0 0 1-7.07-17.07"/>
        </svg>
        Settings
      </button>
      <button class="portal-nav__btn" onclick="openShiftModal()" aria-label="Open end of shift check-in" type="button">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
        End of Shift
      </button>

    </nav>

    <div class="portal-sidebar__footer">
      <button class="portal-nav__logout" onclick="riderLogout()" aria-label="Sign out" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign Out
      </button>
    </div>

  </nav><!-- /rider-sidebar -->


  <!-- ── MAIN AREA ─────────────────────────────────── -->
  <div class="portal-main" id="rider-main-content">

    <!-- ── TOPBAR ──────────────────────────────────── -->
    <header class="portal-topbar" role="banner">
      <button
        class="topbar-menu-btn icon-btn"
        onclick="toggleMobileSidebar()"
        aria-label="Toggle navigation menu"
        aria-expanded="false"
        aria-controls="rider-sidebar"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div class="topbar-title" id="rider-topbar-title" aria-live="polite">
        Dashboard
        <small>Rider Portal</small>
      </div>

      <div class="topbar-actions">
        <!-- Duty status toggle -->
        <button
          id="rider-duty-toggle"
          class="btn-outline btn-sm"
          type="button"
          aria-pressed="true"
          aria-label="Toggle duty status — currently On Duty"
          onclick="toggleDutyStatus()"
        >
          <span id="rider-duty-icon" aria-hidden="true">🟢</span>
          <span id="rider-duty-label">On Duty</span>
        </button>

        <!-- Notification bell -->
        <button
          class="rider-notif-btn"
          id="rider-notif-btn"
          onclick="toggleNotifPanel()"
          aria-label="Notifications"
          aria-expanded="false"
          aria-controls="rider-notif-panel"
          title="Notifications"
          type="button"
        >
          <span aria-hidden="true">🔔</span>
          <span class="notif-badge" id="notif-badge" hidden aria-live="polite"></span>
        </button>
        <button
          class="rider-refresh-btn"
          onclick="refreshCurrentPage()"
          aria-label="Refresh current page"
          title="Refresh"
          type="button"
        >↻</button>
        <time class="rider-topbar-clock" id="rider-clock" aria-live="off" datetime="">—</time>
      </div>

      <!-- Notification panel (dropdown) -->
      <div
        id="rider-notif-panel"
        class="rider-notif-panel"
        role="region"
        aria-label="Notifications"
        hidden
      >
        <div class="notif-panel-header">
          <span>Notifications</span>
          <button class="btn-sm btn-outline" onclick="markAllNotifsRead()" type="button">Mark all read</button>
        </div>
        <div id="notif-panel-list" class="notif-panel-list"><!-- JS --></div>
      </div>
    </header>

    <!-- ── PAGE CONTENT ────────────────────────────── -->
    <main id="rider-pages-wrapper">

      <!-- ════════════════════════════════════════════
           PAGE: DASHBOARD
      ════════════════════════════════════════════ -->
      <section
        id="rider-page-dashboard"
        class="rider-page active"
        aria-labelledby="dash-heading"
        tabindex="-1"
      >
        <div class="rider-page-header">
          <div>
            <h3 id="dash-heading">My Dashboard</h3>
            <p class="rider-page-sub">Today's delivery overview</p>
          </div>
        </div>

        <!-- Summary stat pills -->
        <div
          id="dash-summary-bar"
          class="stats-grid"
          role="region"
          aria-label="Today's delivery summary"
          aria-live="polite"
        >
          <!-- Populated by JS -->
        </div>

        <!-- Shift summary remittance breakdown -->
        <div id="dash-shift-summary" aria-live="polite" aria-label="Shift cash summary"></div>

        <!-- Active / urgent deliveries -->
        <h4 class="section-subheading">Active Deliveries</h4>
        <div
          id="dash-urgent-list"
          aria-live="polite"
          aria-label="Active delivery list"
          aria-relevant="additions removals"
        >
          <!-- Populated by JS -->
        </div>

      </section><!-- /dashboard -->


      <!-- ════════════════════════════════════════════
           PAGE: ACTIVE DELIVERIES
      ════════════════════════════════════════════ -->
      <section
        id="rider-page-active"
        class="rider-page"
        aria-labelledby="active-heading"
        tabindex="-1"
        hidden
      >
        <div class="rider-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title" id="active-heading">Active Deliveries</h2>
              <p class="panel-hint">Assigned orders awaiting pickup or in transit</p>
            </div>
            <div class="filter-bar">
              <label for="active-date-filter" class="sr-only">Filter by delivery date</label>
              <input
                type="date"
                id="active-date-filter"
                class="form-input"
                aria-label="Filter by delivery date"
                onchange="loadActiveOrders()"
              />
            </div>
          </div>
        </div>

        <!-- Status tab bar -->
        <div
          role="tablist"
          aria-label="Filter deliveries by status"
          class="rider-tab-bar"
          id="active-status-tabs"
        >
          <input type="hidden" id="active-tab-value" value="all"/>

          <button
            class="tab-btn btn-outline btn-sm active"
            role="tab"
            aria-selected="true"
            data-tab="all"
            onclick="setActiveTab('all')"
            type="button"
            id="tab-all"
            aria-controls="active-orders-list"
          >All Active</button>

          <button
            class="tab-btn btn-outline btn-sm"
            role="tab"
            aria-selected="false"
            data-tab="Packed"
            onclick="setActiveTab('Packed')"
            type="button"
            id="tab-packed"
            aria-controls="active-orders-list"
          ><span aria-hidden="true">📦</span> Packed</button>

          <button
            class="tab-btn btn-outline btn-sm"
            role="tab"
            aria-selected="false"
            data-tab="Out for Delivery"
            onclick="setActiveTab('Out for Delivery')"
            type="button"
            id="tab-transit"
            aria-controls="active-orders-list"
          ><span aria-hidden="true">🚴</span> In Transit</button>

          <button
            class="tab-btn btn-outline btn-sm"
            role="tab"
            aria-selected="false"
            data-tab="Arrived at Location"
            onclick="setActiveTab('Arrived at Location')"
            type="button"
            id="tab-arrived"
            aria-controls="active-orders-list"
          ><span aria-hidden="true">📍</span> Arrived</button>
        </div>

        <!-- Active orders list -->
        <div
          id="active-orders-list"
          role="tabpanel"
          aria-live="polite"
          aria-label="Active orders"
          aria-relevant="additions removals"
        >
          <!-- Populated by JS -->
        </div>

      </section><!-- /active -->


      <!-- ════════════════════════════════════════════
           PAGE: HISTORY
      ════════════════════════════════════════════ -->
      <section
        id="rider-page-history"
        class="rider-page"
        aria-labelledby="history-heading"
        tabindex="-1"
        hidden
      >
        <div class="rider-page-header">
          <div>
            <h3 id="history-heading">Delivery History</h3>
            <p class="rider-page-sub">All completed deliveries</p>
          </div>
          <fieldset class="rider-filter-row" aria-label="Date range filter">
            <legend class="sr-only">Filter by date range</legend>
            <div class="form-group">
              <label for="hist-date-from">From</label>
              <input
                type="date"
                id="hist-date-from"
                class="form-input rider-filter-input"
                onchange="loadHistory()"
              />
            </div>
            <div class="form-group">
              <label for="hist-date-to">To</label>
              <input
                type="date"
                id="hist-date-to"
                class="form-input rider-filter-input"
                onchange="loadHistory()"
              />
            </div>
          </fieldset>
        </div>

        <div class="panel-body no-pad" role="region" aria-label="Delivery history table" tabindex="0">
          <table class="data-table" aria-label="Delivery history">
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Customer</th>
                <th scope="col">Location</th>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
                <th scope="col">Total</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody id="history-tbody" aria-live="polite" aria-relevant="additions removals">
              <!-- Populated by JS -->
            </tbody>
          </table>
        </div>

      </section><!-- /history -->


      <!-- ════════════════════════════════════════════
           PAGE: PERFORMANCE
      ════════════════════════════════════════════ -->
      <section
        id="rider-page-performance"
        class="rider-page"
        aria-labelledby="perf-heading"
        tabindex="-1"
        hidden
      >
        <div class="rider-page-header">
          <div>
            <h3 id="perf-heading">My Performance</h3>
            <p class="rider-page-sub">Delivery stats and completion rates</p>
          </div>
          <fieldset class="rider-filter-row" aria-label="Performance date range">
            <legend class="sr-only">Filter by date range</legend>
            <div class="form-group">
              <label for="perf-date-from">From</label>
              <input type="date" id="perf-date-from" class="form-input rider-filter-input" onchange="loadPerformance()"/>
            </div>
            <div class="form-group">
              <label for="perf-date-to">To</label>
              <input type="date" id="perf-date-to" class="form-input rider-filter-input" onchange="loadPerformance()"/>
            </div>
          </fieldset>
        </div>

        <div id="perf-stats-bar" class="rider-summary-bar" aria-live="polite"><!-- JS --></div>

        <h4 class="section-subheading">Daily Breakdown</h4>
        <div class="rider-table-wrap" role="region" aria-label="Daily delivery breakdown" tabindex="0">
          <table class="rider-table" aria-label="Daily delivery stats">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Total</th>
                <th scope="col">Completed</th>
                <th scope="col">Success Rate</th>
              </tr>
            </thead>
            <tbody id="perf-daily-tbody" aria-live="polite"></tbody>
          </table>
        </div>

      </section><!-- /performance -->


      <!-- ════════════════════════════════════════════
           PAGE: SETTINGS / PROFILE
      ════════════════════════════════════════════ -->
      <section
        id="rider-page-settings"
        class="rider-page"
        aria-labelledby="settings-heading"
        tabindex="-1"
        hidden
      >
        <div class="rider-page-header">
          <div>
            <h3 id="settings-heading">Settings</h3>
            <p class="rider-page-sub">Update your contact info and password</p>
          </div>
        </div>

        <div class="settings-grid">

          <!-- Profile card -->
          <div class="rider-panel" aria-labelledby="settings-profile-title">
            <div class="panel-header">
              <h2 class="panel-title" id="settings-profile-title">
                <span aria-hidden="true">👤</span> Profile
              </h2>
            </div>
            <div class="panel-body">
            <div id="settings-profile-info" class="settings-profile-info"><!-- JS --></div>

            <div class="form-group">
              <label for="settings-phone">Phone Number</label>
              <input type="tel" id="settings-phone" class="form-input" placeholder="+63 9XX XXX XXXX" autocomplete="tel"/>
            </div>
            <p id="settings-phone-error" class="form-error" role="alert" hidden></p>
            <p id="settings-phone-success" class="form-success" role="status" hidden></p>
              <button class="btn-primary" onclick="savePhone()" type="button">Save Phone Number</button>
            </div>
          </div>

          <!-- Password card -->
          <div class="settings-card" aria-labelledby="settings-pass-title">
            <h4 class="settings-card-title" id="settings-pass-title">
              <span aria-hidden="true">🔒</span> Change Password
            </h4>
            <div class="form-group">
              <label for="settings-cur-pass">Current Password</label>
              <input type="password" id="settings-cur-pass" class="form-input" autocomplete="current-password"/>
            </div>
            <div class="form-group">
              <label for="settings-new-pass">New Password <small>(min 8 characters)</small></label>
              <input type="password" id="settings-new-pass" class="form-input" autocomplete="new-password"/>
            </div>
            <div class="form-group">
              <label for="settings-confirm-pass">Confirm New Password</label>
              <input type="password" id="settings-confirm-pass" class="form-input" autocomplete="new-password"/>
            </div>
            <p id="settings-pass-error" class="form-error" role="alert" hidden></p>
            <p id="settings-pass-success" class="form-success" role="status" hidden></p>
            <button class="btn-primary" onclick="savePassword()" type="button">Update Password</button>
          </div>

          <!-- Cash Remittance card -->
          <div class="settings-card settings-card-full" aria-labelledby="settings-remit-title">
            <h4 class="settings-card-title" id="settings-remit-title">
              <span aria-hidden="true">💰</span> Remit COD Cash
            </h4>
            <p class="rider-page-sub">
              Submit the total COD cash you are handing to the admin at the end of your shift.
            </p>
            <div class="remit-form-row">
              <div class="form-group">
                <label for="remit-amount">Amount (₱)</label>
                <input type="number" id="remit-amount" class="form-input" min="0" step="0.01" placeholder="0.00"/>
              </div>
              <div class="form-group">
                <label for="remit-notes">Notes (optional)</label>
                <input type="text" id="remit-notes" class="form-input" placeholder="e.g. Shift ending 3pm"/>
              </div>
            </div>
            <p id="remit-error"   class="form-error"   role="alert"  hidden></p>
            <p id="remit-success" class="form-success"  role="status" hidden></p>
            <button class="btn-primary" onclick="submitRemittance()" type="button">
              <span aria-hidden="true">💸</span> Submit Remittance
            </button>

            <h5>Recent Remittances</h5>
            <div id="remit-history" class="remit-history"><!-- JS --></div>
          </div>

        </div><!-- /settings-grid -->

      </section><!-- /settings -->

    </main><!-- /rider-pages-wrapper -->
  </div><!-- /rider-main-content -->
</div><!-- /rider-app -->


<!-- ══════════════════════════════════════════════════════
     ORDER DETAIL MODAL  (slide-up drawer)
══════════════════════════════════════════════════════ -->
<div
  id="rider-order-modal-overlay"
  class="rider-modal-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="rider-modal-title"
  aria-hidden="true"
  onclick="if(event.target===this)closeOrderModal()"
>
  <div class="rider-modal" role="document">
    <div class="rider-modal-drag-handle" aria-hidden="true"></div>

<div class="modal-header">
      <h3 id="rider-modal-title" tabindex="-1">Order Details</h3>
      <button
        id="rider-modal-close"
        class="modal-close-btn"
        onclick="closeOrderModal()"
        aria-label="Close order details"
        type="button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body" id="rider-modal-body">
      </div>

    <div class="modal-footer" id="rider-modal-footer">
      </div>
  </div>
</div>


<!-- ══════════════════════════════════════════════════════
     COMPLETE DELIVERY MODAL  (POD + payment confirmation)
══════════════════════════════════════════════════════ -->
<div
  id="rider-complete-modal-overlay"
  class="rider-modal-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="rider-complete-modal-title"
  aria-hidden="true"
  onclick="if(event.target===this)closeCompleteModal()"
>
  <div class="rider-modal" role="document">
    <div class="rider-modal-drag-handle" aria-hidden="true"></div>

    <header class="rider-modal-header">
      <h2 class="rider-modal-title" id="rider-complete-modal-title">Complete Delivery</h2>
      <button
        class="rider-modal-close"
        onclick="closeCompleteModal()"
        aria-label="Close complete delivery dialog"
        type="button"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </header>

    <div class="rider-modal-body" id="rider-complete-modal-body">
      <!-- Populated by JS -->
    </div>

    <footer class="rider-modal-footer" id="rider-complete-modal-footer">
      <!-- Populated by JS -->
    </footer>
  </div>
</div>


<!-- ══════════════════════════════════════════════════════
     GENERIC CONFIRM DIALOG  (Start Delivery confirmation)
══════════════════════════════════════════════════════ -->
<div
  id="rider-confirm-overlay"
  class="rider-confirm-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="rider-confirm-title"
  aria-hidden="true"
  onclick="if(event.target===this)closeConfirm()"
>
  <div class="rider-confirm-box">
    <div id="rider-confirm-icon" class="rider-confirm-icon" aria-hidden="true">🚴</div>
    <h2 class="rider-confirm-title" id="rider-confirm-title">Confirm Action</h2>
    <p class="rider-confirm-body" id="rider-confirm-body">Are you sure?</p>
    <div id="rider-confirm-amount" class="rider-confirm-amount" hidden>
      <div class="amount-label">Amount to collect</div>
      <div class="amount-value" id="rider-confirm-amount-val">₱0.00</div>
    </div>
    <div class="rider-confirm-actions">
      <button
        class="btn-outline"
        onclick="closeConfirm()"
        type="button"
      >Cancel</button>
      <button
        id="rider-confirm-ok"
        class="btn-primary"
        onclick="confirmOk()"
        type="button"
      >Confirm</button>
    </div>
  </div>
</div>


<!-- ══════════════════════════════════════════════════════
     REPORT ISSUE MODAL  (Failed Delivery)
══════════════════════════════════════════════════════ -->
<div
  id="rider-issue-modal-overlay"
  class="rider-modal-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="rider-issue-modal-title"
  aria-hidden="true"
  onclick="if(event.target===this)closeIssueModal()"
>
  <div class="rider-modal" role="document">
    <div class="rider-modal-drag-handle" aria-hidden="true"></div>
    <header class="rider-modal-header">
      <h2 class="rider-modal-title" id="rider-issue-modal-title">Report Failed Delivery</h2>
      <button class="rider-modal-close" onclick="closeIssueModal()" aria-label="Close" type="button">
        <span aria-hidden="true">✕</span>
      </button>
    </header>
    <div class="rider-modal-body">
      <p class="rider-page-sub">
        Use this only if the delivery cannot be completed. The order will be cancelled and the customer will be notified.
      </p>
      <div class="form-group">
        <label for="issue-reason">Reason <span aria-hidden="true">*</span></label>
        <select id="issue-reason" class="form-input" aria-required="true">
          <option value="">— Select a reason —</option>
          <option value="Customer Unreachable">Customer Unreachable</option>
          <option value="Wrong Address">Wrong Address</option>
          <option value="Customer Refused Delivery">Customer Refused Delivery</option>
          <option value="Damaged Goods">Damaged Goods</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label for="issue-notes">Additional Notes</label>
        <textarea id="issue-notes" class="form-input" rows="3" placeholder="Optional: describe what happened"></textarea>
      </div>
      <div id="partial-delivery-container" hidden></div>
      <p id="issue-error" class="form-error" role="alert" hidden></p>
    </div>
    <footer class="rider-modal-footer">
      <button class="btn-outline" onclick="closeIssueModal()" type="button">Cancel</button>
      <button class="btn-danger" id="issue-confirm-btn" onclick="submitFailedDelivery()" type="button">
        <span aria-hidden="true">⚠️</span> Confirm Failed Delivery
      </button>
    </footer>
  </div>
</div>


<!-- ══════════════════════════════════════════════════════
     END OF SHIFT / HUB CHECK-IN MODAL
══════════════════════════════════════════════════════ -->
<div
  id="rider-shift-modal-overlay"
  class="rider-modal-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="rider-shift-modal-title"
  aria-hidden="true"
  onclick="if(event.target===this)closeShiftModal()"
>
  <div class="rider-modal" role="document">
    <div class="rider-modal-drag-handle" aria-hidden="true"></div>
    <header class="rider-modal-header">
      <h2 class="rider-modal-title" id="rider-shift-modal-title">End of Shift Check-In</h2>
      <button class="rider-modal-close" id="rider-shift-modal-close" onclick="closeShiftModal()" aria-label="Close" type="button">
        <span aria-hidden="true">✕</span>
      </button>
    </header>
    <div class="rider-modal-body" id="rider-shift-modal-body"><!-- JS --></div>
    <footer class="rider-modal-footer" id="rider-shift-modal-footer">
      <button class="btn-outline" type="button" onclick="closeShiftModal()">Close</button>
    </footer>
  </div>
</div>


<!-- ══════════════════════════════════════════════════════
     TOAST NOTIFICATION CONTAINER
══════════════════════════════════════════════════════ -->
<div
  id="portal-toast-stack" class="portal-toast-stack"
  aria-live="polite"
  aria-atomic="false"
  aria-label="Notifications"
  role="status"
></div>

<!-- Print delivery slip (hidden on screen, prints only) -->
<div id="print-slip" class="print-only" aria-hidden="true"></div>

<!-- JS -->
<script src="js/shared/constants.js"></script>
<script src="js/shared/utils.js"></script>
<script src="js/shared/uiHelpers.js"></script>
<script src="js/shared/apiService.js"></script>
<script src="js/controllers/rider.js"></script>
</body>
</html>