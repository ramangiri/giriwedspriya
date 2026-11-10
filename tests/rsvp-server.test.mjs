// Synthetic contract tests. The production password/token are never read.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';

const source = await readFile(new URL('../netlify/functions/rsvp-admin.mjs', import.meta.url), 'utf8');
const testPassword = 'synthetic-fixture-password';
const testSalt = Buffer.from('synthetic-fixture-salt');
const testHash = pbkdf2Sync(testPassword, testSalt, 210000, 32, 'sha256').toString('hex');
// Substitute only test authentication constants in an in-memory module.
const fixtureSource = source.replace(/const SALT = "[a-f0-9]+";/, `const SALT = "${testSalt.toString('hex')}";`)
  .replace(/const HASH = "[a-f0-9]+";/, `const HASH = "${testHash}";`);
const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(fixtureSource).toString('base64'));
const request = (password = testPassword, method = 'GET') => new Request('https://fixture.invalid/.netlify/functions/rsvp-admin', {
  method, headers: { authorization: 'Basic ' + Buffer.from('admin:' + password).toString('base64') }
});

async function withFixtures(token, fetch, run) {
  const oldToken = process.env.NETLIFY_RSVP_API_TOKEN;
  const oldFetch = globalThis.fetch;
  try {
    if (token) process.env.NETLIFY_RSVP_API_TOKEN = token;
    else delete process.env.NETLIFY_RSVP_API_TOKEN;
    globalThis.fetch = fetch;
    await run();
  } finally {
    if (oldToken === undefined) delete process.env.NETLIFY_RSVP_API_TOKEN;
    else process.env.NETLIFY_RSVP_API_TOKEN = oldToken;
    globalThis.fetch = oldFetch;
  }
}
const noFetch = () => { throw new Error('Unexpected upstream fetch'); };

test('rejects wrong credentials and non-GET without fetching guest data', async () => {
  await withFixtures('', noFetch, async () => {
    const wrong = await handler(request('wrong-synthetic-password'));
    assert.equal(wrong.status, 401);
    assert.deepEqual(await wrong.json(), { error: 'UNAUTHORIZED' });
    assert.equal(wrong.headers.get('cache-control'), 'no-store, private, max-age=0');
    assert.equal((await handler(request(testPassword, 'POST'))).status, 405);
  });
});

test('reports disconnected clearly when the function token is absent', async () => {
  await withFixtures('', noFetch, async () => {
    const response = await handler(request());
    const data = await response.json();
    assert.equal(data.connected, false);
    assert.deepEqual(data.entries, []);
  });
});

test('normalizes RSVP form fields and paginates without returning credentials', async () => {
  const submissions = Array.from({ length: 101 }, (_, i) => ({
    id: `synthetic-${i}`, created_at: '2026-11-10T00:00:00Z',
    data: { guest_name: `Synthetic Guest ${i}`, attendance: i === 100 ? 'no' : 'yes', guests: '3',
      contact: 'fixture@example.invalid', message: 'Synthetic local fixture.' }
  }));
  let calls = 0;
  await withFixtures('synthetic-upstream-token', async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'api.netlify.com');
    assert.equal(parsed.pathname, '/api/v1/forms/6af13b60bcc7393e2a739b9e/submissions');
    assert.equal(options.headers.authorization, 'Bearer synthetic-upstream-token');
    calls++;
    assert.equal(parsed.searchParams.get('page'), String(calls));
    return Response.json(submissions.slice((calls - 1) * 100, calls * 100));
  }, async () => {
    const response = await handler(request());
    const text = await response.text();
    const data = JSON.parse(text);
    assert.equal(data.connected, true);
    assert.equal(data.entries.length, 101);
    assert.equal(data.entries[0].name, 'Synthetic Guest 0');
    assert.equal(data.entries[0].guests, 3);
    assert.equal(data.entries[100].guests, 0);
    assert.equal(data.entries[100].attendance, 'no');
    assert.equal(data.truncated, false);
    assert.equal(calls, 2);
    assert.ok(!text.includes('synthetic-upstream-token'));
    assert.ok(!text.includes(testPassword));
  });
});

test('reports invalid upstream credentials instead of claiming sync success', async () => {
  await withFixtures('synthetic-upstream-token', async () => new Response('', { status: 403 }), async () => {
    const response = await handler(request());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'TOKEN_NOT_AUTHORIZED' });
  });
});

test('reports malformed upstream responses without exposing them', async () => {
  await withFixtures('synthetic-upstream-token', async () => Response.json({ unexpected: 'synthetic' }), async () => {
    const response = await handler(request());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'UNEXPECTED_API_FORMAT' });
  });
});
