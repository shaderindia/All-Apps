(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Shader7Attendance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

  function assertMonthKey(monthKey) {
    if (!MONTH_KEY.test(monthKey || '') || Number(monthKey.slice(0, 4)) < 1900) {
      throw new RangeError('Choose a valid month from 1900 onward.');
    }
    return monthKey;
  }

  function clampMonthCount(value) {
    const count = Number(value);
    return Number.isInteger(count) && count >= 1 && count <= 3 ? count : 1;
  }

  function getMonthSequence(startMonth, count) {
    assertMonthKey(startMonth);
    const safeCount = clampMonthCount(count);
    const [year, month] = startMonth.split('-').map(Number);
    return Array.from({ length: safeCount }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 1 + index, 1));
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    });
  }

  function getMonthDays(monthKey) {
    assertMonthKey(monthKey);
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function getMonthRows(monthKey, locale = 'en-GB') {
    assertMonthKey(monthKey);
    const [year, month] = monthKey.split('-').map(Number);
    const days = getMonthDays(monthKey);
    return Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      if (day > days) return { day, empty: true, weekday: '', weekend: false };
      const date = new Date(Date.UTC(year, month - 1, day));
      const weekdayIndex = date.getUTCDay();
      return {
        day,
        empty: false,
        weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date),
        weekend: weekdayIndex === 0 || weekdayIndex === 6
      };
    });
  }

  function formatMonth(monthKey, locale = 'en-GB') {
    assertMonthKey(monthKey);
    const [year, month] = monthKey.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }

  return { assertMonthKey, clampMonthCount, getMonthSequence, getMonthDays, getMonthRows, formatMonth };
});
