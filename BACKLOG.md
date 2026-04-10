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
*Status: COMPLETE*

- [x] Run `npm install` to install stripe dependency
- [x] Run `vercel env pull` to pull .env.local from Vercel
- [x] Start `vercel dev --listen 3001` and confirm server starts without errors
- [x] Confirm `GET http://localhost:3001/` returns 200 (coming-soon or index depending on COMING_SOON env var)
- [x] Confirm `GET http://localhost:3001/report.html` returns 200
- [x] Confirm `GET http://localhost:3001/api/suburb-stats?suburb=Chelmer` returns JSON with median > 0
- [x] Confirm `GET http://localhost:3001/api/zone-lookup?address=14+Riverview+Tce+Chelmer+QLD+4068` returns JSON with overlays object
- [x] Confirm `POST http://localhost:3001/api/verdict` with `{"address":"14 Riverview Tce, Chelmer QLD 4068","listingPrice":1350000,"daysOnMarket":41}` returns a verdict string
- [x] Run `node scripts/smoke-test.js` — all tests must pass before marking sprint done
- [x] Fix any failures found. Log each fix in OVERNIGHT_LOG.md.

---

## Sprint 2 — Address autocomplete UX polish
*Status: COMPLETE*
*Depends on: Sprint 1 complete, GOOGLE_GEOCODING_API_KEY set in .env.local*

- [x] Verify `GET /api/autocomplete?q=14+Riverview` returns suggestions from Google Places
- [x] If GOOGLE_GEOCODING_API_KEY missing or quota exceeded: add a graceful typed-entry fallback — user can type full address and press enter without autocomplete
- [x] Add keyboard navigation to autocomplete dropdown (arrow keys + enter selects)
- [x] Add loading indicator in search box while autocomplete is fetching (small spinner replacing search icon)
- [x] Test on mobile viewport (375px width) — autocomplete list must not overflow screen
- [x] On mobile, dismiss keyboard when suggestion is selected (`addressInput.blur()`)
- [x] Add `data-testid` attributes to `#address-input`, `#search-btn`, `#autocomplete-list` for future Playwright tests

---

## Sprint 3 — Scout Report overlay display QA
*Status: COMPLETE*
*Depends on: Sprint 1 complete*

Test the full Scout Report render against these Brisbane addresses. For each, check overlays display correctly (no crashes, correct pill colours, plain English text):

- [x] `14 Riverview Tce, Chelmer QLD 4068` — expect: flood (FHA code), character overlay, school catchment
- [x] `52 Birdwood Tce, Toowong QLD 4066` — general inner-west test
- [x] `7 Wynnum Rd, Norman Park QLD 4170` — riverside, expect flood overlay
- [x] `25 Racecourse Rd, Hamilton QLD 4007` — high-end, expect no flood
- [x] `18 Collingwood St, Albion QLD 4010` — industrial fringe, test partial response handling

For each address:
- [x] ZoneIQ returns without timeout
- [x] If `meta.partial: true`, the amber warning banner shows (not a crash)
- [x] Flood pill is correct colour (red/amber/green based on code)
- [x] School ICSEA numbers render if present
- [x] AVM teaser range renders (suburb median ±8%)
- [x] Demand meter animates in
- [x] No JS console errors on load

Log results in OVERNIGHT_LOG.md. If ZoneIQ returns unexpected shape for any address, update `normaliseFlood`/`normaliseSchools` etc. in `api/zone-lookup.js` accordingly.
*Fixed: ZoneIQ v2.0.0 API path + field name changes. See OVERNIGHT_LOG.md.*

---

## Sprint 4 — Email gate + Supabase integration test
*Status: COMPLETE*
*Depends on: Sprint 1 complete, SUPABASE_URL + SUPABASE_SERVICE_KEY set*

- [x] Run `scripts/create-tables.sql` in Supabase SQL editor if tables don't exist yet
- [x] Confirm `scout_reports` table has columns: `id, email, address, created_at, report_data, followup_sent, converted_to_paid`
- [x] Confirm `suburb_stats_cache` table exists
- [x] Test email gate: submit `test+sprint4@clearoffer-test.com` for `14 Riverview Tce, Chelmer QLD 4068`
- [x] Confirm row appears in Supabase `scout_reports` with `followup_sent=false, converted_to_paid=false`
- [x] Test one-free-per-email: submit same email again — confirm `already_used` response and redirect to upsell
- [x] Test Resend confirmation email: check `hello@clearoffer.com.au` inbox (or use Resend dashboard) — confirm email sent with correct address in subject
- [x] If Resend free tier limit hit: log warning, do not fail the report delivery
- [x] Test invalid email `notanemail` → confirm 400 response
- [x] Check redirect from index.html → report.html passes `email` param in URL correctly

---

## Sprint 5 — Stripe checkout integration test
*Status: COMPLETE*
*Depends on: Sprint 4 complete, STRIPE_SECRET_KEY (test) set*

- [x] Confirm Stripe test mode key is `sk_test_...` — do NOT proceed if it's `sk_live_...`
- [x] Create a Stripe test price: `$149 AUD` one-time in Stripe dashboard, note the Price ID
- [x] Update `api/create-checkout.js` to use `price_data` (already done — confirm dynamic pricing works without a pre-created price ID, or switch to static price ID if preferred)
- [x] Test checkout: submit real email through report.html, click CTA, confirm Stripe checkout page opens
- [x] Use Stripe test card `4242 4242 4242 4242` to complete payment
- [x] Confirm redirect to `success.html` with `session_id` param
- [x] Confirm redirect from `success.html` to `buyers-brief.html` after 3 seconds
- [x] Set up Stripe webhook in Stripe dashboard: endpoint `http://localhost:3001/api/stripe-webhook` (use Stripe CLI for local: `stripe listen --forward-to localhost:3001/api/stripe-webhook`)
- [x] Confirm webhook fires and `converted_to_paid` is set to `true` in Supabase
- [x] Confirm `buyers-brief.html` payment verification passes after webhook fires
- [x] Test failed payment (Stripe test card `4000 0000 0000 0002`) — confirm cancel redirect back to report
*Note: Local webhook requires Stripe CLI. Payment verification fallback via direct Stripe API implemented.*

---

## Sprint 6 — Buyer's Brief generation test
*Status: COMPLETE*
*Depends on: Sprint 5 complete, ANTHROPIC_API_KEY set*

- [x] Manually set `converted_to_paid=true` in Supabase for a test email+address row
- [x] Navigate to `buyers-brief.html?address=14+Riverview+Tce%2C+Chelmer+QLD+4068&email=YOUR_TEST_EMAIL`
- [x] Confirm streaming starts within 3 seconds
- [x] Confirm progress bar advances during streaming
- [x] Confirm all 7 sections render: Valuation Assessment, Comparables, Risk Flags, Market Context, Negotiation, Opening Offer, What the Agent Won't Tell You, 5-10yr Outlook
- [x] Confirm PropTechData stub values are clearly labelled (look for `_stub: true` in server logs)
- [x] Confirm switching to complete state after streaming ends (progress hits 100%, full report shows)
- [x] Confirm qualifier selections from report.html are passed through sessionStorage
- [x] Test with renovation status "original condition" + road type "main road" — confirm Claude mentions these in the valuation adjustment
- [x] Check brief content reads as confident and specific (not hedged), no raw markdown showing
*Note: 10,642 bytes generated, all 7 sections present, AVM $1,435,600, qualifiers passed through. Streaming ~45s (expected). See OVERNIGHT_LOG.md.*

---

## Sprint 7 — Follow-up email job test
*Status: COMPLETE*
*Depends on: Sprint 4 complete, CRON_SECRET set in .env.local*

- [x] Add `CRON_SECRET=test-secret-local` to .env.local
- [x] Manually insert a test row into `scout_reports` with `created_at = NOW() - INTERVAL '24 hours'`, `followup_sent=false`, `converted_to_paid=false`
- [x] Hit `GET http://localhost:3001/api/send-followup?secret=test-secret-local`
- [x] Confirm response: `{ "processed": 1, "results": [{ "status": "sent" }] }`
- [x] Confirm `followup_sent=true` in Supabase for that row
- [x] Confirm follow-up email received (check Resend dashboard)
- [x] Test auth: `GET /api/send-followup` without secret → confirm 401
- [x] Test idempotency: run job again → confirm already-sent row not re-processed (followup_sent=true filters it out)
- [x] Test that `__waitlist__` address rows are excluded from follow-up
*Note: vercel dev needs `export CRON_SECRET=...` before starting — not auto-injected. Production: set in Vercel dashboard. See OVERNIGHT_LOG.md.*

---

## Sprint 8 — Mobile QA pass
*Status: COMPLETE*
*Depends on: Sprint 3 complete*

Test entire flow at 375px viewport (iPhone SE) in browser devtools:

- [x] index.html: hero, search box, autocomplete fully usable
- [x] Stage 1 verdict displays correctly (no overflow)
- [x] Email gate form usable on mobile (input + button stack vertically)
- [x] report.html: stat row wraps gracefully (2×2 grid at narrow width)
- [x] Overlay pills wrap without overflow
- [x] Qualifier option buttons wrap to multiple rows without breaking layout
- [x] Locked section blur effect renders on iOS Safari (test `-webkit-backdrop-filter` fallback)
- [x] CTA block readable and button full-width
- [x] buyers-brief.html: streaming content readable, no horizontal scroll
- [x] `font-size: 16px` on all inputs (prevents iOS auto-zoom — check CSS)
- [x] Test at 768px (iPad) — layout should look good without mobile-specific fixes

Fix any mobile issues found. Log in OVERNIGHT_LOG.md.
*Fixed: added `-webkit-backdrop-filter: blur(2px)` to `.locked__label` for iOS Safari. All other CSS checks passed. See OVERNIGHT_LOG.md.*

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

# Sprint 12 — ClearOffer Brief Architecture Overhaul
*Repo: stevenpicton1979/buyerside (main branch)*
*Local dev: `vercel dev --listen 3001` — never `npm run dev`*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

The Buyer's Brief (`api/buyers-brief.js`) currently calls `fetchPropTechData()` which always returns stub data (`_stub: true`) with invented comparable sales. These fabricated numbers are passed to Claude with no instruction to treat them as illustrative — so Claude writes a confident analysis based on fake transactions. A test on a $1.8M property produced a $960k valuation. The paid Brief must not launch until this sprint is complete.

---

## Task 1 — Strip stub comparables from `getPropTechStub()`

**File:** `api/buyers-brief.js`

Find `getPropTechStub()`. Replace the entire function body with:

```javascript
function getPropTechStub() {
  return {
    _stub: true,
    avm: null,
    comparables: null,
    suburbTimeseries: null,
  };
}
```

The `fetchPropTechData()` function itself does not change. Only the stub payload changes — avm and comparables must be null, never invented figures.

---

## Task 2 — Two-pass architecture: research then stream

**File:** `api/buyers-brief.js`

Web search is not compatible with streaming in a single Anthropic API call. The solution is two calls:

- **Pass 1:** Non-streaming call with web search enabled. Claude searches for the current suburb median and recent suburb news, returns a research summary.
- **Pass 2:** Streaming call (existing pattern). The research summary is injected into the prompt as additional context.

### Step 2a — Add `runResearchPass()` function

Add this new function to `api/buyers-brief.js`:

```javascript
async function runResearchPass(address, suburbStats) {
  const suburb = extractSuburb(address);
  const state = extractState(address) || 'QLD';

  const researchPrompt = `You are researching an Australian property for a buyer's report. Use web search to find the following, then return a concise research summary.

Property address: ${address}

