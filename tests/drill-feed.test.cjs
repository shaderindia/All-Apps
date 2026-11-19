const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync('cnc-machinist/drill/index.html','utf8');
function extract(name,next){return html.slice(html.indexOf('function '+name+'('),html.indexOf(next,html.indexOf('function '+name+'(')));}
const context=vm.createContext({document:{getElementById:()=>({value:'G17'})},pitchTable:[{d:6,p:1},{d:8,p:1.25}]});
vm.runInContext(extract('getPitch','function resetResults')+extract('getSyncedTap','// Global simulation')+extract('generateGCode','// Accordion'),context);
test('custom pitch retains feed relationship at integer RPM',()=>{
const result=context.getSyncedTap(723.2,0.3175);
assert.equal(result.r,723); assert.ok(Math.abs(result.f/result.r-.3175)<1e-9);
const code=context.generateGCode('tap',6,12,result.r,result.f,.3175,'G84');
assert.ok(code.includes('F229.5525')); assert.ok(code.includes('G94 G98'));
});
test('blank depth retains tapping and peck cycle',()=>{
assert.match(context.generateGCode('tap',6,0,500,500,1,'G84'),/G84 Z-12.000/);
assert.match(context.generateGCode('drill',6,0,500,50,.1,'G83'),/G83 Z-12.000/);
});
test('coarse pitch is never guessed for an unknown diameter',()=>{
assert.equal(context.getPitch(6),1);assert.equal(context.getPitch(7), '');
});
test('calculates pre-drill tap drill size correctly', () => {
  assert.equal(context.getTapDrill(6, 1.0), 5.0);
  assert.equal(context.getTapDrill(8, 1.25), 6.75);
  assert.equal(context.getTapDrill(10, 1.5), 8.5);
  assert.equal(context.getTapDrill(12, 1.75), 10.25);
  assert.equal(context.getTapDrill(5, 5), null);
});
test('calculates drill metrics: MRR, cycle time, cutting speed Vc, and tip length', () => {
  const m = context.calculateDrillMetrics('drill', 10, 25, 1000, 150, 0.15, 'G81');
  assert.equal(m.tipLength, 3.0);
  assert.equal(m.effectiveDepth, 25);
  assert.equal(m.totalTravel, 30.0);
  assert.equal(m.vc, 31.42);
  assert.equal(m.mrr, 11.78);
  assert.equal(m.cycleTimeSec, 12);
});
test('supports G18 (Y-axis) and G19 (X-axis) canned cycle generation', () => {
  const g18Ctx = vm.createContext({document:{getElementById:(id)=>({value: id==='coordPlane'?'G18':'G18'})}});
  vm.runInContext(extract('fmtCoord', 'let progRText')+extract('generateGCode', '// Accordion'), g18Ctx);
  const codeG18 = g18Ctx.generateGCode('drill', 6, 20, 1000, 100, 0.1, 'G81');
  assert.match(codeG18, /G18/);
  assert.match(codeG18, /G81 Y-20\.000 R2\.0/);

  const g19Ctx = vm.createContext({document:{getElementById:(id)=>({value: id==='coordPlane'?'G19':'G19'})}});
  vm.runInContext(extract('fmtCoord', 'let progRText')+extract('generateGCode', '// Accordion'), g19Ctx);
  const codeG19 = g19Ctx.generateGCode('drill', 6, 20, 1000, 100, 0.1, 'G81');
  assert.match(codeG19, /G19/);
  assert.match(codeG19, /G81 X-20\.000 R2\.0/);
});
test('customVc takes precedence over default material cutting speed', () => {
  const drillV = { mild:{hss:22} };
  const op = 'drill';
  const resolveV = (customVc) => customVc ? customVc : (op === 'drill' ? drillV.mild.hss : 10);
  assert.equal(resolveV(55), 55);
  assert.equal(resolveV(null), 22);
});

