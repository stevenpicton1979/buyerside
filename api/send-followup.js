'use strict';
// ============================================================
// ClearOffer — 24hr follow-up email job
// ============================================================
// Finds scout_reports where:
//   - created_at between 23–25 hours ago
//   - followup_sent = false
//   - converted_to_paid = false
//   - address != '__waitlist__'
// Sends one follow-up email per report, marks followup_sent.
//
// Invoke via cron or manual GET with ?secret=CRON_SECRET
// Set CRON_SECRET in env vars.
// ============================================================

const { handleCors, supabaseFetch, PRODUCT, PRICING, BASE_URL, DISCLAIMER } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Simple secret guard — not a Stripe webhook, just a cron trigger
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const reports = await findDueReports();
    const results = [];

    for (const report of reports) {
      const result = await processReport(report);
      results.push(result);
    }

    return res.status(200).json({
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error('[send-followup] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

async function findDueReports() {
  // Find reports created 23–25 hours ago, not yet followed up, not yet paid
  const now = new Date();
  const from = new Date(now - 25 * 60 * 60 * 1000).toISOString();
  const to   = new Date(now - 23 * 60 * 60 * 1000).toISOString();

  return await supabaseFetch(
    `/scout_reports`
    + `?created_at=gte.${from}`
    + `&created_at=lte.${to}`
    + `&followup_sent=eq.false`
    + `&converted_to_paid=eq.false`
    + `&address=neq.__waitlist__`
    + `&select=id,email,address,created_at`
    + `&limit=50`
  );
}

async function processReport(report) {
  const { id, email, address } = report;
  try {
    await sendFollowupEmail({ email, address });
    await supabaseFetch(
      `/scout_reports?id=eq.${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ followup_sent: true }),
        headers: { 'Prefer': 'return=minimal' },
      }
    );
    console.log(`[send-followup] sent to ${email} for ${address}`);
    return { email, address, status: 'sent' };
  } catch (err) {
    console.error(`[send-followup] failed for ${email}:`, err.message);
    return { email, address, status: 'failed', error: err.message };
  }
}

async function sendFollowupEmail({ email, address }) {
  const reportUrl  = `${BASE_URL}/report.html?address=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}`;
  const briefUrl   = `${BASE_URL}/report.html?address=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}#cta-block`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Georgia, serif; background: #0a0a0a; color: #e8e0d0; margin: 0; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; }
    .logo { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #d4a853; margin-bottom: 32px; }
    h1 { font-size: 24px; color: #e8e0d0; margin: 0 0 16px; line-height: 1.3; }
    p { color: #a89880; line-height: 1.7; margin: 0 0 16px; font-size: 16px; }
    .address { color: #e8e0d0; font-style: italic; }
    .hook {
      background: #141008;
      border: 1px solid #7a5a22;
      border-left: 4px solid #c9963a;
      border-radius: 8px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .hook p { color: #e8e0d0; font-style: italic; font-size: 17px; line-height: 1.5; margin: 0; }
    .cta-block { background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 24px; margin: 28px 0; }
    .cta-btn { display: inline-block; background: #c9963a; color: #0a0a0a; text-decoration: none;
               font-weight: 700; padding: 14px 28px; border-radius: 6px; font-size: 15px;
               font-family: system-ui, sans-serif; }
    .price-anchor { color: #666; font-size: 13px; margin-top: 12px; font-family: system-ui, sans-serif; }
    .what-inside { background: #0f0f0f; border: 1px solid #1a1a1a; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .what-inside p { font-family: system-ui, sans-serif; font-size: 14px; color: #9a8f80; margin: 0 0 6px; }
    .what-inside p:last-child { margin: 0; }
    .what-inside p::before { content: '→ '; color: #7a5a22; }
    .divider { border: none; border-top: 1px solid #1a1a1a; margin: 28px 0; }
    .footer { color: #444; font-size: 12px; line-height: 1.6; font-family: system-ui, sans-serif; }
    .disclaimer { color: #333; font-size: 11px; line-height: 1.6; margin-top: 20px; font-style: italic; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${PRODUCT.NAME}</div>

    <h1>Still thinking about<br><span class="address">${address}</span>?</h1>

    <p>You got a free Scout Report yesterday. Here's what the Buyer's Brief would add.</p>

    <div class="hook">
      <p>"You've done the inspection. The Buyer's Brief gives you a specific opening offer, the negotiation script to back it up, and what the agent won't volunteer."</p>
    </div>

    <div class="what-inside">
      <p>Full AVM with confidence score and comparable sales analysis</p>
      <p>Flood risk, overlays, and heritage — explained in plain English</p>
      <p>Opening offer recommendation with specific dollar figures</p>
      <p>Negotiation script using DOM signals and comparable gaps</p>
      <p>What the agent won't tell you</p>
      <p>5–10 year suburb outlook</p>
    </div>

    <div class="cta-block">
      <a href="${briefUrl}" class="cta-btn">Get Your Buyer's Brief — $149 →</a>
      <p class="price-anchor">A buyer's agent charges ${PRICING.AGENT_FEE_RANGE}. One-time. No subscription.</p>
    </div>

    <hr class="divider">
    <p class="footer">
      You received this because you requested a free Scout Report for ${address} at ${PRODUCT.DOMAIN}.
      <br>Don't want follow-ups? Just ignore this — we won't email again about this property.
    </p>
    <p class="disclaimer">
      ${DISCLAIMER}
    </p>    </p>
  </div>
</body>
</html>`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${PRODUCT.FROM_NAME} <${PRODUCT.FROM_EMAIL}>`,
      to: [email],
      subject: `Still thinking about ${address}? Here's what the Buyer's Brief would tell you.`,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend ${resp.status}: ${err}`);
  }
}
