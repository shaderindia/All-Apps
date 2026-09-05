(function (root) {
  'use strict';

  const DIALECTS = new Set(['fanuc', 'siemens', 'linuxcnc']);
  const UNITS = new Set(['mm', 'in']);

  function finite(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number.`);
    return number;
  }

  function positive(value, label) {
    const number = finite(value, label);
    if (number <= 0) throw new Error(`${label} must be greater than zero.`);
    return number;
  }

  function nonNegative(value, label) {
    const number = finite(value, label);
    if (number < 0) throw new Error(`${label} cannot be negative.`);
    return number;
  }

  function integer(value, label) {
    const number = positive(value, label);
    if (!Number.isInteger(number)) throw new Error(`${label} must be a whole number.`);
    return number;
  }

  function unitScale(unit) {
    if (!UNITS.has(unit)) throw new Error('Choose millimetres or inches for NC output.');
    return unit === 'in' ? 1 / 25.4 : 1;
  }

  function outputNumber(value, unit, decimals) {
    const places = decimals == null ? (unit === 'in' ? 4 : 3) : decimals;
    const factor = 10 ** places;
    const rounded = Math.round(finite(value, 'Output value') * unitScale(unit) * factor) / factor;
    return (Object.is(rounded, -0) ? 0 : rounded).toFixed(places);
  }

  function unitCode(dialect, unit) {
    if (!DIALECTS.has(dialect)) throw new Error('Choose a supported controller dialect.');
    unitScale(unit);
    return dialect === 'siemens' ? (unit === 'in' ? 'G70' : 'G71') : (unit === 'in' ? 'G20' : 'G21');
  }

  function validateCam(input) {
    if (!DIALECTS.has(input.dialect)) throw new Error('Choose a supported controller dialect.');
    if (input.macro && input.dialect !== 'fanuc') throw new Error('Parametric macro output is available for Fanuc/Haas only.');
    const clean = {
      ...input,
      toolDiameter: positive(input.toolDiameter, 'Tool diameter'),
      feed: positive(input.feed, 'Feed rate'),
      plunge: positive(input.plunge, 'Plunge feed'),
      rpm: integer(input.rpm, 'Spindle RPM'),
      safe: finite(input.safe, 'Safe Z'),
      retract: finite(input.retract, 'Retract plane'),
      allowance: nonNegative(input.allowance, 'Stock to leave'),
      toolNumber: integer(input.toolNumber, 'Tool number'),
      offsetNumber: integer(input.offsetNumber, 'H offset number'),
      programNumber: integer(input.programNumber, 'Program number'),
      offsetZ: finite(input.offsetZ, 'Work offset Z'),
      partTop: finite(input.partTop, 'Part top')
    };
    unitScale(input.unit);
    if (clean.safe + clean.offsetZ <= clean.partTop) {
      throw new Error(`Safe Z must be above the part top at work Z ${outputNumber(clean.partTop - clean.offsetZ, input.unit)}.`);
    }
    return clean;
  }

  function validateRetractPlane(retract, offsetZ, surfaceTop, unit = 'mm') {
    const absolute = finite(retract, 'Retract plane') + finite(offsetZ, 'Work offset Z');
    const top = finite(surfaceTop, 'Machining surface');
    if (absolute <= top) {
      throw new Error(`Retract plane must be above the machining surface at work Z ${outputNumber(top - offsetZ, unit)}.`);
    }
    return absolute;
  }

  function heightFieldVolume(heights, nx, ny, cell) {
    if (!heights || heights.length !== nx * ny || nx < 2 || ny < 2) throw new Error('Height field dimensions are invalid.');
    const pitch = positive(cell, 'Height field pitch');
    let volume = 0;
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        const a = y * nx + x;
        const average = (finite(heights[a], 'Height') + finite(heights[a + 1], 'Height') +
          finite(heights[a + nx], 'Height') + finite(heights[a + nx + 1], 'Height')) / 4;
        volume += Math.max(0, average) * pitch * pitch;
      }
    }
    return volume;
  }

  function validateProject(project) {
    if (!project || ![1, 2].includes(project.v)) throw new Error('Unsupported project version.');
    const clean = {
      ...project,
      v: 2,
      L: positive(project.L, 'Stock length'),
      W: positive(project.W, 'Stock width'),
      H: positive(project.H, 'Stock height'),
      unit: UNITS.has(project.unit) ? project.unit : 'mm',
      wcs: /^G5[4-9]$/.test(project.wcs || '') ? project.wcs : 'G54',
      stockOpt: project.stockOpt && typeof project.stockOpt === 'object' ? {...project.stockOpt} : {},
      objects: Array.isArray(project.objects) ? project.objects : [],
      masks: Array.isArray(project.masks) ? project.masks : [],
      off: project.off && typeof project.off === 'object' ? {...project.off} : {x: 0, y: 0, z: 0}
    };
    if (clean.L > 100000 || clean.W > 100000 || clean.H > 100000) throw new Error('Stock dimensions exceed the supported range.');
    if (clean.objects.length > 250 || clean.masks.length > 250) throw new Error('Project contains too many objects or keep-out zones.');
    ['x', 'y', 'z'].forEach(axis => { clean.off[axis] = finite(clean.off[axis], `Work offset ${axis.toUpperCase()}`); });
    clean.stockOpt.cs = nonNegative(clean.stockOpt.cs || 0, 'Stock chamfer');
    clean.stockOpt.rad = nonNegative(clean.stockOpt.rad || 0, 'Stock corner radius');
    ['nx','px','ny','py','fl','fr','bl','br'].forEach(key => { clean.stockOpt[key] = !!clean.stockOpt[key]; });
    clean.objects = clean.objects.map((source, index) => {
      if (!source || !['box','cyl'].includes(source.type) || !['add','sub'].includes(source.mode)) throw new Error(`Object ${index + 1} has an unsupported type or mode.`);
      const object = {...source, id: integer(source.id, `Object ${index + 1} ID`), x: finite(source.x, `Object ${index + 1} X`),
        y: finite(source.y, `Object ${index + 1} Y`), z: finite(source.z, `Object ${index + 1} Z`),
        H: positive(source.H, `Object ${index + 1} height`), cs: nonNegative(source.cs || 0, `Object ${index + 1} chamfer`)};
      if (object.type === 'box') {
        object.L = positive(source.L, `Object ${index + 1} length`);
        object.W = positive(source.W, `Object ${index + 1} width`);
        object.rad = nonNegative(source.rad || 0, `Object ${index + 1} corner radius`);
      } else object.D = positive(source.D, `Object ${index + 1} diameter`);
      if ([object.H, object.L, object.W, object.D].some(value => value != null && value > 100000)) throw new Error(`Object ${index + 1} exceeds the supported size.`);
      return object;
    });
    clean.masks = clean.masks.map((source, index) => {
      if (!source || !['rect','circle'].includes(source.type)) throw new Error(`Keep-out zone ${index + 1} has an unsupported type.`);
      const mask = {...source, id: integer(source.id, `Keep-out zone ${index + 1} ID`), x: finite(source.x, `Keep-out zone ${index + 1} X`),
        y: finite(source.y, `Keep-out zone ${index + 1} Y`), w: positive(source.w, `Keep-out zone ${index + 1} width`)};
      if (mask.type === 'rect') mask.h = positive(source.h, `Keep-out zone ${index + 1} height`);
      return mask;
    });
    const maxObjectId = clean.objects.reduce((max, item) => Math.max(max, item.id), 0);
    const maxMaskId = clean.masks.reduce((max, item) => Math.max(max, item.id), 0);
    clean.nextId = Number.isInteger(Number(project.nextId)) && Number(project.nextId) > maxObjectId ? Number(project.nextId) : maxObjectId + 1;
    clean.nextMid = Number.isInteger(Number(project.nextMid)) && Number(project.nextMid) > maxMaskId ? Number(project.nextMid) : maxMaskId + 1;
    return clean;
  }

  const api = {finite, positive, nonNegative, integer, unitScale, outputNumber, unitCode, validateCam, validateRetractPlane, heightFieldVolume, validateProject};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CadCore = api;
})(typeof window === 'undefined' ? globalThis : window);
