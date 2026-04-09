#!/usr/bin/env node
'use strict';
// ============================================================
// ClearOffer — Smoke tests
// Run: node scripts/smoke-test.js
// Requires: vercel dev --listen 3001 running in another terminal
// ============================================================

const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
const TEST_ADDRESS = '14 Riverview Tce, Chelmer QLD 4068';
const TEST_EMAIL   = `smoke+${Date.now()}@clearoffer-test.com`;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} … `);
  try {
    await fn();
    console.log('✓');
    passed++;
  } catch (err) {
    console.log(`✗  ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function get(path) {
  const resp = await fetch(`${BASE}${path}`);
  return { resp, json: resp.headers.get('content-type')?.includes('json') ? await resp.json() : null };
}

async function post(path, body) {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = resp.headers.get('content-type')?.includes('json') ? await resp.json() : null;
  return { resp, json };
}

async function run() {
  console.log(`\nClearOffer smoke tests → ${BASE}\n`);

  // ---- Static pages ----
  await test('GET / returns 200 with HTML content-type', async () => {
    const { resp } = await get('/');
    assert(resp.ok, `HTTP ${resp.status}`);
    const ct = resp.headers.get('content-type') || '';
    assert(ct.includes('text/html'), `Expected text/html, got ${ct}`);
  });

  await test('GET /report.html returns 200', async () => {
    const { resp } = await get('/report.html');
    assert(resp.ok, `HTTP ${resp.status}`);
  });

  await test('GET /buyers-brief.html returns 200', async () => {
    const { resp } = await get('/buyers-brief.html');
    assert(resp.ok, `HTTP ${resp.status}`);
  });

  await test('GET /success.html returns 200', async () => {
    const { resp } = await get('/success.html');
    assert(resp.ok, `HTTP ${resp.status}`);
  });

  await test('GET /coming-soon.html returns 200', async () => {
    const { resp } = await get('/coming-soon.html');
    assert(resp.ok, `HTTP ${resp.status}`);
  });

  // ---- Autocomplete ----
  await test('GET /api/autocomplete?q=Chelmer returns suggestions array', async () => {
    const { resp, json } = await get('/api/autocomplete?q=Chelmer');
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(Array.isArray(json?.suggestions), 'No suggestions array');
  });

  await test('GET /api/autocomplete?q=ab (too short) returns empty array', async () => {
    const { resp, json } = await get('/api/autocomplete?q=ab');
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(Array.isArray(json?.suggestions), 'No suggestions array');
    assert(json.suggestions.length === 0, 'Expected empty array for short query');
  });

  // ---- Suburb stats ----
  await test('GET /api/suburb-stats?address=... returns median+dom+suburb', async () => {
    const { resp, json } = await get(`/api/suburb-stats?address=${encodeURIComponent(TEST_ADDRESS)}`);
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(json?.median > 0, `Expected positive median, got ${json?.median}`);
    assert(json?.dom > 0, `Expected positive DOM, got ${json?.dom}`);
    assert(json?.suburb, `Expected suburb name, got ${json?.suburb}`);
    assert(['static','cache'].includes(json?.source), `Expected static or cache source, got ${json?.source}`);
  });

  await test('GET /api/suburb-stats?suburb=Chelmer returns stats', async () => {
    const { resp, json } = await get('/api/suburb-stats?suburb=Chelmer');
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(json?.median > 0, 'Expected positive median');
    assert(json?.clearanceRate > 0, 'Expected clearance rate');
  });

  await test('GET /api/suburb-stats for unknown suburb returns source=none gracefully', async () => {
    const { resp, json } = await get('/api/suburb-stats?suburb=NotARealSuburb99');
    assert(resp.ok, `HTTP ${resp.status} — should never 500 on unknown suburb`);
    assert(json?.source === 'none', `Expected source=none, got ${json?.source}`);
    assert(json?.median === null, 'Expected null median for unknown suburb');
  });

  // ---- Zone lookup ----
  await test('GET /api/zone-lookup?address=... returns all 6 overlay keys', async () => {
    const { resp, json } = await get(`/api/zone-lookup?address=${encodeURIComponent(TEST_ADDRESS)}`);
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(json?.overlays, 'No overlays object');
    const required = ['flood','bushfire','heritage','character','noise','schools'];
    for (const key of required) {
      assert(key in json.overlays, `Missing overlay key: ${key}`);
    }
    // flood must have 'affected' boolean
    assert(typeof json.overlays.flood?.affected === 'boolean', 'flood.affected must be boolean');
    // schools must have 'found' boolean
    assert(typeof json.overlays.schools?.found === 'boolean', 'schools.found must be boolean');
  });

  await test('GET /api/zone-lookup missing address returns 400', async () => {
    const { resp } = await get('/api/zone-lookup');
    assert(resp.status === 400, `Expected 400, got ${resp.status}`);
  });

  // ---- Verdict ----
  await test('POST /api/verdict returns a verdict string', async () => {
    const { resp, json } = await post('/api/verdict', {
      address: TEST_ADDRESS,
      listingPrice: 1350000,
      daysOnMarket: 41,
    });
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(typeof json?.verdict === 'string', 'No verdict string');
    assert(json.verdict.length > 10, 'Verdict too short');
    console.log(`\n     → "${json.verdict}"`);
  });

  await test('POST /api/verdict missing address returns 400', async () => {
    const { resp } = await post('/api/verdict', { listingPrice: 1000000 });
    assert(resp.status === 400, `Expected 400, got ${resp.status}`);
  });

  // ---- Email submit ----
  await test('POST /api/submit-email saves and returns ok', async () => {
    const { resp, json } = await post('/api/submit-email', {
      email: TEST_EMAIL,
      address: TEST_ADDRESS,
    });
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(json?.status === 'ok', `Expected status=ok, got: ${JSON.stringify(json)}`);
  });

  await test('POST /api/submit-email same email returns already_used', async () => {
    const { resp, json } = await post('/api/submit-email', {
      email: TEST_EMAIL,
      address: TEST_ADDRESS,
    });
    assert(resp.ok, `HTTP ${resp.status}`);
    assert(json?.status === 'already_used', `Expected already_used, got: ${JSON.stringify(json)}`);
  });

  await test('POST /api/submit-email invalid email returns 400', async () => {
    const { resp } = await post('/api/submit-email', {
      email: 'not-an-email',
      address: TEST_ADDRESS,
    });
    assert(resp.status === 400, `Expected 400, got ${resp.status}`);
  });

  // ---- Summary ----
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`  ${passed} passed  ${failed} failed`);
  if (failed > 0) {
    console.log(`\n  ⚠  Fix failures before pushing to Vercel.\n`);
    process.exit(1);
  } else {
    console.log(`\n  ✓  All tests passed. Safe to deploy.\n`);
  }
}

run().catch(err => {
  console.error('Smoke test runner error:', err);
  process.exit(1);
});
