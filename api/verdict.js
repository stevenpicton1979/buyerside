'use strict';
// ============================================================
// ClearOffer — One-line AI verdict
// ============================================================
// Called at Stage 1 (before email gate). ~$0.02 per call.
// Returns a single sentence that creates an itch for the report.
// ============================================================

const { handleCors, getSuburbStats } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { address, listingPrice, daysOnMarket, floodCode } = body || {};

  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const verdict = await generateVerdict({ address, listingPrice, daysOnMarket, floodCode });
    return res.status(200).json({ verdict });
  } catch (err) {
    console.error('[verdict] error:', err.message);
    // Never fail the page — return a safe fallback verdict
    return res.status(200).json({
      verdict: listingPrice
        ? `Listed at ${formatPrice(listingPrice)} — get the full picture before you offer.`
        : 'Get the full picture on this property before you make an offer.',
      _fallback: true,
    });
  }
};

async function generateVerdict({ address, listingPrice, daysOnMarket, floodCode }) {
  const suburbStats = getSuburbStats(address);
  const suburb = suburbStats?.suburb || extractSuburb(address);
  const suburbMedian = suburbStats?.median;
  const suburbDom = suburbStats?.dom;

  // Build context string for Claude
  const contextParts = [];

  if (listingPrice) {
    contextParts.push(`Listed at ${formatPrice(listingPrice)}`);
    if (suburbMedian) {
      const pct = ((listingPrice - suburbMedian) / suburbMedian * 100).toFixed(0);
      const rel = listingPrice > suburbMedian ? `${pct}% above` : `${Math.abs(pct)}% below`;
      contextParts.push(`suburb median is ${formatPrice(suburbMedian)} (this listing is ${rel} median)`);
    }
  }

  if (daysOnMarket !== undefined && daysOnMarket !== null) {
    contextParts.push(`${daysOnMarket} days on market`);
    if (suburbDom) {
      contextParts.push(`suburb average is ${suburbDom} days`);
    }
  }

  if (floodCode && floodCode !== 'none' && !floodCode.includes('R5')) {
    contextParts.push(`flood overlay present (${floodCode})`);
  }

  if (suburb) contextParts.push(`suburb: ${suburb}, Brisbane`);

  const context = contextParts.length > 0
    ? contextParts.join('; ')
    : `Address: ${address}, Brisbane QLD`;

  const prompt = `You are a sharp, experienced buyer's agent in Brisbane. Write ONE sentence of market intelligence about this property listing. Be specific, confident, and slightly provocative. Create an itch — make the buyer want to know more. Never be neutral or vague. Use the data provided.

Property data: ${context}

Rules:
- Exactly one sentence, maximum 25 words
- Use specific numbers from the data
- If DOM is well above suburb average: focus on that leverage
- If price is well above median: note the gap
- If flood overlay: mention it as a risk flag
- Never say "fairly valued", "appears to be", or anything that sounds like a disclaimer
- Sound like a smart friend texting you, not a report
- CRITICAL: Never write "I don't have access to...", "Based on available data...", "As an AI...", or any meta-commentary. If data is limited, make your best assessment from what you have. The sentence must name a price or draw a conclusion.

One sentence only:`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim() || '';
  if (!text) throw new Error('Empty response from Claude');
  return text;
}

function formatPrice(price) {
  if (!price) return '';
  const n = Number(price);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  return `$${(n / 1000).toFixed(0)}K`;
}

function extractSuburb(address) {
  if (!address) return null;
  const match = address.match(/,\s*([^,]+?)\s*(QLD|NSW|VIC)?\s*\d{4}/i);
  return match?.[1]?.trim() || null;
}
