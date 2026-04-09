# ClearOffer — Strategy Chat Handoff
*For the rebuild chat — covers all key decisions, research findings, and context from the strategy session*
*9 April 2026*

---

## What this document is

The original ClearOffer project brief was written after Session 1 (Good Friday build day). This document covers everything important that happened in the strategy session that followed — data supplier conversations, product repositioning, ZoneIQ diagnosis, and key decisions made. The new chat should treat this as authoritative over the original brief where they conflict.

---

## The central product repositioning

The original brief assumed comparable sales with listed-price-vs-sold-price (vendor discount) would be available via PropTechData or Domain/Pricefinder. This is not available.

**Root cause:** All major Australian property data providers (Domain/Pricefinder, CoreLogic, PropTrack) licence sold transaction data from state Valuer General bodies. The VG licence prohibits on-selling individual sold transactions in paid consumer reports. This is a structural industry constraint, not a Domain-specific commercial decision. It likely applies to PropTechData as well — this is the most important open question to confirm on the PropTechData call.

**What was confirmed directly by Trea Scott, Commercial Director at Domain Insights:**
- Individual sold transactions in paid reports: blocked (VG licence)
- Individual sold transactions in free reports: also blocked
- Aggregated suburb statistics (median, DOM, clearance rate): technically possible but $29K/year minimum — not viable at launch
- AVM (automated valuation model): blocked for on-selling — Domain wants users coming to their own products
- Agent-reported sold data (not VG): declined on reliability grounds, not licence grounds — this distinction matters

**Agent vendor discount data: deferred out of v1**
Originally a key feature. Repositioned because: (a) the data is hard to get cleanly, (b) it creates agent relations risk, (c) the product is still complete without it.

**The negotiation section now works like this:**
Instead of "this agent averages 3.2% vendor discount," the report says: "This property has been listed 43 days against a 22-day suburb average — that's leverage. The three most comparable sales in the past 90 days settled between $847K and $862K against a $895K asking price — the gap is real." DOM signals + comparable sold prices + active supply = negotiating intelligence without agent-specific data.

---

## Data layer — final architecture

### Free Scout Report — target cost under $0.15 per lookup

| Data point | Source | Cost |
|---|---|---|
| Listing basics (price, beds/baths, DOM, agent name) | Domain developer API (free tier) | Free |
| Address autocomplete | Domain developer API (free tier) — PENDING APPROVAL | Free |
| One-line AI verdict | Claude API — minimal prompt | ~$0.02 |
| Suburb median, DOM average | Cached dataset — see below | Near zero |
| Flood flag (FPA code, plain category only) | ZoneIQ | Free |
| School catchment + ICSEA | ZoneIQ | Free |
| Overlay flags (heritage, bushfire, noise, character) | ZoneIQ | Free |
| AVM teaser (range shown, details locked) | Derived from listing price + suburb median + Claude | ~$0.02 |
| 5 comparable sales (sold price + date only, no listed price) | Cached/built dataset OR PropTechData if terms permit | TBC |
| Demand vs supply meter | Derived from suburb stats | Near zero |

**Critical design principle:** PropTechData is NOT called on the free report. Every free report lookup must cost under $0.15. PropTechData calls are reserved for the paid report only.

### Paid Buyer's Brief — target cost $3–5, revenue $149

| Data point | Source |
|---|---|
| Full AVM with confidence score | PropTechData /properties/avm — PENDING CONFIRMATION |
| Comparable sales (sold price, date, attributes) | PropTechData /market-activity/sales |
| Suburb statistics (median, DOM, yield, vacancy, ICSEA) | PropTechData /suburbs/statistics |
| Suburb timeseries (10yr) | PropTechData /suburbs/timeseries |
| Flood risk in plain English | ZoneIQ FPA code + Claude reasoning on baked context |
| All overlays explained | ZoneIQ |
| 5–10yr suburb outlook | Static lookup table (Olympics/CRR) + PropTechData timeseries |
| Offer recommendation, negotiation script | Claude — synthesises all above |
| What the agent won't tell you | Claude |
| Agent track record | DEFERRED — not in v1 |

### Suburb statistics — the data gap to solve

The free report needs suburb median price (by bedroom count), average DOM, and basic market health indicators without calling PropTechData per lookup. Two options:

**Option A (recommended):** Cache PropTechData suburb statistics in Supabase. One call per suburb per month — not per property lookup. A 200-suburb Brisbane cache costs maybe $20-40/month in PropTechData calls. Serve free report stats from cache. This is cheap and clean once PropTechData terms are confirmed.

**Option B (fallback):** Build own suburb statistics dataset from public sources (QLD Titles Registry transfers + listing site data). Takes 6-12 weeks to have meaningful coverage. Not suitable for launch but worth starting the pipeline now.

