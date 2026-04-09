# ClearOffer — Rebuild Brief
*For the new build chat. Read everything before writing a single line of code.*
*9 April 2026*

---

## What you are building

ClearOffer is an AI-powered property intelligence tool for Australian home buyers. It does the analytical work a buyers agent does — without the $15,000 fee.

**Tagline:** "Know what to offer before you ask."
**Live at:** clearoffer.com.au
**Repo:** stevenpicton1979/buyerside (main branch — not master)
**Stack:** Vanilla HTML/CSS/JS + Vercel serverless Node.js. No framework. No build step. CommonJS (`require`/`module.exports`) throughout. Deploy via git push → Vercel auto-deploy.
**Price:** $149 AUD one-time per property. No subscription.
**Launch market:** Brisbane only.

You are rebuilding this from scratch into the same repo. The previous codebase had mock data baked in, a broken local dev setup, and accumulated technical debt from iterative sessions. Start clean. Keep all infrastructure (Stripe, Supabase, Resend, Anthropic, ZoneIQ keys — all already in Vercel env).

---

## The two constraints that shape everything

Read these first. They are the architectural spine of the entire codebase.

**Constraint 1: PropTechData is NEVER called on the free report.**
The free Scout Report must cost under $0.15 per lookup. PropTechData costs $0.50–$1.50 per call. It is reserved for the paid Buyer's Brief only. Every free report data point must come from ZoneIQ (free), Domain developer API (free tier), or cached/static data. Do not architect a single free report route that touches PropTechData.

**Constraint 2: ZoneIQ is the primary overlay source.**
ZoneIQ (zoneiq-sigma.vercel.app) is a separate product Steven owns. It returns flood, bushfire, heritage, character, school catchments, aircraft noise, and zoning for any Brisbane address in a single API call. It is free per call. It is the only source for overlay data. Do not call BCC ArcGIS directly unless ZoneIQ is explicitly unavailable (use as fallback only, document clearly).

---

## The product flow

```
Visitor lands → enters address (autocomplete)
    ↓
Stage 1 — instant, free, NO email required
  - Listing basics (price, beds/baths, DOM, agent) from Domain API
  - One-line AI verdict (sharp, specific, slightly provocative — see below)
  - Blurred/locked teaser sections visible below
    ↓
Email gate — "Get your free Scout Report"
    ↓
Stage 2 — free Scout Report generates
  - Full overlay data from ZoneIQ
  - Suburb stats from cache (NOT PropTechData)
  - AVM teaser (range shown, detail locked)
  - Comparable sales (sold price + date only — see data constraints)
  - Two buyer qualifier questions (renovation status, road type)
  - Demand vs supply meters
  - Locked sections clearly labelled with what's inside
    ↓
Paid CTA — prominent throughout Stage 2
    ↓
Stripe $149 → Buyer's Brief generates
  - Full PropTechData AVM with confidence score
  - Comparable sales with full context
  - Flood risk in plain English (FPA code explained)
  - All overlays explained
  - Offer recommendation with specific dollar figures
  - Negotiating leverage (DOM signals + comparable gap)
  - 5–10 year suburb outlook
  - What the agent won't tell you
    ↓
Report on screen + emailed as PDF (v2) — on-screen only for v1
    ↓
24hr follow-up email if no paid conversion
```

---

## Data layer — the complete architecture

### Free Scout Report (target: under $0.15 per lookup)

| Data point | Source | Cost | Status |
|---|---|---|---|
| Listing price, beds/baths, DOM, agent name | Domain developer API (free tier) | Free | PENDING APPROVAL — use smart stubs until approved |
| Address autocomplete | Domain developer API — PENDING. Fallback: Google Places API ($0.017/session) | Free/near-free | Use Google Places as fallback |
| One-line AI verdict | Claude API — minimal prompt, ~100 tokens | ~$0.02 | Build this |
| Suburb median, DOM average | Cached Supabase table (populated monthly from PropTechData) | Near zero | Build cache table |
| Flood flag + FPA code | ZoneIQ | Free | Build this |
| School catchment + ICSEA | ZoneIQ | Free | Build this |
| Bushfire, heritage, character, noise overlays | ZoneIQ | Free | Build this |
| AVM teaser range | Derived: listing price + suburb median + Claude | ~$0.02 | Build this |
| Comparable sales teaser (3 rows, sold price + date only) | Cached dataset or PropTechData suburb sales (cached, not per-lookup) | Near zero | Build with cached data |
| Demand vs supply meters | Derived from suburb stats cache | Near zero | Build this |

