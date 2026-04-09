const { getDomainToken } = require('./lib/domain-auth')

// UPDATE QUARTERLY — source: ABS / REA public data
// Median house price by Brisbane suburb (approx, based on 2024–2025 publicly available data)
// Keyed by suburb name in lowercase for case-insensitive lookup
const SUBURB_MEDIANS = {
  'ascot': { median: 2850000, domDays: 18, growth12m: 8.2, cagr10y: 7.1, clearanceRate: 79 },
  'hamilton': { median: 2600000, domDays: 21, growth12m: 7.8, cagr10y: 6.9, clearanceRate: 76 },
  'new farm': { median: 2400000, domDays: 22, growth12m: 9.1, cagr10y: 7.5, clearanceRate: 81 },
  'teneriffe': { median: 2350000, domDays: 20, growth12m: 10.2, cagr10y: 8.1, clearanceRate: 83 },
  'clayfield': { median: 1950000, domDays: 19, growth12m: 8.9, cagr10y: 7.3, clearanceRate: 80 },
  'hendra': { median: 1850000, domDays: 17, growth12m: 9.4, cagr10y: 7.6, clearanceRate: 82 },
  'paddington': { median: 1820000, domDays: 16, growth12m: 9.8, cagr10y: 7.8, clearanceRate: 84 },
  'red hill': { median: 1750000, domDays: 18, growth12m: 8.6, cagr10y: 7.2, clearanceRate: 80 },
  'bulimba': { median: 1780000, domDays: 15, growth12m: 10.1, cagr10y: 8.0, clearanceRate: 85 },
  'hawthorne': { median: 1690000, domDays: 16, growth12m: 9.3, cagr10y: 7.7, clearanceRate: 83 },
  'chelmer': { median: 1610000, domDays: 16, growth12m: 9.2, cagr10y: 7.4, clearanceRate: 82 },
  'fig tree pocket': { median: 1580000, domDays: 22, growth12m: 7.5, cagr10y: 6.8, clearanceRate: 74 },
  'indooroopilly': { median: 1450000, domDays: 20, growth12m: 8.1, cagr10y: 7.0, clearanceRate: 78 },
  'taringa': { median: 1320000, domDays: 21, growth12m: 7.9, cagr10y: 6.9, clearanceRate: 77 },
  'toowong': { median: 1290000, domDays: 19, growth12m: 8.3, cagr10y: 7.2, clearanceRate: 79 },
  'st lucia': { median: 1450000, domDays: 23, growth12m: 7.2, cagr10y: 6.5, clearanceRate: 73 },
  'chapel hill': { median: 1280000, domDays: 24, growth12m: 7.0, cagr10y: 6.3, clearanceRate: 72 },
  'kenmore': { median: 1120000, domDays: 26, growth12m: 6.8, cagr10y: 6.1, clearanceRate: 70 },
  'brookfield': { median: 1380000, domDays: 28, growth12m: 6.5, cagr10y: 6.0, clearanceRate: 68 },
  'graceville': { median: 1390000, domDays: 17, growth12m: 8.8, cagr10y: 7.1, clearanceRate: 80 },
  'sherwood': { median: 1310000, domDays: 18, growth12m: 8.4, cagr10y: 6.9, clearanceRate: 78 },
  'corinda': { median: 1050000, domDays: 21, growth12m: 7.6, cagr10y: 6.5, clearanceRate: 74 },
  'oxley': { median: 950000, domDays: 22, growth12m: 7.2, cagr10y: 6.2, clearanceRate: 72 },
  'rocklea': { median: 780000, domDays: 24, growth12m: 6.8, cagr10y: 5.9, clearanceRate: 68 },
  'annerley': { median: 1050000, domDays: 20, growth12m: 8.5, cagr10y: 7.0, clearanceRate: 79 },
  'yeronga': { median: 1180000, domDays: 19, growth12m: 8.9, cagr10y: 7.3, clearanceRate: 81 },
  'moorooka': { median: 970000, domDays: 22, growth12m: 7.8, cagr10y: 6.6, clearanceRate: 75 },
  'tarragindi': { median: 1060000, domDays: 21, growth12m: 7.5, cagr10y: 6.4, clearanceRate: 74 },
  'mount gravatt': { median: 1050000, domDays: 22, growth12m: 7.3, cagr10y: 6.3, clearanceRate: 73 },
  'upper mount gravatt': { median: 1050000, domDays: 22, growth12m: 7.1, cagr10y: 6.2, clearanceRate: 72 },
  'holland park': { median: 1020000, domDays: 21, growth12m: 8.0, cagr10y: 6.8, clearanceRate: 77 },
  'coorparoo': { median: 1180000, domDays: 18, growth12m: 9.2, cagr10y: 7.5, clearanceRate: 82 },
  'camp hill': { median: 1290000, domDays: 17, growth12m: 9.5, cagr10y: 7.7, clearanceRate: 83 },
  'greenslopes': { median: 1080000, domDays: 20, growth12m: 8.6, cagr10y: 7.1, clearanceRate: 79 },
  'woolloongabba': { median: 1150000, domDays: 19, growth12m: 9.0, cagr10y: 7.4, clearanceRate: 81 },
  'east brisbane': { median: 1320000, domDays: 17, growth12m: 9.8, cagr10y: 7.9, clearanceRate: 84 },
  'kangaroo point': { median: 1250000, domDays: 18, growth12m: 9.4, cagr10y: 7.6, clearanceRate: 82 },
  'west end': { median: 1480000, domDays: 16, growth12m: 10.5, cagr10y: 8.2, clearanceRate: 85 },
  'south brisbane': { median: 1380000, domDays: 18, growth12m: 9.8, cagr10y: 7.8, clearanceRate: 83 },
  'highgate hill': { median: 1480000, domDays: 17, growth12m: 10.1, cagr10y: 8.0, clearanceRate: 84 },
  'dutton park': { median: 1350000, domDays: 18, growth12m: 9.6, cagr10y: 7.7, clearanceRate: 82 },
  'norman park': { median: 1320000, domDays: 16, growth12m: 9.7, cagr10y: 7.8, clearanceRate: 83 },
  'balmoral': { median: 1680000, domDays: 15, growth12m: 10.3, cagr10y: 8.1, clearanceRate: 85 },
  'morningside': { median: 1150000, domDays: 19, growth12m: 9.0, cagr10y: 7.3, clearanceRate: 80 },
  'seven hills': { median: 1050000, domDays: 22, growth12m: 7.5, cagr10y: 6.5, clearanceRate: 74 },
  'wavell heights': { median: 980000, domDays: 23, growth12m: 7.2, cagr10y: 6.3, clearanceRate: 72 },
  'nundah': { median: 920000, domDays: 22, growth12m: 7.8, cagr10y: 6.6, clearanceRate: 75 },
  'toombul': { median: 920000, domDays: 22, growth12m: 7.6, cagr10y: 6.5, clearanceRate: 74 },
  'stafford': { median: 870000, domDays: 23, growth12m: 7.4, cagr10y: 6.4, clearanceRate: 73 },
  'stafford heights': { median: 850000, domDays: 23, growth12m: 7.1, cagr10y: 6.2, clearanceRate: 71 },
  'chermside': { median: 840000, domDays: 24, growth12m: 7.0, cagr10y: 6.1, clearanceRate: 70 },
  'kedron': { median: 950000, domDays: 21, growth12m: 7.9, cagr10y: 6.7, clearanceRate: 76 },
  'gordon park': { median: 1080000, domDays: 20, growth12m: 8.3, cagr10y: 7.0, clearanceRate: 78 },
  'grange': { median: 1250000, domDays: 18, growth12m: 9.0, cagr10y: 7.4, clearanceRate: 81 },
  'wilston': { median: 1380000, domDays: 16, growth12m: 9.5, cagr10y: 7.7, clearanceRate: 83 },
  'windsor': { median: 1280000, domDays: 17, growth12m: 9.2, cagr10y: 7.5, clearanceRate: 82 },
  'lutwyche': { median: 1050000, domDays: 20, growth12m: 8.5, cagr10y: 7.1, clearanceRate: 79 },
  'albion': { median: 1180000, domDays: 18, growth12m: 9.3, cagr10y: 7.6, clearanceRate: 82 },
  'woolwich': { median: 1050000, domDays: 21, growth12m: 7.8, cagr10y: 6.6, clearanceRate: 75 },
  'bowen hills': { median: 1020000, domDays: 21, growth12m: 8.0, cagr10y: 6.8, clearanceRate: 76 },
  'fortitude valley': { median: 1050000, domDays: 20, growth12m: 8.8, cagr10y: 7.2, clearanceRate: 79 },
  'spring hill': { median: 1180000, domDays: 19, growth12m: 9.1, cagr10y: 7.4, clearanceRate: 80 },
  'kelvin grove': { median: 1280000, domDays: 18, growth12m: 9.4, cagr10y: 7.6, clearanceRate: 82 },
  'petrie terrace': { median: 1380000, domDays: 17, growth12m: 9.8, cagr10y: 7.8, clearanceRate: 83 },
  'carindale': { median: 1180000, domDays: 21, growth12m: 7.9, cagr10y: 6.8, clearanceRate: 76 },
  'carina': { median: 980000, domDays: 22, growth12m: 7.5, cagr10y: 6.5, clearanceRate: 74 },
  'carina heights': { median: 1010000, domDays: 22, growth12m: 7.4, cagr10y: 6.4, clearanceRate: 73 },
  'mansfield': { median: 1050000, domDays: 23, growth12m: 7.1, cagr10y: 6.2, clearanceRate: 71 },
  'wishart': { median: 1080000, domDays: 22, growth12m: 7.3, cagr10y: 6.3, clearanceRate: 72 },
  'robertson': { median: 1020000, domDays: 22, growth12m: 7.2, cagr10y: 6.2, clearanceRate: 72 },
  'sunnybank': { median: 950000, domDays: 24, growth12m: 6.9, cagr10y: 6.0, clearanceRate: 69 },
  'sunnybank hills': { median: 870000, domDays: 25, growth12m: 6.7, cagr10y: 5.9, clearanceRate: 68 },
  'eight mile plains': { median: 870000, domDays: 25, growth12m: 6.6, cagr10y: 5.8, clearanceRate: 67 },
  'runcorn': { median: 780000, domDays: 26, growth12m: 6.5, cagr10y: 5.7, clearanceRate: 66 },
  'acacia ridge': { median: 720000, domDays: 27, growth12m: 6.3, cagr10y: 5.6, clearanceRate: 65 },
  'salisbury': { median: 760000, domDays: 26, growth12m: 6.4, cagr10y: 5.7, clearanceRate: 66 },
  'nathan': { median: 880000, domDays: 24, growth12m: 7.0, cagr10y: 6.1, clearanceRate: 70 },
  'macgregor': { median: 950000, domDays: 23, growth12m: 7.2, cagr10y: 6.3, clearanceRate: 72 },
  'mount ommaney': { median: 1080000, domDays: 24, growth12m: 6.8, cagr10y: 6.0, clearanceRate: 69 },
  'jindalee': { median: 980000, domDays: 24, growth12m: 6.9, cagr10y: 6.1, clearanceRate: 70 },
  'middle park': { median: 1050000, domDays: 23, growth12m: 7.1, cagr10y: 6.2, clearanceRate: 71 },
  'sinnamon park': { median: 1020000, domDays: 23, growth12m: 7.0, cagr10y: 6.1, clearanceRate: 70 },
  'seventeen mile rocks': { median: 950000, domDays: 24, growth12m: 6.8, cagr10y: 6.0, clearanceRate: 69 },
  'sumner': { median: 880000, domDays: 25, growth12m: 6.6, cagr10y: 5.8, clearanceRate: 67 },
  'darra': { median: 820000, domDays: 26, growth12m: 6.4, cagr10y: 5.7, clearanceRate: 66 },
  'riverhills': { median: 900000, domDays: 25, growth12m: 6.7, cagr10y: 5.9, clearanceRate: 68 },
  'bellbowrie': { median: 950000, domDays: 27, growth12m: 6.3, cagr10y: 5.7, clearanceRate: 65 },
  'pullenvale': { median: 1280000, domDays: 32, growth12m: 5.8, cagr10y: 5.4, clearanceRate: 60 },
  'moggill': { median: 1050000, domDays: 30, growth12m: 5.9, cagr10y: 5.5, clearanceRate: 62 },
  'pinjarra hills': { median: 1180000, domDays: 31, growth12m: 5.7, cagr10y: 5.3, clearanceRate: 61 },
  'upper kedron': { median: 980000, domDays: 27, growth12m: 6.2, cagr10y: 5.6, clearanceRate: 64 },
  'ferny hills': { median: 880000, domDays: 26, growth12m: 6.5, cagr10y: 5.8, clearanceRate: 66 },
  'arana hills': { median: 850000, domDays: 26, growth12m: 6.4, cagr10y: 5.7, clearanceRate: 65 },
  'everton park': { median: 920000, domDays: 24, growth12m: 7.0, cagr10y: 6.1, clearanceRate: 71 },
  'mitchelton': { median: 1020000, domDays: 21, growth12m: 8.1, cagr10y: 6.9, clearanceRate: 78 },
  'enoggera': { median: 880000, domDays: 23, growth12m: 7.4, cagr10y: 6.4, clearanceRate: 73 },
  'keperra': { median: 850000, domDays: 24, growth12m: 7.1, cagr10y: 6.2, clearanceRate: 71 },
  'the gap': { median: 980000, domDays: 25, growth12m: 6.8, cagr10y: 6.0, clearanceRate: 69 },
  'ashgrove': { median: 1380000, domDays: 17, growth12m: 9.3, cagr10y: 7.6, clearanceRate: 82 },
  'bardon': { median: 1480000, domDays: 16, growth12m: 9.7, cagr10y: 7.8, clearanceRate: 83 },
  'auchenflower': { median: 1350000, domDays: 17, growth12m: 9.5, cagr10y: 7.7, clearanceRate: 83 },
}

