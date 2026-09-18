const test = require('node:test');
const assert = require('node:assert/strict');
const { outputDimensions, toPixels, compress } = require('../photocompressor/compression.js');

test('resize preserves proportions and crop honors explicit dimensions', () => {
  assert.deepEqual(outputDimensions(1200,800,600,600,false),{width:600,height:400});
  assert.deepEqual(outputDimensions(1200,800,600,600,true),{width:600,height:600});
  assert.deepEqual(outputDimensions(1200,800,null,200,false),{width:300,height:200});
  assert.equal(toPixels(25.4,'mm',300),300);
  assert.throws(()=>outputDimensions(1200,800,9000,9000,true),/smaller dimensions/);
  assert.throws(()=>outputDimensions(1200,800,Infinity,null,false),/positive/);
});

function job(overrides={}) {
  let w=0,h=0;
  const draws=[];
  return {draws, options:{
    width:1200,height:800,targetBytes:50000,format:'image/jpeg',allowResize:true,
    draw(width,height) { w=width; h=height; draws.push([w,h]); },
    async encode(type,quality) { return {type,size:Math.ceil(w*h*(.08+quality*.3))}; },
    ...overrides
  }};
}
test('finds a result below the target and chooses quality without resizing when possible', async () => {
  const j=job({targetBytes:200000});
  const result=await compress(j.options);
  assert.ok(result.blob.size<=200000);
  assert.ok(result.quality>.4);
  assert.equal(j.draws.length,1);
  assert.equal(result.width,1200);
});
test('preserves required dimensions when reaching the target would require resizing', async () => {
  const j=job({allowResize:false});
  const result=await compress(j.options);
  assert.equal(result.width,1200); assert.equal(result.height,800);
  assert.ok(result.blob.size>50000); assert.equal(j.draws.length,1);
});
test('resizes only when permitted to meet a small target', async () => {
  const j=job();
  const result=await compress(j.options);
  assert.ok(result.blob.size<=50000);
  assert.ok(result.width<1200); assert.ok(j.draws.length>1);
});
test('PNG bypasses target-size quality search and keeps dimensions', async () => {
  const j=job({format:'image/png'});
  const result=await compress(j.options);
  assert.equal(result.width,1200); assert.equal(result.quality,null);
  assert.equal(j.draws.length,1);
});
test('rejects unsupported-format fallbacks and null encodes', async () => {
  await assert.rejects(compress(job({encode:async()=>({type:'image/png',size:100})}).options),/cannot export/);
  await assert.rejects(compress(job({encode:async()=>null}).options),/could not create/);
});
test('a cancelled job cannot return an obsolete result', async () => {
  let cancelled=false;
  const j=job({cancelled:()=>cancelled,encode:async(type)=>{cancelled=true;return {type,size:100};}});
  await assert.rejects(compress(j.options),/cancelled/);
});
