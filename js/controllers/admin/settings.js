// admin/settings.js — admin portal: settings page and operating hours
'use strict';

/* ════════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════════*/

async function loadSettings() {
  // Do NOT call setLoading('settings-content', …) — that replaces the entire
  // innerHTML and destroys settings-hours-wrap / settings-zones-wrap /
  // settings-slots-wrap before the render helpers can find them.
  setLoading('settings-hours-wrap', 'Loading…');
  setLoading('settings-zones-wrap', 'Loading…');
  setLoading('settings-slots-wrap', 'Loading…');
  const res = await apiGet('settings');
  if (!res.success) { document.getElementById('settings-content').innerHTML = errorHTML(res.message); return; }
  renderHours(res.data?.hours || []);
  renderZones(res.data?.zones || []);
  renderSlots(res.data?.slots || []);
}

function renderHours(hours) {
  const wrap = document.getElementById('settings-hours-wrap');
  if (!wrap) return;
  const rows = hours.map(h => `<tr>
    <td>${DAY_NAMES[h.day_of_week] || h.day_of_week}</td>
    <td>${fmtTime12(h.open_time)} — ${fmtTime12(h.close_time)}</td>
    <td>
      <label class="toggle-switch">
        <input type="checkbox" ${h.is_active ? 'checked' : ''} onchange="toggleHour(${h.day_of_week}, this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </td>
    <td><button class="btn-action" onclick='openHourModal(${JSON.stringify(h)})'>✏️</button></td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Day</th><th>Hours</th><th>Active</th><th>Edit</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function toggleHour(dayOfWeek, isActive) {
  const res = await apiPost('save_hours', { day_of_week: dayOfWeek, is_active: isActive ? 1 : 0 });
  if (!res.success) { toast(res.message, 'error'); }
}

function renderZones(zones) {
  const wrap = document.getElementById('settings-zones-wrap');
  if (!wrap) return;
  const rows = zones.map(z => `<tr>
    <td>${escHtml(z.municipality_name)}</td>
    <td>${fmtPrice(z.delivery_fee)}</td>
    <td>
      <button class="btn-action" onclick='openZoneModal(${JSON.stringify(z)})'>✏️</button>
      <button class="btn-action btn-action-red" onclick="deleteZone(${z.zone_id})">✕</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Municipality</th><th>Fee</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <button class="btn-outline" style="margin-top:.75rem" onclick="openZoneModal()">+ Add Zone</button>`;
}

let _zoneId = 0;

function openZoneModal(zoneObj = null) {
  _zoneId = zoneObj?.zone_id ?? 0;
  document.getElementById('zone-modal-title').textContent = _zoneId ? 'Edit Delivery Zone' : 'Add Delivery Zone';
  document.getElementById('zone-muni-id').value = zoneObj?.municipality_id || '';
  document.getElementById('zone-fee-input').value = zoneObj?.delivery_fee || '';
  document.getElementById('zone-form-error').style.display = 'none';
  openModal('zone-modal', 'zone-modal-close');
}

async function confirmSaveZone() {
  const errEl = document.getElementById('zone-form-error');
  errEl.style.display = 'none';
  const body = {
    zone_id: _zoneId,
    municipality_id: document.getElementById('zone-muni-id').value,
    delivery_fee: document.getElementById('zone-fee-input').value,
  };
  if (!body.municipality_id || body.delivery_fee === '') {
    errEl.textContent = 'Municipality and fee are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_zone', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Zone saved.', 'success');
  closeModal('zone-modal');
  loadSettings();
}

async function deleteZone(id) {
  if (!confirm('Delete this delivery zone?')) return;
  const res = await apiPost('delete_zone', { zone_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Zone deleted.', 'success');
  loadSettings();
}

function renderSlots(slots) {
  const wrap = document.getElementById('settings-slots-wrap');
  if (!wrap) return;
  const rows = slots.map(s => `<tr>
    <td>${escHtml(s.slot_label)}</td>
    <td>${fmtTime12(s.start_time)} — ${fmtTime12(s.end_time)}</td>
    <td><span class="status-badge ${s.is_active ? 'status-Completed' : 'status-Cancelled'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
    <td>
      <button class="btn-action" onclick='openSlotModal(${JSON.stringify(s)})'>✏️</button>
      <button class="btn-action btn-action-red" onclick="deleteSlot(${s.slot_id})">✕</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>Label</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <button class="btn-outline" style="margin-top:.75rem" onclick="openSlotModal()">+ Add Slot</button>`;
}

let _slotId = 0;

function openSlotModal(slotObj = null) {
  _slotId = slotObj?.slot_id ?? 0;
  document.getElementById('slot-modal-title').textContent = _slotId ? 'Edit Time Slot' : 'Add Time Slot';
  document.getElementById('slot-label-input').value = slotObj?.slot_label || '';
  document.getElementById('slot-start-input').value = slotObj?.start_time || '';
  document.getElementById('slot-end-input').value = slotObj?.end_time || '';
  document.getElementById('slot-active-chk').checked = slotObj?.is_active ?? true;
  document.getElementById('slot-form-error').style.display = 'none';
  openModal('slot-modal', 'slot-modal-close');
}

async function confirmSaveSlot() {
  const errEl = document.getElementById('slot-form-error');
  errEl.style.display = 'none';
  const body = {
    slot_id: _slotId,
    slot_label: document.getElementById('slot-label-input').value.trim(),
    start_time: document.getElementById('slot-start-input').value,
    end_time: document.getElementById('slot-end-input').value,
    is_active: document.getElementById('slot-active-chk').checked ? 1 : 0,
  };
  if (!body.slot_label || !body.start_time || !body.end_time) {
    errEl.textContent = 'All fields are required.'; errEl.style.display = ''; return;
  }
  const res = await apiPost('save_slot', body);
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Slot saved.', 'success');
  closeModal('slot-modal');
  loadSettings();
}

async function deleteSlot(id) {
  if (!confirm('Delete this time slot?')) return;
  const res = await apiPost('delete_slot', { slot_id: id });
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Slot deleted.', 'success');
  loadSettings();
}

/* ── Operational Hours Edit ─────────────────────────────────*/

let _hourDayOfWeek = -1;

function openHourModal(hourObj) {
  _hourDayOfWeek = hourObj.day_of_week;
  document.getElementById('hour-modal-title').textContent =
    `Edit Hours — ${DAY_NAMES[_hourDayOfWeek] || _hourDayOfWeek}`;
  document.getElementById('hour-open-input').value = hourObj.open_time || '';
  document.getElementById('hour-close-input').value = hourObj.close_time || '';
  document.getElementById('hour-form-error').style.display = 'none';
  openModal('hour-modal', 'hour-modal-close');
}

async function confirmSaveHour() {
  const errEl = document.getElementById('hour-form-error');
  errEl.style.display = 'none';
  const openTime = document.getElementById('hour-open-input').value;
  const closeTime = document.getElementById('hour-close-input').value;
  if (!openTime || !closeTime) {
    errEl.textContent = 'Both open and close times are required.';
    errEl.style.display = '';
    return;
  }
  const res = await apiPost('save_hours', {
    day_of_week: _hourDayOfWeek,
    open_time: openTime,
    close_time: closeTime,
  });
  if (!res.success) { errEl.textContent = res.message; errEl.style.display = ''; return; }
  toast('Hours updated.', 'success');
  closeModal('hour-modal');
  loadSettings();
}

