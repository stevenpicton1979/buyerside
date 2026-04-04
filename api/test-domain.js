const { getDomainToken } = require('./lib/domain-auth')

module.exports = async (req, res) => {
  try {
    const token = await getDomainToken()
    res.json({ success: true, token_length: token.length })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}
