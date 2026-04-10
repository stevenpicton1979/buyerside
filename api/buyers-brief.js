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
const { getDevFixture } = require('./dev-comparables-fixture');

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

  // Research pass — web search for suburb median and recent news
  const research = await runResearchPass(address, suburbStats);

  // Build Claude prompt with all available data
  const prompt = buildBriefPrompt({
    address,
    qualifiers: qualifiers || {},
    zoneData,
    suburbStats,
    propTechData,
    research,
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
    const fixture = getDevFixture(address);
    if (fixture) {
      console.log('[buyers-brief] PropTechData not set — using dev fixture for', address);
      return fixture;
    }
    console.log('[buyers-brief] PropTechData not set — no fixture for this suburb, returning null');
    return getPropTechStub();
  }
  // TODO: implement real PropTechData calls (Sprint 10)
  console.log('[buyers-brief] PropTechData key present but real calls not yet implemented');
  return getPropTechStub();
}

function getPropTechStub() {
  return {
    _stub: true,
    avm: null,
    comparables: null,
    suburbTimeseries: null,
  };
}

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

  const primarySchool = overlays.schools?.primary;
  const secondarySchool = overlays.schools?.secondary;
  const schoolLines = [];
  if (primarySchool) schoolLines.push(`Primary: ${primarySchool.name}${primarySchool.icsea ? ` (ICSEA ${primarySchool.icsea})` : ''}`);
  if (secondarySchool) schoolLines.push(`Secondary: ${secondarySchool.name}${secondarySchool.icsea ? ` (ICSEA ${secondarySchool.icsea})` : ''}`);
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

async function* streamClaudeBrief(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
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
