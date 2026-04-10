'use strict';
// Fetch ICSEA scores from ACARA and write to data/icsea-scores.json
// Run with: node scripts/fetch-icsea.js
// Re-run annually when new ICSEA data is published

const fs = require('fs');
const path = require('path');

// ACARA publishes school data including ICSEA via their open data
// The My School website API: https://www.myschool.edu.au
// Public school profile search returns ICSEA
async function fetchICSEA(schoolName, state = 'QLD') {
  const query = encodeURIComponent(schoolName);
  const url = `https://www.myschool.edu.au/api/school/search?query=${query}&state=${state}`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'ClearOffer/1.0' }
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const school = data.schools?.[0];
  return school ? { icsea: school.icsea, acaNo: school.acaNo, name: school.name } : null;
}

// Queensland schools in our catchment dataset
// Expand this list as more suburbs are added
const QLD_SCHOOLS = [
  // Carindale area
  'Belmont State School',
  'Whites Hill State College',
  // Chelmer area
  'Graceville State School',
  'Sherwood State School',
  // Hamilton / Ascot
  'Ascot State School',
  'Hamilton State School',
  'Aviation High',
  // Paddington
  'Petrie Terrace State School',
  'Kelvin Grove State College',
  // Bulimba / Hawthorne
  'Bulimba State School',
  'Balmoral State High School',
  // Indooroopilly
  'Indooroopilly State School',
  'Indooroopilly State High School',
  'Fig Tree Pocket State School',
  // More inner Brisbane
  'Ithaca Creek State School',
  'Bardon State School',
  'Rainworth State School',
  'Chapel Hill State School',
];

async function run() {
  const scores = {};
  for (const name of QLD_SCHOOLS) {
    try {
      const result = await fetchICSEA(name);
      if (result?.icsea) {
        scores[name.toLowerCase()] = result.icsea;
        console.log(`${name}: ICSEA ${result.icsea}`);
      } else {
        console.log(`${name}: not found`);
      }
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn(`${name}: error — ${e.message}`);
    }
  }

  const outPath = path.join(__dirname, '../data/icsea-scores.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(scores, null, 2));
  console.log(`\nWrote ${Object.keys(scores).length} schools to ${outPath}`);
}

run();
