'use strict';
// ============================================================
// ClearOffer — Buyer's Brief generation
// ============================================================
// Called after confirmed Stripe payment.
// PropTechData is STUBBED until Steve confirms VG licence terms.
// All data slots are wired — swap stub for real call when ready.
// Claude synthesises everything into the final report.
// ============================================================

const { handleCors, PRODUCT, PRICING, getSuburbStats, supabaseFetch, BASE_URL } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { email, address, sessionId, qualifiers } = body || {};

  console.log('[buyers-brief] POST received — email:', email, '| address:', address, '| sessionId:', sessionId);

  if (!email || !address) {
    return res.status(400).json({ error: 'email and address required' });
  }

  // Verify payment
  try {
    const paid = await verifyPayment(email, address, sessionId);
    if (!paid) {
      return res.status(403).json({ error: 'Payment not found. Please complete checkout first.' });
    }
  } catch (err) {
    console.error('[buyers-brief] payment verification error:', err.message);
    return res.status(403).json({ error: 'Unable to verify payment.' });
  }

  // Gather all data in parallel
  const [zoneData, suburbStats, propTechData] = await Promise.all([
    fetchZoneIQ(address),
    fetchSuburbStats(address),
    fetchPropTechData(address),  // STUBBED until terms confirmed
  ]);

  // Build Claude prompt with all available data
  const prompt = buildBriefPrompt({
    address,
    qualifiers: qualifiers || {},
    zoneData,
    suburbStats,
    propTechData,
  });

  // Stream Claude response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await streamClaudeBrief(prompt);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[buyers-brief] Claude streaming error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Generation failed. Please contact support.' })}\n\n`);
    res.end();
  }
};

async function verifyPayment(email, address, sessionId) {
  // Step 1: check Supabase — webhook may have already fired
  // Use ilike for address to tolerate case differences across the URL chain
  try {
    const rows = await supabaseFetch(
      `/scout_reports?email=eq.${encodeURIComponent(email)}&address=ilike.${encodeURIComponent(address)}&select=converted_to_paid&limit=1`
    );
    console.log('[verifyPayment] Supabase rows:', JSON.stringify(rows));
    if (rows?.[0]?.converted_to_paid === true) {
      console.log('[verifyPayment] Supabase confirmed paid — returning true');
      return true;
    }
    console.log('[verifyPayment] Supabase: not paid or no row found');
  } catch (err) {
    console.log('[verifyPayment] Supabase check failed:', err.message);
    // fall through to Stripe direct check
  }

  // Step 2: if sessionId provided, verify directly with Stripe API
  console.log('[verifyPayment] sessionId:', sessionId, '| STRIPE_SECRET_KEY set:', !!process.env.STRIPE_SECRET_KEY);
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
    console.log('[verifyPayment] FAIL — missing sessionId or Stripe key');
    return false;
  }

  try {
    const stripeKey = Buffer.from(`${process.env.STRIPE_SECRET_KEY}:`).toString('base64');
    const stripeUrl = `https://api.stripe.com/v1/checkout/sessions/${sessionId}`;
    console.log('[verifyPayment] Calling Stripe:', stripeUrl);

    const resp = await fetch(stripeUrl, {
      headers: { 'Authorization': `Basic ${stripeKey}` },
      signal: AbortSignal.timeout(5000),
    });
    console.log('[verifyPayment] Stripe HTTP status:', resp.status);
    if (!resp.ok) {
      const errBody = await resp.text();
      console.log('[verifyPayment] Stripe error body:', errBody);
      return false;
    }

    const session = await resp.json();
    console.log('[verifyPayment] Stripe session — payment_status:', session.payment_status, '| customer_email:', session.customer_email, '| id:', session.id);

    if (session.payment_status !== 'paid') {
      console.log('[verifyPayment] FAIL — payment_status is not paid:', session.payment_status);
      return false;
    }
    if (session.customer_email && session.customer_email !== email) {
      console.log('[verifyPayment] FAIL — email mismatch. Session:', session.customer_email, 'Request:', email);
      return false;
    }

    // Step 3: backfill Supabase so future calls skip the Stripe lookup
    try {
      await supabaseFetch(
        `/scout_reports?email=eq.${encodeURIComponent(email)}&address=ilike.${encodeURIComponent(address)}`,
        { method: 'PATCH', body: JSON.stringify({ converted_to_paid: true }) }
      );
      console.log('[verifyPayment] Supabase backfill complete');
    } catch (err) {
      // Non-fatal — payment is confirmed, log and continue
      console.warn('[verifyPayment] Supabase backfill failed:', err.message);
    }

    console.log('[verifyPayment] Stripe confirmed paid — returning true');
    return true;
  } catch (err) {
    console.warn('[verifyPayment] Stripe direct verify error:', err.message);
    return false;
  }
}

