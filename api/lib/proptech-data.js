// PropTechData integration stubs
// Wire up when credentials arrive from hello@proptechdata.com.au

async function getPriceEstimate(address) {
  // TODO: const key = process.env.PROPTECH_API_KEY
  // TODO: fetch from PropTechData /estimate endpoint
  return null
}

async function getComparableSales(suburb, propertyType, bedrooms) {
  // TODO: fetch from PropTechData /comparables endpoint
  return []
}

async function getSuburbStats(suburb) {
  // TODO: fetch from PropTechData /suburb-stats endpoint
  return null
}

module.exports = { getPriceEstimate, getComparableSales, getSuburbStats }