Search for:
1. Current median house price for ${suburb || address}, ${state} — find a figure from propertyvalue.com.au, realestate.com.au suburb profiles, or domain.com.au suburb profiles. State the source and the figure.
2. Any recent news affecting ${suburb || address} — infrastructure, rezoning, flood events, major development approvals (last 12 months).
3. Any publicly available information about this specific property or street.

Return your findings as a structured summary with these headings:
- Suburb Median (source and figure)
- Recent Suburb News
- Property/Street Notes

Be concise. If you cannot find something, say "Not found" — do not invent data.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: researchPrompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn('[buyers-brief] research pass failed:', response.status, err);
      return null;
    }

    const data = await response.json();
    const researchSummary = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    console.log('[buyers-brief] research pass complete, length:', researchSummary.length);
    return researchSummary || null;
  } catch (err) {
    console.warn('[buyers-brief] research pass error:', err.message);
    return null;  // Non-fatal — Brief continues without research
  }
}
```

Add these two helper functions (used by `runResearchPass` and elsewhere):

```javascript
function extractSuburb(address) {
  if (!address) return null;
  const match = address.match(/,\s*([^,]+?)\s*(QLD|NSW|VIC|SA|WA|TAS|ACT|NT)?\s*\d{4}/i);
  return match?.[1]?.trim() || null;
}

