import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./peanut-profile-api.js', import.meta.url), 'utf8');
assert.match(src, /\/admin\/sync/);
assert.match(src, /\/profile\/twitch\/login/);
assert.match(src, /\/profile\/twitch\/callback/);
assert.match(src, /\/profile\/me/);
assert.doesNotMatch(src, /discord_user_id/);
assert.doesNotMatch(src, /raw_payload/);
assert.match(src, /PEANUT_SYNC_SECRET/);
console.log('peanut-profile-api static tests ok');
