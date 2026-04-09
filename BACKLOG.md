# ClearOffer — Backlog
*Last updated: 9 April 2026. Sprints 4 & 5 complete.*

---

## How this works

Claude Code reads this file at the start of every session. Tasks marked [ ] are incomplete. Tasks marked [x] are done. Work top to bottom within each sprint. Do not start a sprint if its blocker condition is listed and unmet. Always read CLAUDE.md and DECISIONS.md before starting any sprint.

---

## External gates — not sprints, just blockers

| Gate | Status | Steve action needed |
|---|---|---|
| Domain API approval | Unknown — not checked since before Easter | Log into developer.domain.com.au → check approval status for Address Suggestions, Agents & Listings, Price Estimation, Properties & Locations. Update this table when confirmed. |
| PropTechData credentials | Email sent, no response | Follow up with a call. Key questions: (1) VG licence restriction on paid consumer reports? (2) Listed price alongside sold price? (3) Per-call pricing for AVM + suburb stats. |
| Supabase column migration | PENDING MANUAL ACTION | Run scripts/create-scout-reports.sql in Supabase SQL editor for project dqzqqfcepsqhaxovneen. Adds followup_sent and converted_to_paid columns. Must be done before Sprint 7. |
| Launch decision | Pending | Decide: launch with smart stubs before Domain/PropTechData, or wait for real data? |
| 24hr follow-up trigger | Pending | Decide: Vercel cron (automatic hourly) or manual curl trigger for v1? Fill in Sprint 7 before triggering. |

---

## Sprint 6 — Buyer's Brief: prompt rewrite and paid report quality

**Blocker:** Sprints 4 & 5 complete ✓. Steve must read the current Buyer's Brief output on a real test purchase and provide notes before Claude Code starts this sprint.

**Steve notes on current Buyer's Brief quality:**
*(paste here before running this sprint)*

