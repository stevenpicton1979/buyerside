'use strict';
// ============================================================
// ClearOffer — Stripe checkout session creation
// ============================================================
// Creates a $149 AUD Stripe checkout session.
// On success, Stripe redirects to /success.html
// Webhook (stripe-webhook.js) marks converted_to_paid in DB.
// ============================================================

const { handleCors, PRODUCT, PRICING } = require('./config');
const Stripe = require('stripe');

// Resolve BASE_URL explicitly here — never fall back to VERCEL_URL
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

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

  if (!email || !address) {
    return res.status(400).json({ error: 'email and address are required' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'aud',
            unit_amount: PRICING.BUYERS_BRIEF_AUD * 100, // cents
            product_data: {
              name: `${PRODUCT.NAME} — ${PRICING.BUYERS_BRIEF_LABEL}`,
              description: address,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        email,
        address,
        product: 'buyers_brief',
      },
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&address=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}`,
      cancel_url: `${BASE_URL}/report.html?address=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}&cancelled=1`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout] Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
