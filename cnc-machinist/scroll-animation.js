/**
 * CNC Machinist Toolkit - Background Frame Scroll Engine
 * Pure Vanilla JS // Zero Dependencies // 60fps rAF Canvas
 * (c) SHADER7 / Nishikant Xalxo
 */

(() => {
  'use strict';

  // ponytail: Pre-buffering 60 WebP frames (~880KB) into memory ensures instantaneous cover rendering on scroll.
  const TOTAL_FRAMES = 60;
  const FRAME_DIR = 'animation/';
  const FRAME_PREFIX = 'frame_';
  const FRAME_EXT = '.webp';

  const PHASES = [
    { maxFrame: 15, stage: 'Stage 1: Datum Setup', tool: 'T01 Rougher • 18,000 RPM' },
    { maxFrame: 44, stage: 'Stage 2: Pocket Milling', tool: 'T04 Endmill • 3,850 mm/min' },
    { maxFrame: 60, stage: 'Stage 3: Finish Profile', tool: 'T09 Ball Nose • 22,000 RPM' }
  ];

  const canvas = document.getElementById('cnc-bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const hudLabel = document.getElementById('cnc-bg-hud-label');
  const hudTool = document.getElementById('cnc-bg-hud-tool');

  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let currentFrame = 0;
  let lastDrawnFrame = -1;
  let ticking = false;

  function padFrame(num) {
    return String(num).padStart(4, '0');
  }

  // Preload all 60 frames
  function preloadFrames() {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const idx = i - 1;
      img.src = `${FRAME_DIR}${FRAME_PREFIX}${padFrame(i)}${FRAME_EXT}`;
      img.onload = () => {
        images[idx] = img;
        loadedCount++;
        if (loadedCount === 1) {
          drawFrame(0);
        }
      };
      img.onerror = () => {
        // ponytail: mark loaded on network error to allow rest of frames to operate
        loadedCount++;
      };
    }
  }

  // Draw background frame using cover scaling to fill entire viewport
  function drawFrame(frameIdx) {
    if (frameIdx < 0 || frameIdx >= TOTAL_FRAMES) return;
    const img = images[frameIdx];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Cover math: scale image so it completely covers the viewport
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = w / h;
    let renderW, renderH, renderX, renderY;

    if (canvasRatio > imgRatio) {
      renderW = w;
      renderH = renderW / imgRatio;
      renderX = 0;
      renderY = (h - renderH) / 2;
    } else {
      renderH = h;
      renderW = renderH * imgRatio;
      renderX = (w - renderW) / 2;
      renderY = 0;
    }

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, renderX, renderY, renderW, renderH);
    ctx.restore();

    lastDrawnFrame = frameIdx;
    updateHUD(frameIdx);
  }

  // Update floating telemetry HUD pill
  function updateHUD(frameIdx) {
    const frameNum = frameIdx + 1;
    const phase = PHASES.find(p => frameNum <= p.maxFrame) || PHASES[PHASES.length - 1];

    if (hudLabel) {
      hudLabel.textContent = `Frame ${String(frameNum).padStart(2, '0')}/${TOTAL_FRAMES} · ${phase.stage}`;
    }
    if (hudTool) {
      hudTool.textContent = phase.tool;
    }
  }

  // Calculate page scroll progress [0..1] and map to frame [0..59]
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const docHeight = document.documentElement.scrollHeight;
        const winHeight = window.innerHeight;
        const maxScroll = docHeight - winHeight;

        if (maxScroll > 0) {
          const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
          const targetFrame = Math.min(TOTAL_FRAMES - 1, Math.floor(progress * TOTAL_FRAMES));

          if (targetFrame !== currentFrame) {
            currentFrame = targetFrame;
            drawFrame(currentFrame);
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    if (lastDrawnFrame >= 0) drawFrame(lastDrawnFrame);
  }, { passive: true });

  preloadFrames();
})();
