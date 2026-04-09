'use strict';
// ============================================================
// ClearOffer — Suburb stats endpoint
// ============================================================
// Tries Supabase cache first, falls back to static SUBURB_STATS.
// NEVER calls PropTechData. Per-lookup cost: near zero.
// ============================================================

const { handleCors, supabaseFetch, SUBURB_STATS, getSuburbStats } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { suburb, address } = req.query;
  const lookup = suburb || address;

  if (!lookup) return res.status(400).json({ error: 'suburb or address required' });

  // Try Supabase cache first
  try {
    const suburbName = suburb || extractSuburb(address);
    if (suburbName) {
      const rows = await supabaseFetch(
        `/suburb_stats_cache?suburb=ilike.${encodeURIComponent(suburbName)}&state=eq.QLD&limit=1&select=suburb,median_house_price,median_dom,clearance_rate,growth_12m,cagr_10yr,active_listings,updated_at`
      );
      if (rows && rows.length > 0) {
        const row = rows[0];
        return res.status(200).json({
          source: 'cache',
          suburb: row.suburb,
          median: row.median_house_price,
          dom: row.median_dom,
          clearanceRate: row.clearance_rate,
          growth12m: row.growth_12m,
          cagr10yr: row.cagr_10yr,
          activeListings: row.active_listings,
          updatedAt: row.updated_at,
        });
      }
    }
  } catch (err) {
    console.warn('[suburb-stats] cache lookup failed:', err.message);
  }

  // Fall back to static lookup
  const stats = getSuburbStats(lookup);
  if (stats) {
    return res.status(200).json({
      source: 'static',
      suburb: stats.suburb,
      median: stats.median,
      dom: stats.dom,
      clearanceRate: stats.clearance,
      growth12m: stats.growth12m,
      cagr10yr: stats.cagr10yr,
      activeListings: null,
      updatedAt: null,
    });
  }

  return res.status(200).json({
    source: 'none',
    suburb: null,
    median: null,
    dom: null,
    clearanceRate: null,
    growth12m: null,
    cagr10yr: null,
    activeListings: null,
  });
};

function extractSuburb(address) {
  if (!address) return null;
  const match = address.match(/,\s*([^,]+?)\s*(QLD|NSW|VIC)?\s*\d{4}/i);
  return match?.[1]?.trim() || null;
}
