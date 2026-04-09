'use strict';
// ============================================================
// ClearOffer — ZoneIQ overlay lookup
// ============================================================
// Proxy to zoneiq-sigma.vercel.app. Returns safe defaults if
// ZoneIQ is unavailable or returns partial response.
// NEVER call BCC ArcGIS directly here — fallback only if needed.
// ============================================================

const { ZONEIQ, handleCors } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || address.trim().length < 5) {
    return res.status(400).json({ error: 'address is required' });
  }

  try {
    const result = await fetchZoneIQ(address.trim());
    return res.status(200).json(result);
  } catch (err) {
    console.error('[zone-lookup] error:', err.message);
    return res.status(200).json(safeDefaults(address, err.message));
  }
};

async function fetchZoneIQ(address) {
  const url = `${ZONEIQ.URL}/api/lookup?address=${encodeURIComponent(address)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZONEIQ.TIMEOUT_MS);

  let raw;
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) {
      throw new Error(`ZoneIQ HTTP ${resp.status}`);
    }
    raw = await resp.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('ZoneIQ timeout after 8s');
    throw err;
  }

  // Normalise v2.0.0 response
  // ZoneIQ returns HTTP 200 with meta.partial: true when zone not fully seeded
  // overlays are ALWAYS returned even on partial responses
  if (!raw.success) throw new Error(`ZoneIQ returned success: false`);

  const partial = raw.meta?.partial === true;
  const overlays = raw.overlays || {};

  // Detect state from council name (QLD default for ClearOffer Brisbane launch)
  const council = (raw.zone?.council || '').toLowerCase();
  const state = council.includes('sydney') || council.includes('parramatta') || council.includes('blacktown')
    ? 'NSW'
    : council.includes('melbourne') || council.includes('yarra') || council.includes('port phillip')
    ? 'VIC'
    : 'QLD';

  return {
    ok: true,
    partial,
    address: raw.query?.address_resolved || raw.query?.address_input || address,
    zone: {
      code: raw.zone?.code || null,
      name: raw.zone?.name || null,
      council: raw.zone?.council || null,
    },
    overlays: {
      flood: normaliseFlood(overlays.flood, state),
      bushfire: normaliseBushfire(overlays.bushfire),
      heritage: normaliseHeritage(overlays.heritage),
      character: normaliseCharacter(overlays.character),
      noise: normaliseNoise(overlays.noise),
      schools: normaliseSchools(overlays.schools),
    },
    meta: {
      state,
      partial,
      source: 'zoneiq',
    },
  };
}

// ---- Overlay normalisers ----
// Each returns null if overlay absent, or a structured object.
// ClearOffer displays "No [overlay] found" when null.
// Never crash on unexpected shape.

function normaliseFlood(flood, state) {
  // v2.0.0 field: has_flood_overlay
  if (!flood || !flood.has_flood_overlay) return { affected: false };

  // flood_category = e.g. "FHA_R2A", "FHA_R5", "LSIO", "FO", "SBO"
  // overlay_type   = e.g. "brisbane_river", "overland_flow", "NSW_EPI", "Vicmap_Planning"
  const s = (state || 'QLD').toUpperCase();
  const code = flood.flood_category || null;
  const overlayType = flood.overlay_type || null;

  if (s === 'QLD') {
    return {
      affected: true,
      code,
      category: flood.risk_level || null,
      plain: floodPlainEnglish(code),
    };
  }
  if (s === 'NSW') {
    return {
      affected: true,
      code: null,
      category: null,
      plain: 'Flood affected — refer to local LEP for details.',
      lep: flood.risk_level || null,
    };
  }
  if (s === 'VIC') {
    return {
      affected: true,
      code,           // LSIO, FO, SBO
      category: null,
      plain: vicFloodPlain(code),
    };
  }
  return { affected: true, code, plain: 'Flood overlay present.' };
}

function floodPlainEnglish(code) {
  const map = {
    'FHA_R1':  'High flood hazard — significant inundation risk. Review BCC flood maps.',
    'FHA_R2A': 'High-medium flood hazard — regular flood risk.',
    'FHA_R3':  'Medium flood hazard — moderate flood risk.',
    'FHA_R4':  'Low-medium flood hazard — infrequent flood risk.',
    'FHA_R5':  'Low flood hazard — rare flood risk.',
    'OFA':     'Overland flow path — stormwater drainage risk.',
  };
  return map[code] || (code ? `Flood overlay: ${code}` : 'Flood overlay present — refer to council flood map.');
}

function vicFloodPlain(type) {
  const map = {
    'LSIO': 'Land Subject to Inundation Overlay — flood risk present.',
    'FO':   'Floodway Overlay — significant flood risk.',
    'SBO':  'Special Building Overlay — overland flow risk.',
  };
  return map[type] || 'Flood overlay present — refer to local planning scheme.';
}

function normaliseBushfire(bushfire) {
  // v2.0.0 field: has_bushfire_overlay
  if (!bushfire || !bushfire.has_bushfire_overlay) return { affected: false };
  const cat = bushfire.intensity_class || null;
  return {
    affected: true,
    category: cat,
    plain: cat ? `Bushfire hazard — ${cat}.` : 'Bushfire overlay present.',
  };
}

function normaliseHeritage(heritage) {
  // v2.0.0 field: is_heritage
  if (!heritage || !heritage.is_heritage) return { listed: false };
  const name = heritage.heritage_name || null;
  const type = heritage.heritage_type || null;
  return {
    listed: true,
    type: type ? (type.toLowerCase().includes('state') ? 'state' : 'local') : null,
    name,
    plain: name
      ? `Heritage listed — ${name}.`
      : 'Heritage overlay — planning approval likely required for modifications.',
  };
}

function normaliseCharacter(character) {
  // v2.0.0 field: has_character_overlay
  if (!character || !character.has_character_overlay) return { applicable: false };
  return {
    applicable: true,
    type: character.overlay_type || null,
    plain: 'Character overlay — design standards apply to any extensions or renovations.',
  };
}

function normaliseNoise(noise) {
  // v2.0.0 field: has_noise_overlay, anef_contour, airport
  if (!noise || !noise.has_noise_overlay) return { affected: false };
  const anef = noise.anef_contour ? parseInt(noise.anef_contour, 10) || noise.anef_contour : null;
  return {
    affected: true,
    anef,
    airport: noise.airport || null,
    plain: anef
      ? `Aircraft noise zone ANEF ${anef} — ${noiseImpact(anef)}.`
      : 'Aircraft noise overlay present.',
  };
}

function noiseImpact(anef) {
  if (anef >= 35) return 'significant noise impact, restrictions on some residential uses';
  if (anef >= 30) return 'moderate noise impact';
  if (anef >= 25) return 'some noise impact';
  return 'low noise impact';
}

function normaliseSchools(schools) {
  if (!schools) return { found: false };

  // ZoneIQ may return schools as:
  // (a) { primary: {...}, secondary: {...} }       ← object shape
  // (b) [{ type: 'primary', name, icsea }, ...]    ← array shape
  // Handle both defensively.

  let primary = null;
  let secondary = null;

  if (Array.isArray(schools)) {
    for (const s of schools) {
      const t = (s.type || s.school_type || '').toLowerCase();
      if (!primary && t.includes('primary')) primary = s;
      if (!secondary && t.includes('secondary')) secondary = s;
    }
  } else {
    primary   = schools.primary   || null;
    secondary = schools.secondary || null;
  }

  if (!primary && !secondary) return { found: false };

  return {
    found: true,
    primary: primary ? {
      name:  primary.name  || primary.school_name || null,
      icsea: primary.icsea || primary.icsea_score || null,
      plain: icseaPlain(primary.icsea || primary.icsea_score),
    } : null,
    secondary: secondary ? {
      name:  secondary.name  || secondary.school_name || null,
      icsea: secondary.icsea || secondary.icsea_score || null,
      plain: icseaPlain(secondary.icsea || secondary.icsea_score),
    } : null,
  };
}

function icseaPlain(icsea) {
  if (!icsea) return null;
  if (icsea >= 1100) return 'Top 15% nationally';
  if (icsea >= 1050) return 'Above average';
  if (icsea >= 950)  return 'Average';
  return 'Below average';
}

// Safe defaults when ZoneIQ is unavailable
function safeDefaults(address, reason) {
  console.warn(`[zone-lookup] returning safe defaults. Reason: ${reason}`);
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
