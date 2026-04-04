import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, propertyId, address } = req.body;

  if (!email || !propertyId || !address) {
    return res.status(400).json({ error: 'email, propertyId, and address required' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const params = new URLSearchParams({
    'mode': 'payment',
    'payment_method_types[]': 'card',
    'customer_email': email,
    'line_items[0][price_data][currency]': 'aud',
    'line_items[0][price_data][unit_amount]': '14900',
    'line_items[0][price_data][product_data][name]': "ClearOffer Buyer's Brief",
    'line_items[0][price_data][product_data][description]': `Independent property analysis: ${address}`,
    'line_items[0][quantity]': '1',
    'success_url': `${process.env.BASE_URL}/buyers-brief.html?session_id={CHECKOUT_SESSION_ID}&property=${encodeURIComponent(propertyId)}`,
    'cancel_url': `${process.env.BASE_URL}/scout-report.html?property=${encodeURIComponent(propertyId)}`,
    'metadata[property_id]': propertyId,
    'metadata[address]': address,
    'metadata[email]': email,
  });

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return res.status(400).json({ error: session.error?.message || 'Stripe error' });
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}