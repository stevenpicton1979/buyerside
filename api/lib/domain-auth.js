// Domain OAuth token manager
// Caches token in memory — valid for 1 hour

let cachedToken = null
let tokenExpiry = null

async function getDomainToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken
  }

  const response = await fetch('https://auth.domain.com.au/v1/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.DOMAIN_CLIENT_ID,
      client_secret: process.env.DOMAIN_CLIENT_SECRET,
      scope: 'api_listings_read'
    }).toString()
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Domain OAuth failed:', error)
    throw new Error('Domain auth failed')
  }

  const data = await response.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
  return cachedToken
}

module.exports = { getDomainToken }
