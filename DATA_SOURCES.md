# ClearOffer — Data Sources & Field Inventory
*Repo: stevenpicton1979/portfoliostate*
*Last updated: 11 April 2026 — Sprint 23 (GNAF/Addressr)*
*Read this file before any sprint that touches data ingestion, overlay queries, or API calls.*

---

## How to use this file

- **New chat onboarding:** Fetch this file alongside STATE.md. It tells you every data source, every field, every coverage gap and known issue.
- **Sprint planning:** Before writing a sprint that adds or changes a data field, check this file first. Update it as part of the sprint completion criteria.
- **Coverage decisions:** The coverage matrix shows exactly which markets have which data. Never assume a source that works for Brisbane works for other councils.

---

## Architecture principle

> Only store data where no live API exists. Fetch everything else at query time.

Static storage is used only for:
- ICSEA scores (`data/icsea-scores.json`) — live API requires auth, changes annually
- Suburb stats (`api/config.js`) — interim only, replaced by PropTechData when confirmed
- School catchment polygons — ingested by ZoneIQ, no auth-free live API

Everything else is a live API call at query time from BCC open data or ZoneIQ.

---

## Status legend

```
LIVE     — Deployed, returning data
SPRINT   — Confirmed feasible, sprint written or in progress  
BLOCKED  — Feasible but waiting on external approval or terms
MISSING  — Not sourced — no public API found or not yet investigated
```

---

## Data Sources

### SOURCE: BCC City Plan Open Data
```
Base URL:   https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services
Auth:       None — public, no API key required
CORS:       Blocked from browser — server-side only (Vercel serverless function)
Coverage:   Brisbane City Council LGA only
Update:     Nightly (DCDB cadastre), periodic (planning scheme amendments)
Cost:       Free
Licence:    Creative Commons CC-BY
Notes:      2,130 services on this org. All City Plan overlays as at v34.00/2025.
            The authoritative source — same data town planners use via City Plan Online.
            All queries use lot boundary polygon intersection (not point) for accuracy.
            Lot geometry fetched first from Property_boundaries_Parcel, then reused
            for all overlay queries in a single Promise.all.
```

#### BCC: Property / Cadastre
| Field | Service | Query type | Field name | Sprint | Status |
|-------|---------|------------|------------|--------|--------|
| Lot plan number | `Property_boundaries_Parcel/FeatureServer/0` | WHERE clause on HOUSE_NUMBER + CORRIDOR_NAME + SUBURB | `LOTPLAN` | 14 | LIVE |
| Lot area (m²) | `Property_boundaries_Parcel/FeatureServer/0` | WHERE clause | `LOT_AREA` | 14 | LIVE |
| Lot boundary polygon | `Property_boundaries_Parcel/FeatureServer/0` | WHERE clause + `returnGeometry=true&outSR=4326` | `geometry.rings` | 14 | LIVE |

**Address parsing note:** `parseAddress()` in `api/zone-lookup.js` extracts houseNumber, streetName, suburb from the address string. Must handle both comma-separated (Google Places: "6 Glenheaton Ct, Carindale QLD 4152") and space-separated (URL-decoded: "6 Glenheaton Ct Carindale QLD 4152") formats. Bug fixed Sprint 14.

#### BCC: Flood Overlays
| Field | Service | Query type | Key fields | Sprint | Status |
|-------|---------|------------|------------|--------|--------|
| Creek/waterway FPA 1–5 | `Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 13→14 | LIVE |
| Brisbane River FPA 1–5 | `Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 14 | LIVE |
| Overland flow flood area | `Flood_Awareness_Overland_Flow/FeatureServer/0` | Polygon intersection | `FLOOD_TYPE`, `FLOOD_RISK` | 15 | LIVE |
| 1% AEP combined extent | `Flood_Awareness_Brisbane_River_Creek_Storm_Tide_1percent_Annual_Chance/FeatureServer/0` | Polygon intersection | `DESCRIPTION` | 15 | LIVE |
| Flooded January 2011? | `Flood_Awareness_Historic_Brisbane_River_Floods_Jan2011/FeatureServer/0` | Polygon intersection (hit = flooded) | presence only | 15 | LIVE |
| Flooded February 2022? | `Flood_Awareness_Historic_Brisbane_River_and_Creek_Floods_Feb2022/FeatureServer/0` | Polygon intersection (hit = flooded) | presence only | 15 | LIVE |

