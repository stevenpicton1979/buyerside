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
  const url = `${ZONEIQ.URL}/api/zone-lookup?address=${encodeURIComponent(address)}`;

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

  // Normalise response — build safe overlay object regardless of partial response
  // ZoneIQ returns HTTP 200 with meta.partial: true when zone not fully seeded
  const partial = raw.meta?.partial === true;
  const overlays = raw.overlays || {};

  return {
    ok: true,
    partial,
    address: raw.address || address,
    zone: {
      code: raw.zone?.code || null,
      name: raw.zone?.name || null,
      council: raw.zone?.council || null,
    },
    overlays: {
      flood: normaliseFlood(overlays.flood, raw.meta?.state),
      bushfire: normaliseBushfire(overlays.bushfire),
      heritage: normaliseHeritage(overlays.heritage),
      character: normaliseCharacter(overlays.character),
      noise: normaliseNoise(overlays.noise),
      schools: normaliseSchools(overlays.schools),
    },
    meta: {
      state: raw.meta?.state || 'QLD',
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
  if (!flood || flood.affected === false) return { affected: false };
  if (flood.affected !== true) return { affected: false };

  // QLD: FPA codes (R1, R2A, R3, R4, R5)
  // NSW: binary + LEP reference
  // VIC: LSIO/FO/SBO overlay type
  const s = (state || 'QLD').toUpperCase();

  if (s === 'QLD') {
    return {
      affected: true,
      code: flood.code || null,       // e.g. "FHA_R2A"
      category: flood.category || null, // e.g. "Medium flood hazard"
      plain: floodPlainEnglish(flood.code),
    };
  }
  if (s === 'NSW') {
    return {
      affected: true,
      code: null,
      category: null,
      plain: 'Flood affected — refer to local LEP for details.',
      lep: flood.lep || null,
    };
  }
  if (s === 'VIC') {
    return {
      affected: true,
      code: flood.overlay_type || null, // LSIO, FO, SBO
      category: null,
      plain: vicFloodPlain(flood.overlay_type),
    };
  }
  return { affected: true, code: flood.code || null, plain: 'Flood overlay present.' };
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
  if (!bushfire || bushfire.affected === false) return { affected: false };
  return {
    affected: true,
    category: bushfire.category || null,
    plain: bushfire.category
      ? `Bushfire hazard — ${bushfire.category}.`
      : 'Bushfire overlay present.',
  };
}

function normaliseHeritage(heritage) {
  if (!heritage || heritage.listed === false) return { listed: false };
  return {
    listed: true,
    type: heritage.type || null,   // 'local' | 'state'
    name: heritage.name || null,
    plain: heritage.name
      ? `Heritage listed — ${heritage.name}.`
      : 'Heritage overlay — planning approval likely required for modifications.',
  };
}

function normaliseCharacter(character) {
  if (!character || character.applicable === false) return { applicable: false };
  return {
    applicable: true,
    type: character.type || null,
    plain: 'Character overlay — design standards apply to any extensions or renovations.',
  };
}

function normaliseNoise(noise) {
  if (!noise || noise.affected === false) return { affected: false };
  return {
    affected: true,
    anef: noise.anef || null,   // e.g. 20, 25, 30
    airport: noise.airport || null,
    plain: noise.anef
      ? `Aircraft noise zone ANEF ${noise.anef} — ${noiseImpact(noise.anef)}.`
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
