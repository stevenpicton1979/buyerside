'use strict';
// ============================================================
// ClearOffer — Address autocomplete
// ============================================================
// Uses Google Places Autocomplete API (legacy /place/autocomplete/json).
// Key: GOOGLE_GEOCODING_API_KEY — same key as ZoneIQ geocoder.
// Requires "Places API" enabled on the GCP project (in addition to
// Geocoding API). Check GCP console if suggestions return empty.
//
// Will be replaced by Domain developer API autocomplete when approved.
// ============================================================

const { handleCors } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { q } = req.query;
  if (!q || q.trim().length < 3) return res.status(200).json({ suggestions: [] });

  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) {
    console.warn('[autocomplete] GOOGLE_GEOCODING_API_KEY not set');
    return res.status(200).json({ suggestions: [] });
  }

  try {
    // Google Places Autocomplete API
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`
      + `?input=${encodeURIComponent(q)}`
      + `&types=address`
      + `&components=country:au`
      + `&key=${key}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`Google Places ${resp.status}`);

    const data = await resp.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[autocomplete] Google Places status:', data.status);
    }

    const suggestions = (data.predictions || []).map(p => ({
      description: p.description,
      placeId: p.place_id,
    }));

    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error('[autocomplete] error:', err.message);
    return res.status(200).json({ suggestions: [] }); // Never crash the UI
  }
};
