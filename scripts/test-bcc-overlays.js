'use strict';
// Test script for BCC overlay APIs + GNAF resolution (Sprint 23)
// Run with: node scripts/test-bcc-overlays.js
// Tests the exact API pattern used in api/zone-lookup.js

const TEST_ADDRESSES = [
  {
    label: '6 Glenheaton Court, Carindale — flood, bushfire buffer, dwelling char, koala, acid sulfate, biodiversity',
    address: '6 Glenheaton Court, Carindale QLD 4152',
    houseNumber: 6, streetName: 'GLENHEATON', suburb: 'CARINDALE',
    expected: {
      lotPlan: '15RP182797',
      lotAreaMin: 1080, lotAreaMax: 1100,
      floodAffected: true,
      floodContains: ['Creek/waterway flood planning area 4'],
      overlandFlow: true,
      within1PctAEP: true,
      floodedJan2011: false,
      floodedFeb2022: false,
      bushfireAffected: true,
      heritageListed: false,
      characterApplicable: true,
      koalaAffected: true,
      acidSulfateSoilsAffected: true,
      biodiversityAffected: true,
      roadOnArterial: false,
      waterwayCorridor: true,
      wetlands: false,
    }
  },
  {
    label: '17 Wharf St, Chelmer — riverside, expect Brisbane River flood, waterway corridor',
    address: '17 Wharf St, Chelmer QLD 4068',
    houseNumber: 17, streetName: 'WHARF', suburb: 'CHELMER',
    expected: {
      floodAffected: true,
      heritageListed: false,
    }
  },
  {
    label: '26 Racecourse Rd, Hamilton — prestige, expect no flood',
    address: '26 Racecourse Rd, Hamilton QLD 4007',
    houseNumber: 26, streetName: 'RACECOURSE', suburb: 'HAMILTON',
    expected: {
      floodAffected: false,
    }
  },
  {
    label: '7 Wynnum Rd, Norman Park — arterial road, expect road hierarchy hit',
    address: '7 Wynnum Rd, Norman Park QLD 4170',
    houseNumber: 7, streetName: 'WYNNUM', suburb: 'NORMAN PARK',
    expected: {
      roadOnArterial: true,
    }
  },
];

const BASE = 'https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services';

async function fetchParcel(houseNumber, streetName, suburb) {
  const where = `HOUSE_NUMBER=${houseNumber} AND UPPER(CORRIDOR_NAME)='${streetName}' AND UPPER(SUBURB)='${suburb}'`;
  const url = `${BASE}/Property_boundaries_Parcel/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=LOTPLAN%2CLOT_AREA%2CPAR_IND_DESC&returnGeometry=true&outSR=4326&f=json`;
  const resp = await fetch(url);
  const data = await resp.json();
  return data.features?.find(f => f.attributes.PAR_IND_DESC === 'Lot' && f.attributes.LOT_AREA > 0);
}

function getLotCentroid(geometry) {
  const ring = geometry.rings?.[0];
  if (!ring || ring.length === 0) return null;
  const sumX = ring.reduce((s, p) => s + p[0], 0);
  const sumY = ring.reduce((s, p) => s + p[1], 0);
  return { x: sumX / ring.length, y: sumY / ring.length };
}

