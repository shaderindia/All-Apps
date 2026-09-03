const test = require('node:test');
const assert = require('node:assert/strict');
const hours = require('../hourlysalarycalculator/hours-math.js');

test('calendar handles leap years, century rules and month boundaries', () => {
  assert.equal(hours.getMonthDays('2024-02'), 29);
  assert.equal(hours.getMonthDays('2026-02'), 28);
  assert.equal(hours.getMonthDays('1900-02'), 28);
  assert.equal(hours.getMonthDays('2000-02'), 29);
  assert.equal(hours.getMonthDays('2026-04'), 30);
  assert.equal(hours.getMonthDays('2026-12'), 31);
  assert.equal(hours.dayOfWeek('2026-09', 5), 6);
  for (const bad of ['', '2026-13', '2026-00', '2026-2', 'bad', '0099-01']) assert.throws(() => hours.getMonthDays(bad));
});
test('weekend night shifts count once in total hours, with independent breakdowns', () => {
  const result = hours.calculateHours('2026-09', {
    hours: { 1: '8', 2: '7.5', 5: '12', 6: '4.5', 7: '0' },
    shifts: { 1: 'A', 2: 'C', 5: 'Night', 6: 'OT', 7: '0' }
  });
  assert.equal(result.totalHours, 32);
  assert.equal(result.weekdayHours, 15.5);
  assert.equal(result.weekendHours, 16.5);
  assert.equal(result.nightHours, 12);
  assert.equal(result.cShiftHours, 7.5);
  assert.equal(result.overtimeHours, 4.5);
  assert.equal(result.daysWorked, 4);
  assert.equal(result.daysOff, 1);
  assert.equal(result.daysUnlogged, 25);
  assert.equal(result.averageHours, 8);
});
test('shift presets fill familiar hours; OT and an unset shift preserve manual hours', () => {
  for (const shift of ['A', 'B', 'C', '8']) assert.equal(hours.defaultHoursForShift(shift), '8');
  for (const shift of ['Day', 'Night', '12']) assert.equal(hours.defaultHoursForShift(shift), '12');
  assert.equal(hours.defaultHoursForShift('0'), '0');
  assert.equal(hours.defaultHoursForShift('OT'), null);
  assert.equal(hours.defaultHoursForShift(''), null);
});
test('corrupt saved values cannot inflate totals or leak out-of-month days', () => {
  const data = hours.normalizeMonthData('2026-02', { hours: { 1: -8, 2: 25, 3: 'Infinity', 4: true, 5: 7.25, 6: 24, 7: '0.5', 29: 12, 31: 16 }, shifts: { 1: '<script>', 6: 'Night' }, salary: 4000, employeeName: { unsafe: true } });
  assert.equal(hours.calculateHours('2026-02', data).totalHours, 24.5);
  assert.equal(data.shifts[1], '');
  assert.equal(data.hours[29], undefined);
  assert.equal(data.salary, undefined);
  assert.equal(data.employeeName, '');
  assert.equal(hours.calculateHours('2026-02', null).totalHours, 0);
});
test('empty days differ from days explicitly marked off', () => {
  const result = hours.calculateHours('2024-02', { hours: { 29: '0' }, shifts: { 29: '0' } });
  assert.equal(result.daysOff, 1);
  assert.equal(result.daysUnlogged, 28);
  assert.equal(result.averageHours, 0);
});
test('saved months use a distinct namespace from the salary calculator', () => {
  assert.equal(hours.storageKey('2026-09'), 'shader7_hours_v1_2026-09');
  assert.notEqual(hours.storageKey('2026-09'), 'calendarData_2026-09');
  assert.notEqual(hours.storageKey('2026-09'), hours.storageKey('2026-10'));
});
