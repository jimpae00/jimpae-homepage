export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    if (url.pathname !== '/leaderboard.json') {
      return cors(new Response('Not found', { status: 404 }));
    }

    const body = await env.JIMPAE_LEADERBOARD.get('leaderboard.json');
    if (!body) {
      return cors(new Response(JSON.stringify({ error: 'leaderboard not uploaded yet' }), {
        status: 503,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }));
    }

    return cors(new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, stale-while-revalidate=240',
      },
    }));
  },
};

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
