const test = require('node:test');
const assert = require('node:assert/strict');
const salary = require('../hourlysalarycalculator/salary-math.js');

const iso = date => date.toISOString().slice(0, 10);

test('Orthodox Easter dates match published calendars', () => {
  assert.equal(iso(salary.orthodoxEaster(2024)), '2024-05-05');
  assert.equal(iso(salary.orthodoxEaster(2025)), '2025-04-20');
  assert.equal(iso(salary.orthodoxEaster(2026)), '2026-04-12');
  assert.equal(iso(salary.orthodoxEaster(2027)), '2027-05-02');
});

test('Romania has 17 legal public holidays in 2026 with moveable feasts on the right days', () => {
  const holidays = salary.romanianHolidays(2026);
  assert.equal(holidays.size, 16); // June 1 is both Children's Day and Pentecost Monday in 2026
  assert.match(holidays.get('06-01'), /Children's Day/);
  assert.match(holidays.get('06-01'), /Pentecost Monday/);
  assert.equal(holidays.get('04-10'), 'Orthodox Good Friday');
  assert.equal(holidays.get('04-13'), 'Orthodox Easter Monday');
  assert.equal(holidays.get('05-31'), 'Pentecost (Rusalii)');
  for (const key of ['01-01', '01-02', '01-06', '01-07', '01-24', '05-01', '08-15', '11-30', '12-01', '12-25', '12-26']) assert.ok(holidays.has(key), key);
  assert.equal(salary.romanianHolidays(2027).size, 17);
});

test('working days exclude weekends and weekday public holidays', () => {
  assert.equal(salary.workingDays('2026-01'), 18); // 22 weekdays minus Jan 1, 2, 6, 7
  assert.equal(salary.workingDays('2026-01', { excludeHolidays: false }), 22);
  assert.equal(salary.standardMonthlyHours('2026-12'), 21 * 8); // 23 weekdays minus Dec 1, 25
  assert.equal(salary.workingDays('2026-11'), 20); // Nov 30 is a Monday
});

test('salary compounds weekend, night and C shift multipliers per day', () => {
  // Sept 2026: 1st Tue, 5th Sat, 6th Sun
  const result = salary.calculateSalary('2026-09',
    { hours: { 1: '8', 2: '8', 5: '12', 6: '8' }, shifts: { 1: 'A', 2: 'C', 5: 'Night', 6: '8' } },
    { salary: 4000, fixedBaseHours: 160, weekendRate: 1.5, nightRate: 1.25, cShiftRate: 1.1 });
  assert.equal(result.hourlyRate, 25);
  assert.equal(result.totalHours, 36);
  assert.equal(result.weekdayHours, 16);
  assert.equal(result.weekendHours, 20);
  assert.equal(result.nightHours, 12);
  assert.equal(result.cShiftHours, 8);
  const expected = 8 * 25 + 8 * 25 * 1.1 + 12 * 25 * 1.5 * 1.25 + 8 * 25 * 1.5;
  assert.ok(Math.abs(result.gross - expected) < 1e-9);
  assert.equal(result.daysWorked, 4);
  assert.equal(result.extraHours, 36 - 160);
});

test('holidays use the larger of holiday and weekend rates and default to no change', () => {
  const settings = { salary: 1600, fixedBaseHours: 160, weekendRate: 1.5, nightRate: 1.25 };
  // 2026-12-01 is a Tuesday holiday, 2026-12-26 is a Saturday holiday
  const data = { hours: { 1: '8', 26: '8' }, shifts: { 1: 'Night', 26: '8' } };
  const plain = salary.calculateSalary('2026-12', data, settings);
  assert.equal(plain.gross, 8 * 10 * 1.25 + 8 * 10 * 1.5);
  assert.equal(plain.holidayHours, 16);
  const doubled = salary.calculateSalary('2026-12', data, { ...settings, holidayRate: 2 });
  assert.equal(doubled.gross, 8 * 10 * 2 * 1.25 + 8 * 10 * 2);
  const off = salary.calculateSalary('2026-12', data, { ...settings, holidayRate: 2, useHolidays: false });
  assert.equal(off.holidayHours, 0);
  assert.equal(off.gross, plain.gross);
});

test('bad inputs never produce negative or infinite pay', () => {
  const result = salary.calculateSalary('2026-02',
    { hours: { 1: '-8', 2: 'abc', 3: '99', 30: '8' }, shifts: { 3: { bad: true } } },
    { salary: -100, fixedBaseHours: 0, weekendRate: 'x' });
  assert.equal(result.gross, 0);
  assert.equal(result.hourlyRate, 0);
  assert.equal(result.totalHours, 24);
  assert.equal(result.days.length, 28);
});
