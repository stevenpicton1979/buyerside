/* ============================================================
   /api/notify
   POST { email }
   Saves email to Supabase table: clearoffer_notify
   ============================================================ */

async function parseBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body  = await parseBody(req);
  const email = (body.email || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[notify] Missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/clearoffer_notify`, {
      method: 'POST',
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify({ email })
    });

    // 409 Conflict = duplicate email — treat as success
    if (!dbRes.ok && dbRes.status !== 409) {
      const text = await dbRes.text();
      console.error('[notify] Supabase error:', dbRes.status, text);
      return res.status(500).json({ error: 'Failed to save. Please try again.' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[notify] error:', err.message);
    return res.status(500).json({ error: 'Failed to save. Please try again.' });
  }
};
