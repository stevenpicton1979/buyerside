'use strict';
// ============================================================
// ClearOffer — ZoneIQ overlay lookup + BCC direct data
// ============================================================
// Proxies zoneiq-sigma.vercel.app for noise and school catchments.
// BCC ArcGIS (services2.arcgis.com/dEKgZETqwmDAh1rP) is the
// authoritative source for flood, bushfire, heritage, character,
// and lot size — queried using lot-boundary polygon intersection.
// Returns safe defaults if ZoneIQ is unavailable.
// ============================================================

const { ZONEIQ, handleCors } = require('./config');

// Sprint 21: ICSEA scores static lookup
let icseaScores = {};
try {
  icseaScores = require('../data/icsea-scores.json');
} catch {
  console.warn('[zone-lookup] ICSEA scores file not found — run scripts/fetch-icsea.js');
}

function getICSEA(schoolName) {
  if (!schoolName) return null;
  return icseaScores[schoolName.toLowerCase()] || null;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || address.trim().length < 5) {
    return res.status(400).json({ error: 'address is required' });
  }

  try {
    const addr = address.trim();

    // Run ZoneIQ and BCC parcel lookup in parallel
    const [result, bccParcel] = await Promise.all([
      fetchZoneIQ(addr),
      fetchBCCParcel(addr),
    ]);

    // Fetch all BCC overlays using lot-boundary polygon intersection
    const bccOverlays = bccParcel?.geometry ? await fetchBCCOverlays(bccParcel.geometry) : null;

    // BCC overlays override ZoneIQ for all planning overlay data
    if (bccOverlays) {
      result.overlays.flood             = bccOverlays.flood;
      result.overlays.bushfire          = bccOverlays.bushfire;
      result.overlays.heritage          = bccOverlays.heritage;
      result.overlays.character         = bccOverlays.character;
      result.overlays.koala             = bccOverlays.koala;
      result.overlays.acidSulfateSoils  = bccOverlays.acidSulfateSoils;
      result.overlays.biodiversity      = bccOverlays.biodiversity;
      result.overlays.roadHierarchy     = bccOverlays.roadHierarchy;
      result.overlays.waterwayCorridor  = bccOverlays.waterwayCorridor;
      result.overlays.wetlands          = bccOverlays.wetlands;
      result.overlays.highVoltage       = bccOverlays.highVoltage;
      result.overlays.petroleumPipeline = bccOverlays.petroleumPipeline;
      result.derivedRoadType = bccOverlays.roadHierarchy.onArterial ? 'main_road' : 'quiet_street';
    } else {
      // BCC parcel not found — keep ZoneIQ results, patch flood disclaimer
      if (result.overlays.flood && !result.overlays.flood.affected) {
        result.overlays.flood.plain = 'No flood overlay detected. Verify at brisbane.qld.gov.au/floodwise before purchasing.';
      }
    }

    // Add parcel data to response if available
    if (bccParcel) {
      result.parcel = {
        lotPlan:   bccParcel.lotPlan,
        lotAreaM2: bccParcel.lotArea,
      };
    }

    // Sprint 21: Enrich school ICSEA from local lookup data
    if (result.overlays?.schools?.primary?.name) {
      result.overlays.schools.primary.icsea = getICSEA(result.overlays.schools.primary.name);
      result.overlays.schools.primary.plain = icseaPlain(result.overlays.schools.primary.icsea);
    }
    if (result.overlays?.schools?.secondary?.name) {
      result.overlays.schools.secondary.icsea = getICSEA(result.overlays.schools.secondary.name);
      result.overlays.schools.secondary.plain = icseaPlain(result.overlays.schools.secondary.icsea);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[zone-lookup] error:', err.message);
    return res.status(200).json(safeDefaults(address, err.message));
  }
};

// ---- ZoneIQ (noise + school catchments) ----

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
      flood:     normaliseFlood(overlays.flood, state),
      bushfire:  normaliseBushfire(overlays.bushfire),
      heritage:  normaliseHeritage(overlays.heritage),
      character: normaliseCharacter(overlays.character),
      noise:     normaliseNoise(overlays.noise),
      schools:   normaliseSchools(overlays.schools),
    },
    meta: {
      state,
      partial,
      source: 'zoneiq',
    },
  };
}

