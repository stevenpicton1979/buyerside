# ClearOffer — buyerside

AI-powered property intelligence for Brisbane home buyers.  
**Live:** clearoffer.com.au · **Repo:** stevenpicton1979/buyerside (main branch)

---

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Pull env vars from Vercel
vercel env pull

# 3. Start local dev server (always use port 3001)
vercel dev --listen 3001

# 4. In another terminal, run smoke tests
node scripts/smoke-test.js
```

> **Never** run `vercel dev` without `--listen 3001` — causes port conflicts.  
> **Never** add a `dev` script to package.json pointing to `vercel dev` — recursive invocation error.

---

## Env vars

All are already set in Vercel. Pull with `vercel env pull`.

| Variable | Purpose | Status |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` locally, `https://clearoffer.com.au` in prod | Set per environment |
| `ALLOWED_ORIGIN` | CORS origin — same as BASE_URL | Set per environment |
| `ANTHROPIC_API_KEY` | Claude API — verdict + Buyer's Brief | Live |
| `STRIPE_SECRET_KEY` | Test mode — do NOT switch to live until Steve confirms | Test mode |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | Set |
| `SUPABASE_URL` | Project dqzqqfcepsqhaxovneen | Set |
| `SUPABASE_SERVICE_KEY` | Service role key — raw REST fetch | Set |
| `ZONEIQ_URL` | `https://zoneiq-sigma.vercel.app` — always sigma URL, NOT zoneiq.com.au | Set |
| `RESEND_API_KEY` | hello@clearoffer.com.au verified | Set |
| `GOOGLE_GEOCODING_API_KEY` | Address autocomplete (until Domain API approved) | Set |
| `DOMAIN_CLIENT_ID` | Domain developer API — PENDING APPROVAL | Blank |
| `DOMAIN_CLIENT_SECRET` | Domain developer API — PENDING APPROVAL | Blank |
| `PROPTECH_DATA_API_KEY` | PropTechData / Nexu — PENDING TERMS CONFIRMATION | Blank |
| `CRON_SECRET` | Secret for `/api/send-followup` cron trigger | Set a random string |

**Switching environments = change `BASE_URL` + `ALLOWED_ORIGIN` only. No code changes.**

---

## Architecture constraints

These two rules shape everything. Do not violate them.

1. **PropTechData is NEVER called on the free report.** It is stubbed in `api/buyers-brief.js` until Steve confirms: (a) VG licence permits sold data in paid reports, (b) pricing acceptable. See `fetchPropTechData()` in that file.

2. **ZoneIQ is the primary overlay source.** Always call `zoneiq-sigma.vercel.app` (not `zoneiq.com.au`). Overlays normalised in `api/zone-lookup.js`.

---

## Product flow

```
/ (index.html)
  → address search + Google Places autocomplete
  → Stage 1: listing stats + one-line Claude verdict
  → email gate → POST /api/submit-email
    → one-free-per-email check → Supabase save → Resend confirmation

/report.html?address=...&email=...
  → free Scout Report
  → GET /api/zone-lookup  (ZoneIQ overlays)
  → GET /api/suburb-stats (Supabase cache → static fallback)
  → POST /api/verdict     (Claude Haiku ~$0.02)
  → qualifier questions (stored in sessionStorage)
  → POST /api/create-checkout → Stripe $149

/success.html?session_id=...&address=...
  → countdown → redirect to /buyers-brief.html

/buyers-brief.html?address=...&email=...
  → POST /api/buyers-brief (verifies payment, streams Claude response)
```

---

## Database (Supabase: dqzqqfcepsqhaxovneen)

Run `scripts/create-tables.sql` in Supabase SQL editor if tables don't exist.

| Table | Purpose |
|---|---|
| `scout_reports` | Email captures, `followup_sent`, `converted_to_paid` |
| `suburb_stats_cache` | Monthly suburb stats cache — populated from PropTechData when confirmed |

---

## Follow-up emails

`api/send-followup.js` — finds unconverted reports 23–25 hrs old, sends one email, marks `followup_sent`.

Invoke via cron:
```
GET /api/send-followup?secret=YOUR_CRON_SECRET
```

Set `CRON_SECRET` in env vars. Wire to Vercel Cron or external service.

---

## Renaming the product

All user-visible strings are in two files:
- `api/config.js` → `PRODUCT.NAME`, `PRODUCT.TAGLINE`
- `public/js/config.js` → `CLEAROFFER_CONFIG.PRODUCT.NAME`, `CLEAROFFER_CONFIG.COPY.*`

A rename is changing those two constants. Nothing else.

---

## Deployment

```bash
# DO NOT deploy until Steve says so.
# When ready:
git push origin main   # Vercel auto-deploys from main
```

Pre-deploy checklist:
- [ ] All smoke tests pass (`node scripts/smoke-test.js`)
- [ ] Stripe switched to live mode (Steve confirms)
- [ ] `BASE_URL` = `https://clearoffer.com.au` in Vercel production env
- [ ] `ALLOWED_ORIGIN` = `https://clearoffer.com.au`
- [ ] Stripe webhook URL updated to `https://clearoffer.com.au/api/stripe-webhook`
- [ ] `CRON_SECRET` set and follow-up cron wired
- [ ] `scripts/create-tables.sql` run in Supabase

---

## Known pending items

- [ ] Domain developer API approval — unblocks live listing data + autocomplete
- [ ] PropTechData terms confirmation — unblocks paid report real data
- [ ] Supabase suburb stats cache population — after PropTechData confirmed
- [ ] `coming-soon.html` → swap to `index.html` in `vercel.json` redirect when ready to launch

---

## Key gotchas

- ZoneIQ: always use `zoneiq-sigma.vercel.app`, never `zoneiq.com.au`
- Supabase: raw REST fetch (no @supabase/supabase-js), use `try/catch` not `.catch()`
- Stripe webhook: body parsing must be disabled — raw body for signature verification
- Buyers' Brief streaming: `maxDuration: 60` set in vercel.json — don't remove
- buyerside repo: always `main` branch, never `master`
- PropTechData: stubs in `api/buyers-brief.js` — wire real calls only after terms confirmed
