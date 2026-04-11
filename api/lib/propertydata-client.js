'use strict';
/**
 * PropertyData Client — shared by zone-lookup.js and buyers-brief.js
 *
 * Sprint 2: ClearOffer switchover.
 * Replaces direct BCC ArcGIS + ZoneIQ calls with a single POST to PropertyData.
 * Maps the flat PropertyData fields array back to ClearOffer's nested response shape
 * so all downstream code (report rendering, Haiku prompt, Stripe) is unchanged.
 *
 * IMPORTANT: This module is the ONLY place that knows about PropertyData's response shape.
 * If PropertyData adds new fields, update the mapping here — nowhere else in ClearOffer.
 */

const PROPERTYDATA_URL = process.env.PROPERTYDATA_URL || 'http://localhost:3002';
const PROPERTYDATA_SECRET = process.env.PROPERTYDATA_SECRET;

/**
 * Fetch property data from PropertyData API and map to ClearOffer shape.
 *
 * @param {string} address - Full address string
 * @param {string} tier - 'free' or 'paid' (controls which fields are returned)
 * @returns {Object} ClearOffer-shaped response (same shape as old zone-lookup.js)
 */
async function fetchPropertyData(address, tier = 'free') {
  const headers = { 'Content-Type': 'application/json' };
  if (PROPERTYDATA_SECRET) {
    headers['Authorization'] = `Bearer ${PROPERTYDATA_SECRET}`;
  }

  const resp = await fetch(`${PROPERTYDATA_URL}/api/lookup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ address, tier }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`PropertyData HTTP ${resp.status}`);
  }

  const pd = await resp.json();

  // Build key → value lookup from flat fields array
  const f = {};
  for (const field of pd.fields || []) {
    f[field.key] = field.value;
  }

  return mapToClearOfferShape(address, f, pd);
}

// ── Response mapping ─────────────────────────────────────────────

function mapToClearOfferShape(address, f, pd) {
  // ── Flood (rebuild from 6 flat fields) ───────────────────────
  const creekFPA = f.flood_creek_fpa || [];
  const riverFPA = f.flood_river_fpa || [];
  const floodCategories = [...creekFPA, ...riverFPA];
  const overlandFlow = f.flood_overland_flow === true;
  const aep1Pct = f.flood_aep_1pct === true;
  const flooded2011 = f.flood_2011 === true;
  const flooded2022 = f.flood_2022 === true;

  // ── Schools ──────────────────────────────────────────────────
  const primaryName   = f.school_primary   || null;
  const secondaryName = f.school_secondary || null;
  const primaryIcsea  = f.school_primary_icsea  || null;
  const secondaryIcsea = f.school_secondary_icsea || null;

  // ── Overlays (PropertyData returns structured objects) ────────
  const bushfire  = addSource(f.bushfire_hazard,   { affected: false, plain: 'No bushfire overlay.' });
  const heritage  = addSource(f.heritage_listing,  { listed: false, plain: 'Not heritage listed.' });
  const character = addSource(f.character_overlay,  { applicable: false, plain: 'No character overlay.' });
  const koala     = addSource(f.koala_habitat,      { affected: false, plain: 'No koala habitat overlay.' });
  const acidSulfateSoils = addSource(f.acid_sulfate, { affected: false, plain: 'No acid sulfate soils overlay.' });
  const biodiversity = addSource(f.biodiversity,    { affected: false, plain: 'No biodiversity overlay.' });
  const waterwayCorridor = addSource(f.waterway_corridor, { affected: false, plain: 'No waterway corridor overlay.' });
  const wetlands = addSource(f.wetlands,            { affected: false, plain: 'No wetlands overlay.' });
  const petroleumPipeline = addSource(f.petroleum_pipeline, { affected: false, plain: 'No petroleum pipeline overlay.' });

  // ── Road hierarchy ───────────────────────────────────────────
  const roadHierarchy = f.road_hierarchy
    ? { ...f.road_hierarchy, source: 'BCC CityPlan' }
    : { onArterial: false, roadType: 'Local / residential', source: 'BCC CityPlan', plain: 'Local residential street — no arterial road designation.' };

  // ── High voltage (merge two fields into one object) ──────────
  const hvPowerline = f.hv_powerline || {};
  const hvEasement  = f.hv_easement  || {};
  const highVoltage = {
    powerlineNearby: hvPowerline.nearby || false,
    easementOnLot:   hvEasement.onLot   || false,
    source:          'BCC CityPlan',
    plain: (hvPowerline.nearby || hvEasement.onLot)
      ? 'High voltage powerline or easement affects this property — development restrictions apply, and some buyers and lenders treat this as a risk factor. Verify with Energex before purchasing.'
      : 'No high voltage powerline or easement overlay.',
  };

  // ── Noise (PropertyData only returns boolean — rebuild object) ─
  const noiseAffected = f.aircraft_noise_anef === true;
  const noise = {
    affected: noiseAffected,
    plain: noiseAffected
      ? 'Aircraft noise overlay present. Check ANEF contour at airservicesaustralia.com.'
      : 'No ANEF aircraft noise contour detected. ANEF overlays capture formally modelled corridors only — operational flight paths can affect properties outside this contour. Check actual flight activity at webtrak.emsbk.com/bne3 before purchasing.',
  };

  return {
    ok: true,
    partial: (pd.meta?.sources_failed?.length || 0) > 0,
    address: pd.address || address,
    zone: {
      code:    f.zone_code || null,
      name:    f.zone_name || null,
      council: null, // PropertyData doesn't return council — acceptable for Brisbane-only
    },
    overlays: {
      flood: {
        affected:       floodCategories.length > 0 || overlandFlow,
        source:         'BCC CityPlan',
        categories:     floodCategories,
        overlandFlow,
        within1PctAEP:  aep1Pct,
        floodedFeb2022: flooded2022,
        floodedJan2011: flooded2011,
        plain: buildFloodPlain(floodCategories, overlandFlow, aep1Pct, flooded2022, flooded2011),
      },
      bushfire,
      heritage,
      character,
      noise,
      schools: {
        found: !!(primaryName || secondaryName),
        primary: primaryName ? {
          name:  primaryName,
          icsea: primaryIcsea,
          plain: icseaPlain(primaryIcsea),
        } : null,
        secondary: secondaryName ? {
          name:  secondaryName,
          icsea: secondaryIcsea,
          plain: icseaPlain(secondaryIcsea),
        } : null,
      },
      koala,
      acidSulfateSoils,
      biodiversity,
      roadHierarchy,
      waterwayCorridor,
      wetlands,
      highVoltage,
      petroleumPipeline,
    },
    derivedRoadType: f.derived_road_type || 'quiet_street',
    parcel: f.lot_plan ? {
      lotPlan:   f.lot_plan,
      lotAreaM2: f.lot_area,
    } : null,
    gnaf: null, // GNAF moved to PropertyData — not yet implemented there
    meta: {
      state:   'QLD',
      partial: (pd.meta?.sources_failed?.length || 0) > 0,
      source:  'propertydata',
      duration_ms: pd.meta?.duration_ms || null,
    },
  };
}

// ── Helper: add source field to overlay objects ─────────────────

function addSource(overlayValue, defaults) {
  if (!overlayValue) return { ...defaults, source: 'BCC CityPlan' };
  return { ...overlayValue, source: 'BCC CityPlan' };
}

// ── Flood plain-English builder (copied from old zone-lookup.js) ─

function buildFloodPlain(categories, overlandFlow, aep1Pct, flooded2022, flooded2011) {
  const parts = [];
  if (categories.length) parts.push(categories.join(' + '));
  if (overlandFlow)      parts.push('Overland flow flood area');

  let plain = parts.length
    ? parts.join(' + ') + ' (BCC City Plan).'
    : 'No flood overlay identified (BCC City Plan — lot boundary verified).';

  if (aep1Pct) {
    plain += ' Within 1-in-100 year flood extent.';
  }

  if (flooded2022 || flooded2011) {
    const events = [
      flooded2011 ? 'January 2011' : null,
      flooded2022 ? 'February 2022' : null,
    ].filter(Boolean);
    plain += ` Recorded flooding in: ${events.join(', ')}.`;
  } else if (parts.length > 0) {
    plain += ' Not recorded as flooded in the January 2011 or February 2022 events.';
  }

  return plain;
}

// ── ICSEA plain-English label ───────────────────────────────────

function icseaPlain(icsea) {
  if (!icsea) return null;
  if (icsea >= 1100) return 'Top 15% nationally';
  if (icsea >= 1050) return 'Above average';
  if (icsea >= 950)  return 'Average';
  return 'Below average';
}

// ── Safe defaults when PropertyData is unreachable ──────────────

function safeDefaults(address, reason) {
  console.warn(`[propertydata-client] returning safe defaults. Reason: ${reason}`);
  return {
    ok: false,
    partial: true,
    address,
    zone: { code: null, name: null, council: null },
    overlays: {
      flood:     { affected: false, _unavailable: true },
      bushfire:  { affected: false, _unavailable: true },
      heritage:  { listed: false,   _unavailable: true },
      character: { applicable: false, _unavailable: true },
      noise:     { affected: false, _unavailable: true },
      schools:   { found: false,    _unavailable: true },
    },
    meta: { state: 'QLD', partial: true, source: 'unavailable', reason },
  };
}

module.exports = { fetchPropertyData, safeDefaults };
