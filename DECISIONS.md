# BuyerSide — Sprint 2 Decisions Log

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
