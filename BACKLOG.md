# ClearOffer — Backlog
*Last updated: 9 April 2026. Replaces previous BACKLOG.md.*

---

## How this works

Claude Code reads this file at the start of every session. Tasks marked [ ] are incomplete. Tasks marked [x] are done. Work top to bottom within each sprint. Do not start a sprint if its blocker condition is listed and unmet. Always read CLAUDE.md and DECISIONS.md before starting any sprint.

---

## External gates — not sprints, just blockers

These require Steve to take action outside the codebase. Claude Code cannot unblock these.

| Gate | Status | Steve action needed |
|---|---|---|
| Domain API approval | Unknown — not checked since before Easter | Log into developer.domain.com.au → check approval status for Address Suggestions, Agents & Listings, Price Estimation, Properties & Locations. Update this table when confirmed. |
| PropTechData credentials | Email sent, no response | Follow up with a call to hello@proptechdata.com.au. Key questions: (1) VG licence restriction on paid consumer reports? (2) Listed price alongside sold price? (3) Per-call pricing for AVM + suburb stats. Update this table when confirmed. |
| Launch decision | Pending | Decide: launch with smart stubs before Domain/PropTechData, or wait for real data? This determines whether Sprint 8 runs before or after Sprints 9/10. |
| 24hr follow-up trigger | Pending | Decide: Vercel cron (automatic hourly) or manual curl trigger for v1? Tell Claude Code before starting Sprint 7. |

---

## Sprint 4 — Foundations: Supabase, env cleanup, ZoneIQ validation

**Blocker:** None. Start here.

**What this sprint does:** Creates the scout_reports table in Supabase, wires the email gate so captures are actually stored, enforces one free report per email, validates ZoneIQ response shape, adds bushfire overlay to Scout Report display, and cleans up the env file to reflect current reality.

- [x] Check whether `scout_reports` table exists in Supabase project `fzykfxesznyiigoyeyed` by calling the Supabase REST API: `GET $SUPABASE_URL/rest/v1/scout_reports?limit=1` with service role key. If it returns a 404 or relation error, create the table via the Supabase REST API SQL endpoint: POST to `$SUPABASE_URL/rest/v1/rpc/` is not available for DDL — instead use the Management API or confirm table creation via a direct SQL call. Use the pattern: `POST $SUPABASE_URL/rest/v1/` with `Content-Type: application/json` and the service role key. If the Management API is not available, write the SQL to a file `scripts/create-scout-reports.sql` and log a clear message that it must be run manually in the Supabase SQL editor. The SQL to use: `create table if not exists scout_reports (id uuid default gen_random_uuid() primary key, email text not null, address text not null, created_at timestamptz default now(), report_data jsonb, followup_sent boolean default false, converted_to_paid boolean default false, unique(email, address));`
- [x] Check Vercel env vars are set for Production — use `vercel env ls` to confirm `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, and `ZONEIQ_URL` exist. For any that are missing: add them via `vercel env add`. `ZONEIQ_URL` value should be `https://zoneiq-sigma.vercel.app`. Log which vars were present and which were added.
- [x] Wire `submit-email.js` to Supabase — on email gate submission, first check whether this email already exists anywhere in `scout_reports` (any address). If it does, return a paywall response instead of a free Scout Report (one free report per email globally, per brief decision). If it does not exist, upsert `(email, address, followup_sent: false, converted_to_paid: false)` into `scout_reports`. Use raw REST fetch with `Prefer: resolution=merge-duplicates`. Supabase errors must be caught and logged — never block the email submission response.
- [x] Update `.env.example` to reflect current reality: add `ZONEIQ_URL=https://zoneiq-sigma.vercel.app`, add `GOOGLE_GEOCODING_API_KEY=` placeholder with comment "for future address search upgrade", update `BASE_URL` default to `https://clearoffer.com.au`, update `ALLOWED_ORIGIN` to `https://clearoffer.com.au`. Move `DOMAIN_API_KEY` out of the main section into a `# Pending API approval` section with comment: "Active listing data only — not sold/AVM data. Domain Insights/Pricefinder VG restriction does not apply to the developer API." Add `DOMAIN_CLIENT_ID` and `DOMAIN_CLIENT_SECRET` to the same pending section.
- [x] Add ZoneIQ response shape validation in `property-lookup.js`. After receiving a ZoneIQ response, validate it has `success: true` and the expected shape: `overlays.flood.hasFloodOverlay`, `overlays.character.hasCharacterOverlay`, `overlays.bushfire.hasBushfireOverlay`, `overlays.schools` array. If any field is missing or `success` is false, fall back to safe defaults (`hasFloodOverlay: false`, `hasCharacterOverlay: false`, `hasBushfireOverlay: false`, `schools: []`) and log a warning including the actual response shape received.
- [x] Add bushfire overlay display to Scout Report — ZoneIQ Sprint 8 added bushfire data. Wire `overlays.bushfire.hasBushfireOverlay` into the Scout Report overlay section. Display as a bushfire flag row using the same visual pattern as the existing flood overlay row.
- [x] Update DECISIONS.md: document Supabase wiring pattern, one-free-report-per-email logic, ZoneIQ response validation approach, and env var changes.
- [x] Commit: `Sprint 4: Supabase email gate, one-report-per-email, ZoneIQ validation, bushfire overlay, env cleanup`

