# BuyerSide — Backend

Vercel serverless functions for BuyerSide. No framework, no build step. Deploy in ~10 minutes.

---

## Architecture

```
Client (HTML pages)
    │
    ├── GET  /api/property-lookup?action=suggest&q=... → Domain API (autocomplete)
    ├── GET  /api/property-lookup?action=listing&id=... → Domain API (Stage 1 data)
    ├── POST /api/submit-email                          → Supabase + PropTechData (Stage 2)
    ├── POST /api/generate-brief                        → Claude API (streaming)
    ├── POST /api/create-checkout                       → Stripe Checkout
    ├── POST /api/stripe-webhook                        → Stripe → Supabase + Resend
    └── POST /api/verify-access                         → Supabase (token check)
```

---

## Setup (first time)

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) → New project → Name it `buyerside`
2. Dashboard → SQL Editor → paste contents of `supabase-schema.sql` → Run
3. Settings → API → copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY` (not the anon key)

### 2. Stripe

1. [dashboard.stripe.com](https://dashboard.stripe.com) → Create account
2. Get your secret key from Developers → API keys → `STRIPE_SECRET_KEY`
3. Set up webhook:
   - Developers → Webhooks → Add endpoint
   - URL: `https://buyerside.com.au/api/stripe-webhook`
   - Events: `checkout.session.completed`, `payment_intent.payment_failed`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 3. Resend (email)

1. [resend.com](https://resend.com) → New account
2. Add and verify domain: `buyerside.com.au`
3. API Keys → Create key → `RESEND_API_KEY`

### 4. Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# From this directory
vercel

# Follow prompts — link to your Vercel account
# When asked about settings: defaults are fine (no build step)
```

Add environment variables in Vercel Dashboard → Project → Settings → Environment Variables.
Copy everything from `.env.example` and fill in real values.

Or via CLI:
```bash
vercel env add ANTHROPIC_API_KEY
vercel env add STRIPE_SECRET_KEY
# ... etc
```

### 5. Domain API

1. Go to [developer.domain.com.au](https://developer.domain.com.au)
2. Create account → New project → Innovation (free) tier
3. Copy API key → `DOMAIN_API_KEY`

---

## Local development

```bash
# Install Vercel CLI
npm i -g vercel

# Copy env file
cp .env.example .env.local
# Fill in real values (use Stripe test keys)

# Run local dev server
vercel dev

# API available at http://localhost:3000/api/...
```

**Testing the Claude API locally:**
```bash
curl -X POST http://localhost:3000/api/generate-brief \
  -H "Content-Type: application/json" \
  -d '{
    "propertyData": {
      "address": "14 Riverview Tce, Chelmer QLD 4068",
      "listingPrice": 1750000,
      "daysOnMarket": 23,
      "floodRisk": "Q100 mapped"
    },
    "reportType": "analysis"
  }'
```

**Testing Stripe webhooks locally:**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe-webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

---

## API Reference

### `POST /api/generate-brief`

Streams Claude AI analysis for a property.

**Body:**
```json
{
  "propertyData": {
    "address": "14 Riverview Tce, Chelmer QLD 4068",
    "listingPrice": 1750000,
    "beds": 4,
    "baths": 2,
    "land": 607,
    "daysOnMarket": 23,
    "suburbAvgDOM": 16,
    "estimateRange": { "low": 1620000, "high": 1740000, "mid": 1680000 },
    "floodRisk": "Q100 mapped, confirmed 2022 inundation",
    "suburbMedian": 1610000,
    "suburbGrowth12m": 9.2,
    "vendorDiscount": -2.8,
    "agent": "Marcus Webb, Ray White Indooroopilly"
  },
  "reportType": "analysis"
}
```

`reportType` options: `analysis` | `offer` | `flood` | `outlook`

**Response:** Server-sent events stream (Claude API format)

---

### `POST /api/submit-email`

Captures email, stores in Supabase, returns Stage 2 data.

**Body:**
```json
{ "email": "buyer@email.com", "propertyId": "prop-chelmer-001", "address": "14 Riverview Tce, Chelmer" }
```

**Response:**
```json
{
  "success": true,
  "isReturning": false,
  "data": { /* PropTechData shape */ }
}
```

---

### `POST /api/create-checkout`

Creates Stripe Checkout session for $149 AUD.

**Body:**
```json
{ "email": "buyer@email.com", "propertyId": "prop-chelmer-001", "address": "14 Riverview Tce, Chelmer" }
```

**Response:**
```json
{ "url": "https://checkout.stripe.com/...", "sessionId": "cs_..." }
```

---

### `POST /api/verify-access`

Verifies a paid report access token.

**Body:**
```json
{ "token": "abc123...", "propertyId": "prop-chelmer-001" }
```

**Response:**
```json
{ "valid": true, "email": "buyer@email.com", "address": "...", "expiresAt": "..." }
```

---

### `GET /api/property-lookup`

Domain API proxy.

```
?action=suggest&q=14+riverview     → address autocomplete
?action=listing&id=prop-chelmer-001 → Stage 1 listing data
```

---

## Deployment checklist

- [ ] Supabase project created, schema applied
- [ ] All env vars set in Vercel dashboard
- [ ] Stripe webhook endpoint configured and verified
- [ ] Resend domain verified
- [ ] Domain API key active
- [ ] `vercel --prod` deployed
- [ ] Test full flow: address → email gate → Stage 2 data → Stripe → Brief access

---

## Cost monitoring

| Service | Free tier | Paid trigger |
|---|---|---|
| Vercel | 100GB bandwidth, unlimited functions | Rarely needed for v1 |
| Supabase | 500MB DB, 2GB bandwidth | $25/mo if exceeded |
| Resend | 3,000 emails/month | $20/mo for 50k |
| Stripe | No monthly fee | 1.7% + $0.30/transaction |
| Claude API | Pay per token | ~$0.05–0.15/brief |
| Domain API | Free Innovation tier | Free to start |
