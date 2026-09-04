const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLayout } = require('../photopassportsizepro/layout.js');
const dims = { w: 100, h: 150, gapH: 10, gapV: 10, marginL: 10, marginT: 10 };
test('counts photos that actually fit, including exact edges', () => {
  const result = calculateLayout(dims, {w:220,h:320}, 4);
  assert.equal(result.valid,true); assert.equal(result.capacity,4);
  assert.equal(calculateLayout(dims,{w:219,h:320},4).capacity,2);
});
test('oversized photos and margins cannot yield a blank downloadable sheet', () => {
  for (const d of [{...dims,w:500},{...dims,h:500},{...dims,marginL:500},{...dims,marginT:500}]) {
    const result=calculateLayout(d,{w:220,h:320},1);
    assert.equal(result.valid,false); assert.equal(result.capacity,0);
  }
});
test('rejects invalid values and large allocations before rendering', () => {
  for(const value of [0,-1,Infinity,NaN]) assert.equal(calculateLayout({...dims,w:value},{w:220,h:320},1).valid,false);
  assert.equal(calculateLayout({...dims,gapH:-1},{w:220,h:320},1).valid,false);
  for(const page of [{w:10000,h:100},{w:6000,h:6000}]) assert.equal(calculateLayout(dims,page,1).valid,false);
  assert.equal(calculateLayout(dims,{w:2480,h:3508},8).valid,true);
});
test('never silently truncates requested photo counts', () => {
  for(const count of [0,1.5,5,201,NaN]) assert.equal(calculateLayout(dims,{w:220,h:320},count).valid,false);
  assert.match(calculateLayout(dims,{w:220,h:320},5).error,/Only 4/);
});
