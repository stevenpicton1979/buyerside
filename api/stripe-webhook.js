'use strict';
// ============================================================
// ClearOffer — Stripe webhook handler
// ============================================================
// bodyParser MUST be disabled — Stripe signature verification
// requires the raw request body.
// Vercel reads module.exports.config to disable bodyParser.
// ============================================================

const { supabaseFetch } = require('./config');
const Stripe = require('stripe');

// Disable Vercel's automatic body parsing for this route
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Read raw body for Stripe signature verification
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[stripe-webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email   = session.metadata?.email || session.customer_email;
    const address = session.metadata?.address;

    if (email && address) {
      try {
        await supabaseFetch(
          `/scout_reports?email=eq.${encodeURIComponent(email)}&address=eq.${encodeURIComponent(address)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ converted_to_paid: true }),
            headers: { 'Prefer': 'return=minimal' },
          }
        );
        console.log(`[stripe-webhook] marked converted_to_paid for ${email} / ${address}`);
      } catch (err) {
        // Log but return 200 — Stripe will retry on non-200, don't create duplicate emails
        console.error('[stripe-webhook] Supabase update error:', err.message);
      }
    }
  }

  return res.status(200).json({ received: true });
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
