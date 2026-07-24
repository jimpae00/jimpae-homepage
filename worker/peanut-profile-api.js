const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const TWITCH_SCOPES = 'user:read:subscriptions';
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
      if (url.pathname === '/admin/status-sync' && request.method === 'POST') return await adminStatusSync(request, env);
      if (url.pathname === '/profile/admin/status' && request.method === 'GET') return await profileAdminStatus(request, env);
      if (url.pathname === '/admin/gear-catalog' && request.method === 'GET') return await adminGearCatalogList(request, env);
      if (url.pathname === '/admin/gear-catalog' && request.method === 'POST') return await adminGearCatalogCreate(request, env);
      if (url.pathname.match(/^\/admin\/gear-catalog\/\d+\/?$/) && request.method === 'PUT') return await adminGearCatalogUpdate(request, env);
      if (url.pathname.match(/^\/admin\/gear-catalog\/\d+\/?$/) && request.method === 'DELETE') return await adminGearCatalogDelete(request, env);
      if (url.pathname === '/admin/gear-catalog/seed' && request.method === 'POST') return await adminGearCatalogSeed(request, env);
      if (url.pathname === '/admin/gear-catalog-sync' && request.method === 'GET') return await adminGearCatalogSync(request, env);
      if (url.pathname === '/gear-catalog' && request.method === 'GET') return await publicGearCatalog(request, env);
      if (url.pathname === '/admin/pending-discord-links' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_discord_links');
      if (url.pathname === '/admin/pending-discord-links/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_discord_links');
      if (url.pathname === '/admin/pending-youtube-links' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_youtube_links');
      if (url.pathname === '/admin/pending-youtube-links/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_youtube_links');
      if (url.pathname === '/admin/pending-twitch-links' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_twitch_links');
      if (url.pathname === '/admin/pending-twitch-links/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_twitch_links');
      if (url.pathname === '/admin/pending-unlinks' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_unlinks');
      if (url.pathname === '/admin/pending-unlinks/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_unlinks');
      if (url.pathname === '/admin/pending-test-deductions' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_test_deductions');
      if (url.pathname === '/admin/pending-test-deductions/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_test_deductions');
      if (url.pathname === '/admin/pending-peanut-redeems' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_peanut_redeems');
      if (url.pathname === '/admin/pending-peanut-redeems/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_peanut_redeems');
      if (url.pathname === '/admin/pending-avatar-gear-changes' && request.method === 'GET') return await adminPendingLinks(request, env, 'pending_avatar_gear_changes');
      if (url.pathname === '/admin/pending-avatar-gear-changes/ack' && request.method === 'POST') return await adminAckLinks(request, env, 'pending_avatar_gear_changes');

      if (url.pathname === '/profile/twitch/login' && request.method === 'GET') return await twitchLogin(request, url, env);
      if (url.pathname === '/profile/twitch/callback' && request.method === 'GET') return await twitchCallback(request, url, env);
      if (url.pathname === '/profile/discord/login' && request.method === 'GET') return await discordLogin(request, url, env);
      if (url.pathname === '/profile/discord/callback' && request.method === 'GET') return await discordCallback(request, url, env);
      if (url.pathname === '/profile/youtube/login' && request.method === 'GET') return await youtubeLogin(request, url, env);
      if (url.pathname === '/profile/youtube/callback' && request.method === 'GET') return await youtubeCallback(request, url, env);
      if (url.pathname === '/profile/me' && request.method === 'GET') return await profileMe(request, env);
      if (url.pathname === '/profile/member-videos' && request.method === 'GET') return await profileMemberVideos(request, env);
      const memberPlaybackMatch = url.pathname.match(/^\/profile\/member-videos\/([^/]+)\/playback$/);
      if (memberPlaybackMatch && request.method === 'POST') return await profileMemberVideoPlayback(request, memberPlaybackMatch[1], env);
      if (url.pathname === '/profile/unlink' && request.method === 'POST') return await profileUnlink(request, env);
      if (url.pathname === '/profile/test-deduct' && request.method === 'POST') return await profileTestDeduct(request, env);
      if (url.pathname === '/profile/redeem-s57' && request.method === 'POST') return await profileRedeemS57(request, env);
      if (url.pathname === '/profile/equip-gear' && request.method === 'POST') return await profileEquipGear(request, env);
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


async function adminStatusSync(request, env) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  const payload = await request.json();
  await env.DB.prepare('INSERT OR REPLACE INTO admin_status_snapshots (snapshot_key, payload, updated_at) VALUES (?, ?, ?)')
    .bind('latest', JSON.stringify(payload), payload.generated_at || new Date().toISOString()).run();
  return json({ ok: true, updated_at: payload.generated_at || new Date().toISOString() });
}

async function requireProfileAdmin(request, env) {
  const session = await getSession(request, env);
  if (!session) return { ok: false, response: json({ ok: false, error: 'not logged in' }, 401) };
  const { where, value } = identityWhere(session);
  if (!where) return { ok: false, response: json({ ok: false, error: 'no identity' }, 401) };
  const profile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${where}=?`).bind(value).first();
  if (!profile || Number(profile.viewer_id) !== 1) return { ok: false, response: json({ ok: false, error: 'forbidden' }, 403) };
  return { ok: true, profile };
}

async function profileAdminStatus(request, env) {
  const auth = await requireProfileAdmin(request, env);
  if (!auth.ok) return auth.response;
  const row = await env.DB.prepare("SELECT payload, updated_at FROM admin_status_snapshots WHERE snapshot_key='latest'").first();
  if (!row) return json({ ok: true, updated_at: null, data: null });
  return json({ ok: true, updated_at: row.updated_at, data: JSON.parse(row.payload) });
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
    (viewer_id, twitch_user_id, twitch_login, twitch_display_name, youtube_channel_id, youtube_handle, youtube_display_name, discord_user_id, discord_username, discord_linked, points, points_rank, points_platform, avatar_render_url, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ownershipStmt = env.DB.prepare('INSERT OR REPLACE INTO peanut_ownerships_v2 (viewer_id, season_number, source_platform, created_at) VALUES (?, ?, ?, ?)');

  for (let i = 0; i < viewers.length; i += 100) {
    const batch = viewers.slice(i, i + 100).filter(v => v.viewer_id).map(v => viewerStmt.bind(
      Number(v.viewer_id), v.twitch_user_id || null, v.twitch_login || null, v.twitch_display_name || null,
      v.youtube_channel_id || null, v.youtube_handle || null, v.youtube_display_name || null,
      v.discord_user_id || null, v.discord_username || null, v.discord_linked ? 1 : 0,
      v.points ?? null, v.points_rank ?? null, v.points_platform || null, v.avatar_render_url || null, syncedAt,
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
  if (table === 'pending_avatar_gear_changes') {
    const rows = await env.DB.prepare(`
      SELECT p.*
      FROM pending_avatar_gear_changes p
      JOIN (
        SELECT viewer_id, platform, gear_set, MAX(id) AS id
        FROM pending_avatar_gear_changes
        WHERE status='pending'
        GROUP BY viewer_id, platform, gear_set
      ) latest ON latest.id = p.id
      ORDER BY p.id DESC
      LIMIT 100
    `).all();
    return json({ ok: true, links: rows.results || [] });
  }
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

/* ───────── Gear Catalog Admin ───────── */

async function adminGearCatalogList(request, env) {
  const auth = await requireProfileAdmin(request, env);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const enabledOnly = searchParams.get('enabled') === '1';
  const sql = enabledOnly
    ? 'SELECT * FROM gear_catalog WHERE enabled=1 ORDER BY sort_order, gear_set, gear_piece'
    : 'SELECT * FROM gear_catalog ORDER BY sort_order, gear_set, gear_piece';
  const rows = await env.DB.prepare(sql).all();
  return json({ ok: true, gears: rows.results || [] });
}

async function adminGearCatalogCreate(request, env) {
  const auth = await requireProfileAdmin(request, env);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const gearSet = String(body.gear_set || '').trim();
  const gearPiece = String(body.gear_piece || '').trim();
  const label = String(body.label || '').trim();
  if (!gearSet || !gearPiece || !label) return json({ ok: false, error: 'gear_set, gear_piece, label required' }, 400);
  if (gearSet.length > 80 || gearPiece.length > 120 || label.length > 200) return json({ ok: false, error: 'field too long' }, 400);
  const setLabel = String(body.set_label || '').trim().slice(0, 200);
  const price = Number.isFinite(Number(body.price)) ? Math.max(0, Number(body.price)) : 0;
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Math.floor(Number(body.sort_order)) : 0;
  const now = new Date().toISOString();
  try {
    const res = await env.DB.prepare(
      'INSERT INTO gear_catalog (gear_set, set_label, gear_piece, label, price, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)'
    ).bind(gearSet, setLabel || null, gearPiece, label, price, sortOrder, now, now).run();
    return json({ ok: true, id: res?.meta?.last_row_id || null });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint')) return json({ ok: false, error: 'gear_set + gear_piece already exists' }, 409);
    throw e;
  }
}

async function adminGearCatalogUpdate(request, env) {
  const auth = await requireProfileAdmin(request, env);
  if (!auth.ok) return auth.response;
  const id = parseInt(request.url.split('/').filter(Boolean).pop(), 10);
  if (!Number.isFinite(id)) return json({ ok: false, error: 'invalid id' }, 400);
  const body = await request.json().catch(() => ({}));
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries({ set_label: body.set_label, label: body.label, gear_set: body.gear_set, gear_piece: body.gear_piece })) {
    if (v !== undefined) { fields.push(k+'=?'); values.push(String(v).trim().slice(0, 200)); }
  }
  if (body.price !== undefined) { fields.push('price=?'); values.push(Math.max(0, Math.floor(Number(body.price)))); }
  if (body.sort_order !== undefined) { fields.push('sort_order=?'); values.push(Math.floor(Number(body.sort_order))); }
  if (body.enabled !== undefined) { fields.push('enabled=?'); values.push(body.enabled ? 1 : 0); }
  if (!fields.length) return json({ ok: false, error: 'no fields to update' }, 400);
  fields.push('updated_at=?');
  values.push(new Date().toISOString());
  values.push(id);
  await env.DB.prepare(`UPDATE gear_catalog SET ${fields.join(',')} WHERE id=?`).bind(...values).run();
  return json({ ok: true });
}

async function adminGearCatalogDelete(request, env) {
  const auth = await requireProfileAdmin(request, env);
  if (!auth.ok) return auth.response;
  const id = parseInt(request.url.split('/').filter(Boolean).pop(), 10);
  if (!Number.isFinite(id)) return json({ ok: false, error: 'invalid id' }, 400);
  const param = new URL(request.url).searchParams.get('hard');
  if (param === '1') {
    await env.DB.prepare('DELETE FROM gear_catalog WHERE id=?').bind(id).run();
  } else {
    await env.DB.prepare("UPDATE gear_catalog SET enabled=0, updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
  }
  return json({ ok: true });
}

async function adminGearCatalogSeed(request, env) {
  const auth = await requireProfileAdmin(request, env);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const gears = Array.isArray(body.gears) ? body.gears : [];
  let added = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const g of gears) {
    if (!g.gear_set || !g.gear_piece || !g.label) continue;
    const existing = await env.DB.prepare('SELECT id FROM gear_catalog WHERE gear_set=? AND gear_piece=?').bind(g.gear_set, g.gear_piece).first();
    if (existing) { skipped++; continue; }
    await env.DB.prepare(
      'INSERT INTO gear_catalog (gear_set, set_label, gear_piece, label, price, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)'
    ).bind(g.gear_set, g.set_label || null, g.gear_piece, g.label, Math.floor(Number(g.price) || 0), Math.floor(Number(g.sort_order) || 0), now, now).run();
    added++;
  }
  return json({ ok: true, added, skipped });
}

async function adminGearCatalogSync(request, env) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;
  const rows = await env.DB.prepare('SELECT gear_set, gear_piece, label, price FROM gear_catalog WHERE enabled=1 ORDER BY sort_order, gear_set, gear_piece').all();
  const gears = (rows.results || []).map(r => ({
    id: r.gear_piece.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    display_name: r.label,
    gear_set: r.gear_set,
    gear_piece: r.gear_piece,
    cost: r.price,
    gift_only: false,
  }));
  return json({ ok: true, gears });
}

async function publicGearCatalog(request, env) {
  const rows = await env.DB.prepare('SELECT gear_set, gear_piece, label, price FROM gear_catalog WHERE enabled=1 ORDER BY sort_order, gear_set, gear_piece').all();
  const gears = (rows.results || []).map(r => ({
    id: r.gear_piece.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    display_name: r.label,
    gear_set: r.gear_set,
    gear_piece: r.gear_piece,
    cost: r.price,
  }));
  return json({ ok: true, gears });
}

async function twitchLogin(request, url, env) {
  requireEnv(env, ['TWITCH_CLIENT_ID', 'TWITCH_REDIRECT_URI']);
  const session = await getSession(request, env);
  let currentProfile = null;
  if (session) {
    const ident = identityWhere(session);
    if (ident.where) currentProfile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${ident.where}=?`).bind(ident.value).first();
  }
  const state = randomHex(16);
  const auth = new URL('https://id.twitch.tv/oauth2/authorize');
  auth.searchParams.set('client_id', env.TWITCH_CLIENT_ID);
  auth.searchParams.set('redirect_uri', env.TWITCH_REDIRECT_URI);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', TWITCH_SCOPES);
  auth.searchParams.set('state', state);
  const returnTo = url.searchParams.get('return_to') || 'https://jimpae.info/profile';
  return redirectWithCookie(auth.toString(), 'peanut_oauth', {
    state,
    return_to: returnTo,
    youtube_channel_id: session?.youtube_channel_id || currentProfile?.youtube_channel_id || '',
    discord_user_id: session?.discord_user_id || currentProfile?.discord_user_id || '',
    current_viewer_id: currentProfile?.viewer_id || '',
  });
}

async function twitchCallback(request, url, env) {
  requireEnv(env, ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_REDIRECT_URI', 'TWITCH_BROADCASTER_ID', 'COOKIE_SECRET']);
  const oauthState = readOauthState(request, url, 'peanut_oauth');
  const token = await exchangeToken('https://id.twitch.tv/oauth2/token', { client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, code: url.searchParams.get('code'), grant_type: 'authorization_code', redirect_uri: env.TWITCH_REDIRECT_URI }, 'twitch');
  const userRes = await fetch('https://api.twitch.tv/helix/users', { headers: { 'client-id': env.TWITCH_CLIENT_ID, authorization: `Bearer ${token.access_token}` } });
  if (!userRes.ok) return json({ ok: false, error: `twitch user failed ${userRes.status}` }, 502);
  const user = (await userRes.json()).data?.[0];
  if (!user) return json({ ok: false, error: 'twitch user not found' }, 502);
  const sub = await checkTwitchSubscription(user.id, token.access_token, env);
  const checkedAt = new Date();
  const validUntil = new Date(checkedAt.getTime() + 24 * 60 * 60 * 1000);
  await env.DB.prepare(`
    INSERT INTO twitch_sub_entitlements (twitch_user_id, is_subscriber, tier, checked_at, valid_until)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(twitch_user_id) DO UPDATE SET is_subscriber=excluded.is_subscriber, tier=excluded.tier, checked_at=excluded.checked_at, valid_until=excluded.valid_until
  `).bind(String(user.id), sub.isSubscriber ? 1 : 0, sub.tier || null, checkedAt.toISOString(), validUntil.toISOString()).run();
  await env.DB.prepare(`
    INSERT INTO pending_twitch_links
    (twitch_user_id, twitch_login, twitch_display_name, youtube_channel_id, discord_user_id, current_viewer_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(String(user.id), user.login || null, user.display_name || user.login || null, oauthState.youtube_channel_id || null, oauthState.discord_user_id || null, oauthState.current_viewer_id || null, new Date().toISOString()).run();
  const session = await signSession({ provider: 'twitch', twitch_user_id: String(user.id), twitch_login: user.login, exp: sessionExp() }, env.COOKIE_SECRET);
  return callbackRedirect(oauthState.return_to, 'peanut_oauth', session);
}

async function checkTwitchSubscription(userId, accessToken, env) {
  const endpoint = new URL('https://api.twitch.tv/helix/subscriptions/user');
  endpoint.searchParams.set('broadcaster_id', String(env.TWITCH_BROADCASTER_ID));
  endpoint.searchParams.set('user_id', String(userId));
  const res = await fetch(endpoint, { headers: { 'client-id': env.TWITCH_CLIENT_ID, authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return { isSubscriber: false, tier: null };
  if (!res.ok) throw new Error(`twitch subscription check failed ${res.status}`);
  const row = (await res.json()).data?.[0];
  return { isSubscriber: !!row, tier: row?.tier || null };
}

async function requireActiveTwitchSub(request, env) {
  const session = await getSession(request, env);
  if (!session?.twitch_user_id) return { ok: false, response: json({ ok: false, error: '請用 Twitch 登入並驗證訂閱。', code: 'twitch_login_required' }, 401) };
  const entitlement = await env.DB.prepare('SELECT is_subscriber, tier, checked_at, valid_until FROM twitch_sub_entitlements WHERE twitch_user_id=?').bind(String(session.twitch_user_id)).first();
  const validUntilMs = Date.parse(String(entitlement?.valid_until || ''));
  if (!entitlement || !Number.isFinite(validUntilMs) || validUntilMs <= Date.now()) return { ok: false, response: json({ ok: false, error: '訂閱驗證已過期，請重新連結 Twitch。', code: 'reauth_required' }, 403) };
  if (!Number(entitlement.is_subscriber)) return { ok: false, response: json({ ok: false, error: '未偵測到有效 Twitch 訂閱。', code: 'not_subscribed' }, 403) };
  return { ok: true, session, entitlement };
}

async function profileMemberVideos(request, env) {
  const auth = await requireActiveTwitchSub(request, env);
  if (!auth.ok) return auth.response;
  const rows = await env.DB.prepare('SELECT slug, title, description, thumbnail_url, published_at FROM member_videos WHERE enabled=1 ORDER BY sort_order DESC, published_at DESC, id DESC').all();
  return json({ ok: true, access: { twitch_sub: true, tier: auth.entitlement.tier, checked_at: auth.entitlement.checked_at, valid_until: auth.entitlement.valid_until }, videos: rows.results || [] });
}

async function profileMemberVideoPlayback(request, encodedSlug, env) {
  const auth = await requireActiveTwitchSub(request, env);
  if (!auth.ok) return auth.response;
  requireEnv(env, ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN', 'CLOUDFLARE_STREAM_CUSTOMER_CODE']);
  let slug = '';
  try { slug = decodeURIComponent(encodedSlug || ''); } catch { return json({ ok: false, error: 'invalid video' }, 400); }
  if (!slug || slug.includes('/') || slug.length > 120) return json({ ok: false, error: 'invalid video' }, 400);
  const video = await env.DB.prepare('SELECT slug, title, stream_uid FROM member_videos WHERE slug=? AND enabled=1').bind(slug).first();
  if (!video) return json({ ok: false, error: 'video not found' }, 404);
  const metadataRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/stream/${encodeURIComponent(video.stream_uid)}`, { headers: { authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}` } });
  const metadataBody = await metadataRes.json().catch(() => ({}));
  if (!metadataRes.ok || metadataBody?.success !== true || metadataBody?.result?.requireSignedURLs !== true) return json({ ok: false, error: '影片私隱設定未完成。', code: 'stream_not_private' }, 503);
  const entitlementExpiry = Math.floor(Date.parse(String(auth.entitlement.valid_until)) / 1000);
  const tokenExpiry = Math.min(Math.floor(Date.now() / 1000) + 15 * 60, entitlementExpiry);
  const tokenRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/stream/${encodeURIComponent(video.stream_uid)}/token`, {
    method: 'POST', headers: { authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ exp: tokenExpiry, downloadable: false }),
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  const playbackToken = tokenBody?.result?.token;
  if (!tokenRes.ok || tokenBody?.success !== true || typeof playbackToken !== 'string' || !playbackToken) return json({ ok: false, error: '影片播放權限暫時無法建立。', code: 'stream_token_failed' }, 502);
  return json({ ok: true, title: video.title, iframe_url: `https://customer-${env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${playbackToken}/iframe`, expires_in: 900 });
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
  let currentProfile = null;
  if (session) {
    const ident = identityWhere(session);
    if (ident.where) currentProfile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${ident.where}=?`).bind(ident.value).first();
  }
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
  return redirectWithCookie(auth.toString(), 'peanut_youtube_oauth', {
    state,
    return_to: returnTo,
    twitch_user_id: session?.twitch_user_id || currentProfile?.twitch_user_id || '',
    discord_user_id: session?.discord_user_id || currentProfile?.discord_user_id || '',
    current_viewer_id: currentProfile?.viewer_id || '',
  });
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
  await env.DB.prepare('INSERT INTO pending_youtube_links (youtube_channel_id, youtube_handle, youtube_display_name, twitch_user_id, discord_user_id, current_viewer_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, \'pending\', ?)')
    .bind(String(ch.id), snippet.customUrl || null, snippet.title || null, oauthState.twitch_user_id || null, oauthState.discord_user_id || null, oauthState.current_viewer_id || null, new Date().toISOString()).run();
  const session = await signSession({ provider: 'youtube', youtube_channel_id: String(ch.id), youtube_handle: snippet.customUrl || '', youtube_display_name: snippet.title || '', exp: sessionExp() }, env.COOKIE_SECRET);
  return callbackRedirect(oauthState.return_to, 'peanut_youtube_oauth', session);
}




async function profileRedeemS57(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ ok: false, error: 'not logged in' }, 401);
  const { where, value } = identityWhere(session);
  if (!where) return json({ ok: false, error: 'no identity' }, 401);
  const profile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${where}=?`).bind(value).first();
  if (!profile) return json({ ok: false, error: 'profile not found' }, 404);
  const owned = await env.DB.prepare('SELECT 1 FROM peanut_ownerships_v2 WHERE viewer_id=? AND season_number=57 LIMIT 1').bind(Number(profile.viewer_id)).first();
  if (owned) return json({ ok: false, error: '你已經有 S57 花生證。', code: 'already_owned' }, 409);
  const points = Number(profile.points || 0);
  if (points < 1000) return json({ ok: false, error: '占幣不夠，參與直播活動賺幣或可用 Twitch 花生兌換。', code: 'insufficient_points', points, cost: 1000 }, 402);
  const existing = await env.DB.prepare("SELECT id FROM pending_peanut_redeems WHERE viewer_id=? AND season_number=57 AND status='pending' LIMIT 1").bind(Number(profile.viewer_id)).first();
  if (existing) return json({ ok: true, status: 'pending', id: existing.id, season_number: 57, cost: 1000 });
  const res = await env.DB.prepare(`
    INSERT INTO pending_peanut_redeems
    (viewer_id, season_number, cost, session_provider, session_subject, status, created_at)
    VALUES (?, 57, 1000, ?, ?, 'pending', ?)
  `).bind(Number(profile.viewer_id), session.provider || null, value || null, new Date().toISOString()).run();
  return json({ ok: true, status: 'pending', id: res?.meta?.last_row_id || null, season_number: 57, cost: 1000 });
}

async function profileEquipGear(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ ok: false, error: 'not logged in' }, 401);
  const { where, value } = identityWhere(session);
  if (!where) return json({ ok: false, error: 'no identity' }, 401);
  const profile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${where}=?`).bind(value).first();
  if (!profile) return json({ ok: false, error: 'profile not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const platform = String(body.platform || '').toLowerCase();
  const gearSet = String(body.gear_set || '').trim();
  const gearPiece = String(body.gear_piece || '').trim();
  if (!['twitch', 'youtube'].includes(platform)) return json({ ok: false, error: 'invalid platform' }, 400);
  if (!gearSet || !gearPiece || gearSet.length > 80 || gearPiece.length > 120) return json({ ok: false, error: 'invalid gear' }, 400);
  if (platform === 'twitch' && !profile.twitch_user_id) return json({ ok: false, error: 'Twitch 未連結' }, 400);
  if (platform === 'youtube' && !profile.youtube_channel_id) return json({ ok: false, error: 'YouTube 未連結' }, 400);
  const existing = await env.DB.prepare("SELECT id FROM pending_avatar_gear_changes WHERE viewer_id=? AND platform=? AND gear_set=? AND gear_piece=? AND status='pending' LIMIT 1")
    .bind(Number(profile.viewer_id), platform, gearSet, gearPiece).first();
  if (existing) return json({ ok: true, status: 'pending', id: existing.id });
  await env.DB.prepare("UPDATE pending_avatar_gear_changes SET status='failed', message='superseded by newer request for same slot', applied_at=? WHERE viewer_id=? AND platform=? AND gear_set=? AND status='pending'")
    .bind(new Date().toISOString(), Number(profile.viewer_id), platform, gearSet).run();
  const res = await env.DB.prepare(`
    INSERT INTO pending_avatar_gear_changes
    (viewer_id, platform, gear_set, gear_piece, session_provider, session_subject, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(Number(profile.viewer_id), platform, gearSet, gearPiece, session.provider || null, value || null, new Date().toISOString()).run();
  return json({ ok: true, status: 'pending', id: res?.meta?.last_row_id || null, platform, gear_set: gearSet, gear_piece: gearPiece });
}

async function profileTestDeduct(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ ok: false, error: 'not logged in' }, 401);
  const { where, value } = identityWhere(session);
  if (!where) return json({ ok: false, error: 'no identity' }, 401);
  const profile = await env.DB.prepare(`SELECT * FROM viewer_profiles_v2 WHERE ${where}=?`).bind(value).first();
  if (!profile) return json({ ok: false, error: 'profile not found' }, 404);
  if (Number(profile.viewer_id) !== 1) return json({ ok: false, error: 'Jimpae test only' }, 403);
  const amount = -100;
  const res = await env.DB.prepare(`
    INSERT INTO pending_test_deductions
    (viewer_id, session_provider, session_subject, amount, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).bind(Number(profile.viewer_id), session.provider || null, value || null, amount, 'profile_test_button', new Date().toISOString()).run();
  return json({ ok: true, status: 'pending', amount, id: res?.meta?.last_row_id || null });
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
  let gearChanges = { results: [] };
  if (profile) {
    gearChanges = await env.DB.prepare("SELECT id, platform, gear_set, gear_piece, status, created_at, applied_at FROM pending_avatar_gear_changes WHERE viewer_id=? AND status IN ('pending','applied') ORDER BY id DESC LIMIT 100").bind(profile.viewer_id).all();
  }
  let twitchSub = null;
  if (session.twitch_user_id) twitchSub = await env.DB.prepare('SELECT is_subscriber, tier, checked_at, valid_until FROM twitch_sub_entitlements WHERE twitch_user_id=?').bind(String(session.twitch_user_id)).first();
  return json({ ok: true, session, profile: profile || null, twitch_sub: twitchSub ? { active: !!Number(twitchSub.is_subscriber) && Number.isFinite(Date.parse(String(twitchSub.valid_until))) && Date.parse(String(twitchSub.valid_until)) > Date.now(), subscriber: !!Number(twitchSub.is_subscriber), tier: twitchSub.tier, checked_at: twitchSub.checked_at, valid_until: twitchSub.valid_until } : null, discord_pending: Number(pendingDiscord?.count || 0) > 0, seasons: (ownerships.results || []).map(r => ({ season_number: r.season_number, source_platform: r.source_platform, created_at: r.created_at })), gear_changes: gearChanges.results || [] });
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
function json(obj, status = 200, cacheControl = null) {
  const headers = { ...JSON_HEADERS };
  if (cacheControl) headers["cache-control"] = cacheControl;
  return cors(new Response(JSON.stringify(obj), { status, headers }));
}
function cors(resp, request) {
  const headers = new Headers(resp.headers);
  const origin = request?.headers?.get('origin') || 'https://jimpae.info';
  if (ALLOWED_ORIGINS.has(origin)) headers.set('access-control-allow-origin', origin);
  else headers.set('access-control-allow-origin', 'https://jimpae.info');
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-headers', 'content-type, authorization');
  headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