**Critical:** No PropTechData per-lookup calls on the free report. Suburb stats served from Supabase cache populated monthly.

### Paid Buyer's Brief (target: $3–5 cost, $149 revenue)

| Data point | Source |
|---|---|
| Full AVM with confidence score | PropTechData /properties/avm |
| Comparable sales (sold price, date, attributes) | PropTechData /market-activity/sales |
| Suburb statistics | PropTechData /suburbs/statistics |
| Suburb timeseries (10yr) | PropTechData /suburbs/timeseries |
| All overlays explained in plain English | ZoneIQ + Claude |
| Offer recommendation + negotiation script | Claude — synthesises all above |
| 5–10yr outlook | Static lookup table (Olympics/CRR) + PropTechData timeseries |
| What the agent won't tell you | Claude |

---

## Data supplier status — read before building anything

### Domain developer API
- **Status:** PENDING APPROVAL as of 9 April. Chaser sent to api@domain.com.au.
- **What it's for:** Active listing data (price, beds/baths, DOM, agent, photos) and address autocomplete ONLY.
- **What it's NOT for:** Sold transactions, AVM, suburb stats — all blocked by VG licence (separate product: Domain Insights/Pricefinder, different team, not available to us).
- **Build rule:** Design every route that uses Domain data to degrade gracefully with smart stubs. Never hard-fail if Domain returns nothing.
- **Fallback for autocomplete:** Google Places API — key is GOOGLE_GEOCODING_API_KEY already in Vercel env. Use this until Domain approved.

### PropTechData
- **Status:** Email sent 8 April, no response. Their API platform appears to be branded "Nexu" — docs at api.nexu.com.au.
- **Build rule:** Do NOT build any PropTechData integration until Steven confirms: (1) no VG restriction on their sold data for paid consumer reports, (2) pricing is acceptable. Build the paid report structure and Claude prompt so PropTechData data slots in — but stub it out until confirmed.
- **If VG restriction applies:** The negotiation section still works using DOM signals + comparable-price-gap analysis (see negotiation section below).

### ZoneIQ
- **URL:** https://zoneiq-sigma.vercel.app (always use this, NOT zoneiq.com.au — redirect issue on server-side fetch)
- **Cost:** Free per call
- **Always read the OpenAPI spec before wiring any overlay field:** https://zoneiq-sigma.vercel.app/api/openapi — field names differ by state, this is the authoritative reference
- **Response shape:** All overlays nested under `response.overlays.*`
- **QLD flood returns:** FPA codes (R1, R2A, R3, R4, R5) — river flood + overland flow
- **NSW flood returns:** Binary flag with LEP reference — display as "Flood affected — refer to local LEP" not a risk score
- **VIC flood returns:** LSIO/FO/SBO overlay type
- **Partial responses:** HTTP 200 with `rules: null` and `meta.partial: true` when zone not seeded — handle gracefully, never crash
- **Fallback:** If ZoneIQ unavailable, return safe defaults and log warning. Never fail the main response.
- **Timeout:** 8 seconds (AbortSignal.timeout)

---

## The one-line AI verdict — design spec

This is the hook. It appears at Stage 1 before the email gate. It must feel like a sharp friend who knows the market just texted you.

**Wrong:** "This property appears to be fairly valued based on comparable sales."
**Right:** "Listed at $895K, but three comparable sales in the past 90 days suggest $840K is the ceiling — there's room here."
**Right:** "43 days on market in a suburb where properties average 22 days. The listing agent hasn't found a buyer at this price. That's leverage."

