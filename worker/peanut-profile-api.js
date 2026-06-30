const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const TWITCH_SCOPES = '';
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
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
      if (url.pathname === '/health') return json({ ok: true, service: 'peanut-profile-api', schema: 'viewer_id_v2' });

      if (url.pathname === '/admin/sync' && request.method === 'POST') return await adminSync(request, env);
      if (url.pathname === '/admin/pending-discord-links' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_discord_links');
      if (url.pathname === '/admin/pending-discord-links/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_discord_links');
      if (url.pathname === '/admin/pending-youtube-links' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_youtube_links');
      if (url.pathname === '/admin/pending-youtube-links/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_youtube_links');
      if (url.pathname === '/admin/pending-unlinks' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_unlinks');
      if (url.pathname === '/admin/pending-unlinks/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_unlinks');

      if (url.pathname === '/profile/twitch/login' && request.method === 'GET') return twitchLogin(url, env);
      if (url.pathname === '/profile/twitch/callback' && request.method === 'GET') return await twitchCallback(request, url, env);
      if (url.pathname === '/profile/discord/login' && request.method === 'GET') return await discordLogin(request, url, env);
      if (url.pathname === '/profile/discord/callback' && request.method === 'GET') return await discordCallback(request, url, env);
      if (url.pathname === '/profile/youtube/login' && request.method === 'GET') return await youtubeLogin(request, url, env);
      if (url.pathname === '/profile/youtube/callback' && request.method === 'GET') return await youtubeCallback(request, url, env);
      if (url.pathname === '/profile/me' && request.method === 'GET') return await profileMe(request, env);
      if (url.pathname === '/profile/unlink' && request.method === 'POST') return await profileUnlink(request, env);
      if (url.pathname === '/profile/logout' && request.method === 'POST') return cors(new Response(JSON.stringify({ ok: true }), { headers: { ...JSON_HEADERS, 'set-cookie': sessionCookie('', 0) } }), request);
      return json({ ok: false, error: 'not found' }, 404);
    } catch (err) {
      return json({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
    }
  },
};

function requireAdmin(request, env) {
  const expected = env.PEANUT_SYNC_SECRET;
  if (!expected) return { ok: false, response: json({ ok: false, error: 'server missing PEANUT_SYNC_SECRET' }, 500) };
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== expected) return { ok: false, response: json({ ok: false, error: 'unauthorized' }, 401) };
  return { ok: true };
}

async function adminSync(request, env) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  const payload = await request.json();
  const viewers = Array.isArray(payload.viewers) ? payload.viewers : [];
  const ownerships = Array.isArray(payload.ownerships) ? payload.ownerships : [];
  const syncedAt = payload.synced_at || new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare('DELETE FROM peanut_ownerships_v2'),
    env.DB.prepare('DELETE FROM viewer_profiles_v2'),
  ]);

  const viewerStmt = env.DB.prepare(`
    INSERT OR REPLACE INTO viewer_profiles_v2
    (viewer_id, twitch_user_id, twitch_login, twitch_display_name, youtube_channel_id, youtube_handle, youtube_display_name, discord_user_id, discord_username, discord_linked, points, points_rank, points_platform, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ownershipStmt = env.DB.prepare('INSERT OR REPLACE INTO peanut_ownerships_v2 (viewer_id, season_number, source_platform, created_at) VALUES (?, ?, ?, ?)');

  for (let i = 0; i < viewers.length; i += 100) {
    const batch = viewers.slice(i, i + 100).filter(v => v.viewer_id).map(v => viewerStmt.bind(
      Number(v.viewer_id), v.twitch_user_id || null, v.twitch_login || null, v.twitch_display_name || null,
      v.youtube_channel_id || null, v.youtube_handle || null, v.youtube_display_name || null,
      v.discord_user_id || null, v.discord_username || null, v.discord_linked ? 1 : 0,
      v.points ?? null, v.points_rank ?? null, v.points_platform || null, syncedAt,
    ));
    if (batch.length) await env.DB.batch(batch);
  }

  for (let i = 0; i < ownerships.length; i += 100) {
    const batch = ownerships.slice(i, i + 100).filter(o => o.viewer_id && o.season_number).map(o => ownershipStmt.bind(
      Number(o.viewer_id), Number(o.season_number), o.source_platform || null, o.created_at || null,
    ));
    if (batch.length) await env.DB.batch(batch);
  }

  return json({ ok: true, viewers: viewers.length, ownerships: ownerships.length, synced_at: syncedAt });
}

async function adminPendingLinks(request, env, table) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  const rows = await env.DB.prepare(`SELECT * FROM ${table} WHERE status='pending' ORDER BY id LIMIT 100`).all();
  return json({ ok: true, links: rows.results || [] });
}

async function adminAckLinks(request, env, table) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  const status = body.status === 'failed' ? 'failed' : 'applied';
  for (const id of ids) await env.DB.prepare(`UPDATE ${table} SET status=?, applied_at=? WHERE id=?`).bind(status, new Date().toISOString(), id).run();
  return json({ ok: true, ids, status });
}

function twitchLogin(url, env) {
  requireEnv(env, ['TWITCH_CLIENT_ID', 'TWITCH_REDIRECT_URI']);
  const state = randomHex(16);
  const auth = new URL('https://id.twitch.tv/oauth2/authorize');
  auth.searchParams.set('client_id', env.TWITCH_CLIENT_ID);
  auth.searchParams.set('redirect_uri', env.TWITCH_REDIRECT_URI);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', TWITCH_SCOPES);
  auth.searchParams.set('state', state);
  const returnTo = url.searchParams.get('return_to') || 'https://jimpae.info/profile';
  return redirectWithCookie(auth.toString(), 'peanut_oauth', { state, return_to: returnTo });
}

async function twitchCallback(request, url, env) {
  requireEnv(env, ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_REDIRECT_URI', 'COOKIE_SECRET']);
  const oauthState = readOauthState(request, url, 'peanut_oauth');
  const token = await exchangeToken('https://id.twitch.tv/oauth2/token', { client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, code: url.searchParams.get('code'), grant_type: 'authorization_code', redirect_uri: env.TWITCH_REDIRECT_URI }, 'twitch');
  const userRes = await fetch('https://api.twitch.tv/helix/users', { headers: { 'client-id': env.TWITCH_CLIENT_ID, authorization: `Bearer ${token.access_token}` } });
  if (!userRes.ok) return json({ ok: false, error: `twitch user failed ${userRes.status}` }, 502);
  const user = (await userRes.json()).data?.[0];
  if (!user) return json({ ok: false, error: 'twitch user not found' }, 502);
  const session = await signSession({ provider: 'twitch', twitch_user_id: String(user.id), twitch_login: user.login, exp: sessionExp() }, env.COOKIE_SECRET);
  return callbackRedirect(oauthState.return_to, 'peanut_oauth', session);
}

async function discordLogin(request, url, env) {
  requireEnv(env, ['DISCORD_CLIENT_ID', 'DISCORD_REDIRECT_URI']);
  const session = await getSession(request, env);
  const state = randomHex(16);
  const returnTo = url.searchParams.get('return_to') || 'https://jimpae.info/profile';
  const auth = new URL('https://discord.com/oauth2/authorize');
  auth.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  auth.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'identify');
  auth.searchParams.set('state', state);
  return redirectWithCookie(auth.toString(), 'peanut_discord_oauth', { state, return_to: returnTo, twitch_user_id: session?.twitch_user_id || '', youtube_channel_id: session?.youtube_channel_id || '' });
}

async function discordCallback(request, url, env) {
  requireEnv(env, ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'COOKIE_SECRET']);
  const oauthState = readOauthState(request, url, 'peanut_discord_oauth');
  const token = await exchangeToken('https://discord.com/api/oauth2/token', { client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, code: url.searchParams.get('code'), grant_type: 'authorization_code', redirect_uri: env.DISCORD_REDIRECT_URI }, 'discord');
  const userRes = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!userRes.ok) return json({ ok: false, error: `discord user failed ${userRes.status}` }, 502);
  const user = await userRes.json();
  await env.DB.prepare('INSERT INTO pending_discord_links (twitch_user_id, youtube_channel_id, discord_user_id, discord_username, status, created_at) VALUES (?, ?, ?, ?, \'pending\', ?)')
    .bind(oauthState.twitch_user_id || null, oauthState.youtube_channel_id || null, String(user.id), user.global_name || user.username || String(user.id), new Date().toISOString()).run();
  const session = await signSession({ provider: 'discord', discord_user_id: String(user.id), discord_username: user.global_name || user.username || String(user.id), exp: sessionExp() }, env.COOKIE_SECRET);
  return callbackRedirect(oauthState.return_to, 'peanut_discord_oauth', session);
}

async function youtubeLogin(request, url, env) {
  requireEnv(env, ['GOOGLE_CLIENT_ID', 'GOOGLE_REDIRECT_URI']);
  const session = await getSession(request, env);
  const state = randomHex(16);
  const returnTo = url.searchParams.get('return_to') || 'https://jimpae.info/profile';
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  auth.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', YOUTUBE_SCOPE);
  auth.searchParams.set('access_type', 'online');
  auth.searchParams.set('prompt', 'select_account');
  auth.searchParams.set('state', state);
  return redirectWithCookie(auth.toString(), 'peanut_youtube_oauth', { state, return_to: returnTo, twitch_user_id: session?.twitch_user_id || '', discord_user_id: session?.discord_user_id || '' });
}

async function youtubeCallback(request, url, env) {
  requireEnv(env, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'COOKIE_SECRET']);
  const oauthState = readOauthState(request, url, 'peanut_youtube_oauth');
  const token = await exchangeToken('https://oauth2.googleapis.com/token', { client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code: url.searchParams.get('code'), grant_type: 'authorization_code', redirect_uri: env.GOOGLE_REDIRECT_URI }, 'youtube');
  const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!chRes.ok) return json({ ok: false, error: `youtube channel failed ${chRes.status}`, detail: (await chRes.text()).slice(0, 300) }, 502);
  const ch = (await chRes.json()).items?.[0];
  if (!ch) return json({ ok: false, error: 'youtube channel not found' }, 502);
  const snippet = ch.snippet || {};
  await env.DB.prepare('INSERT INTO pending_youtube_links (youtube_channel_id, youtube_handle, youtube_display_name, twitch_user_id, discord_user_id, status, created_at) VALUES (?, ?, ?, ?, ?, \'pending\', ?)')
    .bind(String(ch.id), snippet.customUrl || null, snippet.title || null, oauthState.twitch_user_id || null, oauthState.discord_user_id || null, new Date().toISOString()).run();
  const session = await signSession({ provider: 'youtube', youtube_channel_id: String(ch.id), youtube_handle: snippet.customUrl || '', youtube_display_name: snippet.title || '', exp: sessionExp() }, env.COOKIE_SECRET);
  return callbackRedirect(oauthState.return_to, 'peanut_youtube_oauth', session);
}


async function profileUnlink(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ ok: false, error: 'not logged in' }, 401);
  const body = await request.json().catch(() => ({}));
  const platform = String(body.platform || '').toLowerCase();
  if (!['twitch', 'youtube', 'discord'].includes(platform)) return json({ ok: false, error: 'invalid platform' }, 400);
  const { where, value } = identityWhere(session);
  let profile = null;
  if (where) profile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${where}=?`).bind(value).first();
  const viewerId = profile?.viewer_id || null;
  await env.DB.prepare(`
    INSERT INTO pending_unlinks
    (viewer_id, session_provider, session_subject, platform, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).bind(viewerId, session.provider || null, value || null, platform, new Date().toISOString()).run();
  return json({ ok: true, status: 'pending', platform });
}

async function profileMe(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ ok: false, error: 'not logged in' }, 401);
  const { where, value } = identityWhere(session);
  let profile = null;
  let ownerships = { results: [] };
  if (where) {
    profile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${where}=?`).bind(value).first();
    if (profile) ownerships = await env.DB.prepare('SELECT season_number, source_platform, created_at FROM peanut_ownerships_v2 WHERE viewer_id=? ORDER BY season_number DESC').bind(profile.viewer_id).all();
  }
  const pendingDiscord = profile ? await env.DB.prepare("SELECT COUNT(*) AS count FROM pending_discord_links WHERE status='pending' AND (twitch_user_id=? OR youtube_channel_id=?)").bind(profile.twitch_user_id || '', profile.youtube_channel_id || '').first() : { count: 0 };
  return json({ ok: true, session, profile: profile || null, discord_pending: Number(pendingDiscord?.count || 0) > 0, seasons: (ownerships.results || []).map(r => ({ season_number: r.season_number, source_platform: r.source_platform, created_at: r.created_at })) });
}

