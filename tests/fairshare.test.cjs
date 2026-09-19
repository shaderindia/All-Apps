const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../fairshare/fairshare-core.js');

test('allocates every cent for an equal split that does not divide evenly', () => {
  const result = core.calculateSettlement([
    {id: 'a', name: 'A', spent: 100, weight: 1},
    {id: 'b', name: 'B', spent: 0, weight: 1},
    {id: 'c', name: 'C', spent: 0, weight: 1}
  ]);
  assert.equal(result.total, 100);
  assert.deepEqual(result.balances.map(person => person.share), [33.34, 33.33, 33.33]);
  assert.equal(result.balances.reduce((sum, person) => sum + Math.round(person.balance * 100), 0), 0);
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.amount, 0), 66.66);
});

test('supports weighted shares and produces a compact balanced payment plan', () => {
  const result = core.calculateSettlement([
    {id: 'a', name: 'Alex', spent: 0, weight: 2},
    {id: 'b', name: 'Blair', spent: 120, weight: 1},
    {id: 'c', name: 'Casey', spent: 60, weight: 1}
  ]);
  assert.deepEqual(result.balances.map(person => person.share), [90, 45, 45]);
  assert.deepEqual(result.payments, [
    {from: 'Alex', to: 'Blair', amount: 75},
    {from: 'Alex', to: 'Casey', amount: 15}
  ]);
});

test('rejects invalid groups instead of silently changing their values', () => {
  assert.throws(() => core.calculateSettlement([{name: 'Only one', spent: 10, weight: 1}]), /at least two/);
  assert.throws(() => core.calculateSettlement([
    {name: 'Same', spent: 10, weight: 1},
    {name: 'same', spent: 0, weight: 1}
  ]), /used more than once/);
  assert.throws(() => core.calculateSettlement([
    {name: 'A', spent: 10, weight: 0},
    {name: 'B', spent: 0, weight: 1}
  ]), /share weight/);
});

test('the FairShare page exposes every DOM binding used by the controller', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'fairshare', 'app.html'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'fairshare', 'app.js'), 'utf8');
  const bindings = [...controller.matchAll(/byId\('([^']+)'\)/g)].map(match => match[1]);
  assert.ok(bindings.length > 20, 'expected controller DOM bindings');
  bindings.forEach(id => assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`));
  assert.match(html, /src="fairshare-core\.js/);
  assert.match(html, /src="app\.js/);
  assert.match(html, /href="fairshare\.css/);
});

test('Romanian leu is the default and invalid currency values fall back to RON', () => {
  assert.equal(core.normalizeCurrency(undefined), 'RON');
  assert.equal(core.normalizeCurrency('unknown'), 'RON');
  assert.equal(core.normalizeCurrency('EUR'), 'EUR');
  assert.ok(core.CURRENCIES.has('RON'));
});
