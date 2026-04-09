'use strict';
// ============================================================
// ClearOffer — Email gate + Scout Report generation
// ============================================================
// Called after user enters email. Enforces one-free-per-email.
// Saves to Supabase scout_reports. Sends confirmation email.
// NEVER calls PropTechData here. Free report only.
// ============================================================

const { handleCors, supabaseFetch, PRODUCT, PRICING, BASE_URL, getSuburbStats, DISCLAIMER } = require('./config');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const email = (body?.email || '').trim().toLowerCase();
  const address = (body?.address || '').trim();
  const reportData = body?.reportData || null;

  if (!email || !address) {
    return res.status(400).json({ error: 'email and address are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // ---- One-free-per-email enforcement ----
  // Check if this email has already used their free report
  let existingReports;
  try {
    existingReports = await supabaseFetch(
      `/scout_reports?email=eq.${encodeURIComponent(email)}&address=neq.__waitlist__&select=id,address,created_at&limit=1`
    );
  } catch (err) {
    console.error('[submit-email] Supabase lookup error:', err.message);
    // Don't block on DB error — log and continue
    existingReports = [];
  }

  if (existingReports && existingReports.length > 0) {
    const prev = existingReports[0];
    return res.status(200).json({
      status: 'already_used',
      message: `This email has already used its free Scout Report (for ${prev.address}).`,
      upsell: true,
      buyersBriefUrl: `${BASE_URL}/buyers-brief.html`,
    });
  }

  // ---- Save to Supabase ----
  let saved;
  try {
    const rows = await supabaseFetch('/scout_reports', {
      method: 'POST',
      body: JSON.stringify({
        email,
        address,
        report_data: reportData,
        followup_sent: false,
        converted_to_paid: false,
      }),
    });
    saved = rows?.[0] || { email, address };
  } catch (err) {
    // Unique constraint violation = already exists (race condition)
    if (err.message.includes('23505') || err.message.includes('unique')) {
      return res.status(200).json({
        status: 'already_used',
        message: 'This email has already used its free Scout Report.',
        upsell: true,
        buyersBriefUrl: `${BASE_URL}/buyers-brief.html`,
      });
    }
    console.error('[submit-email] Supabase insert error:', err.message);
    // Don't block on DB error — continue to send email
    saved = { email, address };
  }

  // ---- Send confirmation email via Resend ----
  try {
    await sendConfirmationEmail({ email, address });
  } catch (err) {
    console.error('[submit-email] Resend error:', err.message);
    // Don't fail the request if email fails — report still delivered on screen
  }

  return res.status(200).json({
    status: 'ok',
    message: 'Scout Report ready.',
    email,
    address,
  });
};

async function sendConfirmationEmail({ email, address }) {
  const reportUrl = `${BASE_URL}/report.html?address=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}`;

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
    .cta-block { background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 24px; margin: 28px 0; }
    .cta-btn { display: inline-block; background: #d4a853; color: #0a0a0a; text-decoration: none;
               font-weight: 700; padding: 14px 28px; border-radius: 6px; font-size: 15px; }
    .anchor { color: #666; font-size: 13px; margin-top: 12px; }
    .divider { border: none; border-top: 1px solid #1a1a1a; margin: 28px 0; }
    .footer { color: #444; font-size: 12px; line-height: 1.6; }
    .disclaimer { color: #444; font-size: 11px; line-height: 1.6; margin-top: 20px; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${PRODUCT.NAME}</div>
    <h1>Your Scout Report is ready.</h1>
    <p>We've analysed <span class="address">${address}</span> across planning overlays, school catchments, suburb market data, and more.</p>
    <div class="cta-block">
      <a href="${reportUrl}" class="cta-btn">View Your Scout Report →</a>
      <p class="anchor">${PRICING.AGENT_FEE_RANGE} for a buyer's agent. Your Buyer's Brief is $${PRICING.BUYERS_BRIEF_AUD}.</p>
    </div>
    <hr class="divider">
    <p class="footer">
      This email was sent to ${email} because you requested a free Scout Report from ${PRODUCT.DOMAIN}.
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
      subject: `Your Scout Report — ${address}`,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend ${resp.status}: ${err}`);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
