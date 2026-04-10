'use strict';
// ============================================================
// ClearOffer — GNAF address resolution endpoint
// Sprint 23: Resolves an address to GNAF PID + lat/lng via Addressr API
// GET /api/gnaf-resolve?address=<address>
// ============================================================

const { handleCors } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || address.trim().length < 5) {
    return res.status(400).json({ error: 'address is required' });
  }

  const clean = address.trim().replace(/,?\s*Australia$/i, '').trim();

  try {
    // Step 1: search for address
    const searchResp = await fetch(
      `https://api.addressr.io/addresses?q=${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!searchResp.ok) {
      return res.status(502).json({ error: `Addressr search failed: HTTP ${searchResp.status}` });
    }
    const results = await searchResp.json();
    if (!results?.length) {
      return res.status(404).json({ error: 'No GNAF match found', query: clean });
    }

    const { pid, sla, score } = results[0];
    if (!pid) {
      return res.status(404).json({ error: 'No GNAF PID in result', query: clean });
    }

    // Step 2: fetch geocode detail
    const detailResp = await fetch(
      `https://api.addressr.io/addresses/${pid}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!detailResp.ok) {
      return res.status(502).json({ error: `Addressr detail failed: HTTP ${detailResp.status}`, pid });
    }
    const detail = await detailResp.json();

    const geocode = detail.geocoding?.geocodes?.find(g => g.default) || detail.geocoding?.geocodes?.[0];
    if (!geocode?.latitude || !geocode?.longitude) {
      return res.status(200).json({ pid, sla, score, geocode: null });
    }

    return res.status(200).json({
      pid,
      sla,
      score,
      lat:          geocode.latitude,
      lng:          geocode.longitude,
      geocodeType:  geocode.type?.name || 'PROPERTY CENTROID',
      reliability:  geocode.reliability?.code,
      reliabilityLabel: geocode.reliability?.name || null,
    });

  } catch (err) {
    console.error('[gnaf-resolve] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
