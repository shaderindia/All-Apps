const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, suggestMaterial } = require('../cnc-machinist/millingcalculation/milling-core.js');

const setup = { vc: 120, fz: 0.06, diameter: 12, teeth: 4, ap: 3, ae: 4, length: 150, passes: 1, maxRpm: 8000, maxToolRpm: 12000, maxFeed: 3000, kc: '', availablePower: '' };

test('calculates a milling pass from metric milling formulas', () => {
  const result = calculate(setup);
  assert.equal(result.rpm, 3183);
  assert.equal(result.feed, 763.9);
  assert.ok(Math.abs(result.mrr - 3 * 4 * result.feed / 1000) < 0.001);
  assert.ok(Math.abs(result.minutes - 150 / result.feed) < 0.001);
  assert.equal(result.power, null);
});

test('caps spindle then feed and reports achieved cutting conditions', () => {
  const result = calculate({ ...setup, maxRpm: 2000, maxFeed: 300 });
  assert.equal(result.rpm, 2000);
  assert.equal(result.feed, 300);
  assert.ok(Math.abs(result.actualVc - Math.PI * 12 * 2) < 0.001);
  assert.equal(result.actualFz, 300 / (2000 * 4));
  assert.equal(result.warnings.length, 3); // RPM, feed, and low radial engagement
});

test('optional cutting power uses supplied specific cutting force', () => {
  const result = calculate({ ...setup, kc: 1800, availablePower: 0.1 });
  assert.ok(Math.abs(result.power - 3 * 4 * result.feed * 1800 / 60000000) < 0.001);
  assert.match(result.warnings.join(' '), /exceeds available spindle power/);
});

test('respects the tool assembly RPM rating independently of machine limit', () => {
  const result = calculate({ ...setup, maxToolRpm: 1800 });
  assert.equal(result.rpm, 1800);
  assert.match(result.warnings.join(' '), /tool rating/);
});

test('programmed values never round above machine limits', () => {
  const result = calculate({ ...setup, maxRpm: 2000.8, maxFeed: 300.08 });
  assert.equal(result.rpm, 2000);
  assert.equal(result.feed, 300);
});

test('cutting time scales with identical pass count', () => {
  const one = calculate(setup);
  const three = calculate({ ...setup, passes: 3 });
  assert.equal(three.minutes, one.minutes * 3);
});

test('rejects impossible or missing inputs without returning a setup', () => {
  for (const patch of [{ diameter: 0 }, { ae: 13 }, { teeth: 2.5 }, { passes: 1.5 }, { fz: '' }, { kc: -1 }, { maxFeed: 'abc' }]) {
    assert.ok(calculate({ ...setup, ...patch }).error);
  }
});

test('material selection reads manufacturer values for a 12 mm side-milling reference case', () => {
  assert.deepEqual(
    { vc: suggestMaterial('unalloyed_steel', 12, 6).vc, fz: suggestMaterial('unalloyed_steel', 12, 6).fz },
    { vc: 175, fz: 0.072 }
  );
  assert.deepEqual(
    { vc: suggestMaterial('stainless_austenitic', 12, 6).vc, fz: suggestMaterial('stainless_austenitic', 12, 6).fz },
    { vc: 80, fz: 0.072 }
  );
  assert.deepEqual(
    { vc: suggestMaterial('aluminum_wrought', 12, 6).vc, fz: suggestMaterial('aluminum_wrought', 12, 6).fz },
    { vc: 835, fz: 0.092 }
  );
});

test('material suggestion switches reference case and interpolates between listed diameters', () => {
  const slot = suggestMaterial('low_alloy_steel', 12, 12);
  assert.equal(slot.vc, 110);
  assert.equal(slot.fz, 0.054);
  assert.equal(slot.referenceAp, 0.5);
  const between = suggestMaterial('low_alloy_steel', 11, 5.5);
  assert.equal(between.fz, 0.067);
});

test('material chart boundaries and depth mismatch are explicit', () => {
  assert.equal(suggestMaterial('custom', 12, 6), null);
  assert.match(suggestMaterial('unalloyed_steel', 30, 6).error, /2–25 mm/);
  assert.match(suggestMaterial('unalloyed_steel', 12, 2).error, /Below 30%/);
  const result = calculate({ ...setup, material: 'unalloyed_steel', ap: 13 });
  assert.match(result.warnings.join(' '), /Axial depth exceeds/);
});
