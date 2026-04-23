/// <reference types="node" />
import type { Coordinates } from '../src/types/lumina.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get('address');
  
  // SECURE: Key is read from environment variable on server, never exposed to client
  // @ts-ignore - process.env is provided by Vercel in Edge runtime
  const API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;


  if (!address) {
    return new Response(JSON.stringify({ error: 'Address required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration missing: API Key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const targetUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const response = await fetch(targetUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