---

## Sprint 5 — Scout Report: replace mock data with live data and smart stubs

**Blocker:** Sprint 4 complete.

**What this sprint does:** The Scout Report is hardcoded for 14 Riverview Tce Chelmer. This sprint replaces every field with either live ZoneIQ data or a well-designed smart stub. After this sprint a real Brisbane address returns real overlay data and honest stubs everywhere else.

- [ ] Audit every data field displayed in `scout-report.html` and all contributing API routes. Classify each field as: (a) live from ZoneIQ, (b) live from Domain sandbox, (c) hardcoded mock for Chelmer demo, or (d) already a smart stub. Write the full audit as a comment block at the top of `property-lookup.js`.
- [ ] Confirm the smart stubs from DECISIONS.md Sprint 3 are actually rendering for non-Chelmer addresses. The stubs are: listing price → "See agent listing" (italic, muted), days on market → "Listed recently", agent name → "Contact selling agent". If any of these are still returning the Chelmer hardcoded values for a different address, fix them.
- [ ] Build a static suburb median lookup table as a JS object in `property-lookup.js` — keyed by Brisbane suburb name, value is approximate median house price. Manually curate the top 100 Brisbane suburbs by property search volume using publicly available ABS/REA data. Zero per-call cost. Add a comment: `// UPDATE QUARTERLY — source: ABS / REA public data`. Use this table to populate suburb median in the Scout Report, falling back to null if the suburb is not in the table.
- [ ] Replace hardcoded comparable sales section with a deliberately incomplete stub — display 3 placeholder rows with blurred/redacted prices and the label "Comparable sales — included in your free Scout Report." Style as a teaser that creates curiosity, not an error state. Note: comparables are free per the brief but withheld at Stage 1 to drive email gate conversion.
- [ ] Replace hardcoded property estimate with a teaser: "Estimated value range — unlocked in your Scout Report." Styled as a locked section, consistent with other teaser elements.
- [ ] Replace hardcoded demand/supply meters with values derived from the static suburb lookup table where possible (e.g. derive demand signal from days-on-market data if available). Where not available, show neutral 50/50 with label "Based on current suburb data."
- [ ] Verify Nominatim autocomplete is returning results for real Brisbane QLD addresses. Test with at least 3 addresses. If broken, fix. Do not replace with Google Geocoding — stays on Nominatim until Domain API approval.
- [ ] Update DECISIONS.md: document static suburb lookup table approach and stub strategy.
- [ ] Commit: `Sprint 5: Live ZoneIQ data, suburb lookup table, smart stubs throughout Scout Report`

---

## Sprint 6 — Buyer's Brief: prompt rewrite and paid report quality

**Blocker:** Sprint 4 complete. Steve must read the current Buyer's Brief output on a real test purchase and provide notes before Claude Code starts this sprint. Add notes below before triggering.

**Steve notes on current Buyer's Brief quality:**
*(paste here before running this sprint)*