// ---- BCC parcel lookup ----
// Queries DCDB cadastre by street number + name + suburb.
// Returns lot plan, area, and WGS84 polygon geometry for overlay queries.

function parseAddress(address) {
  // Remove ", Australia" suffix if present (Google Places appends this)
  const clean = address.replace(/,?\s*(QLD|NSW|VIC|SA|WA|TAS|ACT|NT)?,?\s*Australia$/i, '').trim();

  // Extract house number
  const numMatch = clean.match(/^(\d+)/);
  const houseNumber = numMatch?.[1] || null;

  // Extract suburb — last meaningful token before postcode or state
  const suburbMatch = clean.match(/,\s*([^,]+?)\s*(?:QLD|NSW|VIC|SA|WA|TAS|ACT|NT)?\s*\d{4}?\s*$/i);
  const suburb = suburbMatch?.[1]?.trim().toUpperCase() || null;

  // Extract street name — first word(s) after house number, before comma
  const streetMatch = clean.match(/^\d+\s+([^,]+?)(?:\s+(?:St|Street|Rd|Road|Ave|Avenue|Ct|Court|Dr|Drive|Pl|Place|Cres|Crescent|Way|Tce|Terrace|Blvd|Boulevard|Ln|Lane)\b.*?)?(?:,|$)/i);
  const streetName = streetMatch?.[1]?.trim().toUpperCase() || null;

  return { houseNumber, streetName, suburb };
}

async function fetchBCCParcel(address) {
  const { houseNumber, streetName, suburb } = parseAddress(address);

  if (!houseNumber || !streetName || !suburb) {
    console.warn('[zone-lookup] BCC parcel: could not parse address:', address);
    return null;
  }

  const where = `HOUSE_NUMBER=${houseNumber} AND UPPER(CORRIDOR_NAME)='${streetName}' AND UPPER(SUBURB)='${suburb}'`;
  const url = `https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/Property_boundaries_Parcel/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=LOTPLAN%2CLOT_AREA%2CHOUSE_NUMBER%2CCORRIDOR_NAME%2CSUBURB%2CPAR_IND_DESC&returnGeometry=true&outSR=4326&f=json`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`BCC parcel ${resp.status}`);
    const data = await resp.json();

    // Filter out road/reserve parcels, get the residential lot
    const lot = data.features?.find(f =>
      f.attributes.PAR_IND_DESC === 'Lot' && f.attributes.LOT_AREA > 0
    );

    if (!lot) {
      console.warn('[zone-lookup] BCC parcel: no lot found for', address);
      return null;
    }

    console.log('[zone-lookup] BCC parcel found:', lot.attributes.LOTPLAN, lot.attributes.LOT_AREA + 'm²');
    return {
      lotPlan:  lot.attributes.LOTPLAN,
      lotArea:  lot.attributes.LOT_AREA,
      geometry: lot.geometry, // WGS84 polygon rings
    };
  } catch (err) {
    console.warn('[zone-lookup] BCC parcel error:', err.message);
    return null;
  }
}

// ---- BCC overlay queries (lot-boundary polygon intersection) ----

function getLotCentroid(geometry) {
  const ring = geometry.rings?.[0];
  if (!ring || ring.length === 0) return null;
  const sumX = ring.reduce((s, p) => s + p[0], 0);
  const sumY = ring.reduce((s, p) => s + p[1], 0);
  return { x: sumX / ring.length, y: sumY / ring.length };
}