**Confirmed test (6 Glenheaton Court, Carindale 4152, lot 15RP182797, 1086m²):**
- Creek FPA: `["Creek/waterway flood planning area 5", "Creek/waterway flood planning area 4"]`
- Overland flow: `true` — the "unmapped" flow the stormwater consultant found IS in this dataset
- 1% AEP: `true`
- Flooded 2011: `false` | Flooded 2022: `false`

**Important:** The `fam.brisbane.qld.gov.au` endpoint (FloodWise) returns AccessDenied server-side. Use `services2.arcgis.com/dEKgZETqwmDAh1rP` instead — same data, public access.

#### BCC: Planning Overlays
| Field | Service | Query type | Key fields | Sprint | Status |
|-------|---------|------------|------------|--------|--------|
| Bushfire hazard area | `Bushfire_overlay/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 14 | LIVE |
| Heritage listing | `Heritage_overlay/FeatureServer/0` | Polygon intersection | `OVL2_DESC` | 14 | LIVE |
| Traditional building character | `Traditional_building_character_overlay/FeatureServer/0` | Polygon intersection | `OVL2_DESC` | 14 | LIVE |
| Dwelling house character | `Dwelling_house_character_overlay/FeatureServer/0` | Polygon intersection | `OVL2_DESC` | 14 | LIVE |
| Koala habitat area | `Biodiversity_areas_overlay_Koala_habitat_areas/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 16 | LIVE |
| Acid sulfate soils | `City_Plan_2014_PotentialAndActual_acid_sulfate_soils_overlay/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 16 | LIVE |
| Biodiversity area | `Biodiversity_areas_overlay_Biodiversity_areas/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 16 | LIVE |
| Waterway corridor | `Waterway_corridors_overlay_Waterway_corridors/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 19 | LIVE |
| Wetlands | `Wetlands_overlay/FeatureServer/0` | Polygon intersection | `OVL2_DESC`, `OVL2_CAT` | 19 | LIVE |
| Landslide susceptibility | `Landslide_overlay/FeatureServer/0` | Polygon intersection | `OVL2_DESC` | — | MISSING |

**Confirmed test (Carindale):** Bushfire: Medium + High hazard buffer ✓ | Koala: true ✓ | Acid sulfate: true ✓ | Biodiversity: true ✓

#### BCC: Infrastructure Overlays
| Field | Service | Query type | Key fields | Sprint | Status |
|-------|---------|------------|------------|--------|--------|
| Road hierarchy | `Roads_hierarchy_overlay_Road_hierarchy/FeatureServer/0` | **LINE layer** — centroid point + 50m distance buffer | `OVL2_DESC`, `ROUTE_TYPE` | 19 | LIVE |
| High voltage powerline | `Regional_infrastructure_corridors_and_substations_overlay_High_voltage_powerline/FeatureServer/0` | **LINE layer** — centroid + 100m distance buffer | `OVL2_DESC` | 20 | LIVE |
| High voltage easement | `Regional_infrastructure_corridors_and_substations_overlay_High_voltage_easements/FeatureServer/0` | Polygon intersection | `OVL2_DESC` | 20 | LIVE |
| Petroleum pipeline | `Regional_infrastructure_corridors_and_substations_overlay_Petroleum_pipelines/FeatureServer/0` | Polygon intersection | `OVL2_DESC` | 20 | LIVE |

**Line layer query pattern** (road hierarchy, HV powerline):
```
?geometry={lng},{lat}&geometryType=esriGeometryPoint&inSR=4326
&spatialRel=esriSpatialRelIntersects&distance=50&units=esriSRUnit_Meter
&outFields=OVL2_DESC,OVL2_CAT,ROUTE_TYPE&returnGeometry=false&f=json
```
Centroid calculated from lot polygon rings: `getLotCentroid(geometry)` in `api/zone-lookup.js`.

**Derived field:** `derivedRoadType` — set to `main_road` or `quiet_street` from road hierarchy result. Automatically replaces the manual road type qualifier question for Brisbane properties.

#### BCC: Not Yet Confirmed
| Field | Notes |
|-------|-------|
| Contaminated land overlay | Service name not confirmed. High value for ex-industrial sites. Investigate on services2.arcgis.com. |
| Airport environs / ANEF (BCC direct) | `City_Plan_2014_Airport_environs_overlay_Australian_Noise_Exposure_Forecast_ANEF/FeatureServer/0` — accessible, returns none for Carindale (correct). Currently still using ZoneIQ for noise. Could switch to BCC direct. |

---

### SOURCE: ZoneIQ
```
Base URL:   https://zoneiq-sigma.vercel.app/api/lookup
Auth:       RAPIDAPI_PROXY_SECRET (Vercel env)
CORS:       Server-side only
Coverage:   National — 84 councils across QLD SEQ, NSW Sydney, VIC Melbourne
OpenAPI:    https://zoneiq-sigma.vercel.app/api/openapi — check before wiring new fields
Cost:       Internal (own product)
Notes:      Being progressively replaced by BCC direct for Brisbane overlays.
            Still used for: zoning, school catchments, noise ANEF.
            Zoning remains via ZoneIQ for all markets (national coverage).
