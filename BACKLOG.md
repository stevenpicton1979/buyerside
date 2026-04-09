# ClearOffer — Backlog
*Repo: stevenpicton1979/buyerside (main branch)*
*Read STATE.md in portfoliostate repo before starting any sprint.*
*Run `vercel dev --listen 3001` for local dev. Never use `npm run dev`.*

---

## How to run a sprint

```
claude --dangerously-skip-permissions
```

Read this file, find the next sprint with unchecked tasks, execute it completely.
Mark each `[ ]` as `[x]` when done.
Log to `OVERNIGHT_LOG.md` with timestamps.
Do not stop mid-sprint.
Do not deploy to Vercel — local only until Steve says otherwise.

---

## Architectural constraints — read before every sprint

1. **PropTechData is NEVER called on the free report.** Paid report only. See `api/buyers-brief.js`.
2. **ZoneIQ is the primary overlay source.** Always `zoneiq-sigma.vercel.app`. See `api/zone-lookup.js`.
3. **Free report cost target: under $0.15 per lookup.** No external API calls except ZoneIQ + Claude Haiku.
4. **Always check ZoneIQ OpenAPI spec before wiring new overlay fields:** `https://zoneiq-sigma.vercel.app/api/openapi`
5. **Supabase: raw REST fetch only**, no @supabase/supabase-js. Pattern in `api/config.js`.
6. **CommonJS throughout** — `require`/`module.exports`. No ESM.
7. **COMING_SOON env var** controls root route — `true` serves coming-soon.html, `false` serves index.html.

---

## Sprint 1 — Smoke test pass + local dev verification
*Status: READY — do this first after copying files into repo*

- [ ] Run `npm install` to install stripe dependency
- [ ] Run `vercel env pull` to pull .env.local from Vercel
- [ ] Start `vercel dev --listen 3001` and confirm server starts without errors
- [ ] Confirm `GET http://localhost:3001/` returns 200 (coming-soon or index depending on COMING_SOON env var)
- [ ] Confirm `GET http://localhost:3001/report.html` returns 200
- [ ] Confirm `GET http://localhost:3001/api/suburb-stats?suburb=Chelmer` returns JSON with median > 0
- [ ] Confirm `GET http://localhost:3001/api/zone-lookup?address=14+Riverview+Tce+Chelmer+QLD+4068` returns JSON with overlays object
- [ ] Confirm `POST http://localhost:3001/api/verdict` with `{"address":"14 Riverview Tce, Chelmer QLD 4068","listingPrice":1350000,"daysOnMarket":41}` returns a verdict string
- [ ] Run `node scripts/smoke-test.js` — all tests must pass before marking sprint done
- [ ] Fix any failures found. Log each fix in OVERNIGHT_LOG.md.

---

## Sprint 2 — Address autocomplete UX polish
*Status: READY — unblocked*
*Depends on: Sprint 1 complete, GOOGLE_GEOCODING_API_KEY set in .env.local*

- [ ] Verify `GET /api/autocomplete?q=14+Riverview` returns suggestions from Google Places
- [ ] If GOOGLE_GEOCODING_API_KEY missing or quota exceeded: add a graceful typed-entry fallback — user can type full address and press enter without autocomplete
- [ ] Add keyboard navigation to autocomplete dropdown (arrow keys + enter selects)
- [ ] Add loading indicator in search box while autocomplete is fetching (small spinner replacing search icon)
- [ ] Test on mobile viewport (375px width) — autocomplete list must not overflow screen
- [ ] On mobile, dismiss keyboard when suggestion is selected (`addressInput.blur()`)
- [ ] Add `data-testid` attributes to `#address-input`, `#search-btn`, `#autocomplete-list` for future Playwright tests

---

## Sprint 3 — Scout Report overlay display QA
*Status: READY — unblocked*
*Depends on: Sprint 1 complete*

Test the full Scout Report render against these Brisbane addresses. For each, check overlays display correctly (no crashes, correct pill colours, plain English text):

- [ ] `14 Riverview Tce, Chelmer QLD 4068` — expect: flood (FHA code), character overlay, school catchment
- [ ] `52 Birdwood Tce, Toowong QLD 4066` — general inner-west test
- [ ] `7 Wynnum Rd, Norman Park QLD 4170` — riverside, expect flood overlay
- [ ] `25 Racecourse Rd, Hamilton QLD 4007` — high-end, expect no flood
- [ ] `18 Collingwood St, Albion QLD 4010` — industrial fringe, test partial response handling

For each address:
- [ ] ZoneIQ returns without timeout
- [ ] If `meta.partial: true`, the amber warning banner shows (not a crash)
- [ ] Flood pill is correct colour (red/amber/green based on code)
- [ ] School ICSEA numbers render if present
- [ ] AVM teaser range renders (suburb median ±8%)
- [ ] Demand meter animates in
- [ ] No JS console errors on load

Log results in OVERNIGHT_LOG.md. If ZoneIQ returns unexpected shape for any address, update `normaliseFlood`/`normaliseSchools` etc. in `api/zone-lookup.js` accordingly.

