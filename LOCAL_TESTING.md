# ClearOffer — Local Testing Guide

## Prerequisites

| Tool | Status | Notes |
|---|---|---|
| Node.js | Required | `node --version` to confirm |
| Vercel CLI | ✓ Installed (v50+) | Used to run the dev server |
| Doppler CLI | ✓ Installed (v3.75) | Not yet authenticated for this project — local dev uses `.env.local` instead |
| Stripe CLI | ✗ Not installed | Only needed to test webhook events locally (Stripe → mark-converted). Not required for the main flow. |

---

## Starting the local server

```bash
cd C:/dev/buyerside
npm run dev
```

This runs `vercel dev` — the Vercel local development server. It serves `public/` as static files and handles `api/` as serverless functions, exactly mirroring production.

**URL:** `http://localhost:3000`

**Note:** The live site at clearoffer.com.au shows `coming-soon.html` via Vercel routing. Locally, `http://localhost:3000` serves `index.html` (the full app) — this is correct for testing.

### First run
`vercel dev` will prompt to link the project if it hasn't been done in this session. Answer:
- Set up and deploy? → **N** (already deployed)
- Link to existing project? → **Y**, select `stevenpicton1979s-projects/buyerside`

### Env vars
All secrets are in `.env.local` (pulled from Vercel Development env). `vercel dev` reads this file automatically — no Doppler needed for local dev.

When Doppler is set up for this project (run `doppler login` then `doppler setup`), the preferred command becomes:
```bash
doppler run -- npm run dev
```

---

## What's in .env.local

All required vars are present:

| Variable | Local value | Notes |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Stripe success/cancel URLs use this |
| `ALLOWED_ORIGIN` | `*` | CORS — open for local dev |
| `NODE_ENV` | `development` | |
| `STRIPE_SECRET_KEY` | `sk_test_…` | Test mode — safe to use |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Only needed for webhook endpoint |
| `SUPABASE_URL` | `https://dqzqqfcepsqhaxovneen.supabase.co` | Live ClearOffer project |
| `SUPABASE_SERVICE_KEY` | `sb_secret_…` | Write access |
| `RESEND_API_KEY` | `re_…` | Live — emails will actually send |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | Live — brief generation costs real API credits |
| `ZONEIQ_URL` | `https://zoneiq-sigma.vercel.app` | Live ZoneIQ |
| `DOMAIN_CLIENT_ID` | set | Sandbox credentials |
| `DOMAIN_CLIENT_SECRET` | set | Sandbox credentials |

**Live services warning:** Supabase, Resend, and Anthropic are all live. Email gate submissions will write to the real `scout_reports` table and send real confirmation emails. Use a personal test email address.

---

## Full flow test checklist

### 1. Landing page
- Browse to `http://localhost:3000`
- Expected: ClearOffer landing page loads (not coming-soon)
- Check: address autocomplete input is visible in the hero

### 2. Address autocomplete
- Type `42 Kent` in the address search box
- Expected: dropdown appears with Brisbane QLD suggestions within ~1 second
- Source: Nominatim (OpenStreetMap) — no API key required
- If empty results: check browser console for network errors to `nominatim.openstreetmap.org`

### 3. Select an address → Scout Report
- Select any result (e.g. Kent Street, New Farm)
- Expected: browser navigates to `/scout-report.html?address=…&lat=…&lng=…`
- Expected: address displayed in hero, page loads within 1–2 seconds
- At this point: overlay data section says "Flood overlay data loading…" / "Bushfire overlay loading…"

### 4. Email gate
- Enter a test email address in the gate form and click "Unlock Report →"
- Expected: `POST /api/submit-email` fires
- Expected (if email not seen before): report data populates — flood/bushfire overlays, suburb stats, demand meters
- Expected (if email already in scout_reports): page shows "You've already received a free Scout Report. Upgrade to Buyer's Brief for full analysis."
- Check Supabase dashboard to confirm row was written: https://supabase.com/dashboard/project/dqzqqfcepsqhaxovneen/editor
- Check inbox — a confirmation email should arrive from hello@clearoffer.com.au

### 5. ZoneIQ overlays
After email gate unlocks:
- **Section 04 — Flood & Risk Overlay:** should show flood result (green "No flood overlay" or amber/red if overlayed) AND a bushfire row below it
- **Sidebar — Risk Summary:** flood badge and bushfire badge should both be dynamic (not hardcoded)
- Inner-city/riverside suburbs (e.g. New Farm, West End) typically show flood overlays
- Outer suburbs (e.g. Carindale, Mansfield) typically show no flood overlay

### 6. Suburb stats
- After email gate: Section 03 suburb snapshot should populate from static lookup table
- 100 suburbs covered — most inner/middle Brisbane suburbs will have data
- If suburb not in table: all stats show `—`

### 7. Stripe checkout (test mode)
- After email gate unlock, click "Get the Buyer's Brief →" (upgrade strip or sidebar button)
- Expected: page navigates to Stripe Checkout (hosted payment page)
- Use **Stripe test card:** `4242 4242 4242 4242` / Exp: `12/34` / CVC: `123` / Postcode: `4000`
- Expected: Stripe processes payment and redirects to `http://localhost:3000/buyers-brief.html?session_id=…`
- Check Stripe Dashboard → test mode payments to confirm session created: https://dashboard.stripe.com/test/payments

### 8. Buyer's Brief page
- After Stripe redirect: `buyers-brief.html` loads with session_id in URL
- The brief generation (`/api/generate-brief`) is called with the property data
- **Note:** `generate-brief.js` currently generates a 3-sentence stub, not the full brief — Sprint 6 rewrites this prompt
- Expected: brief text appears on screen (may take 5–10 seconds — live Anthropic API call)

---

## What doesn't work locally (and why)

| Feature | Status | Why |
|---|---|---|
| Stripe webhook (`/api/stripe-webhook`) | Needs Stripe CLI | Webhook is POSTed by Stripe's servers — won't reach localhost without forwarding. See below. |
| `converted_to_paid` flag set after payment | Blocked by above | `stripe-webhook.js` fires `mark-converted.js` — only runs when webhook reaches local server |
| 24hr follow-up email | Not built yet | Sprint 7 |
| Domain API listing data | Returns null in sandbox | Domain sandbox returns synthetic/empty data for most real addresses. Stubs display correctly. |

### Testing the Stripe webhook locally (optional)
Install Stripe CLI from https://stripe.com/docs/stripe-cli, then in a second terminal:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
```
This gives you a local webhook secret — update `STRIPE_WEBHOOK_SECRET` in `.env.local` with the value Stripe CLI prints (starts with `whsec_`). Do not commit it.

---

## Manual action still required

**Run the Supabase migration before Sprint 7:**

The `scout_reports` table is missing `followup_sent` and `converted_to_paid` columns. The follow-up email sprint (Sprint 7) needs these. Run the SQL now:

1. Open https://supabase.com/dashboard/project/dqzqqfcepsqhaxovneen/editor
2. Paste and run the contents of `scripts/create-scout-reports.sql`
3. Confirm both columns appear in the table schema
4. Update the external gates table in BACKLOG.md when done

---

## Refreshing .env.local

If Vercel env vars change (e.g. new secret added):
```bash
vercel env pull .env.local
```
Then re-apply the local overrides:
```bash
# Fix the three vars that vercel env pull sets to production values:
sed -i 's|BASE_URL=.*|BASE_URL="http://localhost:3000"|' .env.local
sed -i 's|ALLOWED_ORIGIN=.*|ALLOWED_ORIGIN="*"|' .env.local
sed -i 's|NODE_ENV=.*|NODE_ENV="development"|' .env.local
```