async function fetchZoneIQ(address) {
  try {
    const url = `${process.env.ZONEIQ_URL || 'https://zoneiq-sigma.vercel.app'}/api/lookup?address=${encodeURIComponent(address)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`ZoneIQ ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn('[buyers-brief] ZoneIQ error:', err.message);
    return null;
  }
}

async function fetchSuburbStats(address) {
  const stats = getSuburbStats(address);
  return stats || null;
}

// ============================================================
// PropTechData — STUBBED
// ============================================================
// TODO: Wire real PropTechData call when Steve confirms:
//   1. VG licence permits sold transactions in paid reports
//   2. Pricing acceptable
//   3. Listed price alongside sold price available
// API docs: api.nexu.com.au
// Endpoints needed:
//   POST /properties/avm          → full AVM + confidence score
//   GET  /market-activity/sales   → comparable sales
//   GET  /suburbs/statistics      → suburb stats
//   GET  /suburbs/timeseries      → 10yr timeseries
// ============================================================
async function fetchPropTechData(address) {
  if (!process.env.PROPTECH_DATA_API_KEY) {
    console.log('[buyers-brief] PropTechData API key not set — using stubs');
    return getPropTechStub(address);
  }
  // TODO: implement real PropTechData calls
  // For now, return stub even if key present (safety until terms confirmed)
  console.log('[buyers-brief] PropTechData key present but real calls not yet implemented');
  return getPropTechStub(address);
}