```

| Field | ZoneIQ field path | Coverage | Sprint | Status | Notes |
|-------|-------------------|----------|--------|--------|-------|
| Zone code | `zone.code` | National | — | LIVE | LDR, MDR, CR etc. |
| Zone name | `zone.name` | National | — | LIVE | Full description |
| School primary name | `overlays.schools.primary.name` | QLD + NSW + VIC | — | LIVE | Correct for Brisbane |
| School secondary name | `overlays.schools.secondary.name` | QLD + NSW + VIC | — | LIVE | Correct for Brisbane |
| Aircraft noise ANEF | `overlays.noise.affected` | Brisbane Airport only | — | LIVE | Formal ANEF contours only — does NOT capture operational flight paths |

**ZoneIQ fields being replaced by BCC direct (Sprint 14+):**
Flood, bushfire, heritage, character — all now sourced from BCC City Plan open data for Brisbane. ZoneIQ values for these overlays are ignored when BCC data is available.

---

### SOURCE: ICSEA Scores (Static JSON — annual ingest)
```
File:       data/icsea-scores.json
Refresh:    Run scripts/fetch-icsea.js annually when ACARA publishes new data
Coverage:   Brisbane schools only (18 schools as of April 2026)
Auth:       None (MySchool public website)
Notes:      ZoneIQ v2 dropped ICSEA from responses. Live ACARA API requires auth.
            Abbreviation expansion: SS→state school, SHS→state high school, SC→state college.
            getICSEA(schoolName) in api/zone-lookup.js handles lookup + expansion.
```

Current schools (April 2026):
Belmont SS (1068), Whites Hill State College (988), Ascot SS (1148), Indooroopilly SHS (1118), Kelvin Grove SC (1052), Balmoral SHS (1021), Graceville SS (1089), Fig Tree Pocket SS (1109), Hamilton SS (1072), Chapel Hill SS (1097), Bardon SS (1083), Sherwood SS (1095), Chelmer SS (1071), Ithaca Creek SS (1083), Rainworth SS (1079), Paddington SS (1061), Bulimba SS (1044), Toowong SS (1052).

---

### SOURCE: Suburb Stats (Static table — interim only)
```
File:       api/config.js — getSuburbStats() function
Coverage:   ~100 Brisbane suburbs
Update:     Manual — will drift. Replace with PropTechData when confirmed.
Notes:      Used for: suburb median, DOM, 12m growth, 10yr CAGR, clearance rate.
            AVM teaser on Scout Report derived as ±8% of median.
            Carindale: median $1.7M, DOM 26, growth 8.7%, CAGR 6.2%.
```

**Replacement:** PropTechData `/suburbs/statistics` — Sprint 17, BLOCKED.

---

### SOURCE: Google Geocoding + Places API
```
Key:        GOOGLE_GEOCODING_API_KEY (Vercel env)
Endpoints:  /api/autocomplete (Places API) — suggestions as user types
            /api/zone-lookup uses Google Geocoding internally via ZoneIQ
