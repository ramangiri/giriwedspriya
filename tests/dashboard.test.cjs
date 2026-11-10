// Real HTML + client code in a DOM, with synthetic responses and no network.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const root = resolve(__dirname, '..');
const fixture = { connected: true, entries: [
  { name: 'Synthetic Guest A', contact: 'fixture@example.invalid', attendance: 'yes', guests: 3 },
  { name: 'Synthetic Guest B', attendance: 'no', guests: 9 }
] };
const csv = 'guest_name,attendance,guests,contact\nSynthetic CSV Guest,yes,4,csv@example.invalid\n';
const flush = () => new Promise(setImmediate);

function setup(t) {
  const dom = new JSDOM(readFileSync(resolve(root, 'admin/index.html'), 'utf8'), {
    runScripts: 'outside-only', url: 'https://fixture.invalid/admin/'
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.AbortController = AbortController;
  const requests = [];
  // Ignore cancellation on purpose to test already-resolved/delayed responses.
  window.fetch = (url, options) => new Promise((resolve, reject) => {
    assert.equal(url, '/.netlify/functions/rsvp-admin');
    requests.push({ options, resolve: data => resolve(Response.json(data)), reject });
  });
  window.eval(readFileSync(resolve(root, 'admin/admin.js'), 'utf8') + '\nwindow.__state = () => ({ authorization, entryCount: allEntries.length });');
  const $ = selector => window.document.querySelector(selector);
  const fire = (selector, type) => $(selector).dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true }));
  const click = selector => $(selector).click();
  async function finish(index, data = fixture) { requests[index].resolve(data); await flush(); }
  async function unlock(data = fixture) {
    $('#password').value = 'synthetic-test-password';
    fire('#loginForm', 'submit');
    await finish(requests.length - 1, data);
    assert.equal($('#dashboard').hidden, false);
  }
  function pendingCSV() {
    let resolve, reject;
    const file = { size: csv.length, text: () => new Promise((yes, no) => { resolve = yes; reject = no; }) };
    Object.defineProperty($('#csvFile'), 'files', { configurable: true, value: [file] });
    fire('#csvFile', 'change');
    return { resolve, reject };
  }
  function locked() {
    assert.equal($('#dashboard').hidden, true);
    assert.equal($('#loginPanel').hidden, false);
    assert.equal($('#logout').hidden, true);
    assert.equal($('#rsvpRows').children.length, 0);
    for (const id of ['peopleCount', 'yesCount', 'noCount', 'totalCount']) assert.equal($('#' + id).textContent, '0');
    for (const id of ['sourceBanner', 'importMessage', 'loginMessage']) assert.equal($('#' + id).textContent, '');
    for (const id of ['password', 'search', 'csvFile']) assert.equal($('#' + id).value, '');
    assert.equal($('#filter').value, 'all');
    assert.equal($('#sourceTag').textContent, 'No data loaded');
    assert.equal($('#refresh').disabled, false);
    assert.equal($('#loginButton').disabled, false);
    assert.ok(!window.document.body.textContent.includes('Synthetic Guest'));
    assert.ok(!window.document.body.textContent.includes('Synthetic CSV'));
    assert.ok(!window.document.body.textContent.includes('@example.invalid'));
    assert.equal(window.localStorage.length + window.sessionStorage.length, 0);
    assert.equal(window.__state().authorization, '');
    assert.equal(window.__state().entryCount, 0);
  }
  return { window, $, fire, click, requests, finish, unlock, pendingCSV, locked };
}

test('lock removes guest rows, counts, search, imports, and credentials', async t => {
  const app = setup(t); await app.unlock();
  assert.equal(app.$('#peopleCount').textContent, '3');
  assert.equal(app.$('#noCount').textContent, '1');
  app.$('#search').value = 'fixture@example.invalid';
  app.$('#filter').value = 'yes';
  app.fire('#search', 'input');
  app.click('#logout'); app.locked();
  assert.equal(app.window.document.activeElement.id, 'password');
});

test('lock aborts refresh and ignores late success even if abort is ignored', async t => {
  const app = setup(t); await app.unlock();
  app.click('#refresh'); app.click('#logout');
  assert.equal(app.requests[1].options.signal.aborted, true);
  await app.finish(1); app.locked();
});

test('lock ignores a late refresh rejection', async t => {
  const app = setup(t); await app.unlock();
  app.click('#refresh'); app.click('#logout');
  app.requests[1].reject(new Error('Synthetic late failure'));
  await flush(); app.locked();
});

test('previous refresh cannot overwrite a newly unlocked session', async t => {
  const app = setup(t); await app.unlock();
  app.click('#refresh'); app.click('#logout');
  await app.unlock({ connected: true, entries: [] });
  await app.finish(1);
  assert.equal(app.$('#dashboard').hidden, false);
  assert.equal(app.$('#rsvpRows').children.length, 0);
  assert.equal(app.$('#totalCount').textContent, '0');
});

