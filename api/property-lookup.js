/*
 * DATA FIELD AUDIT — Scout Report (scout-report.html)
 * Sprint 5 — April 2026
 *
 * This file (property-lookup.js) handles Nominatim address autocomplete only.
 * The main data fetch (ZoneIQ + Domain) is in api/submit-email.js.
 *
 * Field classification:
 *   (a) live from ZoneIQ         — real data for any Brisbane address
 *   (b) live from Domain sandbox  — best-effort; sandbox data is synthetic; stubs apply when null
 *   (c) hardcoded mock (Chelmer) — must be replaced with stubs or live data in Sprint 5
 *   (d) already a smart stub     — intentionally withheld, design is correct
 *
 * ┌─────────────────────────────────────────┬───────┬──────────────────────────────────────────┐
 * │ Field                                   │ Class │ Notes                                    │
 * ├─────────────────────────────────────────┼───────┼──────────────────────────────────────────┤
 * │ listing.listingPrice                    │  (b)  │ Falls to "See agent listing" stub ✓       │
 * │ listing.daysOnMarket                    │  (b)  │ Falls to "Listed recently" stub ✓         │
 * │ listing.agentName                       │  (b)  │ Falls to "Contact selling agent" stub ✓   │
 * │ listing.agencyName                      │  (b)  │ Falls to stub ✓                           │
 * │ property.bedrooms/bathrooms/carSpaces   │  (b)  │ Falls to — ✓                             │
 * │ property.landArea                       │  (b)  │ Falls to "See contract" stub ✓            │
 * │ property.propertyType                   │  (b)  │ Falls to — ✓                             │
 * │ flood.hasFloodOverlay / riskLevel       │  (a)  │ Live from ZoneIQ ✓                        │
 * │ character.hasCharacterOverlay           │  (a)  │ Live from ZoneIQ ✓                        │
 * │ bushfire.hasBushfireOverlay             │  (a)  │ Live from ZoneIQ ✓ (added Sprint 4)       │
 * │ zoning.zoneName / zoneCode              │  (a)  │ Live from ZoneIQ ✓                        │
 * │ schools[]                               │  (a)  │ Live from ZoneIQ ✓                        │
 * │ "Year Built: 1958 / Renovated 2018"     │  (c)  │ Hardcoded Chelmer — needs stub            │
 * │ "Council Rates: $3,200 p.a."            │  (c)  │ Hardcoded Chelmer — needs stub            │
 * │ Comparable sales table (6 Chelmer rows) │  (c)  │ Replace with teaser UI (Sprint 5)        │
 * │ Suburb median price ($1,610,000)        │  (c)  │ Replace with static lookup table          │
 * │ Suburb DOM (16 days)                    │  (c)  │ Replace with static lookup table          │
 * │ 12-month growth (+9.2%)                 │  (c)  │ Replace with static lookup table          │
 * │ 10-year CAGR (+7.4%)                    │  (c)  │ Replace with static lookup table          │
 * │ Vendor discount (-2.8%)                 │  (c)  │ Replace with static lookup table          │
 * │ Clearance rate (82%)                    │  (c)  │ Replace with static lookup table          │
 * │ Active listings (7 houses)              │  (c)  │ Replace with static lookup table          │
 * │ Demand/supply meters (78%/28%/52%/45%)  │  (c)  │ Derive from lookup table or show 50/50   │
 * │ Verdict bar text                        │  (c)  │ Hardcoded Chelmer — stub in Sprint 5     │
 * │ Price estimate card                     │  (d)  │ "Domain Price Estimation" stub ✓          │
 * │ Offer Recommendation (blurred)          │  (c)  │ Chelmer text — blurred, ok for v1        │
 * │ Suburb Outlook (blurred)                │  (c)  │ Chelmer text — blurred, ok for v1        │
 * └─────────────────────────────────────────┴───────┴──────────────────────────────────────────┘
 */

module.exports = async (req, res) => {
  const { terms } = req.query
  if (!terms || terms.length < 3) return res.json([])

  try {
    // Use Nominatim for address suggestions (free, no API key)
    const encoded = encodeURIComponent(terms + ' Brisbane QLD Australia')
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=au&addressdetails=1`,
      { headers: { 'User-Agent': 'ClearOffer/1.0 (clearoffer.com.au)' } }
    )
    const results = await response.json()

    const suggestions = results
      .filter(r => r.address?.state === 'Queensland')
      .map(r => ({
        address: r.display_name.replace(', Australia', ''),
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        suburb: r.address?.suburb || r.address?.city_district || '',
        postcode: r.address?.postcode || ''
      }))

    res.json(suggestions)
  } catch (err) {
    console.error('Autocomplete error:', err)
    res.json([])
  }
}
