import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const domainKey = process.env.DOMAIN_API_KEY;

  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return res.status(204).set(corsHeaders).end();
  }

  try {
    switch (action) {
      case 'suggest': {
        const query = url.searchParams.get('q');
        if (!query || query.length < 3) {
          return res.status(200).json([]);
        }

        // Use mock data in development or if no Domain API key
        if (!domainKey || process.env.NODE_ENV === 'development') {
          return res.status(200).json(getMockSuggestions(query));
        }

        const data = await fetchDomainSuggest(query, domainKey);
        return res.status(200).json(data);
      }

      case 'listing': {
        const propertyId = url.searchParams.get('id');
        if (!propertyId) {
          return res.status(400).json({ error: 'Property ID required' });
        }

        if (!domainKey || process.env.NODE_ENV === 'development') {
          return res.status(200).json(getMockListing(propertyId));
        }

        const data = await fetchDomainListing(propertyId, domainKey);
        return res.status(200).json(data);
      }

      default:
        return res.status(400).json({ error: 'Invalid action. Use: suggest, listing' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── DOMAIN API HELPERS ───

async function fetchDomainSuggest(query, apiKey) {
  const res = await fetch(
    `https://api.domain.com.au/v1/properties/_suggest?terms=${encodeURIComponent(query)}&channel=All&addressParts=true`,
    {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    }
  );

  if (!res.ok) throw new Error(`Domain API suggest failed: ${res.status}`);

  const data = await res.json();
  return data
    .filter(item => item.addressComponents?.stateTerritory === 'QLD')
    .slice(0, 6)
    .map(item => ({
      id: item.id,
      address: item.address,
      suburb: item.addressComponents?.suburb,
      state: item.addressComponents?.stateTerritory,
      postcode: item.addressComponents?.postcode,
    }));
}

async function fetchDomainListing(propertyId, apiKey) {
  const res = await fetch(
    `https://api.domain.com.au/v1/properties/${propertyId}`,
    {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    }
  );

  if (!res.ok) throw new Error(`Domain API listing failed: ${res.status}`);

  const data = await res.json();
  return {
    propertyId: data.id,
    address: data.address?.displayAddress,
    suburb: data.address?.suburb,
    state: data.address?.state,
    postcode: data.address?.postcode,
    listing: {
      price: data.priceDetails?.displayPrice,
      priceFrom: data.priceDetails?.from,
      priceTo: data.priceDetails?.to,
      daysOnMarket: calculateDOM(data.dateListed),
      dateListed: data.dateListed,
    },
    property: {
      beds: data.bedrooms,
      baths: data.bathrooms,
      cars: data.carspaces,
      landArea: data.landArea,
      propertyType: data.propertyTypes?.[0],
    },
    agent: {
      name: data.listingAgent?.[0]?.name,
      agency: data.advertiserIdentifiers?.name,
      agentId: data.listingAgent?.[0]?.id,
    },
    media: {
      mainPhoto: data.media?.find(m => m.category === 'Image')?.url,
    },
  };
}

// ─── MOCK DATA ───

function getMockSuggestions(query) {
  const suggestions = [
    { id: 'prop-chelmer-001', address: '14 Riverview Tce, Chelmer QLD 4068', suburb: 'Chelmer', state: 'QLD', postcode: '4068' },
    { id: 'prop-chelmer-002', address: '9 Oxley Rd, Chelmer QLD 4068', suburb: 'Chelmer', state: 'QLD', postcode: '4068' },
    { id: 'prop-graceville-001', address: '12 Cheltenham St, Graceville QLD 4075', suburb: 'Graceville', state: 'QLD', postcode: '4075' },
    { id: 'prop-indooroopilly-001', address: '5 Highgate St, Indooroopilly QLD 4068', suburb: 'Indooroopilly', state: 'QLD', postcode: '4068' },
    { id: 'prop-taringa-001', address: '8 Panorama St, Taringa QLD 4068', suburb: 'Taringa', state: 'QLD', postcode: '4068' },
  ];
  return suggestions.filter(s =>
    s.address.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);
}

function getMockListing(propertyId) {
  return {
    propertyId,
    address: '14 Riverview Tce',
    suburb: 'Chelmer',
    state: 'QLD',
    postcode: '4068',
    listing: {
      price: '$1,750,000',
      priceFrom: 1750000,
      priceTo: 1750000,
      daysOnMarket: 23,
      dateListed: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),
    },
    property: {
      beds: 4,
      baths: 2,
      cars: 2,
      landArea: 607,
      propertyType: 'House',
    },
    agent: {
      name: 'Marcus Webb',
      agency: 'Ray White Indooroopilly',
      agentId: 'agent-webb-001',
    },
    media: {
      mainPhoto: null,
    },
  };
}

function calculateDOM(dateListed) {
  if (!dateListed) return null;
  const listed = new Date(dateListed);
  const now = new Date();
  return Math.floor((now - listed) / (1000 * 60 * 60 * 24));
}