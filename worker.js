// worker.js - Production-Ready Cloudflare Worker Proxy to Finnhub
const ALLOWED_ORIGIN = 'https://yourcompany.github.io';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Allow preflight CORS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Enforce origin validation in production (optional, can be expanded)
  const origin = request.headers.get('Origin');
  
  // Extract query parameters
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  const resolution = url.searchParams.get('resolution');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let apiUrl = '';
  if (url.pathname.includes('/quote')) {
    if (!symbol || !/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
      return new Response('Invalid ticker symbol', { status: 400 });
    }
    apiUrl = `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  } else if (url.pathname.includes('/stock/candle')) {
    if (!symbol || !resolution || !from || !to) {
      return new Response('Missing historical query parameters', { status: 400 });
    }
    apiUrl = `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
  } else {
    return new Response('Not Found', { status: 404 });
  }

  try {
    // Simple fetch forward with Finnhub token injected
    const response = await fetch(apiUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'public, max-age=300' // 5-minute cache
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Backend API failed to connect' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