---

## Sprint 4 — Email gate + Supabase integration test
*Status: READY — unblocked*
*Depends on: Sprint 1 complete, SUPABASE_URL + SUPABASE_SERVICE_KEY set*

- [ ] Run `scripts/create-tables.sql` in Supabase SQL editor if tables don't exist yet
- [ ] Confirm `scout_reports` table has columns: `id, email, address, created_at, report_data, followup_sent, converted_to_paid`
- [ ] Confirm `suburb_stats_cache` table exists
- [ ] Test email gate: submit `test+sprint4@clearoffer-test.com` for `14 Riverview Tce, Chelmer QLD 4068`
- [ ] Confirm row appears in Supabase `scout_reports` with `followup_sent=false, converted_to_paid=false`
- [ ] Test one-free-per-email: submit same email again — confirm `already_used` response and redirect to upsell
- [ ] Test Resend confirmation email: check `hello@clearoffer.com.au` inbox (or use Resend dashboard) — confirm email sent with correct address in subject
- [ ] If Resend free tier limit hit: log warning, do not fail the report delivery
- [ ] Test invalid email `notanemail` → confirm 400 response
- [ ] Check redirect from index.html → report.html passes `email` param in URL correctly

---

## Sprint 5 — Stripe checkout integration test
*Status: READY — test mode only*
*Depends on: Sprint 4 complete, STRIPE_SECRET_KEY (test) set*

- [ ] Confirm Stripe test mode key is `sk_test_...` — do NOT proceed if it's `sk_live_...`
- [ ] Create a Stripe test price: `$149 AUD` one-time in Stripe dashboard, note the Price ID
- [ ] Update `api/create-checkout.js` to use `price_data` (already done — confirm dynamic pricing works without a pre-created price ID, or switch to static price ID if preferred)
- [ ] Test checkout: submit real email through report.html, click CTA, confirm Stripe checkout page opens
- [ ] Use Stripe test card `4242 4242 4242 4242` to complete payment
- [ ] Confirm redirect to `success.html` with `session_id` param
- [ ] Confirm redirect from `success.html` to `buyers-brief.html` after 3 seconds
- [ ] Set up Stripe webhook in Stripe dashboard: endpoint `http://localhost:3001/api/stripe-webhook` (use Stripe CLI for local: `stripe listen --forward-to localhost:3001/api/stripe-webhook`)
- [ ] Confirm webhook fires and `converted_to_paid` is set to `true` in Supabase
- [ ] Confirm `buyers-brief.html` payment verification passes after webhook fires
- [ ] Test failed payment (Stripe test card `4000 0000 0000 0002`) — confirm cancel redirect back to report

---

## Sprint 6 — Buyer's Brief generation test
*Status: READY*
*Depends on: Sprint 5 complete, ANTHROPIC_API_KEY set*

- [ ] Manually set `converted_to_paid=true` in Supabase for a test email+address row
- [ ] Navigate to `buyers-brief.html?address=14+Riverview+Tce%2C+Chelmer+QLD+4068&email=YOUR_TEST_EMAIL`
- [ ] Confirm streaming starts within 3 seconds
- [ ] Confirm progress bar advances during streaming
- [ ] Confirm all 7 sections render: Valuation Assessment, Comparables, Risk Flags, Market Context, Negotiation, Opening Offer, What the Agent Won't Tell You, 5-10yr Outlook
- [ ] Confirm PropTechData stub values are clearly labelled (look for `_stub: true` in server logs)
- [ ] Confirm switching to complete state after streaming ends (progress hits 100%, full report shows)
- [ ] Confirm qualifier selections from report.html are passed through sessionStorage
- [ ] Test with renovation status "original condition" + road type "main road" — confirm Claude mentions these in the valuation adjustment
- [ ] Check brief content reads as confident and specific (not hedged), no raw markdown showing

---

## Sprint 7 — Follow-up email job test
*Status: READY*
*Depends on: Sprint 4 complete, CRON_SECRET set in .env.local*

- [ ] Add `CRON_SECRET=test-secret-local` to .env.local
- [ ] Manually insert a test row into `scout_reports` with `created_at = NOW() - INTERVAL '24 hours'`, `followup_sent=false`, `converted_to_paid=false`
- [ ] Hit `GET http://localhost:3001/api/send-followup?secret=test-secret-local`
- [ ] Confirm response: `{ "processed": 1, "results": [{ "status": "sent" }] }`
- [ ] Confirm `followup_sent=true` in Supabase for that row
- [ ] Confirm follow-up email received (check Resend dashboard)
- [ ] Test auth: `GET /api/send-followup` without secret → confirm 401
- [ ] Test idempotency: run job again → confirm already-sent row not re-processed (followup_sent=true filters it out)
- [ ] Test that `__waitlist__` address rows are excluded from follow-up

---

## Sprint 8 — Mobile QA pass
*Status: READY*
*Depends on: Sprint 3 complete*

Test entire flow at 375px viewport (iPhone SE) in browser devtools:

