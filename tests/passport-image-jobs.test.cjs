const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../photopassportsizepro/app.html'), 'utf8');
const composite = html.slice(html.indexOf('      function compositeTransparentPNG('), html.indexOf('      async function removeBackground('));
function setup() {
  const images = [], encoders = [], results = [], failures = [], urls = [];
  const context = vm.createContext({
    compositeRequest: 0, imageGeneration: 1,
    Image: class { constructor() { this.naturalWidth=600; this.naturalHeight=800; images.push(this); } },
    document: { createElement() { return { getContext() { return {fillRect(){},drawImage(){}}; }, toBlob(callback) { encoders.push(callback); } }; } },
    URL: { createObjectURL(blob) { urls.push(blob); return 'blob:result'; } },
    hideProcessingOverlay(){}, setBackgroundBusy(){}, setStatus(type,message) { failures.push({type,message}); }
  });
  vm.runInContext(composite, context);
  return { context, images, encoders, results, failures, urls, start() { context.compositeTransparentPNG('data:image/png;base64,test', '#fff', url=>results.push(url)); } };
}
test('a previous photo cannot apply its background result to a replacement', () => {
  const job=setup(); job.start(); job.context.imageGeneration++;
  job.images[0].onload();
  assert.equal(job.encoders.length,0); assert.equal(job.results.length,0);
});
test('rapid colour changes only apply the newest completed composite', () => {
  const job=setup(); job.start(); job.images[0].onload();
  job.start(); job.images[1].onload();
  job.encoders[0]({}); job.encoders[1]({});
  assert.deepEqual(job.results,['blob:result']); assert.equal(job.urls.length,1);
});
test('failed background encoding reports an error instead of applying a broken URL', () => {
  const job=setup(); job.start(); job.images[0].onload(); job.encoders[0](null);
  assert.equal(job.results.length,0); assert.equal(job.urls.length,0);
  assert.equal(job.failures[0].type,'error');
});
