const { getDomainToken } = require('./lib/domain-auth')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, address, lat, lng } = req.body

  if (!email || !address) {
    return res.status(400).json({ error: 'Email and address required' })
  }

  // Store email in Supabase via REST API
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    if (supabaseUrl && supabaseKey) {
      await fetch(`${supabaseUrl}/rest/v1/scout_reports`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          email,
          address,
          lat: lat || null,
          lng: lng || null,
          created_at: new Date().toISOString()
        })
      })
    }
  } catch (err) {
    console.error('Supabase error:', err)
    // Don't fail the request if storage fails
  }

  // Fetch data from all sources in parallel
  const [listingData, zoniqData] = await Promise.allSettled([
    fetchDomainListing(address),
    fetchZoneIQ(address)
  ])

  const listing = listingData.status === 'fulfilled' ? listingData.value : null
  const zoneiq = zoniqData.status === 'fulfilled' ? zoniqData.value : null

  res.json({
    property: {
      address,
      lat,
      lng,
      bedrooms: listing?.bedrooms || null,
      bathrooms: listing?.bathrooms || null,
      carSpaces: listing?.carSpaces || null,
      propertyType: listing?.propertyType || null,
      landArea: listing?.landArea || null
    },
    listing: {
      isOnMarket: !!listing,
      listingPrice: listing?.price || 'Contact agent',
      daysOnMarket: listing?.daysListed || null,
      agentName: listing?.agentName || null,
      agencyName: listing?.agencyName || null,
      listingId: listing?.id || null
    },
    zoning: zoneiq ? {
      zoneName: zoneiq.zone?.name || null,
      zoneCode: zoneiq.zone?.code || null
    } : null,
    flood: zoneiq?.overlays?.flood || { hasFloodOverlay: false, riskLevel: 'none' },
    character: zoneiq?.overlays?.character || { hasCharacterOverlay: false },
    schools: zoneiq?.overlays?.schools || [],
    comparables: [],      // TODO: wire PropTechData when credentials arrive
    priceEstimate: null,  // TODO: wire Domain Price Estimation when approved
    suburbStats: null     // TODO: wire PropTechData or Domain Properties & Locations
  })
}

async function fetchDomainListing(address) {
  try {
    const token = await getDomainToken()

    // Search for the listing by address
    const suburb = extractSuburb(address)
    const response = await fetch(
      'https://api.domain.com.au/v1/listings/residential/_search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listingType: 'Sale',
          locations: [{ state: 'QLD', suburb }],
          pageSize: 20
        })
      }
    )

    if (!response.ok) {
      console.error('Domain listings search failed:', response.status)
      return null
    }

    const results = await response.json()

    // Find the best match for the address
    const match = findBestMatch(results, address)
    if (!match) return null

    const l = match.listing
    return {
      id: l.id,
      price: l.priceDetails?.displayPrice || null,
      daysListed: l.daysListed || null,
      bedrooms: l.propertyDetails?.bedrooms || null,
      bathrooms: l.propertyDetails?.bathrooms || null,
      carSpaces: l.propertyDetails?.carspaces || null,
      propertyType: l.propertyDetails?.propertyType || null,
      landArea: l.propertyDetails?.landArea || null,
      agentName: l.advertiserIdentifiers?.agentName || null,
      agencyName: l.advertiserIdentifiers?.agencyName || null
    }
  } catch (err) {
    console.error('fetchDomainListing error:', err)
    return null
  }
}

async function fetchZoneIQ(address) {
  try {
    const encoded = encodeURIComponent(address)
    const response = await fetch(
      `https://zoneiq-sigma.vercel.app/api/lookup?address=${encoded}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!response.ok) return null
    const data = await response.json()
    return data.success ? data : null
  } catch (err) {
    console.error('ZoneIQ error:', err)
    return null
  }
}

function extractSuburb(address) {
  // Extract suburb from address string
  // e.g. "6 Glenheaton Court, Carindale QLD 4152" → "Carindale"
  const match = address.match(/,\s*([^,]+?)\s+(?:QLD|NSW|VIC|WA|SA|TAS|ACT|NT)/)
  return match ? match[1].trim() : 'Brisbane'
}

function findBestMatch(results, address) {
  if (!results || !results.length) return null
  // Simple match — find listing whose address contains key parts of our address
  const addressLower = address.toLowerCase()
  return results.find(r => {
    const listingAddress = (r.listing?.propertyDetails?.displayableAddress || '').toLowerCase()
    const streetParts = addressLower.split(',')[0].split(' ')
    return streetParts.some(part => part.length > 3 && listingAddress.includes(part))
  }) || results[0] // fallback to first result
}