test('previous CSV read cannot repopulate a locked dashboard', async t => {
  const app = setup(t); await app.unlock();
  const file = app.pendingCSV(); app.click('#logout');
  file.resolve(csv); await flush(); app.locked();
});

test('previous CSV rejection cannot restore private feedback', async t => {
  const app = setup(t); await app.unlock();
  const file = app.pendingCSV(); app.click('#logout');
  file.reject(new Error('Synthetic CSV failure')); await flush(); app.locked();
});

test('previous CSV read cannot overwrite a new session', async t => {
  const app = setup(t); await app.unlock();
  const file = app.pendingCSV(); app.click('#logout');
  await app.unlock({ connected: true, entries: [] });
  file.resolve(csv); await flush();
  assert.equal(app.$('#rsvpRows').children.length, 0);
  assert.equal(app.$('#importMessage').textContent, '');
  assert.equal(app.$('#sourceTag').textContent, 'Netlify live responses');
});

test('CSV imports work and lock clears their rendered data', async t => {
  const app = setup(t); await app.unlock();
  app.pendingCSV().resolve(csv); await flush();
  assert.equal(app.$('#peopleCount').textContent, '4');
  assert.equal(app.$('#sourceTag').textContent, 'Locally imported CSV');
  app.click('#logout'); app.locked();
});

test('new CSV supersedes a pending server refresh', async t => {
  const app = setup(t); await app.unlock(); app.click('#refresh');
  app.pendingCSV().resolve(csv); await flush(); await app.finish(1);
  assert.equal(app.$('#peopleCount').textContent, '4');
  assert.equal(app.$('#sourceTag').textContent, 'Locally imported CSV');
});

test('new refresh supersedes a pending CSV read', async t => {
  const app = setup(t); await app.unlock();
  const file = app.pendingCSV(); app.click('#refresh');
  await app.finish(1); file.resolve(csv); await flush();
  assert.equal(app.$('#peopleCount').textContent, '3');
  assert.equal(app.$('#sourceTag').textContent, 'Netlify live responses');
});

test('pagehide locks loaded data and cancels an interrupted unlock', async t => {
  const app = setup(t); await app.unlock();
  app.window.dispatchEvent(new app.window.PageTransitionEvent('pagehide', { persisted: true }));
  app.locked();
  app.$('#password').value = 'synthetic-test-password'; app.fire('#loginForm', 'submit');
  app.window.dispatchEvent(new app.window.PageTransitionEvent('pagehide', { persisted: true }));
  await app.finish(1); app.locked();
});

test('locked refresh and CSV events cannot load data', async t => {
  const app = setup(t);
  app.click('#logout'); app.click('#refresh'); app.pendingCSV();
  await flush(); app.locked(); assert.equal(app.requests.length, 0);
});

test('guest form POST fields round-trip into the dashboard contract', async t => {
  const app = setup(t);
  const guestDOM = new JSDOM(readFileSync(resolve(root, 'index.html'), 'utf8'), {
    runScripts: 'outside-only', url: 'https://fixture.invalid/'
  });
  t.after(() => guestDOM.window.close());
  const guest = guestDOM.window;
  let fields;
  guest.fetch = async (url, options) => {
    assert.equal(url, '/'); assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    fields = Object.fromEntries(new URLSearchParams(options.body));
    return new Response('Synthetic accepted');
  };
  const script = readFileSync(resolve(root, 'script.js'), 'utf8');
  const rsvp = script.slice(script.indexOf('const rsvpForm='), script.indexOf('// Boot.'));
  guest.eval('const $ = selector => document.querySelector(selector);\n' + rsvp);
  const form = guest.document.querySelector('#rsvpForm');
  form.elements.guest_name.value = 'Synthetic RSVP Guest';
  form.elements.attendance.value = 'yes';
  form.elements.guests.value = '3';
  form.elements.contact.value = 'rsvp@example.invalid';
  form.elements.message.value = 'Synthetic local regression fixture.';
  form.dispatchEvent(new guest.Event('submit', { cancelable: true })); await flush();
  assert.equal(fields['form-name'], 'wedding-rsvp'); assert.equal(fields['bot-field'], '');
  assert.equal(fields.attendance, 'yes'); assert.equal(fields.guests, '3');
  assert.match(guest.document.querySelector('#rsvpStatus').textContent, /has been received/);
  await app.unlock({ connected: true, entries: [{ name: fields.guest_name, attendance: fields.attendance,
    guests: fields.guests, contact: fields.contact, message: fields.message }] });
  assert.match(app.$('#rsvpRows').textContent, /Synthetic RSVP Guest/);
  assert.equal(app.$('#peopleCount').textContent, '3');
  assert.equal(app.$('#yesCount').textContent, '1');
});