Specific. Confident. Slightly provocative. Creates an itch for the full report.

**Inputs available at Stage 1:**
- Listing price (from Domain or stub)
- Days on market (from Domain or stub)
- Suburb median (from cache)
- Suburb average DOM (from cache)
- Flood flag if high risk (from ZoneIQ — worth mentioning if R2A or above)

Claude prompt for the verdict should be minimal — 200 tokens max output. Cost target ~$0.02.

---

## The negotiation section — how it works without agent discount data

Agent vendor discount data is deferred out of v1. The negotiation section instead uses:

1. **DOM signal:** "This property has been listed 43 days against a 22-day suburb average. That's leverage."
2. **Comparable price gap:** "The three most comparable sales in the past 90 days settled between $847K and $862K against a $895K asking price — the gap is real."
3. **Active supply:** "There are currently 8 similar properties listed in this suburb. Buyers have options."

This produces genuine negotiating intelligence without agent-specific data.

---

## Buyer qualifier questions

Two questions shown just before the AVM estimate in the free report. Framed as personalisation, not a gate.

1. **Renovation status:** Original condition / Partially updated / Fully renovated
2. **Road type:** Quiet street / Main road / Other

These do not change the PropTechData AVM number. They change how Claude frames confidence and interpretation. Example: "Given this property is in original condition and comparables in this suburb are predominantly renovated, we'd weight toward the lower end of that range."

Maximum two questions. Do not add more.

---

## Conversion design principles

The free/paid split is "creates curiosity vs resolves it" — not cheap data vs expensive data.

Three mechanisms that drive conversion:
1. **Demonstrated competence** — show something the buyer couldn't easily get themselves (flood FPA code in plain language, DOM vs suburb average)
2. **Visible incompleteness** — show the label, lock the value. "Our opening offer recommendation based on comparable evidence is [LOCKED]" — not just a blurred section
3. **Personal relevance** — CTA language: "You've done the inspection. Here's what to offer." Not generic "buy the full report"

---

## Supabase schema

**Project ID:** dqzqqfcepsqhaxovneen
**Use raw REST fetch** (not @supabase/supabase-js) — avoids adding dependencies. Pattern established in verify-access.js from previous build.

Tables needed:

```sql
-- Email captures and conversion tracking
create table if not exists scout_reports (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  address text not null,
  created_at timestamptz default now(),
  report_data jsonb,
  followup_sent boolean default false,
  converted_to_paid boolean default false,
  unique(email, address)
);

-- Suburb statistics cache (populated monthly, served free per lookup)
create table if not exists suburb_stats_cache (
  id uuid default gen_random_uuid() primary key,
  suburb text not null,
  state text not null default 'QLD',
  median_house_price integer,
  median_dom integer,
  clearance_rate numeric,
  growth_12m numeric,
  cagr_10yr numeric,
  updated_at timestamptz default now(),
  unique(suburb, state)
);
```

One free Scout Report per email address globally (not per address). Second attempt with same email returns paywall prompt.

---

## Stripe

- **Test mode** — do not switch to live until Steven confirms
- **Price:** $149 AUD, one-time
- **Webhook:** `checkout.session.completed` → set `converted_to_paid: true` in scout_reports
- Keys already in Vercel env

---

## Resend

- **From:** hello@clearoffer.com.au (domain verified)
- **Emails to send:**
  1. Scout Report confirmation (after email gate)
  2. 24hr follow-up if no paid conversion — subject: "Still thinking about [address]? Here's what the Buyer's Brief would tell you."
- Keys already in Vercel env

---

## Env vars (all already in Vercel)

```
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SUPABASE_URL
SUPABASE_SERVICE_KEY
ZONEIQ_URL=https://zoneiq-sigma.vercel.app
RESEND_API_KEY
BASE_URL=https://clearoffer.com.au
ALLOWED_ORIGIN=https://clearoffer.com.au
GOOGLE_GEOCODING_API_KEY
DOMAIN_CLIENT_ID          # pending approval
DOMAIN_CLIENT_SECRET      # pending approval
PROPTECH_DATA_API_KEY     # pending confirmation of terms
```

