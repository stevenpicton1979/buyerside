import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, propertyId, address } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!propertyId || !address) {
    return res.status(400).json({ error: 'propertyId and address required' });
  }

  // TODO: Add Supabase storage and PropTechData API call here
  // For now, return mock Stage 2 data
  return res.status(200).json({
    success: true,
    isReturning: false,
    data: {
      estimate: { low: 1620000, mid: 1680000, high: 1740000, confidence: 'medium_high' },
    }
  });
}