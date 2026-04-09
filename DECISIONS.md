# ClearOffer — Decisions Log

---

## Sprint 4 — Supabase email gate, ZoneIQ validation, bushfire overlay, env cleanup

### Supabase Wiring Pattern

- **Pattern:** Raw REST API fetch (no `@supabase/supabase-js` dependency).
- **Table:** `scout_reports` — exists at project `dqzqqfcepsqhaxovneen.supabase.co`. Note: this is the ClearOffer project. The Supabase MCP is connected to the ZoneIQ project — DDL for `scout_reports` must be run manually.
- **Missing columns (must be added manually):** `followup_sent boolean default false`, `converted_to_paid boolean default false`. SQL is in `scripts/create-scout-reports.sql`.
- **Upsert strategy:** `Prefer: resolution=merge-duplicates` on `(email, address)` unique constraint.

### One-Free-Report-Per-Email

- **Decision:** Before upsert, check if email exists anywhere in `scout_reports` (any address). If yes, return `{ paywall: true, message: '...' }` — no free report delivered, no Supabase write, no email sent.
- **Scope:** Global — one free report per email, not per address. This is the strictest interpretation of the brief.
- **Frontend:** Scout Report HTML currently shows a generic error for non-`data.property` responses. Sprint 5 should add a specific paywall UI state.
- **Failure handling:** If the Supabase check fails (network error, key issue), the error is logged and the submission proceeds as a new user — generous failure mode.

### ZoneIQ Response Shape Validation

- **Where:** `submit-email.js` `fetchZoneIQ()` function. `property-lookup.js` handles Nominatim autocomplete only (not ZoneIQ).
- **Validated fields:** `success === true`, `overlays.flood`, `overlays.character`, `overlays.bushfire`, `overlays.schools`.
- **On failure:** Log warning including actual response shape. Apply safe defaults for any missing field: `hasFloodOverlay: false`, `hasCharacterOverlay: false`, `hasBushfireOverlay: false`, `schools: []`.
- **ZONEIQ_URL:** Now read from `process.env.ZONEIQ_URL` with fallback to `https://zoneiq-sigma.vercel.app`. Added to Vercel Production and Development env vars.

### Bushfire Overlay Display

- **Source:** `d.bushfire.hasBushfireOverlay` from ZoneIQ response.
- **Location:** Added to the Flood & Risk Overlay section (Section 04) as a second row within the content card, separated by a rule. Also added as a dynamic badge in the sidebar Risk Summary (replacing hardcoded "Low").
- **Visual pattern:** Identical to flood overlay — dot + rating + description. Green dot + "No bushfire overlay" when false; amber dot + "Bushfire overlay present" when true.

### Env Var Changes (Sprint 4)

- `ZONEIQ_URL` added to Vercel Production and Development.
- `.env.example` updated: `BASE_URL` and `ALLOWED_ORIGIN` now point to `clearoffer.com.au`. `ZONEIQ_URL` added. `GOOGLE_GEOCODING_API_KEY` placeholder added. `DOMAIN_API_KEY`, `DOMAIN_CLIENT_ID`, `DOMAIN_CLIENT_SECRET` moved to pending section with VG restriction note.

---

## Sprint 3 — Rebrand + Polish

### Files renamed BuyerSide → ClearOffer
All user-visible strings replaced. File names and folder names left unchanged to avoid breaking imports.

| File | Changes |
|---|---|
| `public/index.html` | title, meta description, logo, hero headline, hero sub, how-it-works steps, what-section heading, case stats, footer, copyright |
| `public/scout-report.html` | title, logo, verdict label, upgrade subtitle, upgrade disclaimer, footer, JS doc.title (×2) |
| `public/buyers-brief.html` | title, logo, cover-meta-label, leverage prose, verdict header, footer disclaimer, footer stamp, AI system prompt |
| `api/stripe-webhook.js` | email header, email disclaimer, from address, subject line |
| `api/create-checkout.js` | Stripe product name |
| `api/property-lookup.js` | Nominatim User-Agent header |

**Skipped (intentionally not renamed):**
- File names and folder names
- Environment variable names (`DOMAIN_CLIENT_ID`, `SUPABASE_URL`, etc.)
- Supabase table names (`scout_reports`, `paid_reports`)
- GitHub repo name (`buyerside`)
- Vercel project name
- "Buyer's Brief" product name — kept as-is, not in the rename table

### Smart placeholders for missing Domain data
When Domain listing API returns no data (sandbox limitations), the Scout Report now shows context-appropriate placeholders instead of bare dashes:
- Listing price → "See agent listing" (italic, muted)
- Days on market → "Listed recently"
- Agent name → "Contact selling agent"
- Land size → "See contract"
- Beds/baths/cars → keep dashes (brief specified)

A `.data-notice` banner appears below the hero strip when `listing.isOnMarket` is false, explaining that live data is sourced from domain.com.au.

### Confirmation email (Scout Report)
Added Resend email call to `submit-email.js` after successful email gate submission. Sends from `hello@clearoffer.com.au`. Guarded by `process.env.RESEND_API_KEY` check — silently skipped if key not set. Email failures are caught and logged, never block the response.

**Status:** Resend API key already present in `.env.local`. Email will send from `hello@clearoffer.com.au` once domain is verified in Resend dashboard.

---

## clearoffer.com.au — DNS Configuration

Domain purchased via VentraIP. To connect to Vercel:

1. In Vercel → buyerside project → Settings → Domains → Add Domain → `clearoffer.com.au`
2. Vercel will display DNS records to add (typically an A record for the apex domain and a CNAME for `www`)
3. In VentraIP → DNS Management for `clearoffer.com.au` → add the A record and/or CNAME records that Vercel specifies
4. Wait 24–48 hours for DNS propagation

