export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/nominatim', '');
  
  const targetUrl = `https://nominatim.openstreetmap.org${path}${url.search}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'LUMINA-ConstructionDashboard/1.0 (billykeesee@example.com)',
        'Accept': 'application/json',
      },
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