---

## Data supplier status

### Domain developer API
- Status: ACCESS PENDING — showing as pending in developer portal as of 9 April
- Contact: api@domain.com.au — chaser email sent 9 April
- What we need it for: active listing data (price, beds/baths, DOM, agent name, photos) and address autocomplete ONLY — not sold data
- What we do NOT need it for: sold transactions, AVM, suburb statistics — all blocked by VG licence anyway
- Fallback if approval delayed: Google Places API for autocomplete ($0.017/session), mock/manual listing data for now
- Important: Domain Insights/Pricefinder (commercial data arm) and Domain developer API (listing data) are SEPARATE products managed by separate teams. Do not conflate them.

### PropTechData
- Status: Email sent to hello@proptechdata.com.au 8 April, no response, no auto-response
- Their API platform appears to be branded "Nexu" — API docs at api.nexu.com.au
- Contact strategy: LinkedIn outreach to someone commercial at PropTechData, check for live chat on their site
- Critical questions for the call (in priority order):
  1. Do they have original listing price alongside sold price, or only sold price?
  2. Does their VG licence carry the same restriction as Domain — can individual sold transactions appear in a paid consumer report?
  3. Can suburb statistics be cached monthly rather than called per-lookup?
  4. Per-call pricing or subscription minimum? What's the minimum commitment?
  5. Is there a confidence score on the AVM?

### CoreLogic (Cotality)
- Not yet contacted
- Has the deepest historical dataset in Australia including likely listed-price alongside sold-price
- Enterprise pricing — expect $2K-15K for historical dump, ongoing refresh subscription
- May carry same VG licence restriction as Domain — ask explicitly
- Worth one conversation but don't expect a cheap outcome
- Lower priority than PropTechData call

### Pricefinder
- Same company as Domain Insights — Trea Scott manages both
- Do not pursue separately

---

## ZoneIQ — what the new chat needs to know

ZoneIQ is a separate product Steven owns (live at zoneiq-sigma.vercel.app). It is a PostGIS spatial API that returns planning and risk overlays for any Australian address. It is ClearOffer's primary overlay data source.

**A 30-address coverage test was run 8 April. Results were poor (30% pass rate) but the root cause is known and fixes are in progress in the ZoneIQ chat.**

**Current ZoneIQ Brisbane coverage (when working):**
- Flood planning area codes (FHA_R1, R2A, R3, R4, R5) — BCC City Plan 2014
- Character overlay
- School catchments + ICSEA scores (Brisbane only)
- Bushfire hazard (SEQ-wide, best coverage)
- Heritage (state QLD-wide + BCC local)
- Aircraft noise ANEF bands (Brisbane Airport, Archerfield, Gold Coast Airport)
- Acid sulfate soils (live ArcGIS query, QLD statewide)
- Zoning code and name

**Bugs being fixed in ZoneIQ chat (do not implement workarounds in ClearOffer that would become redundant):**
1. CRITICAL: Overlay delivery blocked by zone rules gate — overlays discarded when zone rules not seeded. Fix: decouple overlays from zone rules, return partial 200. This unblocks ~47% of failures.
2. HIGH: Silent wrong-state geocoding (Tennyson QLD → Tennyson NSW, returns HTTP 200 with wrong data). Fix: SEQ bounding box guard.
3. HIGH: Nominatim being replaced with Google Geocoding API — more reliable for Australian addresses.
4. MEDIUM: LMR and other common Brisbane zone codes not seeded — being seeded.

**Fallback until ZoneIQ fixes deployed:**
BCC ArcGIS FeatureServer for flood data — call server-side only (CORS blocks browser):
```
GET https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/
    City_Plan_2014_Flood_Overlay/FeatureServer/0/query
    ?geometry=<lng>,<lat>
    &geometryType=esriGeometryPoint
    &spatialRel=esriSpatialRelIntersects
    &outFields=OVL2_CAT,OVL2_DESC
    &f=json
```

**ZoneIQ national expansion:** Decision made — ZoneIQ becomes the national overlay API. NSW and VIC flood/zoning/noise data follows same ArcGIS REST patterns as QLD. Research task assigned to ZoneIQ chat.

**NSW flood data caveat:** NSW returns binary flood flag with LEP reference, not FPA risk codes like Brisbane. ClearOffer needs to handle this gracefully — "Flood affected — refer to local LEP" rather than "High flood risk — FHA R2A." Design for this from the start.

---

## The one-line AI verdict — design intent

This is the hook that makes a buyer lean forward rather than nod along. It appears on the Stage 1 free teaser (before email gate) and must be enticing, not neutral.