function getPropTechStub(address) {
  const stats = getSuburbStats(address);
  const median = stats?.median || 1000000;

  return {
    _stub: true,
    avm: {
      estimate: Math.round(median * 0.97),
      low: Math.round(median * 0.90),
      high: Math.round(median * 1.05),
      confidence: 0.72,
      method: 'comparable_sales',
    },
    comparables: [
      { address: 'Comparable A (withheld)', soldPrice: Math.round(median * 0.95), soldDate: '2025-12-15', beds: 3, baths: 1, landSqm: 480 },
      { address: 'Comparable B (withheld)', soldPrice: Math.round(median * 0.98), soldDate: '2025-11-28', beds: 3, baths: 2, landSqm: 510 },
      { address: 'Comparable C (withheld)', soldPrice: Math.round(median * 1.01), soldDate: '2025-11-10', beds: 4, baths: 2, landSqm: 650 },
    ],
    suburbTimeseries: {
      years: [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
      medians: [
        Math.round(median*0.62), Math.round(median*0.66), Math.round(median*0.70),
        Math.round(median*0.73), Math.round(median*0.77), Math.round(median*0.84),
        Math.round(median*0.91), Math.round(median*0.95), Math.round(median*0.98),
        median
      ],
    },
  };
}

function buildBriefPrompt({ address, qualifiers, zoneData, suburbStats, propTechData }) {
  const { renovationStatus = 'unknown', roadType = 'unknown' } = qualifiers;
  const avm = propTechData?.avm;
  const comparables = propTechData?.comparables || [];
  const isStub = propTechData?._stub;

  const f = (n) => n ? `$${Number(n).toLocaleString('en-AU')}` : 'unknown';

  const suburbContext = suburbStats
    ? `Suburb: ${suburbStats.suburb}. Median: ${f(suburbStats.median)}. Avg DOM: ${suburbStats.dom} days. 12-month growth: ${(suburbStats.growth12m*100).toFixed(1)}%. 10yr CAGR: ${(suburbStats.cagr10yr*100).toFixed(1)}%.`
    : 'Suburb stats not available.';

  const avmContext = avm
    ? `AVM estimate: ${f(avm.estimate)} (range: ${f(avm.low)}–${f(avm.high)}, confidence: ${Math.round(avm.confidence*100)}%).${isStub ? ' [NOTE: AVM is stubbed — replace with real PropTechData call]' : ''}`
    : 'AVM not available.';

  const overlays = zoneData?.overlays || {};
  const floodText = overlays.flood?.affected
    ? `FLOOD RISK: ${overlays.flood.plain}`
    : 'No flood overlay.';
  const bushfireText = overlays.bushfire?.affected
    ? `BUSHFIRE: ${overlays.bushfire.plain}`
    : 'No bushfire overlay.';
  const heritageText = overlays.heritage?.listed
    ? `HERITAGE: ${overlays.heritage.plain}`
    : 'Not heritage listed.';
  const noiseText = overlays.noise?.affected
    ? `AIRCRAFT NOISE: ${overlays.noise.plain}`
    : 'No aircraft noise overlay.';
  const charText = overlays.character?.applicable
    ? `CHARACTER OVERLAY: ${overlays.character.plain}`
    : 'No character overlay.';

  const primarySchool = overlays.schools?.primary;
  const schoolText = primarySchool
    ? `Primary school: ${primarySchool.name} (ICSEA ${primarySchool.icsea} — ${primarySchool.plain}).`
    : 'School catchment data not available.';

  const compText = comparables.length > 0
    ? comparables.map((c, i) =>
        `${i+1}. ${c.address} — sold ${f(c.soldPrice)} on ${c.soldDate} (${c.beds}bd/${c.baths}ba, ${c.landSqm}m²)`
      ).join('\n')
    : 'No comparable sales available.';

  const qualifierText = renovationStatus !== 'unknown' || roadType !== 'unknown'
    ? `Buyer notes: property condition = ${renovationStatus}; road type = ${roadType}.`
    : '';

  return `You are an expert buyer's agent in Brisbane writing a Buyer's Brief for a property purchaser. This is a paid $149 report. Do not include any report header, reference number, preparer name, or date. Start directly with the first section heading.

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

COMPARABLE SALES:
${compText}

Write a complete Buyer's Brief in plain English. Structure it with these sections. Use the actual data provided — be specific with dollar figures, dates, and percentages. Do not hedge or waffle.

## Valuation Assessment
Based on the AVM and comparable sales, what is this property worth? Give a specific recommended price range. Explain the key drivers.

## What Comparable Sales Tell Us
Analyse the comparable sales. What's the range? Are they above or below asking? What should the buyer read into them? Adjust for condition (${renovationStatus}) vs comparables.

## Risk Flags
Cover each overlay present. What does the flood / bushfire / heritage / noise overlay mean practically for a buyer? What questions should they ask at settlement?

## Market Context
What's happening in this suburb? Is it a buyer's or seller's market right now? What does the 12-month growth and DOM tell us?

## The Negotiation
Based on DOM vs suburb average, comparable gap vs asking price, and active supply: what is the buyer's leverage? Give specific language the buyer can use.

## Your Opening Offer
State a specific dollar figure recommendation for the opening offer and the walk-away price. Show the reasoning clearly.

## What the Agent Won't Tell You
2–3 things this buyer should know that the listing agent won't volunteer.

## 5–10 Year Outlook
Based on suburb trajectory, infrastructure, and Olympics/CRR catalyst: what does this suburb look like in 2030–2035?

Tone: confident, specific, like a sharp buyers agent who's done hundreds of deals in Brisbane. No disclaimers in the body of the report — the legal disclaimer appears separately.`;
}

async function* streamClaudeBrief(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic ${response.status}: ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          yield parsed.delta.text;
        }
      } catch { /* ignore parse errors */ }
    }
  }
}