- [ ] Read the current Claude system prompt in `generate-brief.js` (search repo if location unclear). Audit every section against the paid report spec. Write gap analysis to DECISIONS.md: missing sections, thin sections, anything generic rather than Brisbane-specific.
- [ ] Rewrite the system prompt. Required sections: (1) Offer Recommendation — specific opening dollar figure, target settlement range, walk-away price, reasoning from comparable evidence, exact words to say to the agent. (2) Negotiating Leverage — DOM vs suburb average, comparable sold prices vs asking price, active supply signals. No agent vendor discount data (deferred). (3) Flood Risk in Plain English — what the FPA overlay code means (R1–R5 for QLD), estimated insurance premium impact, lender appetite and LVR caps on flood-mapped properties, resale pool impact, post-2022 Brisbane flood context, what to do before exchanging contracts. (4) 5–10 Year Suburb Outlook — Cross River Rail, Olympics 2032 corridor, rezoning and density risk, school catchment ICSEA score, 10-year CAGR vs Brisbane average, honest structural headwinds. (5) The Smart Case for This Property — why it makes sense at the right price, vs 2–3 named comparable alternatives at the same price point, who this property is and isn't right for. (6) What the Agent Won't Tell You — 4–6 specific uncomfortable truths, written confidently, no softening.
- [ ] Surface richer ZoneIQ data in the Buyer's Brief prompt context. ZoneIQ now returns: flood FPA code (R1–R5, river + overland flow), bushfire hazard (4 intensity classes), heritage (is_heritage, heritage_type, heritage_name), aircraft noise ANEF contour and airport name, school catchments (primary + secondary, catchment name). Pass all available overlay fields as structured context into the Claude prompt so the AI can reference them specifically — e.g. "This property is in R2A flood overlay" not just "flood risk present."
- [ ] Add heritage overlay to Scout Report display — ZoneIQ now returns heritage data. Add a heritage flag row to the overlay section (same visual pattern as flood and bushfire). Show heritage type and name if is_heritage is true.
- [ ] Add aircraft noise overlay to Scout Report display — ZoneIQ returns ANEF contour and airport name. Add a noise row to the overlay section. Only show if an ANEF contour is present (most properties won't have one).
- [ ] Add price anchoring above the Buyer's Brief paywall CTA: "A buyer's agent charges $8,000–$15,000. Your Buyer's Brief is $149." Style to match existing design.
- [ ] Add social proof counter to landing page hero and Scout Report paid CTA: "X Brisbane buyers got a Buyer's Brief this week." Hardcode at a plausible starting number. Add HTML comment `<!-- UPDATE WEEKLY -->` at each instance.
- [ ] Verify Claude response streams to screen in real time on the Buyer's Brief page. If broken, fix. Document result in DECISIONS.md.
- [ ] Update DECISIONS.md: document prompt rewrite rationale, new ZoneIQ fields being passed as context, heritage and noise overlay additions.
- [ ] Commit: `Sprint 6: Buyer's Brief prompt rewrite, richer ZoneIQ context, heritage + noise overlays, price anchoring`

---

## Sprint 7 — Email sequences: confirmation + 24hr follow-up

**Blocker:** Sprint 4 complete ✓. Supabase column migration must be run first (see external gates). Steve must decide cron vs manual before triggering.

**Trigger approach chosen by Steve:** *(cron / manual — fill in before running)*

- [ ] Verify Scout Report confirmation email is actually sending via Resend on email gate submission. Check Resend dashboard for sent events against a test submission. Fix if broken.
- [ ] Create `api/send-followup.js` — accepts email and address, sends the 24hr follow-up via Resend. Subject: `Still thinking about [address]? Here's what the Buyer's Brief would tell you.` Body: 3–4 sentences teasing flood risk in plain English, exact offer recommendation, what the agent won't tell you. CTA button to Scout Report for that address. From: hello@clearoffer.com.au. Guard with RESEND_API_KEY check.
- [ ] Create `api/mark-converted.js` — sets `converted_to_paid: true` in scout_reports for matching email + address. Wire into `stripe-webhook.js` on `checkout.session.completed`.
- [ ] Create `api/cron-followup.js` — queries Supabase for `followup_sent = false AND converted_to_paid = false AND created_at < now() - interval '24 hours'`. Sends follow-up via send-followup.js logic, sets `followup_sent: true`. Max 50 rows per run.
- [ ] If CRON: add hourly cron to `vercel.json`, add `CRON_SECRET` env var via `vercel env add`, guard the endpoint with that secret.
- [ ] If MANUAL: do not add cron. Write curl trigger command to DECISIONS.md.
- [ ] Update DECISIONS.md with email sequence architecture and trigger approach.
- [ ] Commit: `Sprint 7: 24hr follow-up email, conversion tracking`

---

## Sprint 8 — Stripe live mode + pre-launch checklist

**Blocker:** Sprints 4–7 complete. Steve must add live Stripe keys to Vercel Production env before triggering (Claude Code cannot retrieve them from Stripe Dashboard).

**Steve action before this sprint:** In Stripe Dashboard switch ClearOffer to live mode. Add live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Vercel Production env only. Keep test keys scoped to Preview.

- [ ] Confirm live Stripe keys are present in Vercel Production env via `vercel env ls`. If test keys are in Production, warn loudly in log but do not overwrite — flag to Steve.
- [ ] Add Stripe key mode guard in `create-checkout.js` — log live vs test on startup. `console.warn` if `NODE_ENV === 'production'` and key starts with `sk_test_`.
- [ ] Confirm `BASE_URL` in Vercel Production env is `https://clearoffer.com.au`. Update via `vercel env add` if still on old subdomain.
- [ ] Add "Powered by ZoneIQ" attribution to Scout Report footer — small grey text, link to zoneiq.com.au.
- [ ] Add legal disclaimer to Scout Report and Buyer's Brief footers: "This report is market research and analysis, not a formal property valuation. It is not suitable for lending, legal, or insurance purposes. ClearOffer is not a registered property valuer. Always obtain independent legal and financial advice before purchasing property."
- [ ] Run pre-launch checklist and write results to `LAUNCH_CHECKLIST.md`. Record pass/fail for each: Scout Report loads for a real Brisbane address; all ZoneIQ overlays display (flood, bushfire, heritage, noise where present); email gate captures to Supabase; one-free-report-per-email enforcement works on second attempt; confirmation email sends; Stripe checkout creates session; Buyer's Brief generates with streaming; Stripe webhook fires and sets converted_to_paid; follow-up does not send after conversion; legal disclaimer on both pages; ZoneIQ attribution present; mobile layout at 375px; no console errors on any page.
- [ ] Commit: `Sprint 8: Stripe live mode guard, launch checklist, legal disclaimer, ZoneIQ attribution`

---

## Sprint 9 — Domain API: active listing data

**Blocker:** Steve confirms Domain API approval in external gates table. Sprint 4 complete ✓.

**Context:** Active listing data only — price, beds/baths, DOM, agent name, photos. Sold data and AVM from Domain Insights/Pricefinder permanently off table (VG licence restriction on that product, not the developer API).

- [ ] Test Domain OAuth via `lib/domain-auth.js` — confirm valid token returned. Debug using DECISIONS.md Sprint 2 notes if failing. Do not proceed until OAuth confirmed working.
- [ ] Replace Nominatim autocomplete with Domain Address Suggestions. QLD only, max 5 results. Frontend UX unchanged.
- [ ] Wire Domain Properties & Locations — listing price, beds, bathrooms, car spaces, land size, DOM, agent name, agency, photos URL. Replace stubs with real data. Keep stubs as fallback.
- [ ] Wire Domain Price Estimation into Scout Report — replaces price estimate stub with real AVM range.
- [ ] Wire Domain Agents & Listings — agent name and agency. Track record stats remain deferred.
- [ ] Update `.env.example`: move `DOMAIN_CLIENT_ID` and `DOMAIN_CLIENT_SECRET` to main section.
- [ ] Update DECISIONS.md.
- [ ] Commit: `Sprint 9: Domain API live — autocomplete, listing data, price estimate`

---

## Sprint 10 — PropTechData: AVM, comparables, suburb stats

**Blocker:** Steve confirms PropTechData in external gates table — no VG restriction, pricing acceptable, credentials received.

- [ ] Add `PROPTECH_DATA_API_KEY` to Vercel Production env via `vercel env add`. Update `.env.example`.
- [ ] Create `lib/proptech-data.js` — functions: `getAVM(address)`, `getComparableSales(suburb, bedrooms, limit=5)`, `getSuburbStats(suburb)`. All return null on failure, never crash.
- [ ] Wire AVM into Scout Report — replaces price estimate stub.
- [ ] Wire comparable sales — 5 recent sales, address/sold price/sold date/beds/baths. No listed price, no vendor discount percentage (per brief decision).
- [ ] Wire suburb stats — median, DOM, clearance rate, 12-month growth. PropTechData overrides Sprint 5 static lookup table. Keep table as fallback.
- [ ] Wire PropTechData context into Buyer's Brief Claude prompt — AVM, comparables, suburb stats passed as structured context.
- [ ] Update DECISIONS.md.
- [ ] Commit: `Sprint 10: PropTechData live — AVM, comparables, suburb stats`

---

## Sprint 11 — Smoke tests

**Blocker:** Sprint 4 complete ✓. Can run in test mode at any time.

- [ ] Add Jest and supertest as dev dependencies: `npm install --save-dev jest supertest`. Add `"test": "jest"` to package.json scripts.
- [ ] Smoke test: Scout Report API returns 200 for "14 Riverview Tce, Chelmer QLD 4068". Assert response contains `address`, `overlays`, `suburb`.
- [ ] Smoke test: Stripe checkout API returns 200 with `sessionId` or `url` for a valid address payload.
- [ ] Smoke test: Email gate submission returns 200 and does not throw for valid email + address.
- [ ] Run `npm test` — confirm all pass. Fix failures before committing.
- [ ] Commit: `Sprint 11: Smoke tests`

---

## Deferred — not in v1

- Agent vendor discount data — out of v1
- Google Geocoding for ClearOffer address search — Domain API replaces Nominatim when approved
- Suburb lookup table quarterly update process — post-launch
- Google Ads — after first real live paid purchase confirmed
- r/AusPropertyChat posting — after launch
- Sydney / Melbourne expansion — post-revenue (ZoneIQ already has the data)
- PDF email of Buyer's Brief — v2
- Subscription model — explicitly rejected

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
- [x] Sprint 4: Supabase email gate, one-report-per-email, ZoneIQ validation, bushfire overlay, env cleanup
- [x] Sprint 5: Live ZoneIQ data, suburb lookup table, smart stubs throughout Scout Report