**Wrong:** "This property appears to be fairly valued based on comparable sales."
**Right:** "Listed at $895K, but three comparable sales in the past 90 days suggest $840K is the ceiling — there's room here."
**Right:** "43 days on market in a suburb where properties average 22 days. The listing agent hasn't found a buyer at this price. That's leverage."

It should feel like a sharp friend who knows the market just texted you. Specific, confident, slightly provocative. It's a hook for the full report, not a summary.

Inputs available for the verdict at Stage 1 (before any paid data calls):
- Listing price
- Days on market (from Domain API)
- Suburb median (from cache)
- Suburb average DOM (from cache)
- Flood flag (from ZoneIQ — can factor in if high risk)

---

## Buyer qualifier questions — design intent

Two questions shown just before the AVM estimate appears in the free report. Framed as "help us calibrate your estimate" — feels like personalisation, not a gate.

**Question 1:** Renovation status — Original condition / Partially updated / Fully renovated
**Question 2:** Road type — Quiet street / Main road / Other

These don't change the PropTechData AVM number. They change how Claude frames the confidence and interpretation of that number. Example: "PropTechData estimates $820K–$880K. Given this property is in original condition and comparable sales in this suburb are predominantly renovated, we'd weight toward the lower end of that range."

Maximum two questions. If it feels like a form, conversion drops.

---

## Free report conversion design principles

The free/paid split is "creates curiosity vs resolves it" — not "cheap data vs expensive data."

**Three mechanisms that drive conversion:**
1. Demonstrated competence — show something the buyer couldn't easily get themselves
2. Visible incompleteness — show the label, lock the value. "Our opening offer recommendation based on comparable evidence is [LOCKED]" not just a blurred section
3. Personal relevance at decision moment — CTA language: "You've done the inspection. Here's what to offer." Not generic "buy the full report"

**What the free report must show to work:**
- Something surprising or specific (flood flag if relevant, DOM vs suburb average, AVM range)
- Locked sections that are clearly labelled with what's inside them
- The one-line verdict that creates an itch

---

## Legal positioning (unchanged from original brief)

"This report is market research and analysis, not a formal property valuation. It is not suitable for lending, legal, or insurance purposes. ClearOffer is not a registered property valuer. Always obtain independent legal and financial advice before purchasing property."

Same positioning as HomePriceGuide, OpenAgent, PropTechData. No registration required.

---

## Infrastructure state (as understood 9 April)

- Live at clearoffer.com.au — Vercel, auto-deploy from GitHub (repo: buyerside, main branch)
- Vanilla HTML/JS + Vercel serverless, no framework, CommonJS — BEING REBUILT FROM SCRATCH
- Stripe: test mode only — switch to live before any ads
- Resend: wired, hello@clearoffer.com.au verified
- Supabase: schema deployed, email gate not yet wired
- ZoneIQ: integrated but response shape validation not done in ClearOffer
- Address autocomplete: Nominatim temporary — Domain pending, Google Places as fallback option
- Mock data: Scout Report and Buyer's Brief still hardcoded for 14 Riverview Tce Chelmer
- No smoke tests yet

---

## Key decisions log

| Decision | Rationale |
|---|---|
| Agent vendor discount deferred from v1 | Data not licensable cleanly, product strong without it, legal risk with agents |
| PropTechData calls on paid report only | Free report must cost under $0.15 — can't absorb $1-2 PropTechData call per free lookup |
| ZoneIQ as primary overlay source | Free per call, covers all Brisbane overlays needed, national expansion feasible |
| Google Geocoding to replace Nominatim in ZoneIQ | Nominatim 23% failure rate on Brisbane addresses — not production quality |
| ZoneIQ becomes national overlay API | Same ArcGIS patterns reusable for NSW/VIC, avoids duplicating spatial logic in ClearOffer |
| No subscription model | One-time purchase per property — confirmed in original brief, unchanged |
| Brisbane only at launch | Flood story uniquely compelling post-2022, ZoneIQ coverage best here |
| $149 price point | This is an $800K decision — price signals quality, not a cheap tool |
| One free report per email address ever | Prevent abuse, maintain email list quality |

---

## Open questions that will unblock the build

1. **PropTechData:** Do they have listed-price alongside sold-price? Does their VG licence permit individual sold transactions in paid reports? What's the pricing? — Cannot finalise paid report data layer until this is answered.

2. **Domain developer API approval:** Still pending as of 9 April. Chaser sent to api@domain.com.au. Needed for active listing data and address autocomplete on live properties.

3. **ZoneIQ bug fixes:** Overlay decoupling from zone rules gate + Google Geocoding — in progress in ZoneIQ chat. ClearOffer integration should be designed for the fixed API shape, not built around the broken one.

4. **Suburb statistics cache:** Once PropTechData terms confirmed, set up monthly Supabase cache of Brisbane suburb stats. This eliminates per-lookup PropTechData calls on the free report.

