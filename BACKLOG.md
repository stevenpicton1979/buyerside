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

- [ ] Server log shows stub with `avm: null, comparables: null`
- [ ] Server log shows `research pass complete` with non-zero length
- [ ] Brief renders fully — all 8 sections present, not truncated
- [ ] Brief does NOT cite specific comparable sale addresses, prices, or dates
- [ ] Brief DOES include the honesty statement about comparables
- [ ] Brief mentions a suburb median figure with a cited source
- [ ] School catchments appear by name in the Brief
- [ ] Error state div NOT visible on successful Brief completion
- [ ] Verdict is a single sharp sentence with no meta-text
- [ ] `OVERNIGHT_LOG.md` updated with timestamps

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

## Ideas / future sprints (not scheduled)

- PDF generation for Buyer's Brief (v2) — Puppeteer or html-pdf-node
- Stripe webhook: trigger follow-up email with PDF attachment on `checkout.session.completed`
- Sydney expansion — ZoneIQ now has NSW coverage, same flow applies
- Melbourne expansion — ZoneIQ has VIC coverage
- Agent lookup — Domain API agent profile (not vendor discount, just name + listing count)
- Avalon Airport ANEF — ZoneIQ Sprint 28 found queryable layers, add to ZoneIQ then expose here
- Suburb stats chart — 10yr timeseries from PropTechData rendered as SVG sparkline
- Coming soon waitlist → Resend broadcast email on launch day