Coverage:   National
Notes:      Places API must be enabled on GCP project (done April 2026).
            Autocomplete appends ", Australia" to suggestions — stripped client-side
            before passing to zone-lookup. See index.html autocomplete handler.
            Both Geocoding API and Places API must be enabled — separate toggles on GCP.
            Used for autocomplete UX only — lat/lng now sourced from Addressr (GNAF).
```

---

### SOURCE: Addressr (GNAF API)
```
Base URL:   https://api.addressr.io
Auth:       None — free, no API key, no documented rate limits
CORS:       Open — works from browser and server
Coverage:   National — 15.9M addresses, all states and territories
Update:     Quarterly (follows GNAF release cycle)
Cost:       Free (open source, Apache 2.0)
Sprint:     23 (LIVE)
Notes:      Two-call pattern:
              1. GET /addresses?q={address}  → returns [{ sla, pid, score }]
              2. GET /addresses/{pid}        → returns geocoding.geocodes[].lat/lng
            Property centroid from land registry — more accurate than Google
            geocoding interpolation for lot boundary spatial queries.
            Run in parallel with BCC parcel fetch — no added wall-clock latency.
            Google Places retained for autocomplete UX (location-aware, faster).
            GNAF PID is Australia's authoritative address identifier.
```

**Confirmed test (6 Glenheaton Court, Carindale 4152):**
```json
{
  "pid": "GAQLD156422713",
  "sla": "6 GLENHEATON CT, CARINDALE QLD 4152",
  "lat": -27.51074722,
  "lng": 153.10155388,
  "geocodeType": "PROPERTY CENTROID",
  "reliability": "WITHIN ADDRESS SITE BOUNDARY OR ACCESS POINT"
}
```

| Field | Endpoint pattern | Sprint | Status |
|-------|-----------------|--------|--------|
| GNAF PID | `GET /addresses?q={address}` → `results[0].pid` | 23 | LIVE |
| Property centroid lat | `GET /addresses/{pid}` → `geocoding.geocodes[0].latitude` | 23 | LIVE |
| Property centroid lng | `GET /addresses/{pid}` → `geocoding.geocodes[0].longitude` | 23 | LIVE |

---

### SOURCE: PropTechData (Nexu)
```
Base URL:   api.nexu.com.au
Auth:       PROPTECH_DATA_API_KEY (Vercel env — blank until confirmed)
Coverage:   National
Status:     BLOCKED — Sprint 10 / Sprint 17. Awaiting terms confirmation.
            Call Monday 13 April if no email reply.
Notes:      VG licence question: does it permit individual sold transactions in
            paid consumer reports? Must confirm before using /market-activity/sales.
            /suburbs/statistics likely permitted (their FAQ says yes for consumer products).
```

| Endpoint | Fields | Sprint | Status |
|----------|--------|--------|--------|
| `POST /properties/avm` | AVM estimate, range, confidence score | 10 | BLOCKED |
| `GET /market-activity/sales` | Comparable sales (address, price, date, beds, baths, land) | 10 | BLOCKED |
| `GET /suburbs/statistics` | Suburb median, DOM, growth, clearance rate, ICSEA by bedroom | 17 | BLOCKED |
| `GET /suburbs/timeseries` | 10yr price history | 10 | BLOCKED |

**Interim solution:** Dev fixture (`api/dev-comparables-fixture.js`) covers 10 Brisbane suburbs with illustrative comparables derived from real medians. `_fixture: true` flag — must never reach production. Real PropTechData uses `_stub: false`.

---

### SOURCE: Domain Developer API
```
Auth:       DOMAIN_CLIENT_ID + DOMAIN_CLIENT_SECRET (Vercel env — blank)
Coverage:   National (all Domain listings)
Status:     BLOCKED — Sprint 9 / Sprint 22. Ticket #2899077, reply submitted 10 April.
Notes:      The Listings Management API Steve has is for pushing listings TO Domain
            (agent tool), not for reading listing data. The separate developer
            read API is what's needed — awaiting approval.
            Once live: listed price and DOM are the two highest-value missing fields.
            Will allow removal of road type qualifier (replaced by BCC road hierarchy)
            and potentially beds/baths qualifier.
