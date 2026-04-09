// ============================================================
// ClearOffer — Server-side config
// ============================================================
// All product name strings, URLs, and feature flags live here.
// A product rename is a change to PRODUCT_NAME + TAGLINE only.
// ============================================================

'use strict';

// --- Product identity (rename here, nowhere else) ---
const PRODUCT = {
  NAME: 'ClearOffer',
  TAGLINE: 'Know what to offer before you ask.',
  FROM_EMAIL: 'hello@clearoffer.com.au',
  FROM_NAME: 'ClearOffer',
  SUPPORT_EMAIL: 'hello@clearoffer.com.au',
  DOMAIN: 'clearoffer.com.au',
};

// --- Pricing ---
const PRICING = {
  BUYERS_BRIEF_AUD: 149,
  BUYERS_BRIEF_LABEL: 'Buyer\'s Brief',
  // Price anchor shown above every CTA
  AGENT_FEE_RANGE: '$8,000–$15,000',
};

// --- Legal disclaimer — derived from PRODUCT.NAME so rename stays in sync ---
const DISCLAIMER =
  `This report is market research and analysis, not a formal property valuation. ` +
  `It is not suitable for lending, legal, or insurance purposes. ` +
  `${PRODUCT.NAME} is not a registered property valuer. ` +
  `Always obtain independent legal and financial advice before purchasing property.`;

// --- Environment-resolved URLs ---
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const ZONEIQ_URL = process.env.ZONEIQ_URL || 'https://zoneiq-sigma.vercel.app';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// --- Feature flags ---
const FEATURES = {
  // Set true when Domain API is approved
  DOMAIN_API_LIVE: !!(process.env.DOMAIN_CLIENT_ID && process.env.DOMAIN_CLIENT_SECRET),
  // Set true when PropTechData terms confirmed
  PROPTECH_LIVE: !!process.env.PROPTECH_DATA_API_KEY,
  // Free report uses Google Places for autocomplete until Domain approved
  GOOGLE_PLACES_AUTOCOMPLETE: !!process.env.GOOGLE_GEOCODING_API_KEY,
};

// --- ZoneIQ ---
const ZONEIQ = {
  URL: ZONEIQ_URL,
  TIMEOUT_MS: 8000,
  // Always read spec before wiring new fields: /api/openapi
  OPENAPI_SPEC: `${ZONEIQ_URL}/api/openapi`,
};