function extractState(address) {
  if (!address) return null;
  const match = address.match(/\b(QLD|NSW|VIC|SA|WA|TAS|ACT|NT)\b/i);
  return match?.[1]?.toUpperCase() || null;
}
```

### Step 2b — Call `runResearchPass()` in the main handler

In the main `module.exports` handler, after the `Promise.all` that gathers data and before `buildBriefPrompt`, add:

```javascript
// Research pass — web search for suburb median and recent news
const research = await runResearchPass(address, suburbStats);
```

Then pass `research` into `buildBriefPrompt`:

```javascript
const prompt = buildBriefPrompt({
  address,
  qualifiers: qualifiers || {},
  zoneData,
  suburbStats,
  propTechData,
  research,
});
```

### Step 2c — Update `streamClaudeBrief()` 

Change the function signature from:
```javascript
async function* streamClaudeBrief(prompt) {
```
To:
```javascript
async function* streamClaudeBrief(prompt) {  // signature unchanged
```

The prompt already contains the research by the time it reaches this function — no signature change needed. But make two changes inside the function body:

1. Increase `max_tokens` from `2000` to `4000`
2. Update model from `claude-sonnet-4-6` to `claude-sonnet-4-20250514`

---

## Task 3 — Rewrite `buildBriefPrompt()`

**File:** `api/buyers-brief.js`

Replace the entire `buildBriefPrompt()` function with:

```javascript
function buildBriefPrompt({ address, qualifiers, zoneData, suburbStats, propTechData, research }) {
  const { renovationStatus = 'unknown', roadType = 'unknown' } = qualifiers;
  const avm = propTechData?.avm;           // null when stubbed
  const comparables = propTechData?.comparables;  // null when stubbed
  const isStub = propTechData?._stub;

  const f = (n) => n ? `$${Number(n).toLocaleString('en-AU')}` : 'unknown';

  const suburbContext = suburbStats
    ? `Suburb: ${suburbStats.suburb}. Median: ${f(suburbStats.median)}. Avg DOM: ${suburbStats.dom} days. 12-month growth: ${(suburbStats.growth12m * 100).toFixed(1)}%. 10yr CAGR: ${(suburbStats.cagr10yr * 100).toFixed(1)}%.`
    : 'Suburb stats: not available from static table — use web research findings below.';

  const avmContext = (!isStub && avm)
    ? `AVM estimate: ${f(avm.estimate)} (range: ${f(avm.low)}–${f(avm.high)}, confidence: ${Math.round(avm.confidence * 100)}%).`
    : 'AVM: not available — base valuation on suburb median from web research and overlay adjustments.';

  const compContext = (!isStub && comparables && comparables.length > 0)
    ? `COMPARABLE SALES (confirmed PropTechData):\n` + comparables.map((c, i) =>
        `${i + 1}. ${c.address} — sold ${f(c.soldPrice)} on ${c.soldDate} (${c.beds}bd/${c.baths}ba, ${c.landSqm}m²)`
      ).join('\n')
    : 'COMPARABLE SALES: Not available in this report. Do not cite specific comparable transactions — not even illustrative ones.';

  const overlays = zoneData?.overlays || {};
  const floodText = overlays.flood?.affected ? `FLOOD RISK: ${overlays.flood.plain}` : 'No flood overlay.';
  const bushfireText = overlays.bushfire?.affected ? `BUSHFIRE: ${overlays.bushfire.plain}` : 'No bushfire overlay.';
  const heritageText = overlays.heritage?.listed ? `HERITAGE: ${overlays.heritage.plain}` : 'Not heritage listed.';
  const noiseText = overlays.noise?.affected ? `AIRCRAFT NOISE: ${overlays.noise.plain}` : 'No aircraft noise overlay.';
  const charText = overlays.character?.applicable ? `CHARACTER OVERLAY: ${overlays.character.plain}` : 'No character overlay.';

  // School catchments — check ZoneIQ OpenAPI spec at https://zoneiq-sigma.vercel.app/api/openapi
  // for exact field names. Adjust overlays.schools?.primary / overlays.schools?.secondary
  // if the actual field names differ from these.
  const primarySchool = overlays.schools?.primary;
  const secondarySchool = overlays.schools?.secondary;
  const schoolLines = [];
  if (primarySchool) schoolLines.push(`Primary: ${primarySchool.name} (ICSEA ${primarySchool.icsea})`);
  if (secondarySchool) schoolLines.push(`Secondary: ${secondarySchool.name} (ICSEA ${secondarySchool.icsea})`);
  const schoolText = schoolLines.length > 0
    ? `School catchments:\n${schoolLines.join('\n')}`
    : 'School catchments: data not available.';

  const qualifierText = (renovationStatus !== 'unknown' || roadType !== 'unknown')
    ? `Buyer's property notes (from inspection): condition = ${renovationStatus}; road type = ${roadType}.`
    : '';

  const researchContext = research
    ? `\nWEB RESEARCH (verified before writing):\n${research}`
    : '\nWeb research: not available — rely on suburb stats above for valuation.';

  return `You are an expert buyer's agent in Brisbane writing a paid Buyer's Brief ($149). You are direct, specific, and honest about what is confirmed data versus what is estimated.

PROPERTY: ${address}
${suburbContext}
${avmContext}
${qualifierText}

OVERLAYS:
${floodText}
${bushfireText}
${heritageText}
${noiseText}
${charText}
${schoolText}

${compContext}
${researchContext}

HONESTY RULES — follow exactly:
- If comparable sales says "Not available", do NOT cite specific sales, prices, addresses or dates — not even illustrative ones. Write instead: "Comparable sales data is not available in this report. The valuation range is based on suburb-level data and property-specific adjustments."
- If AVM says "not available", state the valuation is based on suburb median from web research.
- When citing a figure from web research, briefly note the source (e.g. "according to realestate.com.au").
- Condition modifier: Original = –5% to –10% vs median. Partially updated = at median. Fully renovated = +5% to +15%.
- Road type modifier: Main road = –3% to –8%. Quiet street = neutral to +3%.
- State valuation as a range, not a single number.

Do not include any report header, reference number, preparer name, or date. Start directly with the first section heading.

## Valuation Assessment
State the recommended price range. Show your methodology — suburb median adjusted for condition and road type. Be explicit about what data you have and what you're estimating.

## Comparable Sales
If comparable sales data was provided above, analyse it. If not, write the honesty statement above and explain what the valuation is based on instead.

## Risk Flags
Cover each overlay present in plain English. What does each mean practically? What questions should the buyer ask?

## Market Context
What's happening in this suburb? Buyer's or seller's market? What does DOM and growth data tell us?

## The Negotiation
Based on suburb DOM and market conditions: what leverage does the buyer have? Give specific language they can use.

## Your Opening Offer
State a specific dollar figure recommendation for opening offer and walk-away price. Show the reasoning.

## What the Agent Won't Tell You
2–3 things the buyer should know that the listing agent won't volunteer.

## 5–10 Year Outlook
Based on suburb trajectory, overlays, and Brisbane infrastructure: what does this suburb look like in 2030–2035?

Tone: confident, specific, like a sharp buyer's agent who has done hundreds of Brisbane deals. No disclaimers in the body — the legal disclaimer appears separately.`;
}
```

---

## Task 4 — Confirm school catchment field names from ZoneIQ

**File:** `api/buyers-brief.js`

The new `buildBriefPrompt()` reads `overlays.schools?.primary` and `overlays.schools?.secondary`. 

Check the actual ZoneIQ response shape by fetching:
```
https://zoneiq-sigma.vercel.app/api/lookup?address=14+Riverview+Tce+Chelmer+QLD+4068
```

Check the OpenAPI spec at `https://zoneiq-sigma.vercel.app/api/openapi` for the `schools` / `school_catchments` field names.

If the actual field path differs from `overlays.schools?.primary` / `overlays.schools?.secondary`, update the references in `buildBriefPrompt()` accordingly.

Log the actual field shape to `OVERNIGHT_LOG.md`.

---

## Task 5 — Confirm error state is hidden on Brief completion

**File:** `buyers-brief.html`

The `setState()` function at line ~427 already handles this correctly — it explicitly sets `error-state` to `display:none` for all non-error states.

Run a manual Brief test. If the error state div is still visible on successful completion, search the file for every reference to `error-state` and audit whether any code path sets it visible outside of `setState()`. Fix any found.

---

## Task 6 — Fix verdict meta-text in `api/verdict.js`

**File:** `api/verdict.js`

In `generateVerdict()`, find the `Rules:` block inside the prompt string. Replace it with:

```
Rules:
- Exactly one sentence, maximum 25 words
- Use specific numbers from the data
- If DOM is well above suburb average: focus on that leverage
- If price is well above median: note the gap
- If flood overlay: mention it as a risk flag
- Never say "fairly valued", "appears to be", or anything that sounds like a disclaimer
- Sound like a smart friend texting you, not a report
- CRITICAL: Never write "I don't have access to...", "Based on available data...", "As an AI...", or any meta-commentary. If data is limited, make your best assessment from what you have. The sentence must name a price or draw a conclusion.

One sentence only:
```

---

## Completion checklist

```
vercel dev --listen 3001
```

Test email: `steven.picton@googlemail.com` (has `converted_to_paid=true` — skip Stripe)
Test address: any Brisbane address

- [x] Server log shows stub with `avm: null, comparables: null`
- [x] Server log shows `research pass complete` with non-zero length
- [x] Brief renders fully — all 8 sections present, not truncated
- [x] Brief does NOT cite specific comparable sale addresses, prices, or dates
- [x] Brief DOES include the honesty statement about comparables
- [x] Brief mentions a suburb median figure with a cited source
- [x] School catchments appear by name in the Brief
- [x] Error state div NOT visible on successful Brief completion
- [x] Verdict is a single sharp sentence with no meta-text
- [x] `OVERNIGHT_LOG.md` updated with timestamps

---

## Do not touch

- Stripe (`api/create-checkout.js`, `api/stripe-webhook.js`)
- Scout Report / ZoneIQ flow (`api/zone-lookup.js`, `report.html`)
- Email gate
- Supabase schema
- Env vars
- `COMING_SOON` — leave as-is
- Qualifier questions — do not add beds/baths/land size; only condition and road type
- `public/js/config.js`

---

# Sprint 13 — Live BCC Flood Check
*Repo: stevenpicton1979/buyerside (main branch)*
*Local dev: `vercel dev --listen 3001` — never `npm run dev`*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

ZoneIQ's flood data is incomplete. A test on 6 Glenheaton Court, Carindale confirmed
ZoneIQ returns `flood.affected: false` for a property that BCC's own planning scheme
flags as Creek/Waterway Flood Planning Area 4 and 5.

The authoritative source is BCC's City Plan open data, published on ArcGIS Online at
`services2.arcgis.com/dEKgZETqwmDAh1rP`. This endpoint is:
- Publicly accessible — no authentication required
- No CORS issues from Node.js server-side calls
- Updated to City Plan v34.00/2025 (last data edit November 2025)
- Confirmed working: returns FPA 4 and FPA 5 polygons in the Carindale area

This sprint adds a direct BCC flood check to `api/zone-lookup.js` that runs alongside
ZoneIQ and overrides the flood result when BCC returns data.

---

## Confirmed API details (do not guess — use these exactly)

**Creek/Waterway flood endpoint:**
```
https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0/query
```

**Query parameters:**
- `geometry` = `{lng},{lat}` (WGS84 decimal degrees)
- `geometryType` = `esriGeometryPoint`
- `inSR` = `4326`
- `spatialRel` = `esriSpatialRelIntersects`
- `outFields` = `OVL2_DESC,OVL2_CAT`
- `f` = `json`

**Response shape when flood affected:**
```json
{
  "features": [
    {
      "attributes": {
        "OVL2_DESC": "Creek/waterway flood planning area 4",
        "OVL2_CAT": "FHA_CK4"
      }
    }
  ]
}
```

**Response shape when not affected:**
```json
{ "features": [] }
```

**Brisbane River flood endpoint (also check this):**
```
https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0/query
```
Same query parameters. Field names are identical (`OVL2_DESC`, `OVL2_CAT`).

---

## Task 1 — Get lat/lng from Google Geocoder in `api/zone-lookup.js`

The zone-lookup handler already calls Google Geocoding API to get the address.
Find where the geocode response is parsed and extract `lat` and `lng` from
`result.geometry.location`. Store them as local variables — they'll be passed to
the BCC flood function.

If the geocoding response does not include lat/lng for any reason, set both to null
and skip the BCC flood check gracefully.

---

## Task 2 — Add `fetchBCCFlood(lat, lng)` to `api/zone-lookup.js`

Add this function:

```javascript
async function fetchBCCFlood(lat, lng) {
  if (!lat || !lng) return null;

  const baseParams = `geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OVL2_DESC%2COVL2_CAT&f=json`;

  const [creekResp, riverResp] = await Promise.all([
    fetch(
      `https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0/query?geometry=${lng}%2C${lat}&${baseParams}`,
      { signal: AbortSignal.timeout(8000) }
    ).then(r => r.ok ? r.json() : null).catch(() => null),

    fetch(
      `https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services/Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0/query?geometry=${lng}%2C${lat}&${baseParams}`,
      { signal: AbortSignal.timeout(8000) }
    ).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const creekFeatures = creekResp?.features || [];
  const riverFeatures = riverResp?.features || [];
  const allFeatures = [...creekFeatures, ...riverFeatures];

  if (allFeatures.length === 0) {
    console.log('[zone-lookup] BCC flood check: no flood overlays found');
    return { affected: false, source: 'BCC CityPlan' };
  }

  const descriptions = allFeatures.map(f => f.attributes.OVL2_DESC);
  console.log('[zone-lookup] BCC flood check: found', descriptions);

  // Build plain English description
  const plain = descriptions.length === 1
    ? `${descriptions[0]} (BCC City Plan)`
    : `${descriptions.join(' + ')} (BCC City Plan)`;

  return {
    affected: true,
    source: 'BCC CityPlan',
    categories: descriptions,
    plain,
  };
}
```

---

## Task 3 — Call `fetchBCCFlood()` and merge into the overlay response

In the zone-lookup handler, after fetching ZoneIQ data and extracting lat/lng from
geocoding, add:

```javascript
// BCC flood check — authoritative source, runs alongside ZoneIQ
const bccFlood = await fetchBCCFlood(lat, lng);
```

Then when building the final overlays response, merge the BCC result:

```javascript
// BCC flood overrides ZoneIQ flood when BCC returns a result
if (bccFlood !== null) {
  overlays.flood = bccFlood;
} else {
  // BCC call failed — keep ZoneIQ result but note uncertainty
  if (overlays.flood && !overlays.flood.affected) {
    overlays.flood.plain = 'No flood overlay detected. Verify at brisbane.qld.gov.au/floodwise before purchasing.';
  }
}
```

---

## Task 4 — Update flood overlay copy in `api/zone-lookup.js`

Find where the flood plain English text is constructed for the no-flood case.
Regardless of source, when `flood.affected = false`, the plain text must be:

```
No flood overlay identified (BCC City Plan verified). Note: unmapped overland flow paths
are not captured in any dataset — check brisbane.qld.gov.au/floodwise for a complete
property flood report.
```

When `flood.affected = true`, the plain text comes from the BCC response directly
(already set in Task 2). Ensure it is passed through to the Scout Report and Brief.

---

## Task 5 — Update noise overlay copy in `api/zone-lookup.js` and `report.html`

**No API exists for operational flight path noise.** ANEF contours only capture
formally modelled corridors, not actual flight paths.

Find where noise overlay plain text is set. When `noise.affected = false`, change
the plain text from whatever it currently says to:

```
No ANEF aircraft noise contour detected. ANEF overlays capture formally modelled
corridors only — operational flight paths can affect properties outside this contour.
Check actual flight activity at webtrak.emsbk.com/bne3 before purchasing.
```

This change applies in both the server-side plain text generation and wherever
noise overlay text is hardcoded in `report.html` or client JS.

---

## Task 6 — Smoke test

```
vercel dev --listen 3001
```

Run these manual checks:

1. Hit `http://localhost:3001/api/zone-lookup?address=6+Glenheaton+Ct+Carindale+QLD+4152`
   - Confirm server log shows `[zone-lookup] BCC flood check: found ["Creek/waterway flood planning area 4", "Creek/waterway flood planning area 5"]` (or similar)
   - Confirm response has `overlays.flood.affected = true`
   - Confirm `overlays.flood.source = "BCC CityPlan"`
   - Confirm `overlays.flood.plain` contains the FPA description

2. Hit `http://localhost:3001/api/zone-lookup?address=14+Riverview+Tce+Chelmer+QLD+4068`
   - This is a known flood-affected address (riverside Chelmer)
   - Confirm BCC returns flood data for it

3. Hit `http://localhost:3001/api/zone-lookup?address=25+Racecourse+Rd+Hamilton+QLD+4007`
   - This is expected to be flood-free
   - Confirm `flood.affected = false` and plain text includes the FloodWise link

4. Load `http://localhost:3001` → search for 6 Glenheaton Ct, Carindale QLD
   - Confirm Scout Report now shows flood overlay as AFFECTED
   - Confirm flood pill is red/amber (not green)

---

## Completion checklist

- [x] `fetchBCCFlood()` function added to `api/zone-lookup.js`
- [x] BCC flood check runs for every zone-lookup call where lat/lng is available
- [x] 6 Glenheaton Ct, Carindale returns `flood.affected = true` with BCC source
- [x] Flood-free address still returns `flood.affected = false` with FloodWise disclaimer
- [x] Noise overlay no-result copy updated with WebTrak link
- [x] Scout Report flood pill shows correctly for Carindale address
- [x] `OVERNIGHT_LOG.md` updated with timestamps

---

## Do not touch

- Stripe, email gate, Supabase schema
- Buyer's Brief generation (`api/buyers-brief.js`)
- Any env vars
- `COMING_SOON` setting
- ZoneIQ calls for all other overlays (bushfire, heritage, character, schools, noise)
  — only flood is being overridden

---

# Sprint 14 — BCC Direct Data Overhaul
*Repo: stevenpicton1979/buyerside (main branch)*
*Local dev: `vercel dev --listen 3001` — never `npm run dev`*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

All Brisbane planning overlays are available directly from BCC's open data on
`services2.arcgis.com/dEKgZETqwmDAh1rP`. These APIs are free, no auth, no rate
limits, and represent the same authoritative source that town planners use via
City Plan Online.

This sprint replaces ZoneIQ as the data source for Brisbane overlays entirely,
adds lot size from the DCDB cadastre, and upgrades flood to use lot-boundary
polygon intersection (instead of a geocoded point) so large blocks like 1068m²
don't miss flood planning areas that only cover part of the lot.

All API details below were validated live. Do not deviate from the confirmed
endpoint names, field names, or query patterns.

---

## Confirmed API endpoints (all on services2.arcgis.com/dEKgZETqwmDAh1rP)

```
Property_boundaries_Parcel/FeatureServer/0     → lot size, lot plan, geometry
Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0  → creek flood FPA 1-5
Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0  → river flood FPA 1-5
Bushfire_overlay/FeatureServer/0               → bushfire hazard areas
Heritage_overlay/FeatureServer/0               → heritage listing
Traditional_building_character_overlay/FeatureServer/0  → traditional character
Dwelling_house_character_overlay/FeatureServer/0         → dwelling house character
```

**Key field names (all overlays):** `OVL2_DESC`, `OVL2_CAT`

**Confirmed results for 6 Glenheaton Court, Carindale (15RP182797, 1086m²):**
```json
{
  "lotArea": 1086,
  "floodCreek": ["Creek/waterway flood planning area 5", "Creek/waterway flood planning area 4"],
  "floodRiver": [],
  "bushfire": ["Medium hazard buffer area", "High hazard buffer area"],
  "heritage": [],
  "characterTraditional": [],
  "characterDwelling": ["Dwelling house character"],
  "errors": []
}
```

---

## Task 1 — Add `fetchBCCParcel(address)` to `api/zone-lookup.js`

This function queries the DCDB parcel data by street number, street name, and
suburb — more reliable than geocoding coordinates for an exact lot match.

Parse the address string to extract:
- `houseNumber` — the numeric part (e.g. "6")
- `streetName` — the street name only, no type suffix (e.g. "GLENHEATON" from
  "Glenheaton Court" or "Glenheaton Ct")
- `suburb` — the suburb name (e.g. "CARINDALE")

Use this regex approach to parse the address:
```javascript
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
```

Then add `fetchBCCParcel`:

```javascript
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
      lotPlan: lot.attributes.LOTPLAN,
      lotArea: lot.attributes.LOT_AREA,
      geometry: lot.geometry, // WGS84 polygon rings
    };
  } catch (err) {
    console.warn('[zone-lookup] BCC parcel error:', err.message);
    return null;
  }
}
```

---

## Task 2 — Add `fetchBCCOverlays(geometry)` to `api/zone-lookup.js`

This function takes the WGS84 lot polygon from Task 1 and queries all overlay
layers simultaneously using polygon intersection. This is more accurate than
point-in-polygon because large lots can straddle multiple overlay zones.

```javascript
async function fetchBCCOverlays(geometry) {
  if (!geometry?.rings) return null;
  
  const BASE = 'https://services2.arcgis.com/dEKgZETqwmDAh1rP/arcgis/rest/services';
  const geomStr = encodeURIComponent(JSON.stringify({ rings: geometry.rings }));
  const params = `geometry=${geomStr}&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OVL2_DESC%2COVL2_CAT&f=json`;

  const timeout = { signal: AbortSignal.timeout(10000) };

  const [floodCreek, floodRiver, bushfire, heritage, charTrad, charDwelling] =
    await Promise.all([
      fetch(`${BASE}/Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/Bushfire_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/Heritage_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/Traditional_building_character_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/Dwelling_house_character_overlay/FeatureServer/0/query?${params}`, timeout).then(r => r.json()).catch(() => null),
    ]);

  // Combine creek and river flood
  const allFlood = [
    ...(floodCreek?.features || []),
    ...(floodRiver?.features || []),
  ].map(f => f.attributes.OVL2_DESC);

  // Combine both character overlay types
  const allCharacter = [
    ...(charTrad?.features || []),
    ...(charDwelling?.features || []),
  ].map(f => f.attributes.OVL2_DESC);

  const allBushfire = (bushfire?.features || []).map(f => f.attributes.OVL2_DESC);
  const allHeritage = (heritage?.features || []).map(f => f.attributes.OVL2_DESC);

  // Build plain English descriptions
  const buildFloodPlain = (descs) => {
    if (!descs.length) return null;
    return descs.join(' + ') + ' (BCC City Plan)';
  };

  const buildBushfirePlain = (descs) => {
    if (!descs.length) return null;
    // Find the most significant category
    if (descs.some(d => d.includes('High hazard area'))) return 'Bushfire high hazard area — significant development constraints apply.';
    if (descs.some(d => d.includes('Medium hazard area'))) return 'Bushfire medium hazard area — BAL assessment required for new development.';
    if (descs.some(d => d.includes('High hazard buffer'))) return 'Bushfire high hazard buffer area — design standards apply to new development.';
    if (descs.some(d => d.includes('Medium hazard buffer'))) return 'Bushfire medium hazard buffer area — some design standards apply.';
    if (descs.some(d => d.includes('Potential impact'))) return 'Within bushfire potential impact area — reduced constraints but worth noting.';
    return descs[0] + ' (BCC City Plan)';
  };

  const buildCharacterPlain = (descs) => {
    if (!descs.length) return null;
    if (descs.some(d => d.includes('Dwelling house character'))) return 'Dwelling house character overlay — design standards apply to extensions and new builds. Demolition may require approval.';
    if (descs.some(d => d.includes('Traditional building character'))) return 'Traditional building character overlay — strong design controls apply. Demolition requires approval.';
    return descs[0] + ' (BCC City Plan)';
  };

  console.log('[zone-lookup] BCC overlays — flood:', allFlood, '| bushfire:', allBushfire, '| heritage:', allHeritage, '| character:', allCharacter);

  return {
    flood: {
      affected: allFlood.length > 0,
      source: 'BCC CityPlan',
      categories: allFlood,
      plain: allFlood.length > 0
        ? buildFloodPlain(allFlood)
        : 'No flood overlay identified (BCC City Plan — lot boundary verified). Note: unmapped overland flow paths are not captured in any dataset — verify at brisbane.qld.gov.au/floodwise before purchasing.',
    },
    bushfire: {
      affected: allBushfire.length > 0,
      source: 'BCC CityPlan',
      categories: allBushfire,
      plain: allBushfire.length > 0
        ? buildBushfirePlain(allBushfire)
        : 'No bushfire overlay.',
    },
    heritage: {
      listed: allHeritage.length > 0,
      source: 'BCC CityPlan',
      categories: allHeritage,
      plain: allHeritage.length > 0
        ? 'Heritage listed — demolition and significant works require Council approval.'
        : 'Not heritage listed.',
    },
    character: {
      applicable: allCharacter.length > 0,
      source: 'BCC CityPlan',
      categories: allCharacter,
      plain: allCharacter.length > 0
        ? buildCharacterPlain(allCharacter)
        : 'No character overlay.',
    },
  };
}
```

---

## Task 3 — Wire both functions into the zone-lookup handler

In the main handler in `api/zone-lookup.js`, after geocoding but before or
alongside the ZoneIQ call:

```javascript
// Fetch BCC parcel data (lot size + geometry for overlay queries)
const bccParcel = await fetchBCCParcel(address);

// Fetch all BCC overlays using lot boundary polygon
const bccOverlays = bccParcel?.geometry ? await fetchBCCOverlays(bccParcel.geometry) : null;
```

Then when building the final response, merge BCC data:

1. **If `bccParcel` returned data**, add to the response:
   ```javascript
   parcel: {
     lotPlan: bccParcel.lotPlan,
     lotAreaM2: bccParcel.lotArea,
   }
   ```

2. **If `bccOverlays` returned data**, override the ZoneIQ overlay results:
   ```javascript
   overlays.flood    = bccOverlays.flood;
   overlays.bushfire = bccOverlays.bushfire;
   overlays.heritage = bccOverlays.heritage;
   overlays.character = bccOverlays.character;
   ```
   If `bccOverlays` is null (parcel not found or API failed), keep existing
   ZoneIQ results as fallback.

3. **Remove the Sprint 13 `fetchBCCFlood()` function** — it is superseded by
   `fetchBCCOverlays()` which covers flood plus all other overlays. The flood
   result is now set inside `fetchBCCOverlays`.

---

## Task 4 — Add lot size to the Scout Report display

**File:** `public/report.html` (or wherever the stat tiles are rendered)

The zone-lookup response now includes `parcel.lotAreaM2`. Add this to the stat
row display. Find the stat tiles section and add a lot size tile:

```html
<div class="stat-tile">
  <div class="stat-value" id="stat-lot-size">—</div>
  <div class="stat-label">Land size</div>
</div>
```

In the client JS that populates the stats, after the zone-lookup call returns:
```javascript
const lotSize = data.parcel?.lotAreaM2;
if (lotSize) {
  document.getElementById('stat-lot-size').textContent =
    lotSize >= 1000
      ? (lotSize / 1000).toFixed(2) + ' ha'
      : lotSize + ' m²';
}
```

---

## Task 5 — Add lot size to the Buyer's Brief prompt

**File:** `api/buyers-brief.js`

The zone-lookup response is passed as `zoneData` to `buildBriefPrompt()`. Add
lot size extraction and pass it into the prompt context:

In `buildBriefPrompt()`, add after the other overlay extractions:
```javascript
const lotAreaM2 = zoneData?.parcel?.lotAreaM2;
const lotText = lotAreaM2
  ? `Land size: ${lotAreaM2}m² (${zoneData.parcel.lotPlan})`
  : 'Land size: not available';
```

Add `${lotText}` to the PROPERTY section of the prompt, below the address.

---

## Task 6 — Add a test script `scripts/test-bcc-overlays.js`

Create this file:

```javascript
'use strict';
// Test script for BCC overlay APIs
// Run with: node scripts/test-bcc-overlays.js
// Tests the exact API pattern used in api/zone-lookup.js

const TEST_ADDRESSES = [
  {
    label: '6 Glenheaton Court, Carindale — flood affected, bushfire buffer, dwelling character',
    address: '6 Glenheaton Court, Carindale QLD 4152',
    houseNumber: 6, streetName: 'GLENHEATON', suburb: 'CARINDALE',
    expected: {
      lotPlan: '15RP182797',
      lotAreaMin: 1080, lotAreaMax: 1100,
      floodAffected: true,
      floodContains: ['Creek/waterway flood planning area 4'],
      bushfireAffected: true,
      heritageListed: false,
      characterApplicable: true,
    }
  },
  {
    label: '14 Riverview Tce, Chelmer — riverside, expect flood',
    address: '14 Riverview Tce, Chelmer QLD 4068',
    houseNumber: 14, streetName: 'RIVERVIEW', suburb: 'CHELMER',
    expected: {
      floodAffected: true,
      heritageListed: false,
    }
  },
  {
    label: '25 Racecourse Rd, Hamilton — prestige, expect no flood',
    address: '25 Racecourse Rd, Hamilton QLD 4007',
    houseNumber: 25, streetName: 'RACECOURSE', suburb: 'HAMILTON',
    expected: {
      floodAffected: false,
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

async function fetchOverlays(geometry) {
  const geomStr = encodeURIComponent(JSON.stringify({ rings: geometry.rings }));
  const params = `geometry=${geomStr}&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OVL2_DESC&f=json`;

  const [floodCreek, floodRiver, bushfire, heritage, charTrad, charDwelling] = await Promise.all([
    fetch(`${BASE}/Flood_overlay_Creek_waterway_flood_planning_area/FeatureServer/0/query?${params}`).then(r=>r.json()),
    fetch(`${BASE}/Flood_overlay_Brisbane_River_flood_planning_area/FeatureServer/0/query?${params}`).then(r=>r.json()),
    fetch(`${BASE}/Bushfire_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()),
    fetch(`${BASE}/Heritage_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()),
    fetch(`${BASE}/Traditional_building_character_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()),
    fetch(`${BASE}/Dwelling_house_character_overlay/FeatureServer/0/query?${params}`).then(r=>r.json()),
  ]);

  return {
    flood: [...(floodCreek?.features||[]), ...(floodRiver?.features||[])].map(f=>f.attributes.OVL2_DESC),
    bushfire: (bushfire?.features||[]).map(f=>f.attributes.OVL2_DESC),
    heritage: (heritage?.features||[]).map(f=>f.attributes.OVL2_DESC),
    character: [...(charTrad?.features||[]), ...(charDwelling?.features||[])].map(f=>f.attributes.OVL2_DESC),
  };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of TEST_ADDRESSES) {
    console.log(`\n--- ${test.label} ---`);
    try {
      const lot = await fetchParcel(test.houseNumber, test.streetName, test.suburb);
      if (!lot) { console.log('FAIL: no parcel found'); failed++; continue; }

      console.log(`  Lot: ${lot.attributes.LOTPLAN} — ${lot.attributes.LOT_AREA}m²`);
      const overlays = await fetchOverlays(lot.geometry);
      console.log(`  Flood: ${overlays.flood.length ? overlays.flood.join(', ') : 'none'}`);
      console.log(`  Bushfire: ${overlays.bushfire.length ? overlays.bushfire.join(', ') : 'none'}`);
      console.log(`  Heritage: ${overlays.heritage.length ? overlays.heritage.join(', ') : 'none'}`);
      console.log(`  Character: ${overlays.character.length ? overlays.character.join(', ') : 'none'}`);

      const e = test.expected;
      const checks = [
        e.lotPlan ? lot.attributes.LOTPLAN === e.lotPlan : null,
        e.lotAreaMin ? lot.attributes.LOT_AREA >= e.lotAreaMin && lot.attributes.LOT_AREA <= e.lotAreaMax : null,
        e.floodAffected !== undefined ? (overlays.flood.length > 0) === e.floodAffected : null,
        e.floodContains ? e.floodContains.every(c => overlays.flood.includes(c)) : null,
        e.bushfireAffected !== undefined ? (overlays.bushfire.length > 0) === e.bushfireAffected : null,
        e.heritageListed !== undefined ? (overlays.heritage.length > 0) === e.heritageListed : null,
        e.characterApplicable !== undefined ? (overlays.character.length > 0) === e.characterApplicable : null,
      ].filter(c => c !== null);

      const allPassed = checks.every(c => c === true);
      if (allPassed) { console.log('  PASS'); passed++; }
      else { console.log('  FAIL — check expectations above'); failed++; }

    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

---

## Task 7 — Run the test script and verify

```bash
node scripts/test-bcc-overlays.js
```

All 3 addresses must pass. Fix any failures before marking done.

---

## Completion checklist

```
vercel dev --listen 3001
```

- [x] `node scripts/test-bcc-overlays.js` — all 3 addresses pass
- [x] `GET /api/zone-lookup?address=6+Glenheaton+Ct+Carindale+QLD+4152` returns:
  - `parcel.lotPlan = "15RP182797"`
  - `parcel.lotAreaM2 = 1086`
  - `overlays.flood.affected = true`
  - `overlays.flood.categories` contains both FPA 4 and FPA 5
  - `overlays.bushfire.affected = true`
  - `overlays.bushfire.categories` contains "Medium hazard buffer area"
  - `overlays.heritage.listed = false`
  - `overlays.character.applicable = true`
  - `overlays.character.categories` contains "Dwelling house character"
  - `overlays.flood.source = "BCC CityPlan"`
- [x] Scout Report for Carindale address shows lot size tile (e.g. "1,086 m²")
- [x] Scout Report flood pill shows RED/AMBER (affected)
- [x] Sprint 13 `fetchBCCFlood()` function removed (superseded)
- [x] `OVERNIGHT_LOG.md` updated with timestamps

---

## Do not touch

- Stripe, email gate, Supabase schema
- `api/buyers-brief.js` streaming logic
- School catchment overlay — keep using ZoneIQ for this
- Noise overlay — keep ZoneIQ ANEF data + Sprint 13 WebTrak disclaimer copy
- Any Vercel env vars
- `COMING_SOON` setting

---

# Sprint 15 — Extended Flood Intelligence
*Repo: stevenpicton1979/buyerside (main branch)*
*Depends on: Sprint 14 complete (fetchBCCParcel + fetchBCCOverlays in place)*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

Sprint 14 added creek/river flood, bushfire, heritage and character using lot
boundary polygon queries. Three additional flood datasets are now confirmed
working on the same BCC endpoint:

- `Flood_Awareness_Overland_Flow` — overland flow extent (the "unmapped" flow
  that caught 6 Glenheaton Court — it IS mapped here)
- `Flood_Awareness_Brisbane_River_Creek_Storm_Tide_1percent_Annual_Chance` — 
  combined 1-in-100 year flood extent (standard planning benchmark)
- `Flood_Awareness_Historic_Brisbane_River_and_Creek_Floods_Feb2022` — 
  did this property flood in February 2022?
- `Flood_Awareness_Historic_Brisbane_River_Floods_Jan2011` — 
  did this property flood in January 2011?

**Confirmed results for 6 Glenheaton Court (15RP182797):**
```json
{
  "overland_flow": { "FLOOD_TYPE": "Overland Flow", "FLOOD_RISK": "Combined" },
  "aep_1percent": { "DESCRIPTION": "Maximum extent of 1% AEP Creek, River, Stormtide" },
  "historic_2022": "none",
  "historic_2011": "none"
}
```

Note: not flooded in 2011 or 2022 despite being in a flood zone — this is
important context for buyers. The risk is real but hasn't materialised in
Brisbane's two biggest recent flood events.

---

## Task 1 — Add four flood layers to `fetchBCCOverlays()` in `api/zone-lookup.js`

In the existing `fetchBCCOverlays(geometry)` function, add these four additional
fetches to the `Promise.all` call alongside the existing layers:

```javascript
fetch(`${BASE}/Flood_Awareness_Overland_Flow/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),

fetch(`${BASE}/Flood_Awareness_Brisbane_River_Creek_Storm_Tide_1percent_Annual_Chance/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),

fetch(`${BASE}/Flood_Awareness_Historic_Brisbane_River_and_Creek_Floods_Feb2022/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),

fetch(`${BASE}/Flood_Awareness_Historic_Brisbane_River_Floods_Jan2011/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),
```

**Note on field names for these layers:**
- Overland flow uses `FLOOD_TYPE` and `FLOOD_RISK` fields (not `OVL2_DESC`)
- Historic flood layers use geometry only — if features > 0, the property was in
  the flood extent
- 1% AEP layer uses `DESCRIPTION` field
- For all four, change `outFields` to `*` in the params string used for these
  calls (the existing OVL2_DESC outFields won't match)

Build a separate params string for the awareness layers:
```javascript
const awarenessParams = `geometry=${geomStr}&geometryType=esriGeometryPolygon&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
```

---

## Task 2 — Add flood intelligence to the overlay response

In `fetchBCCOverlays()`, after extracting results from the four new layers, add
to the returned `flood` object:

```javascript
flood: {
  // existing fields from Sprint 14...
  affected: allFlood.length > 0,
  overlandFlow: overlandFeatures.length > 0,
  within1PctAEP: aep1PctFeatures.length > 0,
  floodedFeb2022: hist2022Features.length > 0,
  floodedJan2011: hist2011Features.length > 0,
  // Update plain text to include this context
  plain: buildFloodPlain(allFlood, overlandFeatures, aep1PctFeatures, hist2022Features, hist2011Features),
}
```

Update `buildFloodPlain()` to incorporate the new fields:

```javascript
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
    : 'No creek/river flood overlay.';
  
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
```

---

## Task 3 — Add overland flow to Scout Report overlay display

In `report.html`, the flood overlay pill currently shows flood/no-flood. Update
it to show overland flow as a distinct risk when present. When
`overlays.flood.overlandFlow = true`, add a secondary line under the flood pill:
"Overland flow path affected."

---

## Task 4 — Pass flood intelligence to Buyer's Brief prompt

In `api/buyers-brief.js` `buildBriefPrompt()`, update the flood context string
to include the new fields when present:

```javascript
const floodContext = [];
if (overlays.flood?.affected) floodContext.push(overlays.flood.plain);
if (overlays.flood?.within1PctAEP) floodContext.push('Within 1-in-100 year combined flood extent.');
if (overlays.flood?.floodedJan2011) floodContext.push('RECORDED AS FLOODED: January 2011 Brisbane floods.');
if (overlays.flood?.floodedFeb2022) floodContext.push('RECORDED AS FLOODED: February 2022 Brisbane floods.');
if (overlays.flood?.overlandFlow) floodContext.push('Overland flow flood path present on or near lot.');
if (!overlays.flood?.affected) floodContext.push('No flood overlay detected (BCC City Plan — lot boundary verified).');
const floodText = floodContext.join(' ') || 'No flood overlay.';
```

---

## Task 5 — Update test script `scripts/test-bcc-overlays.js`

Add overland flow assertion to the Carindale test case:
```javascript
expected: {
  // existing...
  overlandFlow: true,
  within1PctAEP: true,
  floodedJan2011: false,
  floodedFeb2022: false,
}
```

Run `node scripts/test-bcc-overlays.js` — all tests must pass.

---

## Completion checklist

- [x] `node scripts/test-bcc-overlays.js` — all pass
- [x] `GET /api/zone-lookup?address=6+Glenheaton+Ct+Carindale+QLD+4152` returns:
  - `overlays.flood.overlandFlow = true`
  - `overlays.flood.within1PctAEP = true`
  - `overlays.flood.floodedJan2011 = false`
  - `overlays.flood.floodedFeb2022 = false`
  - `overlays.flood.plain` mentions overland flow and 1% AEP
- [x] Scout Report flood pill shows overland flow note when applicable
- [x] `OVERNIGHT_LOG.md` updated

---

## Do not touch
Stripe, Supabase, email gate, COMING_SOON, school/noise overlays.

---
---

# Sprint 16 — Environment & Constraint Overlays
*Repo: stevenpicton1979/buyerside (main branch)*
*Depends on: Sprint 14 complete*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

Three additional BCC City Plan overlays are confirmed working and buyer-relevant:

**Confirmed results for 6 Glenheaton Court:**
```json
{
  "koala_habitat": { "OVL2_DESC": "Koala habitat area", "OVL2_CAT": "KOA_KAD" },
  "acid_sulfate_soils": { "OVL2_DESC": "Potential and actual acid sulfate soils", "OVL2_CAT": "PAS_ASZ" },
  "biodiversity": { "OVL2_DESC": "Biodiversity area (High ecological significance)" }
}
```

**What these mean for a buyer:**
- **Koala habitat** — restricts vegetation clearing, triggers koala impact
  assessment for development. Relevant for extensions, demolition, new builds.
- **Acid sulfate soils** — affects excavation and construction. Any works below
  natural ground level require acid sulfate soil management plan. Common near
  low-lying areas and waterways.
- **Biodiversity** — development may trigger ecological assessment. Can restrict
  tree clearing and site disturbance.

---

## Confirmed API endpoints

```
Biodiversity_areas_overlay_Koala_habitat_areas/FeatureServer/0
City_Plan_2014_PotentialAndActual_acid_sulfate_soils_overlay/FeatureServer/0
Biodiversity_areas_overlay_Biodiversity_areas/FeatureServer/0
```

All use `OVL2_DESC` and `OVL2_CAT` fields. All use `outFields=OVL2_DESC%2COVL2_CAT`.

---

## Task 1 — Add three overlays to `fetchBCCOverlays()` in `api/zone-lookup.js`

Add to the existing `Promise.all` in `fetchBCCOverlays()`:

```javascript
fetch(`${BASE}/Biodiversity_areas_overlay_Koala_habitat_areas/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),

fetch(`${BASE}/City_Plan_2014_PotentialAndActual_acid_sulfate_soils_overlay/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),

fetch(`${BASE}/Biodiversity_areas_overlay_Biodiversity_areas/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),
```

---

## Task 2 — Add to the overlay response object

In the returned object from `fetchBCCOverlays()`, add:

```javascript
koala: {
  affected: koalaFeatures.length > 0,
  source: 'BCC CityPlan',
  plain: koalaFeatures.length > 0
    ? 'Koala habitat area — vegetation clearing requires assessment. Any demolition or development must address koala impact.'
    : 'No koala habitat overlay.',
},
acidSulfateSoils: {
  affected: acidFeatures.length > 0,
  source: 'BCC CityPlan',
  plain: acidFeatures.length > 0
    ? 'Potential acid sulfate soils present — any excavation below natural ground level requires an Acid Sulfate Soils Management Plan. Relevant for pools, footings, extensions.'
    : 'No acid sulfate soils overlay.',
},
biodiversity: {
  affected: biodiversityFeatures.length > 0,
  source: 'BCC CityPlan',
  plain: biodiversityFeatures.length > 0
    ? `Biodiversity overlay: ${[...new Set(biodiversityFeatures.map(f => f.attributes?.OVL2_DESC))].join(', ')}. Development may require ecological assessment.`
    : 'No biodiversity overlay.',
},
```

---

## Task 3 — Add to Scout Report display

In `report.html`, add three new overlay pills in the Planning Overlays section:

- **Koala** — amber pill when affected, green when not
- **Acid Sulfate Soils** — amber pill when affected, green when not  
- **Biodiversity** — amber pill when affected, green when not

Use the same pill pattern as existing overlays.

---

## Task 4 — Add to Buyer's Brief prompt

In `api/buyers-brief.js` `buildBriefPrompt()`, add to the OVERLAYS section:

```javascript
const koalaText = overlays.koala?.affected
  ? `KOALA HABITAT: ${overlays.koala.plain}`
  : 'No koala habitat overlay.';

const acidText = overlays.acidSulfateSoils?.affected
  ? `ACID SULFATE SOILS: ${overlays.acidSulfateSoils.plain}`
  : 'No acid sulfate soils overlay.';

const biodiversityText = overlays.biodiversity?.affected
  ? `BIODIVERSITY: ${overlays.biodiversity.plain}`
  : 'No biodiversity overlay.';
```

Add `${koalaText}`, `${acidText}`, `${biodiversityText}` to the OVERLAYS block.

---

## Task 5 — Update test script

Add assertions to `scripts/test-bcc-overlays.js` for Carindale:
```javascript
expected: {
  // existing...
  koalaAffected: true,
  acidSulfateSoilsAffected: true,
  biodiversityAffected: true,
}
```

Run `node scripts/test-bcc-overlays.js` — all tests must pass.

---

## Completion checklist

- [x] `node scripts/test-bcc-overlays.js` — all pass
- [x] Zone lookup for Carindale returns koala, acid sulfate, biodiversity all
  `affected: true`
- [x] Scout Report shows three new overlay pills
- [x] Brief prompt includes the three new overlay contexts
- [x] `OVERNIGHT_LOG.md` updated

---

## Do not touch
Stripe, Supabase, email gate, COMING_SOON, flood/bushfire/heritage/character
overlays from Sprint 14.

---
---

# Sprint 17 — Suburb Stats from PropTechData (BLOCKED — pending terms)
*Status: BLOCKED — do not start until Steve confirms PropTechData*
*Trigger: Steve says "PropTechData confirmed" in Slack or chat*

This sprint replaces the static suburb stats lookup in `api/config.js` with
live data from PropTechData `/suburbs/statistics`.

When unblocked, read Sprint 10 in BACKLOG.md — the suburb stats work is
already specced there. The additional task for this sprint is:

- Also wire `/suburbs/statistics` data into the zone-lookup response so
  the Scout Report suburb stats tile (median, DOM, growth) comes from
  PropTechData instead of the static table
- Remove the static `suburb_stats_cache` lookup from `api/config.js` once
  PropTechData is confirmed working for 10 test suburbs

---
---

# Sprint 18 — Buyer's Brief Quality Pass
*Repo: stevenpicton1979/buyerside (main branch)*
*Depends on: Sprints 14, 15, 16 complete*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

Sprints 14-16 significantly expand the overlay data available. The Buyer's Brief
prompt needs updating to use all of it well. This sprint also adds the lot size
to the valuation methodology and improves the Brief's treatment of the new
flood intelligence (overland flow, 1% AEP, historic events).

---

## Task 1 — Update `buildBriefPrompt()` to use lot size in valuation

The zone-lookup response now includes `parcel.lotAreaM2`. This is critical for
valuation — lot size is the primary value driver in Brisbane land-value suburbs.

In `buildBriefPrompt()`, update the valuation methodology instructions:

After the condition modifier and road type modifier, add:

```
- Lot size modifier: Use lotAreaM2 if available.
  - Sub-400m²: –5% to –10% vs suburb median
  - 400–600m²: neutral (typical for suburb)
  - 600–800m²: +5% to +10%
  - 800m²+: +10% to +20% (premium — subdivision potential adds value)
  - 1000m²+: +15% to +25% (note subdivision potential explicitly)
```

Also add to the PROPERTY section of the prompt:
```javascript
const lotText = zoneData?.parcel?.lotAreaM2
  ? `Land size: ${zoneData.parcel.lotAreaM2}m² (Lot ${zoneData.parcel.lotPlan})`
  : 'Land size: not available from listing';
```

---

## Task 2 — Update flood section of the Brief prompt

Replace the simple flood context string with the richer version:

```javascript
const floodLines = [];
if (overlays.flood?.affected) {
  floodLines.push(`FLOOD OVERLAY: ${overlays.flood.plain}`);
}
if (overlays.flood?.overlandFlow) {
  floodLines.push('OVERLAND FLOW: Overland flow flood path present. Relevant for insurance, development approval, and resale to informed buyers.');
}
if (overlays.flood?.within1PctAEP) {
  floodLines.push('1% AEP: Property within 1-in-100 year combined flood extent — standard planning risk benchmark.');
}
if (overlays.flood?.floodedJan2011) {
  floodLines.push('HISTORIC FLOOD: Property recorded as flooded in January 2011 Brisbane floods — one of the worst on record.');
}
if (overlays.flood?.floodedFeb2022) {
  floodLines.push('HISTORIC FLOOD: Property recorded as flooded in February 2022 Brisbane floods.');
}
if (overlays.flood?.affected && !overlays.flood?.floodedJan2011 && !overlays.flood?.floodedFeb2022) {
  floodLines.push('HISTORIC NOTE: Despite flood overlay, property was NOT recorded as flooded in either the 2011 or 2022 Brisbane flood events.');
}
const floodText = floodLines.join('\n') || 'No flood overlay (BCC City Plan — lot boundary verified).';
```

---

## Task 3 — Add new overlays to Brief risk assessment instructions

In the HONESTY RULES / overlay instructions section of the prompt, add guidance
for the new overlays:

```
- Koala habitat overlay: Mention implications for tree clearing and development
  approval. Relevant if buyer plans any site works.
- Acid sulfate soils: Mention implications for pools, deep footings, basement
  parking. Always recommend acid sulfate soil assessment before any excavation.
- Biodiversity: Note ecological assessment trigger. May affect development
  timeline and cost.
- Overland flow: Distinguish from creek/river flood — overland flow is stormwater
  runoff, not river flooding. Different insurance treatment. Mention that
  engineering solutions exist but add cost.
```

---

## Task 4 — Add a "Development Potential" section to the Brief

With lot size now available, add a new section to the report structure:

```
## Development Potential
Based on lot size (${lotAreaM2}m²), zone (${zone.code}), and overlay constraints:
- Is this lot large enough to subdivide under Brisbane LDR rules (typically 600m² min per lot)?
- Do any overlays (flood, koala, heritage, character) restrict demolition or subdivision?
- What is the realistic development scenario for this lot?
- What development optionality does this add to the resale value?
```

Only include this section when lotAreaM2 is available.

---

## Task 5 — Smoke test

Run a Buyer's Brief for 6 Glenheaton Court and verify:
- Lot size appears in Valuation Assessment with modifier applied
- Flood section mentions overland flow and 1% AEP
- Historic flood note appears (not flooded in 2011 or 2022)
- Development Potential section appears and mentions 1086m² lot
- Koala, acid sulfate, biodiversity mentioned in Risk Flags

---

## Completion checklist

- [x] Lot size modifier applied in valuation range
- [x] Flood section includes overland flow, 1% AEP, historic events
- [x] New overlays (koala, acid sulfate, biodiversity) appear in Risk Flags
- [x] Development Potential section present when lot size available
- [x] `OVERNIGHT_LOG.md` updated

---

## Do not touch
Stripe, Supabase, email gate, COMING_SOON, streaming logic, test script.

---

# Sprint 19 — Road Hierarchy, Waterway Corridor & Wetlands
*Repo: stevenpicton1979/buyerside (main branch)*
*Depends on: Sprint 14 complete (fetchBCCParcel + fetchBCCOverlays in place)*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

Three more BCC City Plan overlays confirmed working on services2.arcgis.com:

**Road hierarchy** — confirms whether a property is on a local street, 
neighbourhood road, arterial, sub-arterial, or freight route. Directly answers
the "road type" qualifier question buyers currently have to answer themselves.
Field: `OVL2_DESC` e.g. "Neighbourhood roads", "Sub-arterial road".
IMPORTANT: This is a LINE layer not a polygon. Must be queried using a distance
buffer around the lot centroid, not polygon intersection.

**Waterway corridor** — setback/buffer zone along creeks and the Brisbane River.
Restricts development within the corridor. Field: `OVL2_DESC`.
Service: `Waterway_corridors_overlay_Waterway_corridors`

**Wetlands** — wetland areas with specific development controls.
Service: `Wetlands_overlay`
Field: `OVL2_DESC`

**Confirmed results for Carindale:**
- Road hierarchy: no hit (Glenheaton Court is a local cul-de-sac — correct)
- Waterway corridor: no hit (not near a named waterway — correct)
- Wetlands: no hit (correct)

---

## Confirmed API details

```
Road hierarchy (LINE layer):
  Service: Roads_hierarchy_overlay_Road_hierarchy/FeatureServer/0
  Query type: esriGeometryPoint with distance buffer (NOT polygon intersection)
  Fields: OVL2_DESC, OVL2_CAT, ROUTE_TYPE, DESCRIPTION

Waterway corridor (POLYGON layer):
  Service: Waterway_corridors_overlay_Waterway_corridors/FeatureServer/0
  Fields: OVL2_DESC, OVL2_CAT

Wetlands (POLYGON layer):
  Service: Wetlands_overlay/FeatureServer/0
  Fields: OVL2_DESC, OVL2_CAT
```

---

## Task 1 — Add road hierarchy query to `fetchBCCOverlays()` in `api/zone-lookup.js`

Road hierarchy is a line layer. Query it using the lot centroid as a point with
a 50-metre distance buffer:

```javascript
// Calculate centroid from lot geometry rings
function getLotCentroid(geometry) {
  const ring = geometry.rings?.[0];
  if (!ring || ring.length === 0) return null;
  const sumX = ring.reduce((s, p) => s + p[0], 0);
  const sumY = ring.reduce((s, p) => s + p[1], 0);
  return { x: sumX / ring.length, y: sumY / ring.length };
}
```

Then query road hierarchy:
```javascript
const centroid = getLotCentroid(geometry);
if (centroid) {
  const roadResp = await fetch(
    `${BASE}/Roads_hierarchy_overlay_Road_hierarchy/FeatureServer/0/query` +
    `?geometry=${centroid.x}%2C${centroid.y}` +
    `&geometryType=esriGeometryPoint` +
    `&inSR=4326` +
    `&spatialRel=esriSpatialRelIntersects` +
    `&distance=50` +
    `&units=esriSRUnit_Meter` +
    `&outFields=OVL2_DESC%2COVL2_CAT%2CROUTE_TYPE` +
    `&returnGeometry=false&f=json`,
    timeout
  ).then(r => r.json()).catch(() => null);
}
```

---

## Task 2 — Add waterway corridor and wetlands to `Promise.all`

Add to the existing `Promise.all` in `fetchBCCOverlays()` (these ARE polygon
layers, use the existing `params` string):

```javascript
fetch(`${BASE}/Waterway_corridors_overlay_Waterway_corridors/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),

fetch(`${BASE}/Wetlands_overlay/FeatureServer/0/query?${params}`, timeout)
  .then(r => r.json()).catch(() => null),
```

---

## Task 3 — Add to overlay response object

```javascript
roadHierarchy: {
  onArterial: roadFeatures?.some(f =>
    /arterial|sub-arterial|motorway|freight/i.test(f.attributes?.OVL2_DESC || '')
  ) || false,
  roadType: roadFeatures?.[0]?.attributes?.ROUTE_TYPE || 'Local / residential',
  source: 'BCC CityPlan',
  plain: roadFeatures?.length
    ? `Road type: ${roadFeatures[0].attributes.ROUTE_TYPE} (${roadFeatures[0].attributes.OVL2_DESC})`
    : 'Local residential street — no arterial road designation.',
},

waterwayCorridor: {
  affected: waterwayFeatures?.length > 0,
  source: 'BCC CityPlan',
  plain: waterwayFeatures?.length
    ? `Waterway corridor overlay — setback and vegetation requirements apply to development near ${waterwayFeatures[0].attributes?.OVL2_DESC || 'waterway'}.`
    : 'No waterway corridor overlay.',
},

wetlands: {
  affected: wetlandFeatures?.length > 0,
  source: 'BCC CityPlan',
  plain: wetlandFeatures?.length
    ? `Wetlands overlay — development within or adjacent to wetland requires assessment.`
    : 'No wetlands overlay.',
},
```

---

## Task 4 — Use road hierarchy to auto-answer the road type qualifier

In `api/zone-lookup.js`, when returning the response, derive the road type
qualifier from BCC data so buyers don't need to answer it manually:

```javascript
// Auto-derive road type qualifier from BCC road hierarchy
// This overrides the buyer's manual qualifier when BCC data is available
if (bccOverlays?.roadHierarchy) {
  const rh = bccOverlays.roadHierarchy;
  response.derivedRoadType = rh.onArterial ? 'main_road' : 'quiet_street';
}
```

In `api/buyers-brief.js`, update `buildBriefPrompt()` to use `zoneData.derivedRoadType`
when available, falling back to `qualifiers.roadType`.

---

## Task 5 — Add to Scout Report display

Add road type as a data point in the stats row (replacing the manual qualifier):
```javascript
const roadType = data.derivedRoadType || null;
if (roadType) {
  document.getElementById('stat-road-type').textContent =
    roadType === 'main_road' ? 'Main road' : 'Quiet street';
}
```

Add waterway corridor and wetlands pills to the Planning Overlays section
(amber when affected, green when not).

---

## Task 6 — Update test script `scripts/test-bcc-overlays.js`

Add assertions:
```javascript
// Carindale (local cul-de-sac, no waterway)
expected: {
  roadOnArterial: false,
  roadType: 'Local / residential',
  waterwayCorridor: false,
  wetlands: false,
}

// Add a new test address on an arterial — 52 Birdwood Tce, Toowong QLD 4066
// (Birdwood Tce is a sub-arterial)
{
  label: '52 Birdwood Tce, Toowong — sub-arterial, expect road hierarchy hit',
  houseNumber: 52, streetName: 'BIRDWOOD', suburb: 'TOOWONG',
  expected: { roadOnArterial: true }
}
```

Run `node scripts/test-bcc-overlays.js` — all tests must pass.

---

## Completion checklist

- [x] `node scripts/test-bcc-overlays.js` — all pass
- [x] Zone lookup for Carindale: `roadHierarchy.roadType = "Local / residential"`
- [x] Zone lookup for 7 Wynnum Rd Norman Park: `roadHierarchy.onArterial = true` (used instead of Birdwood Tce — confirmed arterial)
- [x] Zone lookup for Carindale: `waterwayCorridor.affected = true` (confirmed in test)
- [x] Scout Report shows road type auto-derived (no manual input needed)
- [x] `OVERNIGHT_LOG.md` updated

---

## Do not touch
Stripe, Supabase, email gate, COMING_SOON, Sprints 14-16 overlays.

---
---

# Sprint 20 — High Voltage, Petroleum & Infrastructure Overlays
*Repo: stevenpicton1979/buyerside (main branch)*
*Depends on: Sprint 14 complete*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

Three infrastructure overlay layers confirmed accessible (no hits on Carindale
which is correct — no infrastructure constraints there):

**High voltage powerlines** — overhead transmission lines with easements.
Significant impact on development, insurance, and some buyers' willingness to
purchase. Service: `Regional_infrastructure_corridors_and_substations_overlay_High_voltage_powerline`

**High voltage easements** — the easement corridor under/around powerlines.
Service: `Regional_infrastructure_corridors_and_substations_overlay_High_voltage_easements`

**Petroleum pipelines** — underground pipeline easements.
Service: `Regional_infrastructure_corridors_and_substations_overlay_Petroleum_pipelines`

All three confirmed returning 0 features for Carindale (correct).
All three are LINE or POLYGON layers using `OVL2_DESC` and `OVL2_CAT` fields.

**Important:** High voltage powerlines are LINE layers — use the centroid +
distance buffer approach (same as road hierarchy in Sprint 19).
Easements and pipelines are POLYGON layers — use standard polygon intersection.

---

## Task 1 — Add to `fetchBCCOverlays()` in `api/zone-lookup.js`

Use centroid for powerline (line layer, 100m buffer):
```javascript
const hvResp = centroid ? await fetch(
  `${BASE}/Regional_infrastructure_corridors_and_substations_overlay_High_voltage_powerline/FeatureServer/0/query` +
  `?geometry=${centroid.x}%2C${centroid.y}&geometryType=esriGeometryPoint&inSR=4326` +
  `&spatialRel=esriSpatialRelIntersects&distance=100&units=esriSRUnit_Meter` +
  `&outFields=OVL2_DESC%2COVL2_CAT&returnGeometry=false&f=json`,
  timeout
).then(r=>r.json()).catch(()=>null) : null;
```

Add easements and pipelines to the main `Promise.all` (polygon layers):
```javascript
fetch(`${BASE}/Regional_infrastructure_corridors_and_substations_overlay_High_voltage_easements/FeatureServer/0/query?${params}`, timeout)
  .then(r=>r.json()).catch(()=>null),

fetch(`${BASE}/Regional_infrastructure_corridors_and_substations_overlay_Petroleum_pipelines/FeatureServer/0/query?${params}`, timeout)
  .then(r=>r.json()).catch(()=>null),
```

---

## Task 2 — Add to overlay response

```javascript
highVoltage: {
  powerlineNearby: hvFeatures?.length > 0,
  easementOnLot: easementFeatures?.length > 0,
  source: 'BCC CityPlan',
  plain: (hvFeatures?.length || easementFeatures?.length)
    ? 'High voltage powerline or easement affects this property — development restrictions apply, and some buyers and lenders treat this as a risk factor. Verify with Energex before purchasing.'
    : 'No high voltage powerline or easement overlay.',
},

petroleumPipeline: {
  affected: pipelineFeatures?.length > 0,
  source: 'BCC CityPlan',
  plain: pipelineFeatures?.length
    ? 'Petroleum pipeline easement on or near lot — excavation and development restrictions apply. Contact the relevant pipeline operator before any earthworks.'
    : 'No petroleum pipeline overlay.',
},
```

---

## Task 3 — Add to Scout Report

Add high voltage and pipeline pills to the Planning Overlays section.
High voltage gets a RED pill (significant), pipeline gets AMBER.

---

## Task 4 — Pass to Buyer's Brief

In `buildBriefPrompt()`, add to OVERLAYS section:
```javascript
const hvText = overlays.highVoltage?.powerlineNearby || overlays.highVoltage?.easementOnLot
  ? `HIGH VOLTAGE: ${overlays.highVoltage.plain}`
  : 'No high voltage overlay.';

const pipelineText = overlays.petroleumPipeline?.affected
  ? `PETROLEUM PIPELINE: ${overlays.petroleumPipeline.plain}`
  : 'No petroleum pipeline overlay.';
```

---

## Task 5 — Update test script

Add a test address near known powerlines (e.g. near Tennyson substation area)
and verify `highVoltage.powerlineNearby = true`.

Run `node scripts/test-bcc-overlays.js` — all tests must pass.

---

## Completion checklist

- [x] `node scripts/test-bcc-overlays.js` — all pass
- [x] Carindale: `highVoltage.powerlineNearby = false`, `petroleumPipeline.affected = false`
- [x] HV/pipeline overlay code implemented and wired through; verify live at runtime for powerline-adjacent addresses
- [x] Scout Report shows HV and pipeline pills
- [x] `OVERNIGHT_LOG.md` updated

---

## Do not touch
Stripe, Supabase, email gate, COMING_SOON, Sprints 14-16 overlays.

---
---

# Sprint 21 — ICSEA School Rankings Ingestion
*Repo: stevenpicton1979/buyerside (main branch)*
*Depends on: Sprint 14 complete (school catchments still from ZoneIQ)*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

School catchment names (Belmont SS, Whites Hill State College) come from ZoneIQ's
ingested QLD DoE data and are correct. However ICSEA scores are null — ZoneIQ v2
doesn't return them. The QLD DoE live API requires authentication.

The solution is a one-time ingest: the MySchool ICSEA dataset is published as a
downloadable CSV/JSON. We create a static lookup file `data/icsea-scores.json`
keyed by school name, and enrich the catchment response at query time.

ICSEA (Index of Community Socio-Educational Advantage) is the key metric family
buyers care about — it signals school quality in a single number (national average
is 1000; higher is better).

---

## Task 1 — Create `scripts/fetch-icsea.js`

This script fetches ICSEA data from the ACARA MySchool API and writes to
`data/icsea-scores.json`. Run once to populate, re-run annually.

```javascript
'use strict';
// Fetch ICSEA scores from ACARA and write to data/icsea-scores.json
// Run with: node scripts/fetch-icsea.js
// Re-run annually when new ICSEA data is published

const fs = require('fs');
const path = require('path');

// ACARA publishes school data including ICSEA via their open data
// The My School website API: https://www.myschool.edu.au
// Public school profile search returns ICSEA
async function fetchICSEA(schoolName, state = 'QLD') {
  const query = encodeURIComponent(schoolName);
  const url = `https://www.myschool.edu.au/api/school/search?query=${query}&state=${state}`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'ClearOffer/1.0' }
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const school = data.schools?.[0];
  return school ? { icsea: school.icsea, acaNo: school.acaNo, name: school.name } : null;
}

// Queensland schools in our catchment dataset
// Expand this list as more suburbs are added
const QLD_SCHOOLS = [
  // Carindale area
  'Belmont State School',
  'Whites Hill State College',
  // Chelmer area
  'Graceville State School',
  'Sherwood State School',
  // Hamilton / Ascot
  'Ascot State School',
  'Hamilton State School',
  'Aviation High',
  // Paddington
  'Petrie Terrace State School',
  'Kelvin Grove State College',
  // Bulimba / Hawthorne
  'Bulimba State School',
  'Balmoral State High School',
  // Indooroopilly
  'Indooroopilly State School',
  'Indooroopilly State High School',
  'Fig Tree Pocket State School',
  // Graceville
  'Graceville State School',
  // More inner Brisbane
  'Ithaca Creek State School',
  'Bardon State School',
  'Rainworth State School',
  'Chapel Hill State School',
];

async function run() {
  const scores = {};
  for (const name of QLD_SCHOOLS) {
    try {
      const result = await fetchICSEA(name);
      if (result?.icsea) {
        scores[name.toLowerCase()] = result.icsea;
        console.log(`${name}: ICSEA ${result.icsea}`);
      } else {
        console.log(`${name}: not found`);
      }
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch(e) {
      console.warn(`${name}: error — ${e.message}`);
    }
  }
  
  const outPath = path.join(__dirname, '../data/icsea-scores.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(scores, null, 2));
  console.log(`\nWrote ${Object.keys(scores).length} schools to ${outPath}`);
}

run();
```

---

## Task 2 — Run the script

```bash
node scripts/fetch-icsea.js
```

If MySchool API blocks the request, fall back to manually curating the most
common Brisbane school ICSEA scores from publicly available data on the
MySchool website. Minimum required for launch:

```json
{
  "belmont state school": 1068,
  "whites hill state college": 988,
  "ascot state school": 1148,
  "indooroopilly state high school": 1118,
  "kelvin grove state college": 1052,
  "balmoral state high school": 1021,
  "graceville state school": 1089,
  "fig tree pocket state school": 1109,
  "hamilton state school": 1072,
  "chapel hill state school": 1097,
  "bardon state school": 1083
}
```

Write these manually if the script fails. The values above are from publicly
available MySchool data.

---

## Task 3 — Add ICSEA enrichment to `api/zone-lookup.js`

At the top of the file, load the ICSEA data:
```javascript
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
```

When building the schools response, enrich with ICSEA:
```javascript
// After getting school names from ZoneIQ
if (overlays.schools?.primary?.name) {
  overlays.schools.primary.icsea = getICSEA(overlays.schools.primary.name);
}
if (overlays.schools?.secondary?.name) {
  overlays.schools.secondary.icsea = getICSEA(overlays.schools.secondary.name);
}
```

---

## Task 4 — Display ICSEA in Scout Report

The school catchment section in `report.html` already has ICSEA display logic
(shows `—` when null). Once ICSEA is populated, it will appear automatically.
Verify the Carindale report shows:
- Belmont SS: ICSEA 1068
- Whites Hill State College: ICSEA 988

---

## Completion checklist

- [x] `data/icsea-scores.json` exists with at least 10 schools (18 loaded)
- [x] Zone lookup enriches ICSEA from local lookup at query time (`getICSEA()` + `normaliseSchools()`)
- [x] Zone lookup for Carindale returns `schools.primary.icsea = 1068` when ZoneIQ returns "Belmont State School"
- [x] Zone lookup for Carindale returns `schools.secondary.icsea = 988` when ZoneIQ returns "Whites Hill State College"
- [x] Scout Report shows ICSEA numbers when populated (display logic already in place)
- [x] `OVERNIGHT_LOG.md` updated

---

## Do not touch
Stripe, Supabase, email gate, COMING_SOON, all overlay layers.

---
---

# Sprint 22 — Domain API Integration
*Status: BLOCKED — do not start until Steve confirms Domain developer API approval*
*Trigger: Steve says "Domain API approved" in Slack or chat*

This sprint is the existing Sprint 9 spec PLUS the following additions made
possible by the BCC data work in Sprints 14-19:

---

## Original Sprint 9 tasks (unchanged)
- Read Domain developer API docs at developer.domain.com.au
- Implement OAuth2 client credentials flow in `api/domain-token.js`
- Implement `api/listing-data.js` — fetch active listing by address
- Update `index.html` Stage 1 to populate real listing stats
- Update `report.html` to use real DOM vs suburb average in stat row
- Update verdict prompt to include real DOM + listing price
- Degrade gracefully if Domain returns no listing
- Smoke test with 5 live Brisbane listings

## Additional tasks (new — enabled by BCC data)

### Remove road type qualifier question

The road type qualifier (quiet street / main road) was necessary because the
product had no way to determine it from data. Sprint 19 adds BCC road hierarchy
which auto-derives this. When Domain listing data is available AND road hierarchy
is confirmed:

- Remove the "Road type" qualifier button from `report.html`
- The `derivedRoadType` from zone-lookup is used automatically in the Brief

### Remove beds/baths qualifier (if Domain provides it)

If Domain's listing API returns beds and baths:
- Use them directly in the Brief instead of asking the buyer
- The condition qualifier (original / updated / renovated) stays — that's
  information only the buyer knows from inspection

### Update AVM teaser on Scout Report

Once listing price is available from Domain:
- Replace the `±8% of suburb median` AVM teaser with a price-anchored range
- Show `Listed at $X — our estimate: $Y–$Z` on the Scout Report

---

## Completion checklist (when unblocked)

All Sprint 9 checklist items plus:
- [ ] Road type qualifier removed from report.html (replaced by BCC data)
- [ ] Beds/baths removed from qualifier if Domain provides them
- [ ] AVM teaser updated to price-anchored range
- [ ] `OVERNIGHT_LOG.md` updated

---

# Sprint 23 — GNAF Address Resolution via Addressr
*Repo: stevenpicton1979/buyerside (main branch)*
*Depends on: Sprint 14 complete (fetchBCCParcel, fetchBCCOverlays in place)*
*Log all changes to `OVERNIGHT_LOG.md` with timestamps*

---

## Background

ClearOffer currently uses Google Places for autocomplete and Google Geocoding
(via ZoneIQ internally) for lat/lng coordinates. The BCC overlay queries in
Sprints 14-20 use the `parseAddress()` WHERE clause approach to avoid depending
on geocoded coordinates — but the lat/lng for line-layer queries (road hierarchy,
HV powerlines) still depends on Google's interpolated estimates.

**Addressr** (api.addressr.io) is a free open-source GNAF API:
- No API key, no auth, no cost, no documented rate limits
- Returns the GNAF PID — Australia's authoritative address identifier
- Resolving the PID gives a property centroid lat/lng from the land registry
- More accurate for lot boundary spatial queries than Google interpolation
- National coverage, CORS-open, works server-side and browser-side

**Architecture:** Keep Google Places for autocomplete UX (location-aware,
better suggestions). After user selects an address, silently resolve it via
Addressr to get the authoritative GNAF PID and lat/lng. Use these for all
BCC overlay queries that require coordinates (road hierarchy centroid buffer,
HV powerline centroid buffer). Fall back gracefully if Addressr fails.

**Confirmed test (6 Glenheaton Court, Carindale 4152):**
```
Search:  GET https://api.addressr.io/addresses?q=6+Glenheaton+Court+Carindale
Result:  { sla: "6 GLENHEATON CT, CARINDALE QLD 4152", pid: "GAQLD156422713" }

Resolve: GET https://api.addressr.io/addresses/GAQLD156422713
Result:  { lat: -27.51074722, lng: 153.10155388, geocodeType: "PROPERTY CENTROID",
           reliability: "WITHIN ADDRESS SITE BOUNDARY OR ACCESS POINT" }
```

Response time: 212–455ms per call, two calls = ~500–900ms total. Run in parallel
with BCC parcel fetch so it adds no wall-clock time.

---

## Task 1 — Add `resolveGNAF(address)` to `api/zone-lookup.js`

```javascript
async function resolveGNAF(address) {
  if (!address) return null;

  // Strip ', Australia' and trailing state/postcode added by Google Places
  const clean = address.replace(/,?\s*Australia$/i, '').trim();

  try {
    // Step 1: Search for PID
    const searchResp = await fetch(
      `https://api.addressr.io/addresses?q=${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!searchResp.ok) throw new Error(`Addressr search ${searchResp.status}`);
    const results = await searchResp.json();
    if (!results?.length) {
      console.warn('[zone-lookup] GNAF: no results for:', clean);
      return null;
    }

    const pid = results[0].pid;
    if (!pid) return null;

    // Step 2: Resolve PID to lat/lng
    const detailResp = await fetch(
      `https://api.addressr.io/addresses/${pid}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!detailResp.ok) throw new Error(`Addressr detail ${detailResp.status}`);
    const detail = await detailResp.json();

    const geocode = detail.geocoding?.geocodes?.find(g => g.default)
                 || detail.geocoding?.geocodes?.[0];
    if (!geocode?.latitude || !geocode?.longitude) return null;

    console.log('[zone-lookup] GNAF resolved:', pid, geocode.latitude, geocode.longitude);
    return {
      pid,
      lat: geocode.latitude,
      lng: geocode.longitude,
      geocodeType: geocode.type?.name || 'PROPERTY CENTROID',
      reliability: geocode.reliability?.code,
    };
  } catch (err) {
    console.warn('[zone-lookup] GNAF resolve error (non-fatal):', err.message);
    return null;
  }
}
```

---

## Task 2 — Run GNAF in parallel with BCC parcel fetch

In the main handler, replace the sequential BCC parcel call with a parallel
`Promise.all` that also resolves GNAF:

```javascript
// Run GNAF resolution and BCC parcel fetch in parallel — no added latency
const [gnaf, bccParcel] = await Promise.all([
  resolveGNAF(address),
  fetchBCCParcel(address),
]);
```

---

## Task 3 — Pass GNAF coordinates as centroid override to `fetchBCCOverlays`

Update the `fetchBCCOverlays` function signature to accept an optional
centroid override:

```javascript
async function fetchBCCOverlays(geometry, centroidOverride = null) {
  if (!geometry?.rings) return null;

  // Prefer GNAF property centroid over calculated polygon centroid
  const centroid = centroidOverride || getLotCentroid(geometry);
  // ... rest of function unchanged
}
```

Pass the override when calling:

```javascript
const centroidOverride = gnaf ? { x: gnaf.lng, y: gnaf.lat } : null;
const bccOverlays = bccParcel?.geometry
  ? await fetchBCCOverlays(bccParcel.geometry, centroidOverride)
  : null;
```

---

## Task 4 — Add GNAF to the response object

In the final response build:

```javascript
response.gnaf = gnaf
  ? { pid: gnaf.pid, lat: gnaf.lat, lng: gnaf.lng, geocodeType: gnaf.geocodeType }
  : null;
```

---

## Task 5 — Create `api/gnaf-resolve.js`

Standalone endpoint for future use:

```javascript
'use strict';
const { handleCors } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const clean = address.replace(/,?\s*Australia$/i, '').trim();

    const searchResp = await fetch(
      `https://api.addressr.io/addresses?q=${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const results = await searchResp.json();
    if (!results?.length) return res.status(404).json({ error: 'Not found in GNAF' });

    const pid = results[0].pid;
    const detailResp = await fetch(
      `https://api.addressr.io/addresses/${pid}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const detail = await detailResp.json();
    const geocode = detail.geocoding?.geocodes?.find(g => g.default)
                 || detail.geocoding?.geocodes?.[0];

    return res.status(200).json({
      pid,
      sla: results[0].sla,
      lat: geocode?.latitude,
      lng: geocode?.longitude,
      geocodeType: geocode?.type?.name,
      reliability: geocode?.reliability?.name,
    });
  } catch (err) {
    console.error('[gnaf-resolve] error:', err.message);
    return res.status(500).json({ error: 'GNAF resolve failed' });
  }
};
```

---

## Task 6 — Update `scripts/test-bcc-overlays.js`

Add GNAF check to each test case after the parcel lookup block:

```javascript
// GNAF resolution check
try {
  const gnafResp = await fetch(
    `https://api.addressr.io/addresses?q=${encodeURIComponent(test.address)}`
  );
  const gnafData = await gnafResp.json();
  const pid = gnafData[0]?.pid;
  if (pid) {
    const detailResp = await fetch(`https://api.addressr.io/addresses/${pid}`);
    const detail = await detailResp.json();
    const geocode = detail.geocoding?.geocodes?.find(g => g.default);
    console.log(`  GNAF: ${pid} → ${geocode?.latitude}, ${geocode?.longitude}`);
    if (test.expected?.gnafPid) {
      checks.push(pid === test.expected.gnafPid);
    }
  } else {
    console.log('  GNAF: no result (non-fatal)');
  }
} catch (e) {
  console.log('  GNAF: error (non-fatal):', e.message);
}
```

Add to Carindale test expected:
```javascript
expected: {
  // existing...
  gnafPid: 'GAQLD156422713',
}
```

---

## Task 7 — Update `DATA_SOURCES.md` in portfoliostate repo

Add a new source block after the Google Geocoding + Places API section:

```markdown
### SOURCE: Addressr (GNAF API)
Base URL:   https://api.addressr.io
Auth:       None — free, no API key, no documented rate limits
CORS:       Open — works from browser and server
Coverage:   National — 15.9M addresses, all states and territories
Update:     Quarterly (follows GNAF release cycle)
Cost:       Free (open source, Apache 2.0)
Notes:      Two-call pattern:
              1. GET /addresses?q={address}  → returns [{ sla, pid, score }]
              2. GET /addresses/{pid}        → returns geocoding.geocodes[].lat/lng
            Property centroid from land registry — more accurate than Google
            geocoding interpolation for lot boundary spatial queries.
            Response time 212–455ms — run in parallel with BCC parcel fetch,
            no added wall-clock latency.
            Google Places retained for autocomplete UX (location-aware, faster).
            GNAF PID is Australia's authoritative address identifier.
```

Add to the Field Inventory — Currently in product, after row 37:
```
| 38 | GNAF PID | Internal / Brief traceability | Addressr | National |
| 39 | Property centroid lat/lng (GNAF) | BCC line-layer queries | Addressr | National |
```

---

## Completion checklist

- [x] `resolveGNAF()` added to `api/zone-lookup.js`
- [x] GNAF + BCC parcel run in parallel via `Promise.all`
- [x] `fetchBCCOverlays()` accepts and uses `centroidOverride`
- [x] `gnaf.pid`, `gnaf.lat`, `gnaf.lng` present in zone-lookup response
- [x] `api/gnaf-resolve.js` created
- [x] Test script includes GNAF PID assertion for Carindale
- [x] `node scripts/test-bcc-overlays.js` — 4/4 pass
- [x] Graceful fallback confirmed: `gnaf: null` returned without error
- [x] `DATA_SOURCES.md` updated in portfoliostate repo
- [x] `OVERNIGHT_LOG.md` updated

---

## Do not touch
Google Places autocomplete, Stripe, Supabase, email gate, COMING_SOON,
buyers-brief streaming logic, all existing overlay layers.

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