async function fetchBCCOverlays(geometry) {
  if (!geometry?.rings) return null;

  const BASE = 'https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services';
  const geomStr = encodeURIComponent(JSON.stringify({ rings: geometry.rings }));
  const params = `geometry=${geomStr}&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OVL2_DESC%2COVL2_CAT&f=json`;
  // Sprint 15: flood awareness layers use different field names — request all fields
  const awarenessParams = `geometry=${geomStr}&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;

  const centroid = getLotCentroid(geometry);
  const timeout = { signal: AbortSignal.timeout(12000) };

  // All polygon overlay layers — run in parallel
  const [
    floodCreek, floodRiver, bushfire, heritage, charTrad, charDwelling,
    overlandFlow, aep1Pct, hist2022, hist2011,
    koala, acidSulfate, biodiversity,
    waterwayCorridor, wetlands,
    hvEasements, petroleumPipelines,
  ] = await Promise.all([
    // Sprint 14: core overlays
    fetch(`${BASE}/Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Bushfire_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Heritage_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Traditional_building_character_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Dwelling_house_character_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    // Sprint 15: flood awareness layers
    fetch(`${BASE}/Flood_Awareness_Overland_Flow/FeatureServer/0/query?${awarenessParams}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Flood_Awareness_Brisbane_River_Creek_Storm_Tide_1percent_Annual_Chance/FeatureServer/0/query?${awarenessParams}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Flood_Awareness_Historic_Brisbane_River_and_Creek_Floods_Feb2022/FeatureServer/0/query?${awarenessParams}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Flood_Awareness_Historic_Brisbane_River_Floods_Jan2011/FeatureServer/0/query?${awarenessParams}`, timeout).then(r => r.json()).catch(() => null),
    // Sprint 16: environment/constraint overlays
    fetch(`${BASE}/Biodiversity_areas_overlay_Koala_habitat_areas/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/City_Plan_2014_PotentialAndActual_acid_sulfate_soils_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Biodiversity_areas_overlay_Biodiversity_areas/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    // Sprint 19: waterway corridor + wetlands (polygon layers)
    fetch(`${BASE}/Waterway_corridors_overlay_Waterway_corridors/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Wetlands_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    // Sprint 20: HV easements + petroleum pipelines (polygon layers)
    fetch(`${BASE}/Regional_infrastructure_corridors_and_substations_overlay_High_voltage_easements/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    fetch(`${BASE}/Regional_infrastructure_corridors_and_substations_overlay_Petroleum_pipelines/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
  ]);

  // Sprint 19 + 20: line layer queries using centroid + distance buffer
  let roadResp = null;
  let hvResp = null;
  if (centroid) {
    [roadResp, hvResp] = await Promise.all([
      // Sprint 19: road hierarchy (50m buffer)
      fetch(
        `${BASE}/Roads_hierarchy_overlay_Road_hierarchy/FeatureServer/0/query` +
        `?geometry=${centroid.x}%2C${centroid.y}` +
        `&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects` +
        `&distance=50&units=esriSRUnit_Meter` +
        `&outFields=OVL2_DESC%2COVL2_CAT%2CROUTE_TYPE&returnGeometry=false&f=json`,
        timeout
      ).then(r => r.json()).catch(() => null),
      // Sprint 20: HV powerlines (100m buffer)
      fetch(
        `${BASE}/Regional_infrastructure_corridors_and_substations_overlay_High_voltage_powerline/FeatureServer/0/query` +
        `?geometry=${centroid.x}%2C${centroid.y}` +
        `&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects` +
        `&distance=100&units=esriSRUnit_Meter` +
        `&outFields=OVL2_DESC%2COVL2_CAT&returnGeometry=false&f=json`,
        timeout
      ).then(r => r.json()).catch(() => null),
    ]);
  }

  // Extract feature arrays
  const allFlood = [
    ...(floodCreek?.features || []),
    ...(floodRiver?.features  || []),
  ].map(f => f.attributes.OVL2_DESC);

  const overlandFeatures    = overlandFlow?.features     || [];
  const aep1PctFeatures     = aep1Pct?.features          || [];
  const hist2022Features    = hist2022?.features         || [];
  const hist2011Features    = hist2011?.features         || [];

  const allCharacter = [
    ...(charTrad?.features    || []),
    ...(charDwelling?.features || []),
  ].map(f => f.attributes.OVL2_DESC);

  const allBushfire          = (bushfire?.features        || []).map(f => f.attributes.OVL2_DESC);
  const allHeritage          = (heritage?.features        || []).map(f => f.attributes.OVL2_DESC);
  const koalaFeatures        = koala?.features            || [];
  const acidFeatures         = acidSulfate?.features      || [];
  const biodiversityFeatures = biodiversity?.features     || [];
  const waterwayFeatures     = waterwayCorridor?.features || [];
  const wetlandFeatures      = wetlands?.features         || [];
  const roadFeatures         = roadResp?.features         || [];
  const hvFeatures           = hvResp?.features           || [];
  const easementFeatures     = hvEasements?.features      || [];
  const pipelineFeatures     = petroleumPipelines?.features || [];

  console.log('[zone-lookup] BCC overlays — flood:', allFlood, '| overland:', overlandFeatures.length, '| bushfire:', allBushfire, '| heritage:', allHeritage, '| character:', allCharacter);

  return {
    flood: {
      affected:       allFlood.length > 0 || overlandFeatures.length > 0,
      source:         'BCC CityPlan',
      categories:     allFlood,
      overlandFlow:   overlandFeatures.length > 0,
      within1PctAEP:  aep1PctFeatures.length > 0,
      floodedFeb2022: hist2022Features.length > 0,
      floodedJan2011: hist2011Features.length > 0,
      plain:          buildFloodPlain(allFlood, overlandFeatures, aep1PctFeatures, hist2022Features, hist2011Features),
    },
    bushfire: {
      affected:   allBushfire.length > 0,
      source:     'BCC CityPlan',
      categories: allBushfire,
      plain: allBushfire.length > 0
        ? buildBushfirePlain(allBushfire)
        : 'No bushfire overlay.',
    },
    heritage: {
      listed:     allHeritage.length > 0,
      source:     'BCC CityPlan',
      categories: allHeritage,
      plain: allHeritage.length > 0
        ? 'Heritage listed — demolition and significant works require Council approval.'
        : 'Not heritage listed.',
    },
    character: {
      applicable: allCharacter.length > 0,
      source:     'BCC CityPlan',
      categories: allCharacter,
      plain: allCharacter.length > 0
        ? buildCharacterPlain(allCharacter)
        : 'No character overlay.',
    },
    koala: {
      affected: koalaFeatures.length > 0,
      source:   'BCC CityPlan',
      plain: koalaFeatures.length > 0
        ? 'Koala habitat area — vegetation clearing requires assessment. Any demolition or development must address koala impact.'
        : 'No koala habitat overlay.',
    },
    acidSulfateSoils: {
      affected: acidFeatures.length > 0,
      source:   'BCC CityPlan',
      plain: acidFeatures.length > 0
        ? 'Potential acid sulfate soils present — any excavation below natural ground level requires an Acid Sulfate Soils Management Plan. Relevant for pools, footings, extensions.'
        : 'No acid sulfate soils overlay.',
    },
    biodiversity: {
      affected: biodiversityFeatures.length > 0,
      source:   'BCC CityPlan',
      plain: biodiversityFeatures.length > 0
        ? `Biodiversity overlay: ${[...new Set(biodiversityFeatures.map(f => f.attributes?.OVL2_DESC).filter(Boolean))].join(', ')}. Development may require ecological assessment.`
        : 'No biodiversity overlay.',
    },
    roadHierarchy: {
      onArterial: roadFeatures.some(f => /arterial|sub-arterial|motorway|freight/i.test(f.attributes?.OVL2_DESC || '')),
      roadType:   roadFeatures[0]?.attributes?.ROUTE_TYPE || 'Local / residential',
      source:     'BCC CityPlan',
      plain: roadFeatures.length
        ? `Road type: ${roadFeatures[0].attributes.ROUTE_TYPE} (${roadFeatures[0].attributes.OVL2_DESC})`
        : 'Local residential street — no arterial road designation.',
    },
    waterwayCorridor: {
      affected: waterwayFeatures.length > 0,
      source:   'BCC CityPlan',
      plain: waterwayFeatures.length
        ? `Waterway corridor overlay — setback and vegetation requirements apply to development near ${waterwayFeatures[0].attributes?.OVL2_DESC || 'waterway'}.`
        : 'No waterway corridor overlay.',
    },
    wetlands: {
      affected: wetlandFeatures.length > 0,
      source:   'BCC CityPlan',
      plain: wetlandFeatures.length
        ? 'Wetlands overlay — development within or adjacent to wetland requires assessment.'
        : 'No wetlands overlay.',
    },
    highVoltage: {
      powerlineNearby: hvFeatures.length > 0,
      easementOnLot:   easementFeatures.length > 0,
      source:          'BCC CityPlan',
      plain: (hvFeatures.length > 0 || easementFeatures.length > 0)
        ? 'High voltage powerline or easement affects this property — development restrictions apply, and some buyers and lenders treat this as a risk factor. Verify with Energex before purchasing.'
        : 'No high voltage powerline or easement overlay.',
    },
    petroleumPipeline: {
      affected: pipelineFeatures.length > 0,
      source:   'BCC CityPlan',
      plain: pipelineFeatures.length
        ? 'Petroleum pipeline easement on or near lot — excavation and development restrictions apply. Contact the relevant pipeline operator before any earthworks.'
        : 'No petroleum pipeline overlay.',
    },
  };
}