async function fetchOverlays(geometry) {
  const geomStr = encodeURIComponent(JSON.stringify({ rings: geometry.rings }));
  const params = `geometry=${geomStr}&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OVL2_DESC%2COVL2_CAT&f=json`;
  const awarenessParams = `geometry=${geomStr}&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;

  const centroid = getLotCentroid(geometry);

  const [
    floodCreek, floodRiver, bushfire, heritage, charTrad, charDwelling,
    overlandFlow, aep1Pct, hist2022, hist2011,
    koala, acidSulfate, biodiversity,
    waterwayCorridor, wetlands,
    hvEasements, petroleumPipelines,
  ] = await Promise.all([
    fetch(`${BASE}/Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Bushfire_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Heritage_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Traditional_building_character_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Dwelling_house_character_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Flood_Awareness_Overland_Flow/FeatureServer/0/query?${awarenessParams}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Flood_Awareness_Brisbane_River_Creek_Storm_Tide_1percent_Annual_Chance/FeatureServer/0/query?${awarenessParams}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Flood_Awareness_Historic_Brisbane_River_and_Creek_Floods_Feb2022/FeatureServer/0/query?${awarenessParams}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Flood_Awareness_Historic_Brisbane_River_Floods_Jan2011/FeatureServer/0/query?${awarenessParams}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Biodiversity_areas_overlay_Koala_habitat_areas/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/City_Plan_2014_PotentialAndActual_acid_sulfate_soils_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Biodiversity_areas_overlay_Biodiversity_areas/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Waterway_corridors_overlay_Waterway_corridors/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Wetlands_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Regional_infrastructure_corridors_and_substations_overlay_High_voltage_easements/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
    fetch(`${BASE}/Regional_infrastructure_corridors_and_substations_overlay_Petroleum_pipelines/FeatureServer/0/query?${params}`).then(r=>r.json()).catch(()=>null),
  ]);

  // Line layers: road hierarchy + HV powerlines
  let roadResp = null;
  if (centroid) {
    roadResp = await fetch(
      `${BASE}/Roads_hierarchy_overlay_Road_hierarchy/FeatureServer/0/query` +
      `?geometry=${centroid.x}%2C${centroid.y}` +
      `&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects` +
      `&distance=50&units=esriSRUnit_Meter` +
      `&outFields=OVL2_DESC%2COVL2_CAT%2CROUTE_TYPE&returnGeometry=false&f=json`
    ).then(r=>r.json()).catch(()=>null);
  }

  const allFlood = [...(floodCreek?.features||[]), ...(floodRiver?.features||[])].map(f=>f.attributes.OVL2_DESC);

  return {
    flood:               allFlood,
    bushfire:            (bushfire?.features||[]).map(f=>f.attributes.OVL2_DESC),
    heritage:            (heritage?.features||[]).map(f=>f.attributes.OVL2_DESC),
    character:           [...(charTrad?.features||[]), ...(charDwelling?.features||[])].map(f=>f.attributes.OVL2_DESC),
    overlandFlow:        overlandFlow?.features?.length > 0,
    within1PctAEP:       aep1Pct?.features?.length > 0,
    floodedFeb2022:      hist2022?.features?.length > 0,
    floodedJan2011:      hist2011?.features?.length > 0,
    koala:               koala?.features?.length > 0,
    acidSulfateSoils:    acidSulfate?.features?.length > 0,
    biodiversity:        biodiversity?.features?.length > 0,
    waterwayCorridor:    waterwayCorridor?.features?.length > 0,
    wetlands:            wetlands?.features?.length > 0,
    hvEasements:         hvEasements?.features?.length > 0,
    petroleumPipelines:  petroleumPipelines?.features?.length > 0,
    roadFeatures:        roadResp?.features || [],
    roadOnArterial:      (roadResp?.features || []).some(f => /arterial|sub-arterial|motorway|freight/i.test(f.attributes?.OVL2_DESC || '')),
  };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of TEST_ADDRESSES) {
    console.log(`\n--- ${test.label} ---`);
    try {
      const lot = await fetchParcel(test.houseNumber, test.streetName, test.suburb);
      if (!lot) { console.log('  FAIL: no parcel found'); failed++; continue; }

      console.log(`  Lot: ${lot.attributes.LOTPLAN} — ${lot.attributes.LOT_AREA}m²`);
      const overlays = await fetchOverlays(lot.geometry);
      console.log(`  Flood:            ${overlays.flood.length     ? overlays.flood.join(', ')     : 'none'}`);
      console.log(`  Overland flow:    ${overlays.overlandFlow}`);
      console.log(`  Within 1% AEP:   ${overlays.within1PctAEP}`);
      console.log(`  Flooded 2022:     ${overlays.floodedFeb2022}`);
      console.log(`  Flooded 2011:     ${overlays.floodedJan2011}`);
      console.log(`  Bushfire:         ${overlays.bushfire.length  ? overlays.bushfire.join(', ')  : 'none'}`);
      console.log(`  Heritage:         ${overlays.heritage.length  ? overlays.heritage.join(', ')  : 'none'}`);
      console.log(`  Character:        ${overlays.character.length ? overlays.character.join(', ') : 'none'}`);
      console.log(`  Koala:            ${overlays.koala}`);
      console.log(`  Acid sulfate:     ${overlays.acidSulfateSoils}`);
      console.log(`  Biodiversity:     ${overlays.biodiversity}`);
      console.log(`  Waterway:         ${overlays.waterwayCorridor}`);
      console.log(`  Wetlands:         ${overlays.wetlands}`);
      console.log(`  Road on arterial: ${overlays.roadOnArterial}`);
      if (overlays.roadFeatures.length) {
        console.log(`  Road type:        ${overlays.roadFeatures[0].attributes?.ROUTE_TYPE} (${overlays.roadFeatures[0].attributes?.OVL2_DESC})`);
      }

      const e = test.expected;
      const checks = [
        e.lotPlan       !== undefined ? lot.attributes.LOTPLAN === e.lotPlan                                          : null,
        e.lotAreaMin    !== undefined ? lot.attributes.LOT_AREA >= e.lotAreaMin && lot.attributes.LOT_AREA <= e.lotAreaMax : null,
        e.floodAffected !== undefined ? (overlays.flood.length > 0 || overlays.overlandFlow) === e.floodAffected      : null,
        e.floodContains !== undefined ? e.floodContains.every(c => overlays.flood.includes(c))                        : null,
        e.overlandFlow  !== undefined ? overlays.overlandFlow   === e.overlandFlow                                    : null,
        e.within1PctAEP !== undefined ? overlays.within1PctAEP  === e.within1PctAEP                                   : null,
        e.floodedJan2011 !== undefined ? overlays.floodedJan2011 === e.floodedJan2011                                 : null,
        e.floodedFeb2022 !== undefined ? overlays.floodedFeb2022 === e.floodedFeb2022                                 : null,
        e.bushfireAffected !== undefined ? (overlays.bushfire.length > 0) === e.bushfireAffected                      : null,
        e.heritageListed   !== undefined ? (overlays.heritage.length > 0) === e.heritageListed                        : null,
        e.characterApplicable !== undefined ? (overlays.character.length > 0) === e.characterApplicable               : null,
        e.koalaAffected        !== undefined ? overlays.koala           === e.koalaAffected                           : null,
        e.acidSulfateSoilsAffected !== undefined ? overlays.acidSulfateSoils === e.acidSulfateSoilsAffected           : null,
        e.biodiversityAffected !== undefined ? overlays.biodiversity    === e.biodiversityAffected                    : null,
        e.waterwayCorridor !== undefined ? overlays.waterwayCorridor    === e.waterwayCorridor                        : null,
        e.wetlands         !== undefined ? overlays.wetlands            === e.wetlands                                : null,
        e.roadOnArterial   !== undefined ? overlays.roadOnArterial      === e.roadOnArterial                          : null,
      ].filter(c => c !== null);

      const allPassed = checks.every(c => c === true);
      if (allPassed) { console.log('  PASS'); passed++; }
      else           { console.log('  FAIL — check values above vs expected:', JSON.stringify(e)); failed++; }

    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  return failed;
}

// ---- Sprint 23: GNAF resolution tests ----

const GNAF_TESTS = [
  {
    label: '6 Glenheaton Court, Carindale — GNAF PID + centroid',
    address: '6 Glenheaton Court, Carindale QLD 4152',
    expected: {
      gnafPid: 'GAQLD156422713',
      latMin: -27.52, latMax: -27.50,
      lngMin: 153.09, lngMax: 153.11,
    },
  },
  {
    label: '26 Racecourse Rd, Hamilton — GNAF resolves prestige address',
    address: '26 Racecourse Rd, Hamilton QLD 4007',
    expected: {
      latMin: -27.44, latMax: -27.42,
      lngMin: 153.05, lngMax: 153.07,
    },
  },
];

async function resolveGNAF(address) {
  const clean = address.replace(/,?\s*Australia$/i, '').trim();
  const searchResp = await fetch(`https://api.addressr.io/addresses?q=${encodeURIComponent(clean)}`, { signal: AbortSignal.timeout(5000) });
  if (!searchResp.ok) throw new Error(`Addressr search ${searchResp.status}`);
  const results = await searchResp.json();
  if (!results?.length) return null;
  const pid = results[0].pid;
  if (!pid) return null;
  const detailResp = await fetch(`https://api.addressr.io/addresses/${pid}`, { signal: AbortSignal.timeout(5000) });
  if (!detailResp.ok) throw new Error(`Addressr detail ${detailResp.status}`);
  const detail = await detailResp.json();
  const geocode = detail.geocoding?.geocodes?.find(g => g.default) || detail.geocoding?.geocodes?.[0];
  if (!geocode?.latitude || !geocode?.longitude) return null;
  return { pid, lat: geocode.latitude, lng: geocode.longitude, geocodeType: geocode.type?.name };
}

async function runGNAFTests() {
  console.log('\n=== GNAF Resolution Tests (Sprint 23) ===');
  let passed = 0;
  let failed = 0;

  for (const test of GNAF_TESTS) {
    console.log(`\n--- ${test.label} ---`);
    try {
      const gnaf = await resolveGNAF(test.address);
      if (!gnaf) { console.log('  FAIL: no GNAF result'); failed++; continue; }

      console.log(`  PID:  ${gnaf.pid}`);
      console.log(`  Lat:  ${gnaf.lat}`);
      console.log(`  Lng:  ${gnaf.lng}`);
      console.log(`  Type: ${gnaf.geocodeType}`);

      const e = test.expected;
      const checks = [
        e.gnafPid !== undefined ? gnaf.pid === e.gnafPid : null,
        e.latMin  !== undefined ? gnaf.lat >= e.latMin && gnaf.lat <= e.latMax : null,
        e.lngMin  !== undefined ? gnaf.lng >= e.lngMin && gnaf.lng <= e.lngMax : null,
      ].filter(c => c !== null);

      const allPassed = checks.every(c => c === true);
      if (allPassed) { console.log('  PASS'); passed++; }
      else           { console.log('  FAIL — check values above vs expected:', JSON.stringify(e)); failed++; }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      failed++;
    }
  }
  console.log(`\n=== GNAF Results: ${passed} passed, ${failed} failed ===`);
  return failed;
}

async function main() {
  const bccFailed  = await runTests();
  const gnafFailed = await runGNAFTests();
  process.exit((bccFailed + gnafFailed) > 0 ? 1 : 0);
}

main();
