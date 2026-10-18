// customer/addressData.js — customer portal: Albay geo data loader, address dropdown helpers, and toast shorthand
'use strict';

/* ════════════════════════════════════════════════════════════
   ALBAY ADDRESS DATA
═══════════════════════════════════════════════════════════════*/

// ALBAY_DATA is now loaded from the API on first use.
// Use loadGeoData() below; do not reference ALBAY_DATA directly.
let ALBAY_DATA = {};

let _geoDataPromise = null;
async function loadGeoData() {
  if (Object.keys(ALBAY_DATA).length > 0) return; // already loaded
  if (_geoDataPromise) return _geoDataPromise;     // in-flight — reuse same promise
  _geoDataPromise = (async () => {
  try {
    const res = await apiFetch(apiUrl('geo_data'));
    if (res.success && Array.isArray(res.data)) {
      res.data.forEach(muni => {
        ALBAY_DATA[muni.name] = {
          municipality_id: muni.municipality_id,
          barangays: muni.barangays.map(b => ({
            ...b,
            municipality_id: muni.municipality_id,
          }))
        };
      });
    }
  } catch (e) {
    console.error('[PoultryMart] Failed to load geo data', e);
  }
  })();
  return _geoDataPromise;
}

/**
 * Populate the municipality select, then wire barangay cascade.
 * Call once on page load for each form that uses these dropdowns.
 */
async function initMunicipalitySelect(cityId, barangayId) {
  const cityEl = document.getElementById(cityId);
  if (!cityEl) return;
  await loadGeoData();

  const municipalities = Object.entries(ALBAY_DATA).sort((a,b) => a[0].localeCompare(b[0]));
  cityEl.innerHTML = '<option value="">— Select municipality —</option>' +
    municipalities.map(([name, data]) => {
      const mid = data.municipality_id ?? '';
      return `<option value="${name}" data-municipality-id="${mid}">${name}</option>`;
    }).join('');
}

function populateBarangays(cityId, barangayId) {
  const cityEl = document.getElementById(cityId);
  const bgyEl  = document.getElementById(barangayId);
  if (!cityEl || !bgyEl) return;
  const barangays = ALBAY_DATA[cityEl.value]?.barangays || [];
  bgyEl.innerHTML = '<option value="">— Select barangay —</option>' +
    barangays.map(b => {
      // b is either {barangay_id, name} (DB-loaded) or a plain string (fallback)
      const id   = b.barangay_id ?? b;
      const name = b.name        ?? b;
      return `<option value="${id}" data-name="${name}">${name}</option>`;
    }).join('');
}

/**
 * Set both dropdowns to pre-existing values (used when editing a saved address).
 */
async function setAddressDropdowns(cityId, barangayId, cityVal, barangayVal) {
  const cityEl = document.getElementById(cityId);
  if (!cityEl) return;
  // Await geo data — options now come from DB, not a static const
  if (cityEl.options.length <= 1) await initMunicipalitySelect(cityId, barangayId);
  cityEl.value = cityVal || '';
  populateBarangays(cityId, barangayId);
  const bgyEl = document.getElementById(barangayId);
  if (bgyEl) bgyEl.value = barangayVal || '';
}

/* ── Toast shorthand (stacked toast) ────────────────── */
const toast = (msg, type = '') => showToastStack(msg, type, 'toast');

