(function (root) {
  'use strict';
  function outputDimensions(sw, sh, width, height, crop) {
    if (![sw, sh].every(n => Number.isFinite(n) && n > 0) ||
        [width, height].some(n => n != null && (!Number.isFinite(n) || n <= 0))) {
      throw new Error('Enter positive image dimensions.');
    }
    const ratio = sw / sh;
    let w = width || (height ? height * ratio : sw);
    let h = height || (width ? width / ratio : sh);
    if (width && height && !crop) {
      const scale = Math.min(width / sw, height / sh);
      w = sw * scale; h = sh * scale;
    }
    const scale = Math.min(1, 8000 / w, 8000 / h, Math.sqrt(20000000 / (w * h)));
    if (scale < 1 && (width || height)) {
      throw new Error('Choose smaller dimensions: maximum 8,000 pixels per side and 20 megapixels.');
    }
    return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
  }

  function toPixels(value, unit, dpi) {
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(dpi) || dpi <= 0) {
      throw new Error('Enter positive dimensions and resolution.');
    }
    const factors = { px: 1, inch: dpi, cm: dpi / 2.54, mm: dpi / 25.4 };
    if (!(unit in factors)) throw new Error('Choose a supported measurement unit.');
    return Math.max(1, Math.round(value * factors[unit]));
  }

  // draw() and encode() are supplied by the UI so each job owns its canvas.
  async function compress({ width, height, targetBytes, format, allowResize, draw, encode, cancelled = () => false }) {
    if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new Error('Choose a valid target file size.');
    let w = width, h = height;
    const check = () => { if (cancelled()) throw new Error('Compression cancelled.'); };
    async function encodeAt(quality) {
      check();
      const blob = await encode(format, quality);
      check();
      if (!blob || !blob.size) throw new Error('The browser could not create this image.');
      if (blob.type !== format) throw new Error('This browser cannot export that format. Choose JPG or PNG.');
      return blob;
    }
    for (let attempt = 0; attempt < 16; attempt++) {
      check(); draw(w, h);
      if (format === 'image/png') {
        return { blob: await encodeAt(1), width: w, height: h, quality: null };
      }
      let blob = await encodeAt(.92);
      if (blob.size <= targetBytes) return { blob, width: w, height: h, quality: .92 };
      blob = await encodeAt(.1);
      if (blob.size <= targetBytes) {
        let low = .1, high = .92, best = blob;
        for (let search = 0; search < 8; search++) {
          const quality = (low + high) / 2;
          const candidate = await encodeAt(quality);
          if (candidate.size <= targetBytes) { low = quality; best = candidate; }
          else high = quality;
        }
        return { blob: best, width: w, height: h, quality: low };
      }
      if (!allowResize || attempt === 15 || (w === 1 && h === 1)) {
        return { blob, width: w, height: h, quality: .1 };
      }
      const scale = Math.max(.5, Math.min(.9, Math.sqrt(targetBytes / blob.size) * .95));
      w = Math.max(1, Math.floor(w * scale));
      h = Math.max(1, Math.floor(h * scale));
    }
  }
  const api = { outputDimensions, toPixels, compress };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoCompression = api;
})(typeof window === 'undefined' ? globalThis : window);
