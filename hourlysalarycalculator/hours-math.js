/* Pure calendar and hours calculations, shared by the UI and regression tests. */
(function (root) {
  'use strict';
  const SHIFT_HOURS = Object.freeze({ '8': 8, '12': 12, '0': 0, A: 8, B: 8, C: 8, Day: 12, Night: 12 });
  const SHIFTS = Object.freeze({ '': 'Not selected', '8': '8 hrs', '12': '12 hrs', '0': 'Off', A: 'A', B: 'B', C: 'C', Day: 'Day', Night: 'Night Shift', OT: 'OT' });
  const STORAGE_PREFIX = 'shader7_hours_v1_';

  function isMonthKey(value) {
    return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900;
  }
  function getMonthDays(monthKey) {
    if (!isMonthKey(monthKey)) throw new RangeError('Choose a valid month from 1900 onward.');
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  function dayOfWeek(monthKey, day) {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }
  function normalizeHours(value) {
    if (value === '' || value === null || value === undefined) return '';
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    if (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value)) return '';
    const hours = Number(value);
    return Number.isFinite(hours) && hours >= 0 && hours <= 24 && Number.isInteger(hours * 2) ? String(hours) : '';
  }
  function normalizeMonthData(monthKey, input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const hours = {}, shifts = {};
    for (let day = 1; day <= getMonthDays(monthKey); day++) {
      hours[day] = normalizeHours(source.hours?.[day]);
      const shift = source.shifts?.[day];
      shifts[day] = typeof shift === 'string' && Object.hasOwn(SHIFTS, shift) ? shift : '';
    }
    return {
      version: 1, month: monthKey, hours, shifts,
      employeeName: typeof source.employeeName === 'string' ? source.employeeName.slice(0, 100) : '',
      companyName: typeof source.companyName === 'string' ? source.companyName.slice(0, 100) : ''
    };
  }
  function calculateHours(monthKey, input = {}) {
    const data = normalizeMonthData(monthKey, input);
    const totals = { totalHours: 0, weekdayHours: 0, weekendHours: 0, nightHours: 0, cShiftHours: 0, overtimeHours: 0, daysWorked: 0, daysOff: 0, daysUnlogged: 0, daysLogged: 0, averageHours: 0 };
    for (let day = 1; day <= getMonthDays(monthKey); day++) {
      const raw = data.hours[day], hours = Number(raw) || 0;
      const weekday = dayOfWeek(monthKey, day);
      totals.totalHours += hours;
      totals[weekday === 0 || weekday === 6 ? 'weekendHours' : 'weekdayHours'] += hours;
      if (data.shifts[day] === 'Night') totals.nightHours += hours;
      if (data.shifts[day] === 'C') totals.cShiftHours += hours;
      if (data.shifts[day] === 'OT') totals.overtimeHours += hours;
      if (raw !== '') {
        totals.daysLogged++;
        if (hours > 0) totals.daysWorked++; else totals.daysOff++;
      } else totals.daysUnlogged++;
    }
    totals.averageHours = totals.daysWorked ? totals.totalHours / totals.daysWorked : 0;
    return totals;
  }
  function defaultHoursForShift(shift) {
    return Object.hasOwn(SHIFT_HOURS, shift) ? String(SHIFT_HOURS[shift]) : null;
  }
  function storageKey(monthKey) {
    getMonthDays(monthKey);
    return STORAGE_PREFIX + monthKey;
  }
  const api = Object.freeze({ SHIFTS, isMonthKey, getMonthDays, dayOfWeek, normalizeHours, normalizeMonthData, calculateHours, defaultHoursForShift, storageKey });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShaderHours = api;
})(globalThis);
