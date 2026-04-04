module.exports = async (req, res) => {
  const address = req.query.address || '6 Glenheaton Court Carindale QLD 4152'

  // Test each data source
  const results = {}

  // Test Domain OAuth
  try {
    const { getDomainToken } = require('./lib/domain-auth')
    const token = await getDomainToken()
    results.domainAuth = { ok: true, tokenLength: token.length }
  } catch (e) {
    results.domainAuth = { ok: false, error: e.message }
  }

  // Test ZoneIQ
  try {
    const response = await fetch(
      `https://zoneiq-sigma.vercel.app/api/lookup?address=${encodeURIComponent(address)}`
    )
    const data = await response.json()
    results.zoneiq = { ok: data.success, zone: data.zone?.name }
  } catch (e) {
    results.zoneiq = { ok: false, error: e.message }
  }

  res.json(results)
}