- [ ] Read the current Claude system prompt in `generate-brief.js` (or wherever it lives — search the repo if needed). Read it against the paid report spec in the project brief. Write an audit of gaps to DECISIONS.md: missing sections, thin sections, sections that are generic rather than Brisbane-specific.
- [ ] Rewrite the system prompt. Required sections per brief: (1) Offer Recommendation — specific opening dollar figure, target settlement range, walk-away price, reasoning grounded in comparable evidence, exact words to say to the agent. (2) Negotiating Leverage — DOM vs suburb average, comparable sold prices vs asking price, active supply signals. No agent vendor discount data (deferred out of v1). (3) Flood Risk in Plain English — what the overlay category means, estimated insurance premium impact annual cost range, lender appetite and LVR caps on flood-mapped properties, resale pool impact, post-2022 Brisbane flood context specifically, what to do before exchanging contracts. (4) 5–10 Year Suburb Outlook — Cross River Rail, Olympics 2032 corridor, rezoning and density risk, school catchment ICSEA score, 10-year CAGR vs Brisbane average, honest structural headwinds. (5) The Smart Case for This Property — why it makes sense at the right price, vs 2–3 named comparable alternatives at the same price point, who this property is and isn't right for. (6) What the Agent Won't Tell You — 4–6 specific uncomfortable truths, written confidently from the data, no softening.
- [ ] Add price anchoring to the Buyer's Brief page — above the fold before report content: "A buyer's agent charges $8,000–$15,000. Your Buyer's Brief is $149." Style to match existing design.
- [ ] Add social proof counter to the landing page hero and Scout Report paid CTA: "X Brisbane buyers got a Buyer's Brief this week." Hardcode at a plausible starting number. Add HTML comment `<!-- UPDATE WEEKLY -->` at each instance.
- [ ] Verify Claude response streams to screen in real time on the Buyer's Brief page. If the page shows a spinner then dumps the full text at once, streaming is not working — fix it. If streaming is already working, confirm with a test and document in DECISIONS.md.
- [ ] Commit: `Sprint 6: Buyer's Brief prompt rewrite, price anchoring, social proof, streaming verified`

---

## Sprint 7 — Email sequences: confirmation + 24hr follow-up

**Blocker:** Sprint 4 complete. Steve must decide on cron vs manual trigger before this sprint runs (see external gates above). Update the task below with the decision before triggering.

**Trigger approach chosen by Steve:** *(cron / manual — fill in before running)*

- [ ] Verify the Scout Report confirmation email is actually sending via Resend on email gate submission. Check Resend dashboard for sent events. If it is not sending, debug `submit-email.js` — the Resend call should already be there per DECISIONS.md Sprint 3. Fix if broken.
- [ ] Create `api/send-followup.js` — accepts email and address, sends the 24hr follow-up email via Resend. Subject: `Still thinking about [address]? Here's what the Buyer's Brief would tell you.` Body: 3–4 sentences teasing the specific paid sections — flood risk in plain English, exact offer recommendation, what the agent won't tell you. CTA button linking to the Scout Report for that address with a prompt to purchase. From: hello@clearoffer.com.au. Guard with `process.env.RESEND_API_KEY` check — log and skip silently if not set.
- [ ] Create `api/mark-converted.js` — called from the Stripe webhook on `checkout.session.completed`. Updates `converted_to_paid: true` in `scout_reports` for the matching email + address. Add a call to this from `stripe-webhook.js` after successful payment. This prevents follow-up emails going to buyers who already purchased.
- [ ] Create `api/cron-followup.js` — queries Supabase for rows where `followup_sent = false AND converted_to_paid = false AND created_at < now() - interval '24 hours'`. For each matching row: call `send-followup.js` logic, then set `followup_sent: true`. Process max 50 rows per run to stay within Vercel function timeout.
- [ ] If trigger approach is CRON: add cron entry to `vercel.json` — run `cron-followup.js` hourly: `{"crons": [{"path": "/api/cron-followup", "schedule": "0 * * * *"}]}`. Also add `CRON_SECRET` env var via `vercel env add` and guard the cron endpoint so it only runs when called with that secret.
- [ ] If trigger approach is MANUAL: do not add vercel.json cron. Instead write the curl trigger command to DECISIONS.md so Steve can run it on demand.
- [ ] Update DECISIONS.md with email sequence architecture and chosen trigger approach.
- [ ] Commit: `Sprint 7: 24hr follow-up email, conversion tracking, cron or manual trigger`

