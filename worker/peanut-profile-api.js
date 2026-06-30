const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const OAUTH_SCOPES = '';
const ALLOWED_ORIGINS = new Set([
  'https://jimpae.info',
  'https://www.jimpae.info',
  'https://jimpae-homepage.pages.dev',
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), request);

    try {
      if (url.pathname === '/health') {
        return json({ ok: true, service: 'peanut-profile-api' });
      }

      if (url.pathname === '/admin/sync' && request.method === 'POST') {
        return await adminSync(request, env);
      }

      if (url.pathname === '/profile/twitch/login' && request.method === 'GET') {
        return twitchLogin(url, env);
      }

      if (url.pathname === '/profile/twitch/callback' && request.method === 'GET') {
        return await twitchCallback(request, url, env);
      }

      if (url.pathname === '/profile/me' && request.method === 'GET') {
        return await profileMe(request, env);
      }

      if (url.pathname === '/profile/logout' && request.method === 'POST') {
        return cors(new Response(JSON.stringify({ ok: true }), {
          headers: {
            ...JSON_HEADERS,
            'set-cookie': sessionCookie('', 0),
          },
        }), request);
      }

      return json({ ok: false, error: 'not found' }, 404);
    } catch (err) {
      return json({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
    }
  },
};

async function adminSync(request, env) {
  const expected = env.PEANUT_SYNC_SECRET;
  if (!expected) return json({ ok: false, error: 'server missing PEANUT_SYNC_SECRET' }, 500);
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== expected) return json({ ok: false, error: 'unauthorized' }, 401);

  const payload = await request.json();
  const viewers = Array.isArray(payload.viewers) ? payload.viewers : [];
  const ownerships = Array.isArray(payload.ownerships) ? payload.ownerships : [];
  const syncedAt = payload.synced_at || new Date().toISOString();

  await env.DB.prepare('DELETE FROM peanut_ownerships').run();
  await env.DB.prepare('DELETE FROM viewer_profiles').run();

  for (const v of viewers) {
    if (!v.twitch_user_id) continue;
    await env.DB.prepare(`
      INSERT INTO viewer_profiles
      (twitch_user_id, twitch_login, twitch_display_name, youtube_handle, discord_linked, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      String(v.twitch_user_id),
      v.twitch_login || null,
      v.twitch_display_name || null,
      v.youtube_handle || null,
      v.discord_linked ? 1 : 0,
      syncedAt,
    ).run();
  }

  for (const o of ownerships) {
    if (!o.twitch_user_id || !o.season_number) continue;
    await env.DB.prepare(`
      INSERT OR REPLACE INTO peanut_ownerships
      (twitch_user_id, season_number, source_platform, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      String(o.twitch_user_id),
      Number(o.season_number),
      o.source_platform || null,
      o.created_at || null,
    ).run();
  }

  return json({ ok: true, viewers: viewers.length, ownerships: ownerships.length, synced_at: syncedAt });
}

function twitchLogin(url, env) {
  requireEnv(env, ['TWITCH_CLIENT_ID', 'TWITCH_REDIRECT_URI', 'COOKIE_SECRET']);
  const state = randomHex(16);
  const auth = new URL('https://id.twitch.tv/oauth2/authorize');
  auth.searchParams.set('client_id', env.TWITCH_CLIENT_ID);
  auth.searchParams.set('redirect_uri', env.TWITCH_REDIRECT_URI);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', OAUTH_SCOPES);
  auth.searchParams.set('state', state);
  const returnTo = url.searchParams.get('return_to') || '/profile';
  const cookieValue = btoa(JSON.stringify({ state, return_to: returnTo })).replace(/=+$/, '');
  return new Response(null, {
    status: 302,
    headers: {
      location: auth.toString(),
      'set-cookie': `peanut_oauth=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`,
    },
  });
}

async function twitchCallback(request, url, env) {
  requireEnv(env, ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_REDIRECT_URI', 'COOKIE_SECRET']);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return json({ ok: false, error: 'missing code/state' }, 400);

  const oauth = readCookie(request, 'peanut_oauth');
  const oauthState = oauth ? JSON.parse(atob(padBase64(oauth))) : null;
  if (!oauthState || oauthState.state !== state) return json({ ok: false, error: 'invalid state' }, 400);

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.TWITCH_REDIRECT_URI,
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text);
      detail = parsed.message || parsed.error || detail;
    } catch (_) {}
    return json({ ok: false, error: `twitch token failed ${tokenRes.status}`, detail }, 502);
  }
  const token = await tokenRes.json();

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'client-id': env.TWITCH_CLIENT_ID,
      authorization: `Bearer ${token.access_token}`,
    },
  });
  if (!userRes.ok) return json({ ok: false, error: `twitch user failed ${userRes.status}` }, 502);
  const userJson = await userRes.json();
  const user = userJson.data && userJson.data[0];
  if (!user) return json({ ok: false, error: 'twitch user not found' }, 502);

  const session = await signSession({ twitch_user_id: String(user.id), twitch_login: user.login, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }, env.COOKIE_SECRET);
  return new Response(null, {
    status: 302,
    headers: {
      location: oauthState.return_to || '/profile',
      'set-cookie': [
        sessionCookie(session, 60 * 60 * 24 * 30),
        'peanut_oauth=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
      ].join(', '),
    },
  });
}

async function profileMe(request, env) {
  const sessionCookieValue = readCookie(request, 'peanut_session');
  if (!sessionCookieValue) return json({ ok: false, error: 'not logged in' }, 401);
  const session = await verifySession(sessionCookieValue, env.COOKIE_SECRET);
  if (!session) return json({ ok: false, error: 'invalid session' }, 401);

  const profile = await env.DB.prepare('SELECT * FROM viewer_profiles WHERE twitch_user_id=?')
    .bind(session.twitch_user_id).first();
  const ownerships = await env.DB.prepare('SELECT season_number, source_platform, created_at FROM peanut_ownerships WHERE twitch_user_id=? ORDER BY season_number DESC')
    .bind(session.twitch_user_id).all();

  return json({
    ok: true,
    twitch_user_id: session.twitch_user_id,
    twitch_login: session.twitch_login,
    profile: profile || null,
    seasons: (ownerships.results || []).map(r => ({ season_number: r.season_number, source_platform: r.source_platform, created_at: r.created_at })),
  });
}

function requireEnv(env, keys) {
  for (const k of keys) if (!env[k]) throw new Error(`missing env ${k}`);
}

function json(obj, status = 200, request = null) {
  return cors(new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS }), request);
}

function cors(response, request = null) {
  const headers = new Headers(response.headers);
  const origin = request?.headers?.get('origin') || '';
  headers.set('access-control-allow-origin', ALLOWED_ORIGINS.has(origin) ? origin : 'https://jimpae.info');
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type, authorization');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function readCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return '';
}

function sessionCookie(value, maxAge) {
  return `peanut_session=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}

async function signSession(payload, secret) {
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

async function verifySession(value, secret) {
  const [body, sig] = String(value).split('.');
  if (!body || !sig) return null;
  const expected = await hmac(body, secret);
  if (sig !== expected) return null;
  const payload = JSON.parse(atob(padBase64(body)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function hmac(body, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function padBase64(s) {
  return s + '='.repeat((4 - (s.length % 4)) % 4);
}

function randomHex(bytes) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map(b => b.toString(16).padStart(2, '0')).join('');
}
