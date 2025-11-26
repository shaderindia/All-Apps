// PASSPORT PHOTO MAKER - PRODUCTION VERSION
// Uses Cropper.js for cropping and @imgly/background-removal for AI background removal

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  // ==== DOM Elements ====
  const els = {
    uploadArea: document.getElementById('upload-area'),
    photoUpload: document.getElementById('photo-upload'),
    editorContainer: document.getElementById('editor-container'),
    imageToCrop: document.getElementById('image-to-crop'),
    bgProcessing: document.getElementById('bg-processing'),
    removeBgBtn: document.getElementById('remove-bg-btn'),
    bgColorPicker: document.getElementById('bg-color-picker'),
    rotateLeftBtn: document.getElementById('rotate-left'),
    rotateRightBtn: document.getElementById('rotate-right'),
    resetCropBtn: document.getElementById('reset-crop'),
    unit: document.getElementById('unit'),
    dpi: document.getElementById('dpi'),
    photoWidth: document.getElementById('photo-width'),
    photoHeight: document.getElementById('photo-height'),
    pageSize: document.getElementById('page-size'),
    customPageSize: document.getElementById('custom-page-size'),
    customWidth: document.getElementById('custom-width'),
    customHeight: document.getElementById('custom-height'),
    numPhotos: document.getElementById('num-photos'),
    hSpacing: document.getElementById('h-spacing'),
    vSpacing: document.getElementById('v-spacing'),
    marginTop: document.getElementById('margin-top'),
    marginLeft: document.getElementById('margin-left'),
    autocenter: document.getElementById('autocenter-margin'),
    showCutlines: document.getElementById('show-cutlines'),
    addBorder: document.getElementById('add-border'),
    autofixBtn: document.getElementById('autofix-btn'),
    outputCanvas: document.getElementById('output-canvas'),
    format: document.getElementById('format'),
    downloadBtn: document.getElementById('download-btn'),
    downloadHQBtn: document.getElementById('download-hq-btn'),
    themeBtn: document.getElementById('theme-btn'),
    infoBtn: document.getElementById('info-btn'),
    infoModal: document.getElementById('info-modal'),
    closeInfo: document.getElementById('close-info'),
  };

  // ==== State ====
  let cropper = null;
  let originalImageURL = null;
  let currentImageURL = null;
  let currentFile = null;
  let isDark = false;
  let bgColor = '#ffffff';
  let previousUnit = 'mm';
  const REFERENCE_DPI = 300; // Reference DPI for consistent rendering

  // ==== Initialization ====
  function init() {
    // Load saved theme
    isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
      document.body.classList.add('dark');
      updateThemeIcon();
    }

    // Set defaults
    if (!els.customWidth.value) els.customWidth.value = 210;
    if (!els.customHeight.value) els.customHeight.value = 297;

    setupEventListeners();
    renderCanvas(); // Initial empty render
  }

  // ==== Event Listeners ====
  function setupEventListeners() {
    // Upload area click
    els.uploadArea.addEventListener('click', () => {
      els.photoUpload.value = '';
      els.photoUpload.click();
    });

    // Keyboard support for upload area
    els.uploadArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        els.photoUpload.click();
      }
    });

    // File input change
    els.photoUpload.addEventListener('change', handleFileSelect);

    // Drag & Drop
    els.uploadArea.addEventListener('dragover', (e) => { 
      e.preventDefault(); 
      els.uploadArea.style.background = 'rgba(99,102,241,0.1)'; 
    });
    els.uploadArea.addEventListener('dragleave', (e) => { 
      e.preventDefault(); 
      els.uploadArea.style.background = ''; 
    });
    els.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      els.uploadArea.style.background = '';
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    // Toolbar buttons
    els.removeBgBtn.addEventListener('click', removeBackground);
    els.bgColorPicker.addEventListener('input', (e) => {
      bgColor = e.target.value;
      renderCanvas();
    });
    els.rotateLeftBtn.addEventListener('click', () => {
      if (cropper) cropper.rotate(-90);
    });
    els.rotateRightBtn.addEventListener('click', () => {
      if (cropper) cropper.rotate(90);
    });
    els.resetCropBtn.addEventListener('click', () => {
      if (cropper) cropper.reset();
    });

    // Settings inputs
    const settingsInputs = [
      els.unit, els.dpi, els.photoWidth, els.photoHeight, els.pageSize,
      els.customWidth, els.customHeight, els.numPhotos,
      els.hSpacing, els.vSpacing, els.marginTop, els.marginLeft,
      els.autocenter, els.showCutlines, els.addBorder, els.format
    ];
    
    settingsInputs.forEach(el => {
      if (el) {
        el.addEventListener('input', handleSettingsChange);
        el.addEventListener('change', handleSettingsChange);
      }
    });

    els.autofixBtn.addEventListener('click', autoFixLayout);

    // Margin inputs disable autocenter
    const disableAutoCenter = () => {
      if (els.autocenter.checked) {
        els.autocenter.checked = false;
        renderCanvas();
      }
    };
    els.marginTop.addEventListener('input', disableAutoCenter);
    els.marginLeft.addEventListener('input', disableAutoCenter);

    // Download buttons
    els.downloadBtn.addEventListener('click', () => downloadOutput(false));
    els.downloadHQBtn.addEventListener('click', () => downloadOutput(true));

    // Theme toggle
    els.themeBtn.addEventListener('click', toggleTheme);

    // Modal controls
    els.infoBtn.addEventListener('click', () => {
      els.infoModal.classList.add('active');
      els.infoModal.setAttribute('aria-hidden', 'false');
    });
    els.closeInfo.addEventListener('click', closeModal);
    els.infoModal.addEventListener('click', (e) => { 
      if (e.target === els.infoModal) closeModal();
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.infoModal.classList.contains('active')) {
        closeModal();
      }
    });

    // Orientation change handling
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (cropper) {
          cropper.resize();
          renderCanvas();
        }
      }, 300);
    });

    // Resize handling
    window.addEventListener('resize', () => {
      if (cropper) {
        cropper.resize();
        renderCanvas();
      }
    });
  }

  function handleSettingsChange(e) {
    const el = e.target;
    if (el === els.pageSize) handlePageSizeChange();
    if (el === els.unit) handleUnitChange();
    if (el === els.photoWidth || el === els.photoHeight) updateCropperAspectRatio();
    renderCanvas();
  }

  function closeModal() {
    els.infoModal.classList.remove('active');
    els.infoModal.setAttribute('aria-hidden', 'true');
  }

  // ==== File Handling ====
  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }

  function handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG/PNG).');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }

    // Clean up previous image
    if (originalImageURL) {
      URL.revokeObjectURL(originalImageURL);
    }

    // Store file and create object URL
    currentFile = file;
    originalImageURL = URL.createObjectURL(file);
    currentImageURL = originalImageURL;

    // Show editor, hide upload area
    els.uploadArea.classList.add('hidden');
    els.editorContainer.classList.remove('hidden');

    // Initialize cropper
    startCropper(currentImageURL);
  }

  // ==== Cropper.js Logic ====
  function startCropper(url) {
    // Destroy previous cropper if exists
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    const img = els.imageToCrop;
    
    // Set image source
    img.src = url;
    
    // Wait for image to load before creating cropper
    img.onload = function() {
      try {
        const aspectRatio = getAspectRatio();
        
        cropper = new Cropper(img, {
          viewMode: 1,
          dragMode: 'move',
          aspectRatio: aspectRatio,
          autoCropArea: 0.8,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          ready: function() {
            console.log('Cropper ready');
            renderCanvas();
          },
          cropend: function() {
            renderCanvas();
          }
        });
      } catch (error) {
        console.error('Cropper initialization error:', error);
        alert('Failed to initialize cropper. Please try again.');
      }
    };

    img.onerror = function() {
      console.error('Image failed to load');
      alert('Failed to load image. Please try a different file.');
      // Reset to upload state
      els.uploadArea.classList.remove('hidden');
      els.editorContainer.classList.add('hidden');
    };
  }

  function getAspectRatio() {
    const w = parseFloat(els.photoWidth.value) || 35;
    const h = parseFloat(els.photoHeight.value) || 45;
    return (w && h) ? w / h : (35 / 45);
  }

  function updateCropperAspectRatio() {
    if (!cropper) return;
    const ratio = getAspectRatio();
    if (ratio && isFinite(ratio)) {
      cropper.setAspectRatio(ratio);
    }
  }

  // ==== Background Removal ====
  async function removeBackground() {
    if (!currentImageURL && !currentFile) return;

    if (!window.crossOriginIsolated) {
      alert('Background removal requires a secure environment. Please ensure you are running a local server.');
      return;
    }

    els.bgProcessing.classList.remove('hidden');
    els.removeBgBtn.disabled = true;

    try {
      const config = {
        publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@1.0.6/dist/',
        debug: false,
      };

      const { removeBackground: imglyRemoveBackground } = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.0.5/+esm');

      const source = currentFile || currentImageURL;
      const blob = await imglyRemoveBackground(source, config);
      
      // Create new URL for background-removed image
      const newUrl = URL.createObjectURL(blob);

      // Update current image
      currentImageURL = newUrl;
      
      // Don't revoke the original URL yet - it might be needed for reprocessing
      startCropper(currentImageURL);

    } catch (error) {
      console.error('Background removal failed:', error);
      alert(`Background removal failed: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      els.bgProcessing.classList.add('hidden');
      els.removeBgBtn.disabled = false;
    }
  }

  // ==== Rendering Logic ====
  function getDPI() { 
    return Math.max(72, Math.min(1200, parseInt(els.dpi.value) || 300));
  }

  // Converts a value from the current unit to pixels
  // DPI only affects physical units (mm, inch), not px
  function toPx(val, unit) {
    const dpi = getDPI();
    val = parseFloat(val) || 0;
    if (unit === 'mm') return (val / 25.4) * dpi;
    if (unit === 'inch') return val * dpi;
    return val; // px - DPI has no effect
  }

  // Converts a pixel value to the current unit for display
  function fromPx(px, unit) {
    const dpi = getDPI();
    if (unit === 'mm') return (px * 25.4) / dpi;
    if (unit === 'inch') return px / dpi;
    return px;
  }

  function getDims() {
    const unit = els.unit.value;
    return {
      w: toPx(els.photoWidth.value, unit),
      h: toPx(els.photoHeight.value, unit),
      gapH: toPx(els.hSpacing.value, unit),
      gapV: toPx(els.vSpacing.value, unit),
      marginT: toPx(els.marginTop.value, unit),
      marginL: toPx(els.marginLeft.value, unit)
    };
  }

  function getPageSize() {
    const unit = els.unit.value;
    const type = els.pageSize.value;
    
    if (type === 'a4') return { w: toPx(210, 'mm'), h: toPx(297, 'mm') };
    if (type === '4r') return { w: toPx(4, 'inch'), h: toPx(6, 'inch') };

    return {
      w: toPx(els.customWidth.value, unit),
      h: toPx(els.customHeight.value, unit)
    };
  }

  function renderCanvas() {
    if (!cropper) {
      console.log('Cropper not ready, skipping render');
      return;
    }

    const canvas = els.outputCanvas;
    const ctx = canvas.getContext('2d');
    const dims = getDims();
    const page = getPageSize();
    const count = Math.max(1, parseInt(els.numPhotos.value) || 1);

    // Calculate scaling factor to normalize DPI (100 DPI should look same as 300 DPI on screen)
    const dpi = getDPI();
    const dpiScale = REFERENCE_DPI / dpi;

    // Set canvas size in CSS pixels (affected by DPI normalization)
    canvas.width = Math.round(page.w * dpiScale);
    canvas.height = Math.round(page.h * dpiScale);

    // Scale the context so everything draws correctly
    ctx.scale(dpiScale, dpiScale);

    // Fill background
    ctx.fillStyle = isDark ? '#23293b' : '#ffffff';
    ctx.fillRect(0, 0, page.w, page.h);

    // Calculate grid layout
    const contentW = page.w - dims.marginL * 2;
    const contentH = page.h - dims.marginT * 2;

    const cols = Math.floor((contentW + dims.gapH) / (dims.w + dims.gapH)) || 1;
    const rows = Math.ceil(count / cols);

    // Auto-center logic - only applies if checkbox is explicitly checked
    let startX = dims.marginL;
    let startY = dims.marginT;

    if (els.autocenter.checked) {
      const totalRowW = cols * dims.w + (cols - 1) * dims.gapH;
      if (cols > 0) startX = (page.w - totalRowW) / 2;

      startX = Math.max(startX, dims.marginL);
      startY = Math.max(startY, dims.marginT);

      if (document.activeElement !== els.marginLeft) {
        els.marginLeft.value = fromPx(startX, els.unit.value).toFixed(2);
      }
      if (document.activeElement !== els.marginTop) {
        els.marginTop.value = fromPx(startY, els.unit.value).toFixed(2);
      }
    }

    // Get cropped image
    const croppedCanvas = cropper.getCroppedCanvas({
      width: dims.w * 2,
      height: dims.h * 2,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      fillColor: bgColor
    });

    if (!croppedCanvas) {
      console.log('Cropped canvas is empty');
      return;
    }

    // Draw photos
    let drawn = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (drawn >= count) break;

        const x = startX + c * (dims.w + dims.gapH);
        const y = startY + r * (dims.h + dims.gapV);

        // Draw image
        ctx.drawImage(croppedCanvas, x, y, dims.w, dims.h);

        // Draw border ONLY if "Add Border" is checked
        if (els.addBorder.checked) {
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, dims.w, dims.h);
          ctx.restore();
        }

        drawn++;
      }
    }

    // Draw grid cutlines in the gaps ONLY (not on photo edges)
    if (els.showCutlines.checked && rows > 0 && cols > 0) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#999999';
      ctx.setLineDash([2, 2]);

      const hasPhoto = (r, c) => (r * cols + c) < count;

      // Vertical cutlines between columns
      for (let c = 1; c < cols; c++) {
        const x = startX + c * (dims.w + dims.gapH) - dims.gapH / 2;
        for (let r = 0; r < rows; r++) {
          if (hasPhoto(r, c - 1) || hasPhoto(r, c)) {
            const yStart = startY + r * (dims.h + dims.gapV) - dims.gapV / 2;
            const yEnd = yStart + dims.h + dims.gapV;
            ctx.beginPath();
            ctx.moveTo(x, yStart);
            ctx.lineTo(x, yEnd);
            ctx.stroke();
          }
        }
      }

      // Horizontal cutlines between rows
      for (let r = 1; r < rows; r++) {
        const y = startY + r * (dims.h + dims.gapV) - dims.gapV / 2;
        for (let c = 0; c < cols; c++) {
          if (hasPhoto(r - 1, c) || hasPhoto(r, c)) {
            const xStart = startX + c * (dims.w + dims.gapH) - dims.gapH / 2;
            const xEnd = xStart + dims.w + dims.gapH;
            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(xEnd, y);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    }
  }

  // ==== Unit Conversion ====
  // When changing units, the PIXEL VALUE is preserved. Only the displayed number changes.
  // Example: 300px → 25.4mm (at 300 DPI) → 300px (when switching back)
  function handleUnitChange() {
    const newUnit = els.unit.value;
    if (newUnit === previousUnit) return;

    const dpi = getDPI();
    const inputsToConvert = [
      els.photoWidth, els.photoHeight,
      els.hSpacing, els.vSpacing,
      els.marginTop, els.marginLeft,
      els.customWidth, els.customHeight
    ];

    inputsToConvert.forEach(input => {
      if (!input.value) return;

      let val = parseFloat(input.value);
      let pxVal = 0;

      // Convert from old unit to pixels
      if (previousUnit === 'mm') pxVal = (val / 25.4) * dpi;
      else if (previousUnit === 'inch') pxVal = val * dpi;
      else pxVal = val; // was already in pixels

      // Convert from pixels to new unit
      let newVal = 0;
      if (newUnit === 'mm') newVal = (pxVal * 25.4) / dpi;
      else if (newUnit === 'inch') newVal = pxVal / dpi;
      else newVal = pxVal; // keep as pixels

      input.value = (newUnit === 'px') ? Math.round(newVal) : newVal.toFixed(2);
    });

    previousUnit = newUnit;
    renderCanvas();
  }

  function handlePageSizeChange() {
    const isCustom = els.pageSize.value === 'custom';
    els.customPageSize.classList.toggle('hidden', !isCustom);
    renderCanvas();
  }

  // ==== Auto-fix Layout ====
  // Applies 300x400px photo size with 35px gaps/margins
  // Preserves actual pixel values when converting between units
  function autoFixLayout() {
    const currentUnit = els.unit.value;
    const dpi = getDPI();
    const targets = {
      w: 300,  // Target width in pixels
      h: 400,  // Target height in pixels
      gap: 35, // Target gap in pixels
      margin: 35 // Target margin in pixels
    };

    const convert = (pxVal) => {
      if (currentUnit === 'px') return pxVal;
      if (currentUnit === 'inch') return pxVal / dpi;
      if (currentUnit === 'mm') return (pxVal / dpi) * 25.4;
      return pxVal;
    };

    const format = (val) => currentUnit === 'px' ? Math.round(val) : val.toFixed(2);

    els.photoWidth.value = format(convert(targets.w));
    els.photoHeight.value = format(convert(targets.h));
    els.hSpacing.value = format(convert(targets.gap));
    els.vSpacing.value = format(convert(targets.gap));
    els.marginTop.value = format(convert(targets.margin));
    els.marginLeft.value = format(convert(targets.margin));

    // Auto-center is NOT forced by auto-fix anymore
    // It only activates if user manually checks the box

    updateCropperAspectRatio();
    renderCanvas();

    // Visual feedback
    const originalHTML = els.autofixBtn.innerHTML;
    els.autofixBtn.innerHTML = '<i class="fa fa-check"></i> Applied!';
    els.autofixBtn.disabled = true;
    
    setTimeout(() => {
      els.autofixBtn.innerHTML = originalHTML;
      els.autofixBtn.disabled = false;
    }, 1500);
  }

  // ==== Download ====
  function downloadOutput(hq) {
    const ext = els.format.value || 'jpg';
    const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = hq ? 1.0 : 0.92;
    const filename = `passport-photo-${Date.now()}.${ext}`;

    els.outputCanvas.toBlob((blob) => {
      if (!blob) {
        alert('Error: Could not generate image. Please try again.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);

      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);

    }, mime, quality);

    // Success feedback
    const btn = hq ? els.downloadHQBtn : els.downloadBtn;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-check"></i> Starting...';
    btn.disabled = true;
    
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 2000);
  }

  // ==== Theme Toggle ====
  function toggleTheme() {
    isDark = !isDark;
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
    renderCanvas(); // Re-render with dark mode
  }

  function updateThemeIcon() {
    const icon = els.themeBtn.querySelector('i');
    icon.className = isDark ? 'fa fa-sun' : 'fa fa-moon';
  }

  // ==== Memory Management ====
  window.addEventListener('beforeunload', () => {
    if (originalImageURL) URL.revokeObjectURL(originalImageURL);
    if (currentImageURL && currentImageURL !== originalImageURL) {
      URL.revokeObjectURL(currentImageURL);
    }
  });

  // ==== Error Handling ====
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
  });

  // Initialize the app
  init();
}