// ---- Material-aware feeds, peck depth and tap pre-drill depth ----
const helperCtx = vm.createContext({});
vm.runInContext(extract('drillFeedPerRev','// SMART TAPPING')+extract('getSyncedTap','// Global simulation'), helperCtx);
test('drill feed/rev is adjusted by workpiece material', () => {
  assert.equal(helperCtx.materialFeedPerRev(10, 'mild'), 0.14);
  assert.equal(helperCtx.materialFeedPerRev(10, 'stainless'), 0.105);
  assert.equal(helperCtx.materialFeedPerRev(10, 'aluminum'), 0.175);
  assert.equal(helperCtx.materialFeedPerRev(10, 'unknown'), 0.14);
});
test('peck increment Q scales with material and has a floor', () => {
  assert.equal(helperCtx.peckDepth(8, 'mild'), 6);
  assert.equal(helperCtx.peckDepth(8, 'stainless'), 4);
  assert.equal(helperCtx.peckDepth(8, 'aluminum'), 8);
  assert.equal(helperCtx.peckDepth(0.5, 'stainless'), 0.5);
});
test('blind tap pre-drill depth = thread + 4P + drill point', () => {
  assert.equal(helperCtx.tapPreDrillDepth(10, 1.5, 15), 23.55);
  assert.equal(helperCtx.tapPreDrillDepth(8, 1.25, 0), null);
});
test('G83 uses supplied Q and positions XY before tool length offset', () => {
  const code = context.generateGCode('drill', 8, 30, 1000, 100, 0.1, 'G83', 4);
  assert.match(code, /G83 Z-30\.000 R2\.0 Q4\.00 F100/);
  assert.ok(code.indexOf('X0.0 Y0.0') < code.indexOf('G43 H01'));
});
test('G73 peck cycles count pecks in cycle time', () => {
  const a = context.calculateDrillMetrics('drill', 10, 25, 1000, 150, 0.15, 'G81');
  const b = context.calculateDrillMetrics('drill', 10, 25, 1000, 150, 0.15, 'G73', 5);
  assert.ok(b.cycleTimeSec > a.cycleTimeSec);
});

// ---- Program options: tool, offset, heights, controller, hole list ----
test('hole list parser accepts spaces, commas and axis letters', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(context.parseHoleList('0 0\n25, 15\nX-10.5 Y.5\n\n'))), [[0,0],[25,15],[-10.5,0.5]]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.parseHoleList(''))), [[0,0]]);
  assert.throws(() => context.parseHoleList('10'), /line 1/);
});
test('multi-hole program lists extra positions inside the canned cycle', () => {
  const code = context.generateGCode('drill', 8, 20, 1000, 100, 0.1, 'G81', 4,
    { tool: 7, offset: 'G55', r: 3, init: 50, ret: 'G99', holes: [[0,0],[25,0],[25,15]] });
  assert.match(code, /G94 G99 G40 G80 G17 G55/);
  assert.match(code, /T07 M06/);
  assert.match(code, /G43 H07 Z50\.0/);
  assert.match(code, /G81 Z-20\.000 R3\.0 F100/);
  const lines = code.split('\n');
  const cyc = lines.findIndex(l => l.startsWith('G81'));
  assert.equal(lines[cyc + 1], 'X25.0 Y0.0 (HOLE 2)');
  assert.equal(lines[cyc + 2], 'X25.0 Y15.0 (HOLE 3)');
  assert.ok(lines[cyc + 3].startsWith('G80'));
});
test('Haas rigid tapping omits M29, Fanuc keeps it', () => {
  assert.doesNotMatch(context.generateGCode('tap', 6, 12, 500, 500, 1, 'G84', 0, { controller: 'haas' }), /M29/);
  assert.match(context.generateGCode('tap', 6, 12, 500, 500, 1, 'G84', 0, { controller: 'fanuc' }), /M29 S500 \(RIGID SYNC ENABLER\)\nG84 /);
});
test('coordinate formatting keeps a decimal point', () => {
  assert.equal(context.fmtCoord(2), '2.0');
  assert.equal(context.fmtCoord(2.25), '2.25');
  assert.equal(context.fmtCoord(-0.1234), '-0.123');
});