function getSuburbStats(suburb) {
  if (!suburb) return null
  const key = suburb.toLowerCase().trim()
  const data = SUBURB_MEDIANS[key]
  if (!data) return null
  return {
    medianPrice: data.median,
    medianDomDays: data.domDays,
    growth12m: data.growth12m,
    cagr10y: data.cagr10y,
    clearanceRate: data.clearanceRate,
    source: 'static-lookup'
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, address, lat, lng } = req.body

  if (!email || !address) {
    return res.status(400).json({ error: 'Email and address required' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  // One free report per email globally — check before proceeding
  if (supabaseUrl && supabaseKey) {
    try {
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/scout_reports?email=eq.${encodeURIComponent(email)}&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      )
      if (checkRes.ok) {
        const existing = await checkRes.json()
        if (existing && existing.length > 0) {
          // This email has already claimed a free report — return paywall response
          return res.json({
            paywall: true,
            message: 'You\'ve already received a free Scout Report. Upgrade to Buyer\'s Brief for full analysis.',
            address
          })
        }
      }
    } catch (err) {
      console.error('Supabase email check error:', err)
      // Don't block submission if check fails
    }
  }

  // New email — upsert into Supabase
  if (supabaseUrl && supabaseKey) {
    try {
      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/scout_reports`, {
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
          followup_sent: false,
          converted_to_paid: false,
          created_at: new Date().toISOString()
        })
      })
      if (!upsertRes.ok) {
        const errBody = await upsertRes.text()
        console.error('Supabase upsert error:', upsertRes.status, errBody)
      }
    } catch (err) {
      console.error('Supabase upsert error:', err)
      // Don't block the response if storage fails
    }
  }

  // Send Scout Report confirmation email via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'ClearOffer <hello@clearoffer.com.au>',
          to: email,
          subject: 'Your ClearOffer Scout Report',
          html: `
            <h2>Your Scout Report is ready</h2>
            <p>We've generated your free Scout Report for <strong>${address}</strong>.</p>
            <p>Your report includes flood risk assessment, zoning analysis, comparable sales, and an AI-powered property verdict.</p>
            <p>If you found the Scout Report useful, the full <strong>Buyer's Brief ($149)</strong> includes:</p>
            <ul>
              <li>Specific offer recommendation with reasoning</li>
              <li>Negotiation leverage analysis</li>
              <li>5-10 year suburb outlook</li>
              <li>What the agent won't tell you</li>
            </ul>
            <p><a href="https://clearoffer.com.au">Get your Buyer's Brief →</a></p>
            <p style="color:#999;font-size:12px;">ClearOffer — Independent property analysis for Brisbane buyers.</p>
          `
        })
      })
    } catch (emailErr) {
      console.error('Email send failed:', emailErr)
      // Don't fail the request if email fails
    }
  }

  // Fetch data from all sources in parallel
  const [listingData, zoneiqData] = await Promise.allSettled([
    fetchDomainListing(address),
    fetchZoneIQ(address)
  ])

  const listing = listingData.status === 'fulfilled' ? listingData.value : null
  const zoneiq = zoneiqData.status === 'fulfilled' ? zoneiqData.value : null
  const suburb = extractSuburb(address)
  const suburbStats = getSuburbStats(suburb)

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
      zoneCode: zoneiq.zone?.code || null,
      partial: zoneiq.meta?.partial || false,
      disclaimer: zoneiq.meta?.disclaimer || null
    } : null,
    flood: zoneiq?.overlays?.flood || { hasFloodOverlay: false, riskLevel: 'none' },
    character: zoneiq?.overlays?.character || { hasCharacterOverlay: false },
    bushfire: zoneiq?.overlays?.bushfire || { hasBushfireOverlay: false },
    schools: zoneiq?.overlays?.schools || [],
    heritage: zoneiq?.overlays?.heritage || null,
    noise: zoneiq?.overlays?.noise || null,
    comparables: [],
    priceEstimate: null,
    suburbStats
  })
}

async function fetchDomainListing(address) {
  try {
    const token = await getDomainToken()
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
    const zoneiqUrl = process.env.ZONEIQ_URL || 'https://zoneiq-sigma.vercel.app'
    const encoded = encodeURIComponent(address)
    const response = await fetch(
      `${zoneiqUrl}/api/lookup?address=${encoded}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!response.ok) return null
    const data = await response.json()

    if (!data.success) {
      console.warn('ZoneIQ returned success:false for', address,
        '— actual response keys:', JSON.stringify(Object.keys(data)))
      return null
    }

    // Validate expected shape: overlays.flood, character, bushfire, schools must all be present
    const overlays = data.overlays || {}
    const missingFields = ['flood', 'character', 'bushfire', 'schools'].filter(k => !(k in overlays))
    if (missingFields.length > 0) {
      console.warn('ZoneIQ response missing overlay fields', missingFields,
        'for', address, '— received keys:', JSON.stringify(Object.keys(overlays)),
        '— applying safe defaults')
      if (!overlays.flood) overlays.flood = { hasFloodOverlay: false, riskLevel: 'none' }
      if (!overlays.character) overlays.character = { hasCharacterOverlay: false }
      if (!overlays.bushfire) overlays.bushfire = { hasBushfireOverlay: false }
      if (!overlays.schools) overlays.schools = []
      data.overlays = overlays
    }

    return data
  } catch (err) {
    console.error('ZoneIQ error:', err)
    return null
  }
}

function extractSuburb(address) {
  const match = address.match(/,\s*([^,]+?)\s+(?:QLD|NSW|VIC|WA|SA|TAS|ACT|NT)/)
  return match ? match[1].trim() : 'Brisbane'
}

function findBestMatch(results, address) {
  if (!results || !results.length) return null
  const addressLower = address.toLowerCase()
  return results.find(r => {
    const listingAddress = (r.listing?.propertyDetails?.displayableAddress || '').toLowerCase()
    const streetParts = addressLower.split(',')[0].split(' ')
    return streetParts.some(part => part.length > 3 && listingAddress.includes(part))
  }) || results[0]
}