**Do not attempt to configure DNS automatically** — this requires manual steps in both Vercel and VentraIP dashboards.

Also update `BASE_URL` environment variable in Vercel from `https://buyerside.stevenpicton.ai` to `https://clearoffer.com.au` once the domain is live.

---

## Sprint 2 — Wire Real Data

## Domain OAuth

- **Scope used:** `api_listings_read`
- **Auth endpoint:** `https://auth.domain.com.au/v1/connect/token`
- **Grant type:** `client_credentials`
- **Credentials required:** `DOMAIN_CLIENT_ID` and `DOMAIN_CLIENT_SECRET` — these are OAuth client credentials, different from the existing `DOMAIN_API_KEY` (which was used for the older API-key auth pattern). Both `DOMAIN_CLIENT_ID` and `DOMAIN_CLIENT_SECRET` must be added to `.env.local` and to Vercel environment variables before OAuth will work.
- **Token caching:** Token cached in memory per serverless function instance. Valid ~1 hour (expires_in minus 60s buffer).

## Domain Endpoints — Listings Management Sandbox

- **Used:** `POST /v1/listings/residential/_search` — searches by state + suburb, returns up to 20 listings
- **Address match logic:** Fuzzy match on street parts (>3 chars) against `propertyDetails.displayableAddress`. Falls back to first result if no match found.
- **Sandbox caveat:** Domain Listings Management is sandbox only at this stage. Real QLD properties may not appear — sandbox data may be synthetic. Treat listing data as "best effort" until production credentials are available.
- **Not available yet (403):** Address Suggestions, Agents & Listings, Price Estimation, Properties & Locations — all pending approval after Easter. These return 403 until approved.

## Address Autocomplete

- **Decision:** Switched from Domain Address Suggestions to Nominatim (OpenStreetMap). Domain Address Suggestions not yet approved.
- **Nominatim URL:** `https://nominatim.openstreetmap.org/search` — free, no API key, rate limit 1 req/sec
- **User-Agent required:** Nominatim policy requires a descriptive User-Agent header. Set to `BuyerSide/1.0 (buyerside.com.au)`.
- **Filter:** QLD only (`r.address.state === 'Queensland'`), max 5 results
- **When to replace:** When Domain Address Suggestions API is approved, swap `property-lookup.js` back to the Domain endpoint.

## ZoneIQ

- **Endpoint:** `https://zoneiq-sigma.vercel.app/api/lookup?address=...`
- **Timeout:** 8 seconds (AbortSignal.timeout)
- **Expected response shape:** `{ success: true, zone: { name, code }, overlays: { flood: { hasFloodOverlay, riskLevel }, character: { hasCharacterOverlay }, schools: [] } }`
- **If unavailable:** All ZoneIQ data falls back to safe defaults (`hasFloodOverlay: false`, `hasCharacterOverlay: false`, empty schools array). Never fails the main response.
- **Response time:** Not yet benchmarked from BuyerSide context — monitor in production.

## Supabase Integration

- **Pattern used:** Raw REST API fetch (same as `verify-access.js`) — avoids adding `@supabase/supabase-js` as a dependency since only `dotenv` is currently in `package.json`.
- **Table:** `scout_reports` — must be created manually in Supabase SQL editor (see schema in brief).
- **Upsert strategy:** `Prefer: resolution=merge-duplicates` on `(email, address)` unique constraint.
- **Failure handling:** Supabase errors are caught and logged but do not fail the response — email submission still succeeds even if DB write fails.

## Module System

- **Decision:** CommonJS (`require` / `module.exports`) for all new and rewritten API files. This matches `"type": "commonjs"` in `package.json`.
- **Existing files untouched:** `stripe-webhook.js`, `verify-access.js`, `create-checkout.js`, `generate-brief.js` — these use ESM (`import`/`export default`) and are left as-is since they are not imported by any of the new files.
- **Cross-file imports:** Only within new files (`submit-email.js` → `lib/domain-auth.js`, test files → `lib/domain-auth.js`). All CJS, no interop issues.

## URL / Navigation Changes

- **Before:** `scout-report.html?property=PROP_ID&address=ADDRESS` — used Domain property ID
- **After:** `scout-report.html?address=ADDRESS&lat=LAT&lng=LNG` — uses address + Nominatim coordinates
- **Impact on checkout:** `create-checkout.js` still expects `propertyId`. Workaround: passing `encodeURIComponent(address)` as `propertyId`. This works for Stripe metadata — no functional impact on payment flow. Refactor in Sprint 3 when address becomes the primary identifier throughout.

## Data Missing / Left as Stub

- **Price estimate:** `null` — stub ready for Domain Price Estimation (pending approval)
- **Comparable sales:** `[]` — stub ready for PropTechData (credentials pending from hello@proptechdata.com.au)
- **Suburb stats:** `null` — stub ready for PropTechData
- **Year built:** Not available from Domain Listings Search — left as hardcoded in property details grid
- **Council rates:** Not available from any current API — left as hardcoded
- **Agent track record:** Not available until Agents & Listings API is approved

## Sprint 3 Wiring (post-Easter)

When these are approved/received, wire in this order:
1. Domain Address Suggestions → replace Nominatim in `property-lookup.js`
2. Domain Price Estimation → replace `null` in `submit-email.js` response
3. PropTechData → replace `[]` comparables and `null` suburbStats
4. Domain Agents & Listings → agent track record in sidebar
