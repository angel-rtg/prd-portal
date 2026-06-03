// Vercel Edge Function — proxies requests to Anthropic API
// API key lives here server-side; never exposed to the browser
export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY environment variable is not set in Vercel.' } }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid JSON in request body.' } }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model:      body.model      || 'claude-sonnet-4-5-20251001',
      max_tokens: body.max_tokens || 8192,
      stream:     true,
      system:     body.system     || '',
      messages:   body.messages   || [],
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
