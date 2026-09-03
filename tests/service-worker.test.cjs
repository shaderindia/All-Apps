const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function worker() {
  const handlers = {};
  const stored = new Map();
  const added = [];
  const deleted = [];
  const key = request => typeof request === 'string' ? request : request.url;
  const cache = {
    add: async url => added.push(url),
    put: async (request, response) => stored.set(key(request), response)
  };
  vm.runInNewContext(source, {
    self: {
      addEventListener: (type, handler) => { handlers[type] = handler; },
      skipWaiting() {},
      clients: { claim() {} }
    },
    caches: {
      open: async () => cache,
      match: async request => stored.get(key(request))?.clone(),
      keys: async () => ['shader7-v18', 'shader7-v19', 'another-app-cache'],
      delete: async name => deleted.push(name)
    },
    fetch: async () => { throw new Error('offline'); },
    URL, Response, console
  });
  return {
    stored, added, deleted,
    lifecycle(type) {
      let pending;
      handlers[type]({ waitUntil(value) { pending = value; } });
      return pending;
    },
    fetch(url, mode = 'navigate') {
      let response;
      handlers.fetch({
        request: { url, method: 'GET', mode, headers: new Headers() },
        respondWith(value) { response = value; }
      });
      return response;
    }
  };
}

test('install downloads a small directory shell, not every tool and CAD texture', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.ok(sw.added.includes('/offline.html'));
  assert.ok(sw.added.includes('/css/landing.css'));
  assert.ok(sw.added.includes('/js/landing.js'));
  assert.ok(sw.added.every(url => !url.includes('/cnc-machinist/')));
  const bytes = sw.added.reduce((total, url) => total + fs.statSync(path.join(root, url === '/' ? 'index.html' : url.slice(1))).size, 0);
  assert.ok(bytes < 600_000, `Precache exceeds 600 KB: ${bytes}`);
});

test('offline navigation reuses a previously visited tool', async () => {
  const sw = worker();
  const url = 'https://shader7.com/cnc-machinist/Triangle/index.html';
  sw.stored.set(url, new Response('saved triangle tool'));
  sw.stored.set('/offline.html', new Response('offline explanation'));
  assert.equal(await (await sw.fetch(url)).text(), 'saved triangle tool');
});

test('an uncached tool opened offline shows an explanation, not the homepage at a nested URL', async () => {
  const sw = worker();
  sw.stored.set('/offline.html', new Response('offline explanation'));
  assert.equal(await (await sw.fetch('https://shader7.com/cnc-machinist/3DCADWEB/')).text(), 'offline explanation');
});

test('failed asset requests never receive homepage HTML as an image or script', async () => {
  const sw = worker();
  const response = await sw.fetch('https://shader7.com/assets/missing.webp', 'no-cors');
  assert.equal(response.type, 'error');
});

test('cached assets remain available offline', async () => {
  const sw = worker();
  const url = 'https://shader7.com/assets/home/passport.webp';
  sw.stored.set(url, new Response('cached image'));
  assert.equal(await (await sw.fetch(url, 'no-cors')).text(), 'cached image');
});

test('activation clears only outdated Shader7 caches', async () => {
  const sw = worker();
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, ['shader7-v18']);
});
