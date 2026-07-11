import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

let source = fs.readFileSync(new URL('../worker/peanut-profile-api.js', import.meta.url), 'utf8');
source = source.replace('export default {', 'globalThis.worker = {');
source += '\nglobalThis.__test = { checkTwitchSubscription };\n';
const context = {
  console,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  Response,
  Request,
  Headers,
  crypto: webcrypto,
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  fetch: null,
};
vm.createContext(context);
vm.runInContext(source, context);

const env = { TWITCH_CLIENT_ID: 'client', TWITCH_BROADCASTER_ID: '229138740' };
let requested = null;
context.fetch = async (url, init) => {
  requested = { url: String(url), init };
  return new Response(JSON.stringify({ data: [{ tier: '1000' }] }), { status: 200, headers: {'content-type':'application/json'} });
};
let result = await context.__test.checkTwitchSubscription('viewer123', 'token-secret', env);
assert.deepEqual(JSON.parse(JSON.stringify(result)), { isSubscriber: true, tier: '1000' });
assert.match(requested.url, /broadcaster_id=229138740/);
assert.match(requested.url, /user_id=viewer123/);
assert.equal(requested.init.headers.authorization, 'Bearer token-secret');

context.fetch = async () => new Response('', { status: 404 });
result = await context.__test.checkTwitchSubscription('viewer123', 'token-secret', env);
assert.deepEqual(JSON.parse(JSON.stringify(result)), { isSubscriber: false, tier: null });

console.log('twitch_subscription_tests_ok');
