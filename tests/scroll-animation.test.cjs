const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const baseDir = path.resolve(__dirname, '..');
const animDir = path.join(baseDir, 'cnc-machinist', 'animation');
const htmlPath = path.join(baseDir, 'cnc-machinist', 'index.html');
const jsPath = path.join(baseDir, 'cnc-machinist', 'scroll-animation.js');
const cssPath = path.join(baseDir, 'css', 'pages.css');
const serverPath = path.join(baseDir, 'server.ps1');

const js = fs.readFileSync(jsPath, 'utf-8');
const html = fs.readFileSync(htmlPath, 'utf-8');
const css = fs.readFileSync(cssPath, 'utf-8');
const server = fs.readFileSync(serverPath, 'utf-8');

test('contains exactly 240 serial, non-empty WebP frames', () => {
  assert.ok(fs.existsSync(animDir), 'Animation frames folder must exist');
  const frameFiles = fs.readdirSync(animDir).filter(name => /^frame_\d{4}\.webp$/.test(name));
  assert.equal(frameFiles.length, 240, 'Animation folder must contain exactly 240 serial WebP frames');

  for (let i = 1; i <= 240; i++) {
    const frameName = `frame_${String(i).padStart(4, '0')}.webp`;
    const framePath = path.join(animDir, frameName);
    assert.ok(fs.existsSync(framePath), `Frame ${frameName} must exist`);
    assert.ok(fs.statSync(framePath).size > 0, `Frame ${frameName} must be non-empty`);
  }
});

test('binds the canvas, telemetry HUD, and animation controller in the page DOM', () => {
  assert.match(html, /<canvas\s+id="cnc-bg-canvas"\s+class="cnc-bg-canvas"><\/canvas>/);
  assert.match(html, /class="cnc-bg-scroll-container"/);
  assert.match(html, /id="cnc-bg-hud"/);
  assert.match(html, /id="cnc-bg-hud-label"/);
  assert.match(html, /id="cnc-bg-hud-tool"/);
  assert.match(html, /src="scroll-animation\.js\?v=[^"]+"/);
  assert.equal((html.match(/class="tool-card cnc-card catalog-card"/g) || []).length, 11);
});

test('implements HiDPI cover drawing, LERP damping, crossfade, and sleeping rAF', () => {
  assert.match(js, /const TOTAL_FRAMES = 240;/);
  assert.match(js, /const LERP_FACTOR = 0\.085;/);
  assert.match(js, /new Array\(TOTAL_FRAMES\)/);
  assert.match(js, /new Image\(\)/);
  assert.match(js, /Math\.max\(viewportWidth \/ img\.naturalWidth, viewportHeight \/ img\.naturalHeight\)/);
  assert.match(js, /window\.devicePixelRatio \|\| 1/);
  assert.match(js, /window\.scrollY \/ maxScroll/);
  assert.match(js, /progress \* \(TOTAL_FRAMES - 1\)/);
  assert.match(js, /currentFrameFloat \+= \(targetFrameFloat - currentFrameFloat\) \* LERP_FACTOR/);
  assert.match(js, /drawCover\(imgB, w, h, blendAlpha\)/);
  assert.match(js, /Math\.abs\(delta\) > 0\.001/);
  assert.match(js, /isLoopRunning = false/);
  assert.match(js, /Stage 1: Datum Setup/);
  assert.match(js, /Stage 2: Pocket Milling/);
  assert.match(js, /Stage 3: Finish Profile/);
});

test('keeps the canvas unfaded while frosted surfaces protect text', () => {
  assert.match(css, /\.cnc-bg-scroll-container\s*{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*width:\s*100vw;[^}]*height:\s*100vh;[^}]*z-index:\s*-1;[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.cnc-bg-canvas\s*{[^}]*opacity:\s*1\s*!important;[^}]*filter:\s*contrast\(1\.18\) saturate\(1\.22\)\s*!important;/s);
  assert.match(css, /\.cnc-hero-copy\s*{[^}]*background:\s*rgba\(255, 255, 255, 0\.93\);[^}]*backdrop-filter:\s*blur\(20px\);[^}]*border:\s*1px solid rgba\(220, 227, 237, 0\.9\);[^}]*border-radius:\s*24px;[^}]*padding:\s*36px 40px;[^}]*box-shadow:\s*0 16px 44px rgba\(15, 23, 42, 0\.14\);/s);
  assert.match(css, /\[data-theme='dark'\][^{]*\.cnc-hero-copy\s*{[^}]*background:\s*rgba\(15, 23, 42, 0\.92\);[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.16\);/s);
  assert.match(css, /\.site-page\.cnc-directory \.tool-card\s*{[^}]*background:\s*rgba\(255, 255, 255, 0\.96\);/s);
  assert.match(css, /\.site-page\.cnc-directory \.directory-heading\s*{[^}]*background:\s*rgba\(255, 255, 255, 0\.96\);/s);
  assert.doesNotMatch(css, /\.cnc-bg-overlay\s*{/);
});

test('local server prevents stale browser assets', () => {
  assert.match(server, /Cache-Control", "no-cache, no-store, must-revalidate"/);
  assert.match(server, /Pragma", "no-cache"/);
  assert.match(server, /Expires", "0"/);
});
