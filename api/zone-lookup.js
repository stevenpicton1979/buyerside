'use strict';
// ============================================================
// ClearOffer — Zone/overlay lookup (Sprint 2: PropertyData switchover)
// ============================================================
// Thin wrapper that delegates to PropertyData API.
// All BCC ArcGIS + ZoneIQ queries are now handled by PropertyData.
// Response shape is identical to the pre-switchover version.
//
// Before Sprint 2, this file was 713 lines handling:
//   - ZoneIQ fetch + normalisation
//   - BCC DCDB parcel lookup
//   - 17 BCC ArcGIS overlay queries
//   - GNAF resolution
//   - ICSEA lookup
//   - All plain-English builders
//
// Now it's a single fetch + mapping via api/lib/propertydata-client.js.
// ============================================================

const { handleCors } = require('./config');
const { fetchPropertyData, safeDefaults } = require('./lib/propertydata-client');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address || address.trim().length < 5) {
    return res.status(400).json({ error: 'address is required' });
  }

  try {
    // Free tier for zone-lookup (used by free Scout Report)
    const result = await fetchPropertyData(address.trim(), 'free');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[zone-lookup] PropertyData error:', err.message);
    return res.status(200).json(safeDefaults(address, err.message));
  }
};