```

| Field | Endpoint | Sprint | Status |
|-------|----------|--------|--------|
| Listed price | Domain listings read API | 22 | BLOCKED |
| Days on market (actual listing) | Domain listings read API | 22 | BLOCKED |
| Beds / baths | Domain listings read API | 22 | BLOCKED |
| Agent name | Domain listings read API | 22 | BLOCKED |
| Property description | Domain listings read API | 22 | BLOCKED |

---

### SOURCE: Anthropic API (Claude)
```
Key:        ANTHROPIC_API_KEY (Vercel env)
Model:      claude-sonnet-4-20250514
Cost:       ~$0.02 verdict (Haiku), ~$0.05–0.15 Brief (Sonnet)
```

| Use | Model | Call type | Sprint | Status |
|-----|-------|-----------|--------|--------|
| Scout Report verdict (1 sentence) | claude-haiku-4-5-20251001 | Non-streaming | — | LIVE |
| Buyer's Brief research pass | claude-sonnet-4-20250514 | Non-streaming + web_search tool | 12 | LIVE |
| Buyer's Brief writing pass | claude-sonnet-4-20250514 | Streaming SSE | 12 | LIVE |

**Web search tool:** `tools: [{ type: "web_search_20250305", name: "web_search" }]` — used in research pass to find current suburb median, cross-validate AVM, find recent suburb news. Free (included in API pricing). Cannot be combined with streaming — two-pass architecture.

---

### SOURCE: Airservices Australia (WebTrak)
```
URL:        https://webtrak.emsbk.com/bne3
API:        NONE — browser tool only, run by Envirosuite (private company)
Coverage:   Brisbane Airport operational flight paths
Status:     MISSING — cannot be programmatically queried
Notes:      ANEF contours (formal modelled corridors) are in BCC City Plan data.
            Operational flight paths that affect properties OUTSIDE the ANEF contour
            have no public API. Steve is on Airservices noise engagement list for
            Brisbane. Product currently shows WebTrak link as disclaimer when
            noise.affected = false. This is the correct approach — no better option exists.
```

---

### SOURCE: Buyer Qualifier Inputs (Manual)
```
Source:     sessionStorage from report.html qualifier buttons
Fields:     renovationStatus (original / partially_updated / fully_renovated)
            roadType (quiet_street / main_road / other)
Notes:      renovationStatus is permanent — only the buyer knows this from inspection.
            roadType is being replaced by BCC road hierarchy (Sprint 19) for Brisbane.
            roadType remains as manual fallback for non-Brisbane properties.
            derivedRoadType in zone-lookup response overrides manual qualifier when available.
            DO NOT add beds/baths/land size as qualifiers — that data comes from
            listing APIs. Asking buyers to re-enter listing data destroys credibility.