---

## Sprint 8 — Stripe live mode + pre-launch checklist

**Blocker:** Sprints 4, 5, 6, 7 complete. Steve must add live Stripe keys to Vercel env before this sprint runs (Claude Code cannot access Stripe Dashboard to retrieve them).

**Steve action before this sprint:** In Stripe Dashboard switch ClearOffer to live mode. Add `STRIPE_SECRET_KEY` (live) and `STRIPE_WEBHOOK_SECRET` (live) to Vercel env under Production scope only. Keep test keys scoped to Preview. Then trigger this sprint.

- [ ] Confirm live Stripe keys are present in Vercel Production env via `vercel env ls`. If test keys are present in Production, warn loudly in the log but do not overwrite — flag to Steve.
- [ ] Add Stripe key mode guard in `create-checkout.js` — on startup, log whether the key is live or test. Add `console.warn` if `NODE_ENV === 'production'` and `STRIPE_SECRET_KEY` starts with `sk_test_`.
- [ ] Confirm `BASE_URL` in Vercel Production env is `https://clearoffer.com.au`. If it is still the old buyerside subdomain, update it via `vercel env add`.
- [ ] Add "Powered by ZoneIQ" attribution to Scout Report footer — small grey text, link to zoneiq.com.au.
- [ ] Add legal disclaimer to Scout Report and Buyer's Brief footers: "This report is market research and analysis, not a formal property valuation. It is not suitable for lending, legal, or insurance purposes. ClearOffer is not a registered property valuer. Always obtain independent legal and financial advice before purchasing property."
- [ ] Run pre-launch checklist and write results to `LAUNCH_CHECKLIST.md`. For each item, record pass/fail and any notes: Scout Report loads for a real Brisbane address; ZoneIQ overlays return and display correctly; flood, character, bushfire overlays all show; email gate captures to Supabase; one-free-report-per-email enforcement works on second attempt with same email; confirmation email sends via Resend; Stripe checkout creates a session; Buyer's Brief generates with streaming; Stripe webhook fires and sets converted_to_paid; follow-up email does not send after conversion; legal disclaimer present on both pages; ZoneIQ attribution present; mobile layout renders at 375px viewport; no console errors on any page.
- [ ] Commit: `Sprint 8: Stripe live mode guard, launch checklist, legal disclaimer, ZoneIQ attribution`

---

## Sprint 9 — Domain API: active listing data

**Blocker:** Steve confirms Domain API approval in the external gates table above. Sprint 4 complete.

**Context:** Domain is for active listing data only — listing price, beds/baths, days on market, agent name, photos. Sold transaction data and AVM from Domain Insights/Pricefinder are permanently off the table (VG licence restriction on that product). The developer API is a separate product and does not carry that restriction.

- [ ] Test Domain OAuth by running `lib/domain-auth.js` — call the token endpoint and confirm a valid token is returned. Log the result. Do not proceed to other tasks until OAuth is confirmed working. If it fails, debug the OAuth flow using DECISIONS.md Sprint 2 notes before touching any other file.
- [ ] Replace Nominatim address autocomplete in `property-lookup.js` with Domain Address Suggestions endpoint. QLD filter only. Max 5 results. Frontend autocomplete UX unchanged — only the data source changes.
- [ ] Wire Domain Properties & Locations into `property-lookup.js` — retrieve listing price, beds, bathrooms, car spaces, land size, days on market, agent name, agency name, listing photos URL. Replace all stubs with real data where available. Keep stubs as fallback if Domain returns nothing for an address.
- [ ] Wire Domain Price Estimation into Scout Report — replaces price estimate stub with a real AVM range for the active listing.
- [ ] Wire Domain Agents & Listings — pull agent name and agency for display. Agent performance data (track record stats) remains deferred out of v1.
- [ ] Update `.env.example`: move `DOMAIN_CLIENT_ID` and `DOMAIN_CLIENT_SECRET` from the pending section to the main section.
- [ ] Update DECISIONS.md with Domain API integration details.
- [ ] Commit: `Sprint 9: Domain API live — autocomplete, listing data, price estimate`