function buildFloodPlain(creekRiverDescs, overlandFeatures, aep1Pct, hist2022, hist2011) {
  const parts = [];

  if (creekRiverDescs.length) {
    parts.push(creekRiverDescs.join(' + '));
  }
  if (overlandFeatures.length) {
    parts.push('Overland flow flood area');
  }

  let plain = parts.length
    ? parts.join(' + ') + ' (BCC City Plan).'
    : 'No flood overlay identified (BCC City Plan — lot boundary verified).';

  if (aep1Pct.length) {
    plain += ' Within 1-in-100 year flood extent.';
  }

  if (hist2022.length || hist2011.length) {
    const events = [hist2011.length ? 'January 2011' : null, hist2022.length ? 'February 2022' : null].filter(Boolean);
    plain += ` Recorded flooding in: ${events.join(', ')}.`;
  } else if (parts.length > 0) {
    plain += ' Not recorded as flooded in the January 2011 or February 2022 events.';
  }

  return plain;
}

function buildBushfirePlain(descs) {
  if (descs.some(d => d.includes('High hazard area')))    return 'Bushfire high hazard area — significant development constraints apply.';
  if (descs.some(d => d.includes('Medium hazard area')))  return 'Bushfire medium hazard area — BAL assessment required for new development.';
  if (descs.some(d => d.includes('High hazard buffer')))  return 'Bushfire high hazard buffer area — design standards apply to new development.';
  if (descs.some(d => d.includes('Medium hazard buffer'))) return 'Bushfire medium hazard buffer area — some design standards apply.';
  if (descs.some(d => d.includes('Potential impact')))    return 'Within bushfire potential impact area — reduced constraints but worth noting.';
  return descs[0] + ' (BCC City Plan)';
}