async function getSession(request, env) {
  const sessionCookieValue = readCookie(request, 'peanut_session');
  if (!sessionCookieValue) return null;
  return await verifySession(sessionCookieValue, env.COOKIE_SECRET);
}

function identityWhere(session) {
  if (session.twitch_user_id) return { where: 'twitch_user_id', value: session.twitch_user_id };
  if (session.youtube_channel_id) return { where: 'youtube_channel_id', value: session.youtube_channel_id };
  if (session.discord_user_id) return { where: 'discord_user_id', value: session.discord_user_id };
  return { where: '', value: '' };
}

async function exchangeToken(endpoint, params, label) {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  if (!res.ok) return Promise.reject(new Error(`${label} token failed ${res.status}: ${(await res.text()).slice(0, 300)}`));
  return await res.json();
}

function readOauthState(request, url, cookieName) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) throw new Error('missing code/state');
  const raw = readCookie(request, cookieName);
  const parsed = raw ? JSON.parse(base64UrlDecode(raw)) : null;
  if (!parsed || parsed.state !== state) throw new Error('invalid state');
  return parsed;
}

function redirectWithCookie(location, name, value) {
  const cookieValue = base64UrlEncode(JSON.stringify(value));
  return new Response(null, { status: 302, headers: { location, 'set-cookie': `${name}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600` } });
}

