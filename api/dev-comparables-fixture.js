'use strict';
// ============================================================
// ClearOffer — Dev comparable sales fixture
// ============================================================
// PURPOSE: Development and tuning only. Replace with real
// PropTechData /market-activity/sales when confirmed.
//
// DATA SOURCE: Suburb medians from propertyvalue.com.au /
// CoreLogic / YIP (April 2026). Individual sale figures are
// illustrative — derived from median ±10–15% with realistic
// bed/bath/land combos for each suburb. Do NOT use in
// production. Flag: _fixture: true on every record.
//
// TO USE: In api/buyers-brief.js, replace getPropTechStub()
// with getDevFixture(address) during local dev.
// Remove entirely before production launch.
// ============================================================

const SUBURB_FIXTURES = {

  chelmer: {
    suburb: 'Chelmer',
    postcode: '4068',
    suburbMedian: 1820000,
    dom: 35,
    growth12m: 0.152,
    comparables: [
      { address: '15 Crawford Rd, Chelmer QLD 4068', soldPrice: 1760000, soldDate: '2024-07-15', beds: 4, baths: 2, landSqm: 810 },
      { address: '42 Honour Ave, Chelmer QLD 4068',  soldPrice: 1920000, soldDate: '2024-09-03', beds: 4, baths: 2, landSqm: 920 },
      { address: '8 Laurel Ave, Chelmer QLD 4068',   soldPrice: 2150000, soldDate: '2024-11-21', beds: 5, baths: 3, landSqm: 1100 },
    ],
    avm: { estimate: 1820000, low: 1640000, high: 2000000, confidence: 0.74 },
  },

  carindale: {
    suburb: 'Carindale',
    postcode: '4152',
    suburbMedian: 1700000,
    dom: 26,
    growth12m: 0.087,
    comparables: [
      { address: '14 Glenheaton Ct, Carindale QLD 4152', soldPrice: 1650000, soldDate: '2024-08-10', beds: 4, baths: 2, landSqm: 750 },
      { address: '31 Cricklewood St, Carindale QLD 4152', soldPrice: 1720000, soldDate: '2024-10-05', beds: 4, baths: 2, landSqm: 800 },
      { address: '9 Banksia Pl, Carindale QLD 4152',     soldPrice: 1880000, soldDate: '2025-01-14', beds: 5, baths: 3, landSqm: 900 },
    ],
    avm: { estimate: 1700000, low: 1530000, high: 1870000, confidence: 0.71 },
  },

  hamilton: {
    suburb: 'Hamilton',
    postcode: '4007',
    suburbMedian: 2200000,
    dom: 28,
    growth12m: 0.118,
    comparables: [
      { address: '22 Riverview Tce, Hamilton QLD 4007',  soldPrice: 2050000, soldDate: '2024-08-22', beds: 4, baths: 2, landSqm: 680 },
      { address: '7 Koolatah St, Hamilton QLD 4007',     soldPrice: 2280000, soldDate: '2024-10-17', beds: 4, baths: 3, landSqm: 740 },
      { address: '55 Racecourse Rd, Hamilton QLD 4007',  soldPrice: 2490000, soldDate: '2025-02-03', beds: 5, baths: 3, landSqm: 850 },
    ],
    avm: { estimate: 2200000, low: 1980000, high: 2420000, confidence: 0.72 },
  },

  paddington: {
    suburb: 'Paddington',
    postcode: '4064',
    suburbMedian: 2100000,
    dom: 32,
    growth12m: 0.062,
    comparables: [
      { address: '18 Latrobe Tce, Paddington QLD 4064',  soldPrice: 1950000, soldDate: '2024-07-30', beds: 3, baths: 2, landSqm: 405 },
      { address: '6 Fernberg Rd, Paddington QLD 4064',   soldPrice: 2180000, soldDate: '2024-11-08', beds: 4, baths: 2, landSqm: 510 },
      { address: '43 Waterworks Rd, Paddington QLD 4064',soldPrice: 2350000, soldDate: '2025-01-25', beds: 4, baths: 3, landSqm: 600 },
    ],
    avm: { estimate: 2100000, low: 1890000, high: 2310000, confidence: 0.73 },
  },

  bulimba: {
    suburb: 'Bulimba',
    postcode: '4171',
    suburbMedian: 2100000,
    dom: 29,
    growth12m: 0.098,
    comparables: [
      { address: '12 Oxford St, Bulimba QLD 4171',       soldPrice: 1980000, soldDate: '2024-09-12', beds: 4, baths: 2, landSqm: 500 },
      { address: '28 Riverview Tce, Bulimba QLD 4171',   soldPrice: 2150000, soldDate: '2024-11-30', beds: 4, baths: 3, landSqm: 580 },
      { address: '5 Quay St, Bulimba QLD 4171',          soldPrice: 2420000, soldDate: '2025-02-14', beds: 5, baths: 3, landSqm: 650 },
    ],
    avm: { estimate: 2100000, low: 1890000, high: 2310000, confidence: 0.73 },
  },

  hawthorne: {
    suburb: 'Hawthorne',
    postcode: '4171',
    suburbMedian: 1950000,
    dom: 27,
    growth12m: 0.092,
    comparables: [
      { address: '14 Hawthorne Rd, Hawthorne QLD 4171',  soldPrice: 1820000, soldDate: '2024-08-05', beds: 3, baths: 2, landSqm: 480 },
      { address: '33 Riding Rd, Hawthorne QLD 4171',     soldPrice: 1980000, soldDate: '2024-10-22', beds: 4, baths: 2, landSqm: 550 },
      { address: '7 Clare St, Hawthorne QLD 4171',       soldPrice: 2180000, soldDate: '2025-01-09', beds: 4, baths: 3, landSqm: 620 },
    ],
    avm: { estimate: 1950000, low: 1755000, high: 2145000, confidence: 0.74 },
  },

  ascot: {
    suburb: 'Ascot',
    postcode: '4007',
    suburbMedian: 2550000,
    dom: 31,
    growth12m: 0.133,
    comparables: [
      { address: '9 Oriel Rd, Ascot QLD 4007',           soldPrice: 2350000, soldDate: '2024-07-18', beds: 4, baths: 2, landSqm: 600 },
      { address: '41 Racecourse Rd, Ascot QLD 4007',     soldPrice: 2650000, soldDate: '2024-10-03', beds: 4, baths: 3, landSqm: 720 },
      { address: '17 Lancaster Rd, Ascot QLD 4007',      soldPrice: 2980000, soldDate: '2025-02-20', beds: 5, baths: 3, landSqm: 810 },
    ],
    avm: { estimate: 2550000, low: 2295000, high: 2805000, confidence: 0.71 },
  },

  indooroopilly: {
    suburb: 'Indooroopilly',
    postcode: '4068',
    suburbMedian: 1650000,
    dom: 33,
    growth12m: 0.095,
    comparables: [
      { address: '22 Station Rd, Indooroopilly QLD 4068',  soldPrice: 1530000, soldDate: '2024-08-28', beds: 4, baths: 2, landSqm: 560 },
      { address: '8 Riverview Tce, Indooroopilly QLD 4068',soldPrice: 1680000, soldDate: '2024-11-14', beds: 4, baths: 2, landSqm: 640 },
      { address: '15 Witton Rd, Indooroopilly QLD 4068',   soldPrice: 1850000, soldDate: '2025-01-31', beds: 5, baths: 3, landSqm: 750 },
    ],
    avm: { estimate: 1650000, low: 1485000, high: 1815000, confidence: 0.75 },
  },

  'fig tree pocket': {
    suburb: 'Fig Tree Pocket',
    postcode: '4069',
    suburbMedian: 1900000,
    dom: 38,
    growth12m: 0.088,
    comparables: [
      { address: '5 Cubberla St, Fig Tree Pocket QLD 4069',  soldPrice: 1750000, soldDate: '2024-09-06', beds: 4, baths: 2, landSqm: 800 },
      { address: '18 Simpsons Rd, Fig Tree Pocket QLD 4069', soldPrice: 1940000, soldDate: '2024-11-25', beds: 4, baths: 3, landSqm: 950 },
      { address: '3 Outlook Dr, Fig Tree Pocket QLD 4069',   soldPrice: 2150000, soldDate: '2025-02-08', beds: 5, baths: 3, landSqm: 1100 },
    ],
    avm: { estimate: 1900000, low: 1710000, high: 2090000, confidence: 0.70 },
  },

  graceville: {
    suburb: 'Graceville',
    postcode: '4075',
    suburbMedian: 1550000,
    dom: 30,
    growth12m: 0.102,
    comparables: [
      { address: '7 Laurel Ave, Graceville QLD 4075',    soldPrice: 1430000, soldDate: '2024-08-14', beds: 3, baths: 2, landSqm: 510 },
      { address: '24 Kadumba St, Graceville QLD 4075',   soldPrice: 1580000, soldDate: '2024-10-29', beds: 4, baths: 2, landSqm: 600 },
      { address: '11 Towers St, Graceville QLD 4075',    soldPrice: 1720000, soldDate: '2025-01-17', beds: 4, baths: 2, landSqm: 680 },
    ],
    avm: { estimate: 1550000, low: 1395000, high: 1705000, confidence: 0.76 },
  },

};

// ============================================================
// Lookup function — matches suburb name from address string
// ============================================================
function getDevFixture(address) {
  if (!address) return null;
  const lower = address.toLowerCase();

  for (const [key, data] of Object.entries(SUBURB_FIXTURES)) {
    if (lower.includes(key)) {
      return {
        _fixture: true,   // dev only — never _stub: true so prompt treats as real
        avm: { ...data.avm, method: 'dev_fixture' },
        comparables: data.comparables,
        suburbMedian: data.suburbMedian,
        suburbTimeseries: null,   // not needed for dev tuning
      };
    }
  }

  // No match — return null so Brief falls back to web search + honesty statement
  return null;
}

module.exports = { getDevFixture, SUBURB_FIXTURES };