---

## Local development

- Run locally with: `vercel dev --listen 3001`
- Do NOT set "dev" script in package.json to "vercel dev" — causes recursive invocation error
- Set `"installCommand": "npm install"` in vercel.json — prevents Vercel from trying to use yarn
- .env.local for local secrets — pull via `vercel env pull`
- When running locally: Resend sends real emails, Supabase writes real rows, Anthropic charges real credits. Use a test email address.

---

## What to build first (sequencing)

Build in this order. Do not skip ahead to PropTechData or Domain API integration — those are blocked on external approvals.

**Phase 1 — core flow with ZoneIQ and stubs (unblocked, build now):**
1. Landing page — address search with Google Places autocomplete, clean dark design
2. Stage 1 response — listing stubs + one-line Claude verdict
3. Email gate — captures to Supabase, enforces one-free-per-email
4. Scout Report — ZoneIQ overlays live, suburb stats from static lookup table (build Supabase cache later), AVM teaser, comparable sales teaser, locked paid sections
5. Buyer's Brief page — Stripe checkout, Claude generation with streaming, all sections structured (PropTechData stubbed until confirmed)
6. Stripe webhook — marks converted_to_paid
7. Resend emails — confirmation + 24hr follow-up
8. Smoke tests

**Phase 2 — wire real data (blocked on approvals):**
9. Domain API — active listing data + autocomplete (when approved)
10. PropTechData — AVM + comparables + suburb stats (when terms confirmed)
11. Supabase suburb stats cache — monthly population job

---

## Design direction

- Dark theme (near-black background, existing site had this right)
- Gold/amber accent for CTAs and highlights
- Clean, professional — feels like a $500 report, not a startup MVP
- Mobile-first — buyers search on phones
- Locked sections must be clearly labelled with what's inside them, not just blurred
- Price anchoring above every paid CTA: "A buyer's agent charges $8,000–$15,000. Your Buyer's Brief is $149."
- Social proof: "X Brisbane buyers got a Buyer's Brief this week." Hardcode, update manually. Add HTML comment `<!-- UPDATE WEEKLY -->`.

---

## Legal disclaimer (on every report page)

"This report is market research and analysis, not a formal property valuation. It is not suitable for lending, legal, or insurance purposes. ClearOffer is not a registered property valuer. Always obtain independent legal and financial advice before purchasing property."

---

## Key decisions (do not relitigate these)

- No subscription model — one-time per property
- $149 price point — not cheaper, this is an $800K decision
- One free report per email address, ever
- Agent vendor discount data — deferred out of v1
- PropTechData — paid report only, never free report
- Brisbane only at launch
- No 30-minute call upsell — product stands alone
- PDF delivery — v2. On-screen only for v1.
- coming-soon.html stays at clearoffer.com.au root until Steven is ready to launch. Use `vercel.json` redirect scoped to `/` only — do not use meta refresh on index.html.

---

## Open questions — do not build past these without Steven's input

1. **PropTechData:** VG licence restriction on sold data in paid reports? Pricing? Listed price alongside sold price? — Unblocks paid report data layer.
2. **Domain API approval:** Still pending. Unblocks live listing data and autocomplete. Build with stubs + Google Places fallback in the meantime.
3. **ZoneIQ overlay decoupling fix:** In progress in ZoneIQ chat. Build ClearOffer integration against the fixed API shape (overlays always returned, never blocked by zone rules gate). Do not build workarounds for the broken behaviour.

---

## About Steven

- Brisbane-based, 1–2 hours/day available
- Builds with Claude Code — all code produced collaboratively
- Overnight build system: `claude --dangerously-skip-permissions` in repo terminal
- Secrets in .env.local — no Doppler
- Budget flexible, will pay for ads, will not cold-call
- Other products in portfolio: ZoneIQ (spatial API, the overlay source), WhatCanIBuild (planning rules checker, already live), SubdivideIQ (in design)
- Full portfolio state: stevenpicton1979/portfoliostate — STATE.md is the authoritative cross-product reference

