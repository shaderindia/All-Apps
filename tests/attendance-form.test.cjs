const test = require('node:test');
const assert = require('node:assert/strict');
const attendance = require('../hourlysalarycalculator/attendance-core.js');

test('one to three consecutive months roll across years', () => {
  assert.deepEqual(attendance.getMonthSequence('2026-11', 3), ['2026-11', '2026-12', '2027-01']);
  assert.deepEqual(attendance.getMonthSequence('2026-04', 2), ['2026-04', '2026-05']);
  assert.deepEqual(attendance.getMonthSequence('2026-04', 1), ['2026-04']);
});

test('every month panel has 31 printable rows and marks unused dates', () => {
  const february = attendance.getMonthRows('2024-02');
  assert.equal(february.length, 31);
  assert.equal(february[28].empty, false);
  assert.equal(february[29].empty, true);
  assert.equal(february[30].empty, true);
  assert.equal(attendance.getMonthRows('2026-01').filter(row => row.empty).length, 0);
});

test('weekends and leap-year boundaries are calculated in UTC', () => {
  assert.equal(attendance.getMonthDays('2024-02'), 29);
  assert.equal(attendance.getMonthDays('2026-02'), 28);
  const rows = attendance.getMonthRows('2026-09');
  assert.equal(rows[4].weekday, 'Sat');
  assert.equal(rows[4].weekend, true);
  assert.equal(rows[6].weekend, false);
});

test('invalid months and page counts are handled safely', () => {
  for (const bad of ['', '2026-2', '2026-00', '2026-13', '1899-12', 'bad']) assert.throws(() => attendance.getMonthRows(bad));
  assert.equal(attendance.clampMonthCount(0), 1);
  assert.equal(attendance.clampMonthCount(4), 1);
  assert.equal(attendance.clampMonthCount('3'), 3);
});
