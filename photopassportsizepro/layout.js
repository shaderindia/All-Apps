(function (root) {
  'use strict';
  function calculateLayout(dims, page, count) {
    const fail = error => ({ valid: false, error, columns: 0, rows: 0, capacity: 0 });
    if (![page.w, page.h, dims.w, dims.h].every(n => Number.isFinite(n) && n > 0) ||
        ![dims.gapH, dims.gapV, dims.marginL, dims.marginT].every(n => Number.isFinite(n) && n >= 0)) {
      return fail('Enter positive photo and paper dimensions, with zero or positive gaps and margins.');
    }
    if (Math.round(page.w) < 1 || Math.round(page.h) < 1 || Math.round(dims.w) < 1 || Math.round(dims.h) < 1) {
      return fail('Photo and paper dimensions must be at least one pixel at the selected DPI.');
    }
    if (page.w > 8192 || page.h > 8192 || Math.round(page.w) * Math.round(page.h) > 20000000) {
      return fail('This sheet is too large to export safely. Lower the DPI or choose a smaller paper size (maximum 20 megapixels).');
    }
    const columns = Math.max(0, Math.floor((Math.round(page.w) - dims.marginL + dims.gapH + 1e-7) / (dims.w + dims.gapH)));
    const rows = Math.max(0, Math.floor((Math.round(page.h) - dims.marginT + dims.gapV + 1e-7) / (dims.h + dims.gapV)));
    const capacity = columns * rows;
    if (!capacity) return fail('The photo does not fit on this paper. Reduce the photo size or margins, or choose larger paper.');
    const validCount = Number.isInteger(count) && count >= 1 && count <= 200;
    const fits = validCount && count <= capacity;
    return { valid: fits, columns, rows, capacity,
      error: !validCount ? 'Choose a whole photo count from 1 to 200.' :
        !fits ? `Only ${capacity} photos fit on this sheet. Reduce the count or use “Max Photos Per Page”.` : '' };
  }
  const api = { calculateLayout };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PassportLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
