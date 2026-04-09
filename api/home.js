'use strict';
// ============================================================
// ClearOffer — Root route handler
// ============================================================
// COMING_SOON=true  → serves /public/coming-soon.html
// COMING_SOON=false → serves /public/index.html  (default)
//
// To launch: set COMING_SOON=false in Vercel dashboard.
// No code change required.
// ============================================================

const fs   = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  const comingSoon = process.env.COMING_SOON === 'true';
  const file = comingSoon ? 'coming-soon.html' : 'index.html';
  // Vercel serverless: process.cwd() is the project root, __dirname is not reliable
  const filePath = path.join(process.cwd(), 'public', file);

  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[home] could not read', file, err.message);
    return res.status(500).send('Internal error');
  }
};
