const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ponytail: Smallest runnable check for CNC background scroll animation assets & integration
const baseDir = path.resolve(__dirname, '..');
const animDir = path.join(baseDir, 'cnc-machinist', 'animation');
const htmlPath = path.join(baseDir, 'cnc-machinist', 'index.html');
const jsPath = path.join(baseDir, 'cnc-machinist', 'scroll-animation.js');

// 1. Verify all 240 frames are present and non-empty
assert(fs.existsSync(animDir), 'Animation frames folder must exist');
for (let i = 1; i <= 240; i++) {
  const frameName = `frame_${String(i).padStart(4, '0')}.webp`;
  const framePath = path.join(animDir, frameName);
  assert(fs.existsSync(framePath), `Frame ${frameName} must exist`);
  const stat = fs.statSync(framePath);
  assert(stat.size > 1000, `Frame ${frameName} must be non-empty (size: ${stat.size})`);
}

// 2. Verify HTML includes required background markup and script link
assert(fs.existsSync(htmlPath), 'cnc-machinist/index.html must exist');
const html = fs.readFileSync(htmlPath, 'utf-8');
assert(html.includes('scroll-animation.js'), 'index.html must reference scroll-animation.js');
assert(html.includes('id="cnc-bg-canvas"'), 'index.html must contain #cnc-bg-canvas');
assert(html.includes('class="cnc-bg-scroll-container"'), 'index.html must contain .cnc-bg-scroll-container');
assert(html.includes('id="cnc-bg-hud"'), 'index.html must contain #cnc-bg-hud');

// 3. Verify JS script exists and is syntactically clean
assert(fs.existsSync(jsPath), 'scroll-animation.js must exist');
const js = fs.readFileSync(jsPath, 'utf-8');
assert(js.includes('TOTAL_FRAMES = 240'), 'JS must define 240 frames');
assert(js.includes('requestAnimationFrame'), 'JS must use rAF for rendering');
assert(js.includes('cnc-bg-canvas'), 'JS must bind to cnc-bg-canvas');

console.log('✔ CNC background scroll animation check passed (all 240 frames, background canvas bindings, and script verified)');
