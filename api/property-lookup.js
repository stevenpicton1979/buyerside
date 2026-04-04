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