function buildCharacterPlain(descs) {
  if (descs.some(d => d.includes('Dwelling house character')))    return 'Dwelling house character overlay — design standards apply to extensions and new builds. Demolition may require approval.';
  if (descs.some(d => d.includes('Traditional building character'))) return 'Traditional building character overlay — strong design controls apply. Demolition requires approval.';
  return descs[0] + ' (BCC City Plan)';
}

// ---- Overlay normalisers (ZoneIQ fallback path) ----
// Used when BCC parcel lookup fails. BCC results bypass these.

function normaliseFlood(flood, state) {
  // v2.0.0 field: has_flood_overlay
  if (!flood || !flood.has_flood_overlay) return {
    affected: false,
    plain: 'No flood overlay identified (BCC City Plan verified). Note: unmapped overland flow paths are not captured in any dataset — check brisbane.qld.gov.au/floodwise for a complete property flood report.',
  };

  const s = (state || 'QLD').toUpperCase();
  const code = flood.flood_category || null;

  if (s === 'QLD') {
    return { affected: true, code, category: flood.risk_level || null, plain: floodPlainEnglish(code) };
  }
  if (s === 'NSW') {
    return { affected: true, code: null, category: null, plain: 'Flood affected — refer to local LEP for details.', lep: flood.risk_level || null };
  }
  if (s === 'VIC') {
    return { affected: true, code, category: null, plain: vicFloodPlain(code) };
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
  if (!bushfire || !bushfire.has_bushfire_overlay) return { affected: false };
  const cat = bushfire.intensity_class || null;
  return {
    affected: true,
    category: cat,
    plain: cat ? `Bushfire hazard — ${cat}.` : 'Bushfire overlay present.',
  };
}

function normaliseHeritage(heritage) {
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
  if (!character || !character.has_character_overlay) return { applicable: false };
  return {
    applicable: true,
    type: character.overlay_type || null,
    plain: 'Character overlay — design standards apply to any extensions or renovations.',
  };
}

function normaliseNoise(noise) {
  if (!noise || !noise.has_noise_overlay) return {
    affected: false,
    plain: 'No ANEF aircraft noise contour detected. ANEF overlays capture formally modelled corridors only — operational flight paths can affect properties outside this contour. Check actual flight activity at webtrak.emsbk.com/bne3 before purchasing.',
  };
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
      if (!primary   && t.includes('primary'))   primary   = s;
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