- [ ] index.html: hero, search box, autocomplete fully usable
- [ ] Stage 1 verdict displays correctly (no overflow)
- [ ] Email gate form usable on mobile (input + button stack vertically)
- [ ] report.html: stat row wraps gracefully (2×2 grid at narrow width)
- [ ] Overlay pills wrap without overflow
- [ ] Qualifier option buttons wrap to multiple rows without breaking layout
- [ ] Locked section blur effect renders on iOS Safari (test `-webkit-backdrop-filter` fallback)
- [ ] CTA block readable and button full-width
- [ ] buyers-brief.html: streaming content readable, no horizontal scroll
- [ ] `font-size: 16px` on all inputs (prevents iOS auto-zoom — check CSS)
- [ ] Test at 768px (iPad) — layout should look good without mobile-specific fixes

Fix any mobile issues found. Log in OVERNIGHT_LOG.md.

---

## Sprint 9 — Domain API integration (BLOCKED — pending approval)
*Status: BLOCKED — do not start until Steve confirms Domain API is approved*
*Trigger: Steve says "Domain API approved" in Slack or chat*

When unblocked:
- [ ] Read Domain developer API docs at developer.domain.com.au
- [ ] Implement OAuth2 client credentials flow in `api/domain-token.js`
- [ ] Implement `api/listing-data.js` — fetch active listing by address (price, beds, baths, DOM, agent)
- [ ] Update `index.html` Stage 1 to call `/api/listing-data` and populate real stats
- [ ] Update `report.html` to use real DOM vs suburb average in stat row
- [ ] Replace Nominatim references with Domain autocomplete (if approved for that use)
- [ ] Update verdict prompt to include real DOM + listing price
- [ ] Degrade gracefully if Domain returns no listing (property may be off-market)
- [ ] Smoke test with 5 live Brisbane listings

---

## Sprint 10 — PropTechData integration (BLOCKED — pending terms confirmation)
*Status: BLOCKED — do not start until Steve confirms VG licence + pricing*
*Trigger: Steve says "PropTechData confirmed" in Slack or chat*

**Critical questions confirmed before starting:**
- VG licence permits individual sold transactions in paid consumer reports? (YES/NO)
- Pricing per call? Monthly minimum?
- Listed price alongside sold price available?
- AVM confidence score returned?

When unblocked:
- [ ] Read Nexu API docs at api.nexu.com.au
- [ ] Implement `api/proptech-client.js` — auth, error handling, retry logic
- [ ] Wire `/properties/avm` into `api/buyers-brief.js` (replace stub in `fetchPropTechData`)
- [ ] Wire `/market-activity/sales` for comparable sales
- [ ] Wire `/suburbs/statistics` for suburb stats (replace static lookup in `api/config.js`)
- [ ] Wire `/suburbs/timeseries` for 10yr chart data
- [ ] Set up monthly suburb stats cache job: `scripts/cache-suburb-stats.js` → writes to `suburb_stats_cache` table
- [ ] Update Buyer's Brief prompt to include real AVM confidence + comparable details
- [ ] Smoke test paid brief: confirm AVM within 15% of listing price for test addresses
- [ ] Remove `_stub: true` flags from PropTechData stub

---

## Sprint 11 — Launch prep (BLOCKED — pending Steve's go signal)
*Status: BLOCKED — do not start until Steve says ready to launch*

- [ ] Set `COMING_SOON=false` in Vercel production environment variables
- [ ] Switch Stripe to live mode: update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel
- [ ] Update Stripe webhook endpoint URL to `https://clearoffer.com.au/api/stripe-webhook`
- [ ] Set `BASE_URL=https://clearoffer.com.au` in Vercel production
- [ ] Set `ALLOWED_ORIGIN=https://clearoffer.com.au` in Vercel production
- [ ] Set `CRON_SECRET` to a strong random string in Vercel production
- [ ] Wire follow-up cron: set up Vercel Cron or external service to hit `/api/send-followup?secret=CRON_SECRET` daily at 10am AEST
- [ ] Final smoke test against production URL
- [ ] Update `SOCIAL_PROOF` string in `public/js/config.js` to a real number <!-- UPDATE WEEKLY -->
- [ ] Post announcement (r/Brisbane, r/AusPropertyChat or similar)
- [ ] Update `STATE.md` in portfoliostate repo: mark ClearOffer status as LAUNCHED

---

## Ideas / future sprints (not scheduled)

- PDF generation for Buyer's Brief (v2) — Puppeteer or html-pdf-node
- Stripe webhook: trigger follow-up email with PDF attachment on `checkout.session.completed`
- Sydney expansion — ZoneIQ now has NSW coverage, same flow applies
- Melbourne expansion — ZoneIQ has VIC coverage
- Agent lookup — Domain API agent profile (not vendor discount, just name + listing count)
- Avalon Airport ANEF — ZoneIQ Sprint 28 found queryable layers, add to ZoneIQ then expose here
- Suburb stats chart — 10yr timeseries from PropTechData rendered as SVG sparkline
- Coming soon waitlist → Resend broadcast email on launch day
