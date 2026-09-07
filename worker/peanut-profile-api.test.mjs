import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./peanut-profile-api.js', import.meta.url), 'utf8');
assert.match(src, /\/admin\/sync/);
assert.match(src, /\/profile\/twitch\/login/);
assert.match(src, /\/profile\/twitch\/callback/);
assert.match(src, /\/profile\/me/);
assert.match(src, /discord_user_id/);
assert.doesNotMatch(src, /raw_payload/);
assert.match(src, /PEANUT_SYNC_SECRET/);
assert.match(src, /\/webhooks\/twitch\/eventsub/);
assert.match(src, /TWITCH_EVENTSUB_SECRET/);
assert.match(src, /channel:read:redemptions/);
assert.match(src, /createTwitchPtsShadowSubscription/);
assert.match(src, /grant_type: 'client_credentials'/);
assert.match(src, /twitch_pts_eventsub_shadow/);
assert.match(src, /shadow_received/);
console.log('peanut-profile-api static tests ok');
