import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// api/stripe-webhook.js
// Handles Stripe webhook events
// On payment_intent.succeeded: stores paid report access, triggers brief generation

// NOTE: Stripe webhooks require raw body for signature verification
// This function uses Node.js runtime (not Edge) for that reason
export const config = {
  api: {
    bodyParser: false, // Must be disabled for Stripe webhook signature verification
  },
};

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

  // ─── Read raw body for signature verification ───
  const rawBody = await getRawBody(req);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // ─── Handle events ───
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (session.payment_status === 'paid') {
          await handleSuccessfulPayment({
            sessionId: session.id,
            email: session.customer_email || session.metadata.email,
            propertyId: session.metadata.property_id,
            address: session.metadata.address,
            amountPaid: session.amount_total, // in cents
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        // Log failed payments for monitoring
        const intent = event.data.object;
        console.error('Payment failed:', intent.id, intent.last_payment_error?.message);
        break;
      }

      default:
        // Ignore other events
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Handler error' });
  }
}

// ─── PAYMENT SUCCESS HANDLER ───
async function handleSuccessfulPayment({ sessionId, email, propertyId, address, amountPaid }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // 1. Generate a secure access token for the report
  const accessToken = generateAccessToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  // 2. Store paid report record in Supabase
  await fetch(`${supabaseUrl}/rest/v1/paid_reports`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      email,
      property_id: propertyId,
      address,
      stripe_session_id: sessionId,
      amount_paid_aud: amountPaid / 100,
      access_token: accessToken,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    }),
  });

  // 3. Send confirmation email with report link
  await sendConfirmationEmail({ email, address, accessToken, propertyId });

  console.log(`✅ Paid report stored: ${email} → ${address} (token: ${accessToken.slice(0, 8)}...)`);
}

// ─── EMAIL DELIVERY ───
async function sendConfirmationEmail({ email, address, accessToken, propertyId }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('RESEND_API_KEY not set — skipping confirmation email');
    return;
  }

  const reportUrl = `${process.env.BASE_URL}/brief?token=${accessToken}&property=${encodeURIComponent(propertyId)}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="background:#0d1b2a; margin:0; padding:0; font-family: Georgia, serif;">
      <div style="max-width:560px; margin:0 auto; padding:40px 32px;">
        <div style="color:#d4860a; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:20px; font-family: monospace;">
          BuyerSide — Buyer's Brief
        </div>
        <div style="color:#f5f0e8; font-size:24px; letter-spacing:-0.02em; margin-bottom:12px;">
          Your report is ready.
        </div>
        <div style="color:#8da0b3; font-size:15px; line-height:1.65; margin-bottom:28px;">
          Your Buyer's Brief for <strong style="color:#f5f0e8">${address}</strong> has been generated. 
          It includes your offer recommendation, negotiating leverage, flood risk analysis, 
          suburb outlook, and everything the agent won't tell you.
        </div>
        <a href="${reportUrl}" 
           style="display:inline-block; background:#d4860a; color:#0d1b2a; font-weight:700; font-size:15px; 
                  padding:14px 28px; text-decoration:none; border-radius:3px; letter-spacing:0.01em;">
          View Your Buyer's Brief →
        </a>
        <div style="color:#4a6278; font-size:11px; margin-top:28px; line-height:1.6;">
          This link is valid for 30 days. This report is for your use only.<br>
          BuyerSide is independent — we have no relationship with the selling agent.
        </div>
        <div style="border-top:1px solid rgba(213,190,150,0.12); margin-top:32px; padding-top:20px;">
          <div style="color:#4a6278; font-size:11px; line-height:1.65;">
            This report is market research and analysis, not a formal property valuation. 
            Always obtain independent legal and financial advice before purchasing property.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BuyerSide <reports@buyerside.com.au>',
      to: [email],
      subject: `Your Buyer's Brief — ${address}`,
      html,
    }),
  });
}

// ─── UTILS ───
function generateAccessToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
