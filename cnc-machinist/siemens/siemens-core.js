(function (root) {
  'use strict';

  const OPERATIONS = new Set(['rough', 'rough_only', 'finish_only', 'facing']);
  const TURN_TYPES = new Set(['od', 'id']);

  function number(value, label, options = {}) {
    const result = Number(value);
    const min = options.min == null ? 0 : options.min;
    if (!Number.isFinite(result) || (options.allowZero ? result < min : result <= min)) {
      throw new Error(`${label} must be ${options.allowZero ? 'zero or greater' : 'greater than zero'}.`);
    }
    return result;
  }

  function cycle95Variant(operation, turnType) {
    if (!OPERATIONS.has(operation) || operation === 'facing') throw new Error('CYCLE95 is not used for a facing-only operation.');
    if (!TURN_TYPES.has(turnType)) throw new Error('Choose OD or ID turning.');
    const base = operation === 'rough_only' ? 1 : operation === 'finish_only' ? 5 : 9;
    return base + (turnType === 'id' ? 2 : 0);
  }

  function validateTurningInput(input) {
    if (!OPERATIONS.has(input.operation)) throw new Error('Choose a supported machining mode.');
    if (!TURN_TYPES.has(input.turnType)) throw new Error('Choose OD or ID turning.');
    if (input.operation === 'facing' && input.turnType !== 'od') throw new Error('Facing-only mode is available for external turning.');
    const clean = {
      ...input,
      blank: number(input.blank, input.turnType === 'id' ? 'Initial bore diameter' : 'Blank diameter'),
      target: number(input.target, input.turnType === 'id' ? 'Final bore diameter' : 'Target diameter'),
      length: number(input.length, 'Turned length'),
      infeed: number(input.infeed, 'Depth of cut'),
      allowX: number(input.allowX, 'X finishing allowance', {allowZero:true}),
      allowZ: number(input.allowZ, 'Z finishing allowance', {allowZero:true}),
      speed: number(input.speed, input.speedMode === 'G96' ? 'Cutting speed' : 'Spindle speed'),
      lims: number(input.lims, 'Maximum spindle speed'),
      roughFeed: number(input.roughFeed, 'Roughing feed'),
      plungeFeed: number(input.plungeFeed, 'Plunge feed'),
      finishFeed: number(input.finishFeed, 'Finishing feed'),
      dwell: number(input.dwell, 'Chip-breaking dwell', {allowZero:true}),
      chipLength: number(input.chipLength, 'Chip-breaking path length', {allowZero:true}),
      liftOff: number(input.liftOff, 'Lift-off distance', {allowZero:true}),
      stepDia: Number(input.stepDia),
      stepLen: Number(input.stepLen)
    };
    if (!['G96','G97'].includes(input.speedMode)) throw new Error('Choose G96 or G97 spindle mode.');
    if (clean.turnType === 'od' && clean.target >= clean.blank) throw new Error('For OD turning, the target diameter must be smaller than the blank.');
    if (clean.turnType === 'id' && clean.target <= clean.blank) throw new Error('For ID turning, the final bore must be larger than the initial bore.');
    if (input.profile === 'step' || input.profile === 'profile') {
      if (!Number.isFinite(clean.stepLen) || clean.stepLen <= 0 || clean.stepLen >= clean.length) {
        throw new Error('Step length must be greater than zero and shorter than the turned length.');
      }
      const validStepDia = clean.turnType === 'od'
        ? clean.stepDia > clean.target && clean.stepDia < clean.blank
        : clean.stepDia > clean.blank && clean.stepDia < clean.target;
      if (!Number.isFinite(clean.stepDia) || !validStepDia) {
        throw new Error(`Step diameter must be between ${Math.min(clean.blank, clean.target)} and ${Math.max(clean.blank, clean.target)} mm.`);
      }
    }
    return clean;
  }

  function turningMetrics(input) {
    const p = validateTurningInput(input);
    const radialStock = Math.abs(p.blank - p.target) / 2;
    const roughStock = Math.max(0, radialStock - p.allowX / 2);
    const hasRoughing = p.operation === 'rough' || p.operation === 'rough_only';
    const hasFinishing = p.operation === 'rough' || p.operation === 'finish_only';
    const roughPasses = hasRoughing ? Math.ceil(roughStock / p.infeed) : 0;
    const rpmAtBlank = p.speedMode === 'G96' ? Math.min(p.lims, Math.round(p.speed * 1000 / (Math.PI * p.blank))) : Math.round(p.speed);
    const rpmAtTarget = p.speedMode === 'G96' ? Math.min(p.lims, Math.round(p.speed * 1000 / (Math.PI * p.target))) : Math.round(p.speed);
    const minRpm = Math.min(rpmAtBlank, rpmAtTarget);
    const maxRpm = Math.max(rpmAtBlank, rpmAtTarget);
    const avgRpm = Math.max(1, (minRpm + maxRpm) / 2);
    const averageDiameter = (p.blank + p.target) / 2;
    const effectiveCuttingSpeed = p.speedMode === 'G96' ? p.speed : Math.PI * averageDiameter * p.speed / 1000;
    let seconds;
    if (p.operation === 'facing') {
      seconds = ((p.blank / 2 + 2) / (avgRpm * p.roughFeed)) * 60;
    } else {
      const roughSeconds = roughPasses * (p.length / (avgRpm * p.roughFeed)) * 60;
      const finishSeconds = hasFinishing ? (p.length / (avgRpm * p.finishFeed)) * 60 : 0;
      seconds = roughSeconds + finishSeconds + (p.includeFacing ? 6 : 0);
    }
    return {
      params:p,
      roughPasses,
      minRpm,
      maxRpm,
      mrr: Math.round(effectiveCuttingSpeed * p.infeed * p.roughFeed * 10) / 10,
      effectiveCuttingSpeed:Math.round(effectiveCuttingSpeed * 10) / 10,
      estimatedSeconds: Math.max(1, Math.round(seconds))
    };
  }

  function cycle95Call(input, contourName = 'CONTOUR1') {
    const p = validateTurningInput(input);
    const vari = cycle95Variant(p.operation, p.turnType);
    const ff1 = p.operation === 'finish_only' ? 0 : p.roughFeed;
    const ff2 = p.operation === 'finish_only' ? 0 : p.plungeFeed;
    const ff3 = p.operation === 'rough_only' ? 0 : p.finishFeed;
    const fmt = value => Number(value).toFixed(3);
    return {
      vari,
      line:`CYCLE95("${contourName}", ${fmt(p.infeed)}, ${fmt(p.allowZ)}, ${fmt(p.allowX)}, 0, ${fmt(ff1)}, ${fmt(ff2)}, ${fmt(ff3)}, ${vari}, ${fmt(p.dwell)}, ${fmt(p.chipLength)}, ${fmt(p.liftOff)})`
    };
  }

  function calculateSpeedFeed(input) {
    const diameter = number(input.diameter, 'Cutting diameter');
    const cuttingSpeed = number(input.cuttingSpeed, 'Cutting speed');
    const feed = number(input.feed, 'Feed');
    const depth = number(input.depth, 'Depth of cut');
    const radius = number(input.radius, 'Tool nose radius');
    const rpm = cuttingSpeed * 1000 / (Math.PI * diameter);
    const ra = (feed * feed / (32 * radius)) * 1000;
    return {
      rpm:Math.round(rpm),
      tableFeed:Math.round(rpm * feed),
      mrr:Math.round(cuttingSpeed * depth * feed * 10) / 10,
      ra:Math.round(ra * 100) / 100,
      rz:Math.round(ra * 4 * 100) / 100
    };
  }

  function parseToolNumber(label) {
    const match = /^\s*T\s*(\d+)\b/i.exec(String(label || ''));
    if (!match) throw new Error('Tool ID must start with a numeric T number, for example T12 or T12 (ROUGH_OD).');
    const value = Number(match[1]);
    if (!Number.isInteger(value) || value < 1 || value > 99999) throw new Error('Tool number must be from T1 to T99999.');
    return value;
  }

  function normalizeStoredTool(tool) {
    const tNo = Number.isInteger(Number(tool.tNo)) ? Number(tool.tNo) : parseToolNumber(tool.num);
    const fields = ['edge','l1','l2','rad','dir','wx','wz'];
    const result = {...tool, tNo};
    fields.forEach(key => { result[key] = Number(tool[key]); });
    if (!Number.isInteger(tNo) || tNo < 1 || !Number.isInteger(result.edge) || result.edge < 1 ||
        !fields.every(key => Number.isFinite(result[key])) || result.rad < 0 || result.dir < 1 || result.dir > 9) {
      throw new Error('Stored tool data is invalid.');
    }
    result.num = String(tool.num || `T${tNo}`);
    result.type = String(tool.type || 'Rougher');
    result.typeCode = Number(tool.typeCode) || (/finish/i.test(result.type) ? 510 : /groov/i.test(result.type) ? 520 : /thread/i.test(result.type) ? 540 : /drill/i.test(result.type) ? 200 : /mill/i.test(result.type) ? 120 : 500);
    return result;
  }

  function buildTOAArchive(tools, date = new Date().toISOString().slice(0,10)) {
    const clean = tools.map(normalizeStoredTool);
    const seen = new Set();
    let text = ';$PATH=/_N_TO_DIR\r\n; SHADER7 SINUMERIK TOOL OFFSET ARCHIVE\r\n';
    text += `; DATE: ${date}\r\n; CONTROL: SIEMENS 840D / 828D / 808D\r\n\r\n`;
    clean.forEach(tool => {
      const key = `${tool.tNo}:${tool.edge}`;
      if (seen.has(key)) throw new Error(`Duplicate T${tool.tNo} D${tool.edge} offset.`);
      seen.add(key);
      text += `; --- ${tool.num.replace(/[\r\n]/g,' ')} ---\r\n`;
      text += `$TC_DP1[${tool.tNo},${tool.edge}]=${tool.typeCode} ; Tool Type\r\n`;
      text += `$TC_DP2[${tool.tNo},${tool.edge}]=${tool.dir} ; Cutting Edge Position\r\n`;
      text += `$TC_DP3[${tool.tNo},${tool.edge}]=${tool.l1.toFixed(3)} ; Length 1 (X)\r\n`;
      text += `$TC_DP4[${tool.tNo},${tool.edge}]=${tool.l2.toFixed(3)} ; Length 2 (Z)\r\n`;
      text += `$TC_DP6[${tool.tNo},${tool.edge}]=${tool.rad.toFixed(3)} ; Radius (R)\r\n`;
      text += `$TC_DP12[${tool.tNo},${tool.edge}]=${tool.wx.toFixed(3)} ; Wear length 1 (X)\r\n`;
      text += `$TC_DP13[${tool.tNo},${tool.edge}]=${tool.wz.toFixed(3)} ; Wear length 2 (Z)\r\n\r\n`;
    });
    return text + 'M17\r\n';
  }

  const api = {cycle95Variant, validateTurningInput, turningMetrics, cycle95Call, calculateSpeedFeed, parseToolNumber, normalizeStoredTool, buildTOAArchive};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiemensCore = api;
})(typeof window === 'undefined' ? globalThis : window);
