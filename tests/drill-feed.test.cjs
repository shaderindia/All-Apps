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
  vm.runInContext(extract('generateGCode', '// Accordion'), g18Ctx);
  const codeG18 = g18Ctx.generateGCode('drill', 6, 20, 1000, 100, 0.1, 'G81');
  assert.match(codeG18, /G18/);
  assert.match(codeG18, /G81 Y-20\.000 R2\.0/);

  const g19Ctx = vm.createContext({document:{getElementById:(id)=>({value: id==='coordPlane'?'G19':'G19'})}});
  vm.runInContext(extract('generateGCode', '// Accordion'), g19Ctx);
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
