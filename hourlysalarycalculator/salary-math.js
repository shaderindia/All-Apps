/* Pure salary calculations and Romanian public-holiday calendar, shared by the
   salary UI, the A4 report, the Excel export and the regression tests. */
(function (root) {
  'use strict';

  const DEFAULT_SHIFT_HOURS = 8;

  function pad(value) { return String(value).padStart(2, '0'); }

  function parseMonthKey(monthKey) {
    if (typeof monthKey !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) throw new RangeError('Invalid month key.');
    const [year, month] = monthKey.split('-').map(Number);
    return { year, month };
  }

  function daysInMonth(monthKey) {
    const { year, month } = parseMonthKey(monthKey);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function dayOfWeek(monthKey, day) {
    const { year, month } = parseMonthKey(monthKey);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  function isWeekend(monthKey, day) {
    const weekday = dayOfWeek(monthKey, day);
    return weekday === 0 || weekday === 6;
  }

  /* Orthodox Easter (Meeus Julian algorithm), converted to the Gregorian calendar. */
  function orthodoxEaster(year) {
    const a = year % 4, b = year % 7, c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const julianMonth = Math.floor((d + e + 114) / 31);
    const julianDay = ((d + e + 114) % 31) + 1;
    const offset = Math.floor(year / 100) - Math.floor(year / 400) - 2;
    return new Date(Date.UTC(year, julianMonth - 1, julianDay + offset));
  }

  const holidayCache = new Map();

  /* Legal public holidays in Romania (Labour Code, art. 139). Returns a Map of 'MM-DD' -> name. */
  function romanianHolidays(year) {
    if (holidayCache.has(year)) return holidayCache.get(year);
    const holidays = new Map();
    const add = (date, name) => {
      const key = `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
      holidays.set(key, holidays.has(key) ? `${holidays.get(key)} / ${name}` : name);
    };
    const fixed = (month, day, name) => add(new Date(Date.UTC(year, month - 1, day)), name);
    const easter = orthodoxEaster(year);
    const fromEaster = (days, name) => add(new Date(easter.getTime() + days * 86400000), name);

    fixed(1, 1, "New Year's Day");
    fixed(1, 2, "Day after New Year's");
    if (year >= 2024) { fixed(1, 6, 'Epiphany (Boboteaza)'); fixed(1, 7, 'St. John the Baptist'); }
    if (year >= 2017) fixed(1, 24, 'Union of the Principalities');
    if (year >= 2018) fromEaster(-2, 'Orthodox Good Friday');
    fromEaster(0, 'Orthodox Easter');
    fromEaster(1, 'Orthodox Easter Monday');
    fixed(5, 1, 'Labour Day');
    if (year >= 2017) fixed(6, 1, "Children's Day");
    fromEaster(49, 'Pentecost (Rusalii)');
    fromEaster(50, 'Pentecost Monday');
    fixed(8, 15, 'Assumption of Mary');
    fixed(11, 30, "St. Andrew's Day");
    fixed(12, 1, 'National Day');
    fixed(12, 25, 'Christmas Day');
    fixed(12, 26, 'Second day of Christmas');

    holidayCache.set(year, holidays);
    return holidays;
  }

  function holidayName(monthKey, day) {
    const { year, month } = parseMonthKey(monthKey);
    return romanianHolidays(year).get(`${pad(month)}-${pad(day)}`) || '';
  }

  /* Working days = Monday-Friday that are not Romanian public holidays. */
  function workingDays(monthKey, { excludeHolidays = true } = {}) {
    let count = 0;
    for (let day = 1; day <= daysInMonth(monthKey); day++) {
      if (isWeekend(monthKey, day)) continue;
      if (excludeHolidays && holidayName(monthKey, day)) continue;
      count++;
    }
    return count;
  }

  function standardMonthlyHours(monthKey, hoursPerDay = DEFAULT_SHIFT_HOURS, options) {
    return workingDays(monthKey, options) * hoursPerDay;
  }

  function positive(value, fallback) {
    const number = parseFloat(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function normalizeSettings(settings = {}) {
    const salary = positive(settings.salary, 0);
    const fixedBaseHours = positive(settings.fixedBaseHours, 0);
    return {
      salary,
      fixedBaseHours,
      hourlyRate: fixedBaseHours > 0 ? salary / fixedBaseHours : 0,
      weekendRate: positive(settings.weekendRate, 1) || 1,
      nightRate: positive(settings.nightRate, 1) || 1,
      cShiftRate: positive(settings.cShiftRate, 1) || 1,
      holidayRate: positive(settings.holidayRate, 1) || 1,
      useHolidays: settings.useHolidays !== false
    };
  }

  /* A public holiday uses the larger of the holiday and weekend multipliers (never both),
     then night / C shift multipliers compound on top. */
  function dayMultiplier({ weekend, holiday, shift }, rates) {
    const dayRate = holiday ? Math.max(rates.holidayRate, weekend ? rates.weekendRate : 1) : (weekend ? rates.weekendRate : 1);
    const value = String(shift || '').toLowerCase();
    return dayRate * (value === 'night' ? rates.nightRate : 1) * (value === 'c' ? rates.cShiftRate : 1);
  }

  function calculateSalary(monthKey, data = {}, settings = {}) {
    const rates = normalizeSettings(settings);
    const totals = {
      hourlyRate: rates.hourlyRate, totalHours: 0, weekdayHours: 0, weekendHours: 0, holidayHours: 0,
      nightHours: 0, cShiftHours: 0, otShiftHours: 0, daysWorked: 0, daysOff: 0, gross: 0,
      basePay: 0, premiumPay: 0, extraHours: 0, effectiveHourlyRate: 0, days: []
    };
    for (let day = 1; day <= daysInMonth(monthKey); day++) {
      const raw = data.hours?.[day];
      const hoursNumber = parseFloat(raw);
      const hours = Number.isFinite(hoursNumber) && hoursNumber > 0 ? Math.min(hoursNumber, 24) : 0;
      const shift = typeof data.shifts?.[day] === 'string' ? data.shifts[day] : '';
      const weekend = isWeekend(monthKey, day);
      const holiday = rates.useHolidays ? holidayName(monthKey, day) : '';
      const multiplier = dayMultiplier({ weekend, holiday: Boolean(holiday), shift }, rates);
      const pay = hours * rates.hourlyRate * multiplier;
      totals.totalHours += hours;
      if (weekend) totals.weekendHours += hours; else totals.weekdayHours += hours;
      if (holiday) totals.holidayHours += hours;
      if (shift === 'Night') totals.nightHours += hours;
      if (shift === 'C') totals.cShiftHours += hours;
      if (shift === 'OT') totals.otShiftHours += hours;
      if (hours > 0) totals.daysWorked++; else totals.daysOff++;
      totals.gross += pay;
      totals.basePay += hours * rates.hourlyRate;
      totals.days.push({ day, hours, shift, weekend, holiday, multiplier, pay });
    }
    totals.premiumPay = totals.gross - totals.basePay;
    totals.extraHours = rates.fixedBaseHours > 0 ? totals.totalHours - rates.fixedBaseHours : 0;
    totals.effectiveHourlyRate = totals.totalHours > 0 ? totals.gross / totals.totalHours : 0;
    return totals;
  }

  const api = Object.freeze({
    daysInMonth, dayOfWeek, isWeekend, orthodoxEaster, romanianHolidays, holidayName,
    workingDays, standardMonthlyHours, normalizeSettings, dayMultiplier, calculateSalary
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShaderSalary = api;
})(globalThis);
