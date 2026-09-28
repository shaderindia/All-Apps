const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'cvbanao');
const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const legacyGallery = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

for (let id = 1; id <= 6; id += 1) {
  const name = `template${id}.png`;
  const image = fs.readFileSync(path.join(root, 'previews', name));
  assert.ok(image.length > 30_000, `${name} must contain a rendered resume`);
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 794, `${name} width`);
  assert.equal(image.readUInt32BE(20), 1123, `${name} height`);
  assert.ok(landing.includes(`previews/${name}`), `${name} missing from template chooser`);
  assert.ok(landing.includes(`data-preview="${id}"`), `Template ${id} lacks a preview trigger`);

  const template = fs.readFileSync(path.join(root, `template${id}`, 'index.html'), 'utf8');
  assert.ok(template.includes('../sample-mode.js'), `Template ${id} lacks sample mode`);
  assert.match(template, /window\.CV_SAMPLE_MODE \? null : (?:localStorage\.getItem|safeGetStorage)/, `Template ${id} could expose saved user data`);
}

assert.ok(legacyGallery.includes('previews/template${templateId}.png'));
assert.ok(landing.includes('id="sampleDialog"'));
console.log('All six real-template sample previews are present and wired to both galleries.');
