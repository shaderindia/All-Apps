/**
 * CNC Machinist Toolkit - Ultra-Smooth Background Frame Scroll Engine
 * Pure Vanilla JS // Zero Dependencies // 240 Frames // Sub-frame LERP Canvas
 * (c) SHADER7 / Nishikant Xalxo
 */

(() => {
  'use strict';

  // ponytail: Pre-buffering all 240 WebP frames (~3.3MB total) guarantees 60-120fps continuous scrubbing without stutter.
  const TOTAL_FRAMES = 240;
  const FRAME_DIR = 'animation/';
  const FRAME_PREFIX = 'frame_';
  const FRAME_EXT = '.webp';

  // ponytail: LERP damping factor (0.085) provides silky momentum and eliminates mouse-wheel discrete jumping.
  const LERP_FACTOR = 0.085;

  const PHASES = [
    { maxFrame: 60, stage: 'Stage 1: Datum Setup', tool: 'T01 Rougher • 18,000 RPM' },
    { maxFrame: 175, stage: 'Stage 2: Pocket Milling', tool: 'T04 Endmill • 3,850 mm/min' },
    { maxFrame: 240, stage: 'Stage 3: Finish Profile', tool: 'T09 Ball Nose • 22,000 RPM' }
  ];

  const canvas = document.getElementById('cnc-bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const hudLabel = document.getElementById('cnc-bg-hud-label');
  const hudTool = document.getElementById('cnc-bg-hud-tool');

  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;

  // Sub-frame continuous interpolation state
  let targetFrameFloat = 0;
  let currentFrameFloat = 0;
  let animRequestId = null;
  let isLoopRunning = false;

  function padFrame(num) {
    return String(num).padStart(4, '0');
  }

  // Preload all 240 frames into memory
  function preloadFrames() {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const idx = i - 1;
      images[idx] = img;
      img.decoding = 'async';
      img.onload = () => {
        loadedCount++;
        const baseIdx = Math.floor(currentFrameFloat);
        if (loadedCount === 1 || idx === baseIdx || idx === Math.min(TOTAL_FRAMES - 1, baseIdx + 1)) {
          renderFrame(currentFrameFloat);
        }
      };
      img.onerror = () => {
        console.warn(`Unable to preload CNC animation frame ${i}.`);
      };
      img.src = `${FRAME_DIR}${FRAME_PREFIX}${padFrame(i)}${FRAME_EXT}`;
    }
  }

  function isDrawable(img) {
    return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  }

  function nearestLoadedImage(frameIdx) {
    if (isDrawable(images[frameIdx])) return images[frameIdx];

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const before = frameIdx - offset;
      const after = frameIdx + offset;
      if (before >= 0 && isDrawable(images[before])) return images[before];
      if (after < TOTAL_FRAMES && isDrawable(images[after])) return images[after];
    }

    return null;
  }

  function drawCover(img, viewportWidth, viewportHeight, alpha) {
    const scale = Math.max(viewportWidth / img.naturalWidth, viewportHeight / img.naturalHeight);
    const renderWidth = img.naturalWidth * scale;
    const renderHeight = img.naturalHeight * scale;
    const renderX = (viewportWidth - renderWidth) / 2;
    const renderY = (viewportHeight - renderHeight) / 2;

    ctx.globalAlpha = alpha;
    ctx.drawImage(img, renderX, renderY, renderWidth, renderHeight);
  }

  // Draw frame with cover scaling, HiDPI support, and sub-frame alpha crossfading
  function renderFrame(frameFloat) {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const pixelWidth = Math.round(w * dpr);
    const pixelHeight = Math.round(h * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const baseIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.floor(frameFloat)));
    const nextIdx = Math.min(TOTAL_FRAMES - 1, baseIdx + 1);
    const blendAlpha = frameFloat - baseIdx;

    const requestedBaseImage = images[baseIdx];
    const imgA = nearestLoadedImage(baseIdx);
    if (!imgA) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw primary base frame
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    drawCover(imgA, w, h, 1);

    // ponytail: Sub-frame cross-fading eliminates step-banding between adjacent frames
    if (blendAlpha > 0.01 && nextIdx !== baseIdx) {
      const imgB = images[nextIdx];
      if (imgA === requestedBaseImage && isDrawable(imgB)) {
        drawCover(imgB, w, h, blendAlpha);
      }
    }

    ctx.restore();
    updateHUD(Math.round(frameFloat));
  }

  // Update floating telemetry HUD
  function updateHUD(frameIdx) {
    const frameNum = Math.max(1, Math.min(TOTAL_FRAMES, frameIdx + 1));
    const phase = PHASES.find(p => frameNum <= p.maxFrame) || PHASES[PHASES.length - 1];

    if (hudLabel) {
      hudLabel.textContent = `Frame ${String(frameNum).padStart(3, '0')}/${TOTAL_FRAMES} · ${phase.stage}`;
    }
    if (hudTool) {
      hudTool.textContent = phase.tool;
    }
  }

  // Continuous LERP animation loop that smoothly glides currentFrameFloat towards targetFrameFloat
  function animationLoop() {
    const delta = targetFrameFloat - currentFrameFloat;

    if (Math.abs(delta) > 0.001) {
      currentFrameFloat += (targetFrameFloat - currentFrameFloat) * LERP_FACTOR;
      renderFrame(currentFrameFloat);
      animRequestId = window.requestAnimationFrame(animationLoop);
    } else {
      currentFrameFloat = targetFrameFloat;
      renderFrame(currentFrameFloat);
      isLoopRunning = false;
      animRequestId = null;
    }
  }

  function startLoop() {
    if (!isLoopRunning) {
      isLoopRunning = true;
      animRequestId = window.requestAnimationFrame(animationLoop);
    }
  }

  // Calculate target frame from page scroll position
  function calculateTargetFrame() {
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const maxScroll = docHeight - winHeight;

    if (maxScroll <= 0) return 0;
    const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    return progress * (TOTAL_FRAMES - 1);
  }

  function onScroll() {
    targetFrameFloat = calculateTargetFrame();
    startLoop();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    targetFrameFloat = calculateTargetFrame();
    renderFrame(currentFrameFloat);
    startLoop();
  }, { passive: true });

  targetFrameFloat = calculateTargetFrame();
  currentFrameFloat = targetFrameFloat;
  preloadFrames();
})();