---

## Sprint 10 — PropTechData: AVM, comparables, suburb stats

**Blocker:** Steve confirms PropTechData in the external gates table above — VG restriction confirmed as not applying, pricing acceptable, credentials received. Sprint 4 complete.

- [ ] Add `PROPTECH_DATA_API_KEY` to Vercel Production env via `vercel env add`. Update `.env.example` — move from pending section to main section.
- [ ] Create `lib/proptech-data.js` — wrapper with three functions: `getAVM(address)`, `getComparableSales(suburb, bedrooms, limit=5)`, `getSuburbStats(suburb)`. All functions return null on failure and log the error — never crash the main response.
- [ ] Wire AVM into Scout Report — replaces price estimate stub with PropTechData estimated value range. Display as "Estimated value: $X – $Y" with note "Based on comparable sales data."
- [ ] Wire comparable sales into Scout Report — 5 recent sales with address, sold price, sold date, beds/baths. No listed price, no vendor discount percentage (per brief decision — vendor discount repositioned as narrative derived from DOM signals and price-to-comparable gap).
- [ ] Wire suburb stats into Scout Report — median house price, days on market, clearance rate, 12-month price growth. PropTechData values override the static lookup table from Sprint 5. Keep lookup table as fallback.
- [ ] Wire PropTechData context into the Buyer's Brief Claude prompt — pass AVM, comparable sales, and suburb stats as structured context so the AI analysis is grounded in real data for that specific address.
- [ ] Update DECISIONS.md.
- [ ] Commit: `Sprint 10: PropTechData live — AVM, comparables, suburb stats in Scout Report and Buyer's Brief`

---

## Sprint 11 — Smoke tests

**Blocker:** Sprint 4 complete. Can run in test mode at any point — does not need Stripe live mode.

- [ ] Add Jest and supertest as dev dependencies: `npm install --save-dev jest supertest`. Update `package.json` scripts: `"test": "jest"`.
- [ ] Write smoke test: Scout Report API returns 200 for address "14 Riverview Tce, Chelmer QLD 4068". Assert response body contains `address`, `overlays`, `suburb`.
- [ ] Write smoke test: Stripe checkout API returns 200 and response contains `sessionId` or `url` when called with a valid address.
- [ ] Write smoke test: email gate submission to `submit-email.js` returns 200 and does not throw for a valid email + address payload.
- [ ] Run `npm test` and confirm all three pass. Fix any failures before committing.
- [ ] Commit: `Sprint 11: Smoke tests — Scout Report, Stripe checkout, email gate`

---

## Deferred — not in v1

Intentional decisions. Do not build until v1 is launched and generating revenue.

- **Agent vendor discount data** — out of v1. Negotiation section uses DOM vs suburb average and comparable sales gap instead.
- **Google Geocoding for ClearOffer address search** — Domain API replaces Nominatim when approved. Google Geocoding not needed for this use case.
- **Suburb lookup table quarterly update process** — table built in Sprint 5, update process scheduled post-launch.
- **Google Ads** — only after at least one real live paid purchase validated end-to-end.
- **r/AusPropertyChat posting** — after launch.
- **Sydney / Melbourne expansion** — same code, different ZoneIQ data. Post-revenue.
- **PDF email of Buyer's Brief** — on-screen delivery is v1. Puppeteer PDF generation is v2.
- **Subscription model** — explicitly rejected per brief decisions.

---

## Done

- [x] Sprint 1–3: Setup, overlays, rebrand BuyerSide → ClearOffer
- [x] Smart placeholders for missing API data
- [x] Resend wired, hello@clearoffer.com.au verified
- [x] clearoffer.com.au domain live and DNS configured
- [x] Claude AI streaming Buyer's Brief (live, real API)
- [x] Stripe payment flow ($149 AUD, test mode)
- [x] ZoneIQ integration (flood, character, schools, bushfire) via zoneiq-sigma.vercel.app
- [x] Domain OAuth lib created (lib/domain-auth.js)
- [x] Nominatim address autocomplete (temporary)
- [x] Git → GitHub → Vercel auto-deploy pipeline
