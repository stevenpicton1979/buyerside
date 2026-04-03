import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { propertyData } = req.body;

  if (!propertyData) {
    return res.status(400).json({ error: 'propertyData is required' });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `Analyse this property in 3 sentences: ${JSON.stringify(propertyData)}` }],
    }),
  });

  const data = await response.json();
  return res.status(200).json({ text: data.content?.[0]?.text });
}