function callbackRedirect(returnTo, oauthCookie, session) {
  const headers = new Headers();
  headers.set('location', returnTo || 'https://jimpae.info/profile');
  headers.append('set-cookie', sessionCookie(session, 60 * 60 * 24 * 30));
  headers.append('set-cookie', `${oauthCookie}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

function sessionExp() { return Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; }
function requireEnv(env, keys) { for (const k of keys) if (!env[k]) throw new Error(`server missing ${k}`); }
function json(obj, status = 200) { return cors(new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS })); }
function cors(resp, request) {
  const headers = new Headers(resp.headers);
  const origin = request?.headers?.get('origin') || 'https://jimpae.info';
  if (ALLOWED_ORIGINS.has(origin)) headers.set('access-control-allow-origin', origin);
  else headers.set('access-control-allow-origin', 'https://jimpae.info');
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-headers', 'content-type, authorization');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}
function randomHex(bytes) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); }
function readCookie(request, name) { const cookies = request.headers.get('cookie') || ''; for (const part of cookies.split(';')) { const [k, ...rest] = part.trim().split('='); if (k === name) return rest.join('='); } return ''; }

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlDecode(text) {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padBase64(normalized));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function padBase64(s) { return s + '='.repeat((4 - (s.length % 4)) % 4); }
async function signSession(payload, secret) { const body = base64UrlEncode(JSON.stringify(payload)); const sig = await hmac(body, secret); return `${body}.${sig}`; }
async function verifySession(token, secret) { const [body, sig] = String(token || '').split('.'); if (!body || !sig) return null; const expected = await hmac(body, secret); if (sig !== expected) return null; const payload = JSON.parse(base64UrlDecode(body)); if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null; return payload; }
async function hmac(body, secret) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)); return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function sessionCookie(value, maxAge) { return `peanut_session=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`; }