// --- Supabase raw REST helper ---
// Uses raw fetch, not @supabase/supabase-js, per brief
function supabaseHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation',
  };
}

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status} on ${path}: ${body}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// --- CORS helper ---
function corsHeaders(origin) {
  const allowed = process.env.ALLOWED_ORIGIN || BASE_URL;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function handleCors(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// --- Suburb stats (static lookup — cache table populated later) ---
// 100 Brisbane suburbs: median_house, median_dom, growth_12m, cagr_10yr, clearance_rate
const SUBURB_STATS = {
  'Ascot':         { median: 2050000, dom: 28, growth12m: 0.08, cagr10yr: 0.072, clearance: 0.71 },
  'Bulimba':       { median: 1620000, dom: 24, growth12m: 0.09, cagr10yr: 0.068, clearance: 0.73 },
  'Camp Hill':     { median: 1250000, dom: 22, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Chelmer':       { median: 1480000, dom: 31, growth12m: 0.07, cagr10yr: 0.065, clearance: 0.69 },
  'Clayfield':     { median: 1780000, dom: 26, growth12m: 0.09, cagr10yr: 0.071, clearance: 0.72 },
  'Coorparoo':     { median: 1150000, dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'East Brisbane': { median: 1050000, dom: 19, growth12m: 0.13, cagr10yr: 0.079, clearance: 0.78 },
  'Ekibin':        { median: 1080000, dom: 21, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.75 },
  'Fig Tree Pocket':{ median: 1620000, dom: 35, growth12m: 0.07, cagr10yr: 0.063, clearance: 0.67 },
  'Graceville':    { median: 1320000, dom: 25, growth12m: 0.10, cagr10yr: 0.069, clearance: 0.72 },
  'Hamilton':      { median: 1950000, dom: 29, growth12m: 0.08, cagr10yr: 0.070, clearance: 0.70 },
  'Hawthorne':     { median: 1580000, dom: 22, growth12m: 0.10, cagr10yr: 0.071, clearance: 0.74 },
  'Highgate Hill': { median: 1180000, dom: 21, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Holland Park':  { median: 980000,  dom: 19, growth12m: 0.13, cagr10yr: 0.078, clearance: 0.77 },
  'Indooroopilly': { median: 1380000, dom: 27, growth12m: 0.09, cagr10yr: 0.068, clearance: 0.71 },
  'Kangaroo Point':{ median: 1120000, dom: 23, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Kenmore':       { median: 1150000, dom: 30, growth12m: 0.08, cagr10yr: 0.065, clearance: 0.68 },
  'Morningside':   { median: 1080000, dom: 20, growth12m: 0.13, cagr10yr: 0.078, clearance: 0.77 },
  'New Farm':      { median: 1750000, dom: 24, growth12m: 0.09, cagr10yr: 0.072, clearance: 0.73 },
  'Newmarket':     { median: 1280000, dom: 22, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Norman Park':   { median: 1180000, dom: 21, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Paddington':    { median: 1420000, dom: 23, growth12m: 0.10, cagr10yr: 0.073, clearance: 0.74 },
  'Red Hill':      { median: 1320000, dom: 22, growth12m: 0.11, cagr10yr: 0.075, clearance: 0.75 },
  'St Lucia':      { median: 1580000, dom: 28, growth12m: 0.08, cagr10yr: 0.069, clearance: 0.70 },
  'Taringa':       { median: 1180000, dom: 25, growth12m: 0.10, cagr10yr: 0.071, clearance: 0.73 },
  'Teneriffe':     { median: 1920000, dom: 26, growth12m: 0.09, cagr10yr: 0.073, clearance: 0.72 },
  'Toowong':       { median: 1250000, dom: 24, growth12m: 0.10, cagr10yr: 0.072, clearance: 0.73 },
  'West End':      { median: 1150000, dom: 20, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Wilston':       { median: 1380000, dom: 23, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Windsor':       { median: 1120000, dom: 21, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.75 },
  // Additional suburbs
  'Albion':        { median: 1050000, dom: 22, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Alderley':      { median: 1180000, dom: 23, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.73 },
  'Annerley':      { median: 920000,  dom: 19, growth12m: 0.13, cagr10yr: 0.079, clearance: 0.77 },
  'Ashgrove':      { median: 1350000, dom: 25, growth12m: 0.10, cagr10yr: 0.071, clearance: 0.72 },
  'Aspley':        { median: 880000,  dom: 18, growth12m: 0.13, cagr10yr: 0.080, clearance: 0.78 },
  'Balmoral':      { median: 1650000, dom: 27, growth12m: 0.08, cagr10yr: 0.068, clearance: 0.70 },
  'Bardon':        { median: 1280000, dom: 24, growth12m: 0.10, cagr10yr: 0.072, clearance: 0.73 },
  'Bowen Hills':   { median: 850000,  dom: 22, growth12m: 0.11, cagr10yr: 0.070, clearance: 0.72 },
  'Brisbane City': { median: 820000,  dom: 20, growth12m: 0.11, cagr10yr: 0.071, clearance: 0.73 },
  'Bulwer':        { median: 780000,  dom: 30, growth12m: 0.07, cagr10yr: 0.061, clearance: 0.65 },
  'Carindale':     { median: 980000,  dom: 22, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.74 },
  'Carseldine':    { median: 860000,  dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Chapel Hill':   { median: 1150000, dom: 27, growth12m: 0.09, cagr10yr: 0.068, clearance: 0.70 },
  'Chermside':     { median: 820000,  dom: 19, growth12m: 0.13, cagr10yr: 0.079, clearance: 0.77 },
  'Clayfield':     { median: 1780000, dom: 26, growth12m: 0.09, cagr10yr: 0.071, clearance: 0.72 },
  'Corinda':       { median: 1050000, dom: 24, growth12m: 0.10, cagr10yr: 0.070, clearance: 0.72 },
  'Darra':         { median: 680000,  dom: 17, growth12m: 0.14, cagr10yr: 0.082, clearance: 0.79 },
  'Deagon':        { median: 750000,  dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Doolandella':   { median: 720000,  dom: 18, growth12m: 0.13, cagr10yr: 0.079, clearance: 0.77 },
  'Drewvale':      { median: 780000,  dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Durack':        { median: 680000,  dom: 18, growth12m: 0.13, cagr10yr: 0.079, clearance: 0.77 },
  'Eight Mile Plains':{ median: 880000, dom: 19, growth12m: 0.13, cagr10yr: 0.078, clearance: 0.77 },
  'Everton Park':  { median: 920000,  dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Ferny Grove':   { median: 820000,  dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Forest Lake':   { median: 720000,  dom: 18, growth12m: 0.13, cagr10yr: 0.080, clearance: 0.78 },
  'Fortitude Valley':{ median: 780000, dom: 21, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.73 },
  'Gaythorne':     { median: 1020000, dom: 22, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.74 },
  'Gordon Park':   { median: 1080000, dom: 22, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Grange':        { median: 1250000, dom: 24, growth12m: 0.10, cagr10yr: 0.072, clearance: 0.73 },
  'Greenslopes':   { median: 980000,  dom: 20, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Hendra':        { median: 1420000, dom: 26, growth12m: 0.09, cagr10yr: 0.070, clearance: 0.71 },
  'Herston':       { median: 980000,  dom: 22, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.74 },
  'Holland Park West':{ median: 950000, dom: 20, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Inala':         { median: 580000,  dom: 16, growth12m: 0.15, cagr10yr: 0.085, clearance: 0.80 },
  'Kedron':        { median: 1050000, dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Kelvin Grove':  { median: 980000,  dom: 21, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Keperra':       { median: 820000,  dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Lota':          { median: 980000,  dom: 23, growth12m: 0.11, cagr10yr: 0.072, clearance: 0.73 },
  'MacGregor':     { median: 920000,  dom: 20, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Mansfield':     { median: 950000,  dom: 21, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Mitchelton':    { median: 1020000, dom: 22, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Moorooka':      { median: 880000,  dom: 19, growth12m: 0.13, cagr10yr: 0.078, clearance: 0.77 },
  'Mount Gravatt': { median: 980000,  dom: 20, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Mount Gravatt East':{ median: 950000, dom: 20, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Mount Ommaney': { median: 1080000, dom: 26, growth12m: 0.09, cagr10yr: 0.068, clearance: 0.70 },
  'Murarrie':      { median: 920000,  dom: 21, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Nathan':        { median: 980000,  dom: 22, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.74 },
  'Nundah':        { median: 920000,  dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Oxley':         { median: 880000,  dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Pullenvale':    { median: 1650000, dom: 38, growth12m: 0.07, cagr10yr: 0.062, clearance: 0.66 },
  'Rocklea':       { median: 750000,  dom: 18, growth12m: 0.13, cagr10yr: 0.080, clearance: 0.78 },
  'Salisbury':     { median: 820000,  dom: 19, growth12m: 0.13, cagr10yr: 0.079, clearance: 0.77 },
  'Sandgate':      { median: 880000,  dom: 22, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Sinnamon Park': { median: 1050000, dom: 24, growth12m: 0.10, cagr10yr: 0.071, clearance: 0.73 },
  'Stafford':      { median: 920000,  dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Sunnybank':     { median: 950000,  dom: 20, growth12m: 0.12, cagr10yr: 0.077, clearance: 0.76 },
  'Sunnybank Hills':{ median: 980000, dom: 21, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Tarragindi':    { median: 1080000, dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Tennyson':      { median: 1280000, dom: 28, growth12m: 0.09, cagr10yr: 0.069, clearance: 0.70 },
  'The Gap':       { median: 1050000, dom: 26, growth12m: 0.09, cagr10yr: 0.069, clearance: 0.70 },
  'Tingalpa':      { median: 850000,  dom: 20, growth12m: 0.12, cagr10yr: 0.076, clearance: 0.76 },
  'Upper Kedron':  { median: 950000,  dom: 25, growth12m: 0.10, cagr10yr: 0.070, clearance: 0.71 },
  'Upper Mount Gravatt':{ median: 1050000, dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Wakerley':      { median: 1050000, dom: 23, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.73 },
  'Wavell Heights':{ median: 1020000, dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Wishart':       { median: 1050000, dom: 22, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Woolloongabba': { median: 1080000, dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Wynnum':        { median: 920000,  dom: 22, growth12m: 0.11, cagr10yr: 0.074, clearance: 0.74 },
  'Wynnum West':   { median: 880000,  dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Yeerongpilly':  { median: 1050000, dom: 21, growth12m: 0.12, cagr10yr: 0.075, clearance: 0.75 },
  'Yeronga':       { median: 1180000, dom: 23, growth12m: 0.11, cagr10yr: 0.073, clearance: 0.73 },
  'Zillmere':      { median: 780000,  dom: 19, growth12m: 0.13, cagr10yr: 0.079, clearance: 0.77 },
};

// Fuzzy suburb lookup — strips QLD/Brisbane/etc suffix
function getSuburbStats(address) {
  if (!address) return null;
  // Try to extract suburb from address string
  // "14 Riverview Tce, Chelmer QLD 4068" → "Chelmer"
  const parts = address.split(',').map(s => s.trim());
  for (const part of parts) {
    const suburb = part.replace(/\s+(QLD|NSW|VIC|ACT|SA|WA|TAS|NT)\s*\d{4}/i, '').trim();
    if (SUBURB_STATS[suburb]) return { suburb, ...SUBURB_STATS[suburb] };
  }
  // Fallback: scan all words
  const words = address.split(/[\s,]+/);
  for (let i = words.length - 1; i >= 0; i--) {
    const key = words[i];
    if (SUBURB_STATS[key]) return { suburb: key, ...SUBURB_STATS[key] };
    // Two-word suburb check
    if (i > 0) {
      const two = `${words[i-1]} ${words[i]}`;
      if (SUBURB_STATS[two]) return { suburb: two, ...SUBURB_STATS[two] };
    }
  }
  return null;
}

module.exports = {
  PRODUCT,
  PRICING,
  DISCLAIMER,
  BASE_URL,
  ZONEIQ,
  FEATURES,
  SUBURB_STATS,
  getSuburbStats,
  supabaseFetch,
  supabaseHeaders,
  corsHeaders,
  handleCors,
};