```

---

## Field Inventory — Complete List

### Currently in product (LIVE)

| # | Field | Where used | Source | Market |
|---|-------|------------|--------|--------|
| 1 | Geocoded address | All | Google Geocoding | National |
| 2 | Zone code + name | Scout Report, Brief | ZoneIQ | National |
| 3 | Lot plan number | Brief, internal | BCC DCDB | Brisbane |
| 4 | Lot area (m²) | Scout Report stat tile, Brief valuation | BCC DCDB | Brisbane |
| 5 | Creek/river flood FPA | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 6 | Overland flow flood area | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 7 | 1% AEP flood extent | Brief flood section | BCC City Plan | Brisbane |
| 8 | Flooded Jan 2011? | Brief flood section | BCC City Plan | Brisbane |
| 9 | Flooded Feb 2022? | Brief flood section | BCC City Plan | Brisbane |
| 10 | Bushfire hazard area | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 11 | Heritage listing | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 12 | Character overlay type | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 13 | Koala habitat | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 14 | Acid sulfate soils | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 15 | Biodiversity area | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 16 | Road hierarchy / type | Scout Report stat tile, Brief qualifier | BCC City Plan | Brisbane |
| 17 | Waterway corridor | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 18 | Wetlands | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 19 | High voltage powerline | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 20 | High voltage easement | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 21 | Petroleum pipeline | Scout Report overlay, Brief | BCC City Plan | Brisbane |
| 22 | Aircraft noise ANEF | Scout Report overlay, Brief | ZoneIQ | Brisbane Airport |
| 23 | School primary name | Scout Report, Brief | ZoneIQ | QLD/NSW/VIC |
| 24 | School secondary name | Scout Report, Brief | ZoneIQ | QLD/NSW/VIC |
| 25 | School primary ICSEA | Scout Report, Brief | ICSEA JSON | Brisbane |
| 26 | School secondary ICSEA | Scout Report, Brief | ICSEA JSON | Brisbane |
| 27 | Suburb median price | Scout Report stat tile, Brief | Static table | ~100 Brisbane suburbs |
| 28 | Suburb DOM | Scout Report stat tile, Brief | Static table | ~100 Brisbane suburbs |
| 29 | Suburb 12m growth | Scout Report stat tile, Brief | Static table | ~100 Brisbane suburbs |
| 30 | Suburb 10yr CAGR | Brief | Static table | ~100 Brisbane suburbs |
| 31 | Suburb clearance rate | Brief | Static table | ~100 Brisbane suburbs |
| 32 | Live suburb median (web search) | Brief valuation cross-check | Claude web search | National |
| 33 | Recent suburb news | Brief context | Claude web search | National |
| 34 | AVM estimate (fixture) | Brief valuation | Dev fixture | 10 Brisbane suburbs |
| 35 | Comparable sales (fixture) | Brief valuation | Dev fixture | 10 Brisbane suburbs |
| 36 | Condition qualifier | Brief valuation modifier | Buyer input | National |
| 37 | Road type qualifier | Brief valuation modifier (being replaced) | Buyer input / BCC | Brisbane: BCC. Others: manual |
| 38 | GNAF PID | Internal / Brief traceability | Addressr | National |
| 39 | Property centroid lat/lng (GNAF) | BCC line-layer queries (road hierarchy, HV powerlines) | Addressr | National |

### Blocked (LIVE when unblocked)

| # | Field | Sprint | Blocker |
|---|-------|--------|---------|
| 40 | AVM (real) | 10 | PropTechData terms |
| 41 | Comparable sales (real) | 10 | PropTechData VG licence |
| 42 | Suburb stats (live) | 17 | PropTechData terms |
| 43 | Suburb 10yr timeseries | 10 | PropTechData terms |
| 44 | Listed price | 22 | Domain API approval |
| 45 | Days on market (actual listing) | 22 | Domain API approval |
| 46 | Beds / baths | 22 | Domain API approval |
| 47 | Agent name | 22 | Domain API approval |

### Not sourced (no public API or not yet investigated)

| # | Field | Notes |
|---|-------|-------|
| 48 | Operational flight path noise | No API. Airservices WebTrak is browser-only. Permanent gap. |
| 49 | Building age / construction year | No public API. Sometimes in Domain listing description. |
| 50 | Title type (freehold/leasehold/community) | QLD Land Title Register — paid access via CITEC. |
| 51 | Easements on title | Paid title search. InfoTrack email sent 10 April. |
| 52 | Body corporate levies | No public API. PropTechData may have. |
| 53 | Contaminated land overlay | BCC has layer but service name not confirmed. Investigate. |
| 54 | Landslide overlay | BCC `Landslide_overlay` accessible but returns no hits for flat suburbs. Add to fetchBCCOverlays() — relevant for hilly suburbs (Bardon, Paddington, Taringa, Red Hill). |
| 55 | Rental yield / history | PropTechData has this (when confirmed). |

---

## Coverage Matrix

| Data category | BCC Brisbane | Moreton Bay | Gold Coast | Sunshine Coast | Sydney (NSW) | Melbourne (VIC) |
|--------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Zoning | ✅ | ✅ ZoneIQ | ✅ ZoneIQ | ✅ ZoneIQ | ✅ ZoneIQ | ✅ ZoneIQ |
| Lot size / cadastre | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Flood overlays | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Historic flood (2011/2022) | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bushfire overlay | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Heritage overlay | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Character overlay | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Koala / biodiversity | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Acid sulfate soils | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Road hierarchy | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Infrastructure overlays | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Waterway / wetlands | ✅ BCC | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aircraft noise ANEF | ✅ ZoneIQ | ❌ | ✅ ZoneIQ | ❌ | ✅ ZoneIQ | ✅ ZoneIQ |
| School catchments | ✅ ZoneIQ | ✅ ZoneIQ | ✅ ZoneIQ | ✅ ZoneIQ | ✅ ZoneIQ | ✅ ZoneIQ |
| School ICSEA | ✅ JSON | ❌ | ❌ | ❌ | ❌ | ❌ |
| Suburb stats | ✅ static | ❌ | ❌ | ❌ | ❌ | ❌ |
| Listed price / DOM | 🔒 Domain | 🔒 Domain | 🔒 Domain | 🔒 Domain | 🔒 Domain | 🔒 Domain |
| AVM / comparables | 🔒 PropTech | 🔒 PropTech | 🔒 PropTech | 🔒 PropTech | 🔒 PropTech | 🔒 PropTech |

### Expanding to other markets

**Moreton Bay, Gold Coast, Sunshine Coast:** Each council runs their own ArcGIS instance with similar overlay structure to BCC. ZoneIQ already has zones. Flood, bushfire, heritage all need council-specific investigation. Same BCC approach applies — find the `services.arcgis.com` org ID for each council.

**Sydney (NSW):** Flood data is complex — 33 LGAs, each with their own flood studies. NSW ePlanning has some state-level overlays. Heritage via NSW Heritage Office API. AHSEPP controls some overlays state-wide.

**Melbourne (VIC):** VIC Vicmap Planning is the state-wide source for overlays. Flood data varies by council. Heritage via VIC Heritage Register. ZoneIQ already ingests Vicmap for zones.

---

## Known Issues & Watch Points

| Issue | Affected field | Status | Notes |
|-------|----------------|--------|-------|
| ANEF misses operational flight paths | Aircraft noise | Permanent gap | No public API. WebTrak link added as disclaimer (Sprint 13). |
| Overland flow was "unmapped" — it isn't | Flood | Fixed Sprint 15 | `Flood_Awareness_Overland_Flow` layer contains this data. Was never queried before. |
| ZoneIQ flood data incomplete | Flood | Fixed Sprint 13/14 | ZoneIQ missed FPA 4+5 for Carindale. Direct BCC query via lot boundary now authoritative. |
| Large lots straddle multiple flood zones | Flood | Resolved Sprint 14 | Lot boundary polygon intersection returns ALL zones. Point query only returned one. |
| ICSEA null from ZoneIQ v2 | Schools | Fixed Sprint 21 | ZoneIQ dropped ICSEA in v2. Annual JSON ingest solves this. |
| Address parsing (comma-less URLs) | All BCC fields | Fixed Sprint 14 | URL-decoded query strings have no commas. Second-pass regex handles both formats. |
| School abbreviation mismatch | ICSEA lookup | Fixed Sprint 21 | ZoneIQ returns "Belmont SS" but JSON stores "belmont state school". Expansion map added. |
| Suburb stats static table drifts | Suburb median/DOM/growth | Interim | Carindale was $980K in old table, corrected to $1.7M. Replaced by PropTechData (Sprint 17). |
| PropTechData stub in prod | AVM / comparables | Must fix before launch | `_fixture: true` flag prevents production use. Brief shows honesty statement when no real comps. |
| FloodWise (fam.brisbane.qld.gov.au) blocked | — | Not a blocker | Returns AccessDenied server-side. Use services2.arcgis.com instead — same underlying data. |

---

## Pending External Actions

| Action | Contact | Sent | Follow-up |
|--------|---------|------|-----------|
| PropTechData API terms + VG licence | api.nexu.com.au | 8+9 April | Call Monday 13 April |
| Domain developer read API | api@domain.com.au, ticket #2899077 | 10 April | Await response |
| InfoTrack API (title/easement data) | — | 10 April | Follow up 13 April |
| Anthropic Claude.ai billing refund ($310) | Support via Fin | 10 April | Reference receipt 2310-1838-8712 |
