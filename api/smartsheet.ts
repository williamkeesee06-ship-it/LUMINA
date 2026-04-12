export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/smartsheet', '');
  
  const targetUrl = `https://api.smartsheet.com${path}${url.search}`;
  
  const headers = new Headers(req.headers);
  headers.set('Host', 'api.smartsheet.com');
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' ? await req.blob() : undefined,
    });

    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
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
