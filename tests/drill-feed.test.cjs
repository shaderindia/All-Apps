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
