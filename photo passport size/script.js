// PASSPORT PHOTO MAKER - ENHANCED VERSION
// Uses Cropper.js for cropping and @imgly/background-removal for AI background removal

document.addEventListener('DOMContentLoaded', function () {
  // ==== DOM Elements ====
  const els = {
    // Upload & Editor
    uploadArea: document.getElementById('upload-area'),
    photoUpload: document.getElementById('photo-upload'),
    editorContainer: document.getElementById('editor-container'),
    imageToCrop: document.getElementById('image-to-crop'),
    bgProcessing: document.getElementById('bg-processing'),

    // Toolbar
    removeBgBtn: document.getElementById('remove-bg-btn'),
    bgColorPicker: document.getElementById('bg-color-picker'),
    rotateLeftBtn: document.getElementById('rotate-left'),
    rotateRightBtn: document.getElementById('rotate-right'),
    resetCropBtn: document.getElementById('reset-crop'),

    // Settings
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

    // Output
    outputCanvas: document.getElementById('output-canvas'),
    format: document.getElementById('format'),
    downloadBtn: document.getElementById('download-btn'),
    downloadHQBtn: document.getElementById('download-hq-btn'),

    // Theme & Modal
    themeBtn: document.getElementById('theme-btn'),
    infoBtn: document.getElementById('info-btn'),
    infoModal: document.getElementById('info-modal'),
    closeInfo: document.getElementById('close-info'),
  };

  // ==== State ====
  let cropper = null;
  let originalImageURL = null;
  let currentImageURL = null; // Could be original or bg-removed
  let currentFile = null; // Store the actual File object
  let isDark = false;
  let bgColor = '#ffffff'; // Default background color for the photo

  // ==== Initialization ====
  function init() {
    // Set defaults if needed
    if (!els.customWidth.value) els.customWidth.value = 210;
    if (!els.customHeight.value) els.customHeight.value = 297;

    // Event Listeners
    setupEventListeners();

    // Initial Canvas Render (Empty)
    renderCanvas();
  }

  function setupEventListeners() {
    // Upload
    els.uploadArea.addEventListener('click', () => {
      els.photoUpload.value = ''; // Reset value to allow re-selecting same file
      els.photoUpload.click();
    });
    els.photoUpload.addEventListener('change', handleFileSelect);

    // Drag & Drop
    els.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); els.uploadArea.style.background = 'rgba(99,102,241,0.1)'; });
    els.uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); els.uploadArea.style.background = ''; });
    els.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      els.uploadArea.style.background = '';
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    // Toolbar
    els.removeBgBtn.addEventListener('click', removeBackground);
    els.bgColorPicker.addEventListener('input', (e) => {
      bgColor = e.target.value;
      renderCanvas();
    });
    els.rotateLeftBtn.addEventListener('click', () => cropper && cropper.rotate(-90));
    els.rotateRightBtn.addEventListener('click', () => cropper && cropper.rotate(90));
    els.resetCropBtn.addEventListener('click', () => cropper && cropper.reset());

    // Settings Changes
    const settingsInputs = [
      els.unit, els.dpi, els.photoWidth, els.photoHeight, els.pageSize,
      els.customWidth, els.customHeight, els.numPhotos,
      els.hSpacing, els.vSpacing, els.marginTop, els.marginLeft,
      els.autocenter, els.showCutlines, els.addBorder, els.format
    ];
    settingsInputs.forEach(el => {
      if (el) el.addEventListener('input', () => {
        if (el === els.pageSize) handlePageSizeChange();
        if (el === els.unit) handleUnitChange();
        if (el === els.photoWidth || el === els.photoHeight) updateCropperAspectRatio();
        renderCanvas();
      });
    });

    els.autofixBtn.addEventListener('click', autoFixLayout);

    // UX Improvement: Uncheck Auto-Center if user manually edits margins
    const disableAutoCenter = () => {
      if (els.autocenter.checked) {
        els.autocenter.checked = false;
        // We don't need to call renderCanvas here because the 'input' event 
        // that triggered this will call renderCanvas anyway.
      }
    };
    els.marginTop.addEventListener('input', disableAutoCenter);
    els.marginLeft.addEventListener('input', disableAutoCenter);

    // Download
    els.downloadBtn.addEventListener('click', () => downloadOutput(false));
    els.downloadHQBtn.addEventListener('click', () => downloadOutput(true));

    // Theme & Modal
    els.themeBtn.addEventListener('click', toggleTheme);
    els.infoBtn.addEventListener('click', () => els.infoModal.classList.add('active'));
    els.closeInfo.addEventListener('click', () => els.infoModal.classList.remove('active'));
    els.infoModal.addEventListener('click', (e) => { if (e.target === els.infoModal) els.infoModal.classList.remove('active'); });
  }

  // ==== File Handling ====
  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG/PNG).');
      return;
    }

    if (originalImageURL) URL.revokeObjectURL(originalImageURL);
    originalImageURL = URL.createObjectURL(file);
    currentImageURL = originalImageURL;
    currentFile = file; // Store file object

    startCropper(currentImageURL);
    els.uploadArea.classList.add('hidden');
    els.editorContainer.classList.remove('hidden');
  }

  // ==== Cropper.js Logic ====
  function startCropper(url) {
    if (cropper) cropper.destroy();

    els.imageToCrop.src = url;
    cropper = new Cropper(els.imageToCrop, {
      viewMode: 1,
      dragMode: 'move',
      aspectRatio: getAspectRatio(), // Initialize with correct ratio
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      ready() {
        renderCanvas();
      },
      cropend() {
        renderCanvas();
      }
    });
  }

  function getAspectRatio() {
    const w = parseFloat(els.photoWidth.value);
    const h = parseFloat(els.photoHeight.value);
    return (w && h) ? w / h : NaN;
  }

  function updateCropperAspectRatio() {
    if (!cropper) return;
    const ratio = getAspectRatio();
    cropper.setAspectRatio(ratio);
  }

  // ==== Background Removal ====
  // ==== Background Removal ====
  async function removeBackground() {
    if (!currentImageURL && !currentFile) return;

    // Diagnostic Check: Headers
    if (!window.crossOriginIsolated) {
      alert('Background removal requires a secure environment with specific headers.\nPlease ensure you are running the server (node server.js) and accessing via http://127.0.0.1:8080');
      return;
    }

    els.bgProcessing.classList.remove('hidden');
    els.removeBgBtn.disabled = true;

    try {
      // Config to ensure it works locally
      // Explicitly point to the assets on the CDN to avoid relative path issues
      const config = {
        publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@1.0.6/dist/',
        debug: true,
        progress: (key, current, total) => {
          console.log(`Downloading ${key}: ${current} of ${total}`);
        }
      };

      // Dynamic Import: Load library only when needed
      const { removeBackground: imglyRemoveBackground } = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.0.5/+esm');

      // Prefer passing the File object directly if available
      const source = currentFile || currentImageURL;
      const blob = await imglyRemoveBackground(source, config);
      const newUrl = URL.createObjectURL(blob);

      currentImageURL = newUrl;
      startCropper(currentImageURL);

    } catch (error) {
      console.error('Background removal failed:', error);
      alert(`Background removal failed: ${error.message || 'Unknown error'}.\nCheck console for details.`);
    } finally {
      els.bgProcessing.classList.add('hidden');
      els.removeBgBtn.disabled = false;
    }
  }

  // ==== Rendering Logic ====
  function getDPI() { return parseInt(els.dpi.value) || 300; }

  function toPx(val, unit) {
    const dpi = getDPI();
    val = parseFloat(val) || 0;
    if (unit === 'mm') return (val / 25.4) * dpi;
    if (unit === 'inch') return val * dpi;
    return val; // px
  }

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
    const dpi = getDPI();

    if (type === 'a4') return { w: toPx(210, 'mm'), h: toPx(297, 'mm') };
    if (type === '4r') return { w: toPx(4, 'inch'), h: toPx(6, 'inch') };

    return {
      w: toPx(els.customWidth.value, unit),
      h: toPx(els.customHeight.value, unit)
    };
  }

  function renderCanvas() {
    if (!cropper) return;

    const canvas = els.outputCanvas;
    const ctx = canvas.getContext('2d');
    const dims = getDims();
    const page = getPageSize();
    const count = parseInt(els.numPhotos.value) || 1;

    // Set canvas size
    canvas.width = page.w;
    canvas.height = page.h;

    // Fill Background (Paper Color)
    ctx.fillStyle = isDark ? '#23293b' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate Grid
    const contentW = page.w - dims.marginL * 2; // Simplified margin logic (left=right)
    const contentH = page.h - dims.marginT * 2; // Simplified margin logic (top=bottom)

    const cols = Math.floor((contentW + dims.gapH) / (dims.w + dims.gapH));
    const rows = Math.ceil(count / cols);

    // Auto Center Logic
    let startX = dims.marginL;
    let startY = dims.marginT;

    if (els.autocenter.checked) {
      const totalRowW = cols * dims.w + (cols - 1) * dims.gapH;
      // Center horizontally
      if (cols > 0) startX = (page.w - totalRowW) / 2;

      // Ensure margins are at least what was set (or 3mm min as requested)
      startX = Math.max(startX, dims.marginL);
      startY = Math.max(startY, dims.marginT);

      // Update inputs to show actual values
      // Use a flag to prevent infinite loop if we were triggering events (we aren't, but good practice)
      if (document.activeElement !== els.marginLeft) {
        els.marginLeft.value = fromPx(startX, els.unit.value).toFixed(2);
      }
      if (document.activeElement !== els.marginTop) {
        els.marginTop.value = fromPx(startY, els.unit.value).toFixed(2);
      }
    }

    // Get Cropped Image
    // CRITICAL FIX: Use the aspect ratio of the TARGET dimensions to avoid stretching.
    // We ask Cropper for a canvas that matches the target dimensions exactly.
    // Since we locked the aspect ratio in updateCropperAspectRatio, this should be safe.
    // If the user somehow unlocked it, this ensures we get the content scaled to fit.

    const croppedCanvas = cropper.getCroppedCanvas({
      width: dims.w * 2, // Higher res for print
      height: dims.h * 2,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      fillColor: bgColor // Set the background color for the cropped image
    });

    if (!croppedCanvas) return;

    // Draw Photos
    let drawn = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (drawn >= count) break;

        const x = startX + c * (dims.w + dims.gapH);
        const y = startY + r * (dims.h + dims.gapV);

        // Draw Image
        ctx.drawImage(croppedCanvas, x, y, dims.w, dims.h);

        // Draw Border/Cutlines
        if (els.showCutlines.checked) {
          ctx.save();

          // Calculate line width based on DPI (e.g., 0.5mm thickness)
          // 1px at 300 DPI is invisible. We need physical thickness.
          const dpi = getDPI();
          const lineWidth = Math.max(2, (0.5 / 25.4) * dpi); // Min 2px, target 0.5mm

          // Draw White Outline first (for contrast on dark photos)
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = lineWidth + 2; // Slightly wider
          ctx.setLineDash([]);
          ctx.strokeRect(x, y, dims.w, dims.h);

          // Draw Black Line on top
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = lineWidth;
          ctx.strokeRect(x, y, dims.w, dims.h);

          ctx.restore();
        }

        // Draw Photo Border (Thin)
        if (els.addBorder.checked) {
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1; // Thin 1px border
          ctx.strokeRect(x, y, dims.w, dims.h);
          ctx.restore();
        }

        drawn++;
      }
    }
  }

  // ==== Helpers ====
  // ==== Unit Conversion Logic ====
  let previousUnit = 'mm'; // Default start unit

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

      // Convert current value to pixels first
      if (previousUnit === 'mm') pxVal = (val / 25.4) * dpi;
      else if (previousUnit === 'inch') pxVal = val * dpi;
      else pxVal = val; // already px

      // Convert pixels to new unit
      let newVal = 0;
      if (newUnit === 'mm') newVal = (pxVal * 25.4) / dpi;
      else if (newUnit === 'inch') newVal = pxVal / dpi;
      else newVal = pxVal;

      // Update input value (round to 2 decimals for mm/inch, 0 for px)
      input.value = (newUnit === 'px') ? Math.round(newVal) : newVal.toFixed(2);
    });

    previousUnit = newUnit;
    renderCanvas(); // Re-render after unit change
  }

  function handlePageSizeChange() {
    const isCustom = els.pageSize.value === 'custom';
    els.customPageSize.classList.toggle('hidden', !isCustom);
    renderCanvas();
  }

  function autoFixLayout() {
    // User requested: 300px x 400px
    // We'll use these as the base values and convert if needed.

    const currentUnit = els.unit.value;
    const dpi = getDPI();

    // Target values in PX
    // Gap/Margin: 3mm is approx 35px at 300 DPI.
    const targets = {
      w: 300,
      h: 400,
      gap: 35,
      margin: 35
    };

    // Helper to convert PX to current unit
    const convert = (pxVal) => {
      if (currentUnit === 'px') return pxVal;
      if (currentUnit === 'inch') return pxVal / dpi;
      if (currentUnit === 'mm') return (pxVal / dpi) * 25.4;
      return pxVal;
    };

    // Set values
    const format = (val) => currentUnit === 'px' ? Math.round(val) : val.toFixed(2);

    els.photoWidth.value = format(convert(targets.w));
    els.photoHeight.value = format(convert(targets.h));
    els.hSpacing.value = format(convert(targets.gap));
    els.vSpacing.value = format(convert(targets.gap));
    els.marginTop.value = format(convert(targets.margin));
    els.marginLeft.value = format(convert(targets.margin));

    // Auto-center
    els.autocenter.checked = true;

    updateCropperAspectRatio();
    renderCanvas();

    // Visual feedback
    const originalText = els.autofixBtn.innerHTML;
    els.autofixBtn.innerHTML = '<i class="fa fa-check"></i> Applied!';
    setTimeout(() => els.autofixBtn.innerHTML = originalText, 1500);
  }

  function renderCanvas() {
    if (!cropper) return;

    const canvas = els.outputCanvas;
    const ctx = canvas.getContext('2d');
    const dims = getDims();
    const page = getPageSize();
    const count = parseInt(els.numPhotos.value) || 1;

    // Set canvas size
    canvas.width = page.w;
    canvas.height = page.h;

    // Fill Background (Paper Color)
    ctx.fillStyle = isDark ? '#23293b' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate Grid
    const contentW = page.w - dims.marginL * 2;
    const contentH = page.h - dims.marginT * 2;

    const cols = Math.floor((contentW + dims.gapH) / (dims.w + dims.gapH));
    const rows = Math.ceil(count / cols);

    // Auto Center Logic
    let startX = dims.marginL;
    let startY = dims.marginT;

    if (els.autocenter.checked) {
      const totalRowW = cols * dims.w + (cols - 1) * dims.gapH;
      // Center horizontally
      if (cols > 0) startX = (page.w - totalRowW) / 2;

      // Ensure margins are at least what was set (or 3mm min as requested)
      startX = Math.max(startX, dims.marginL);
      startY = Math.max(startY, dims.marginT);
    }

    // Get Cropped Image
    // Fix Deformation: We must ensure the cropped canvas has the same aspect ratio as the target dims
    // The cropper box might have a slightly different ratio if the user manually adjusted it freely.
    // However, we forced aspect ratio in updateCropperAspectRatio.
    // If user unlocked it, we should crop what they see, but draw it to fill the target dims?
    // NO, that causes deformation. We should draw it to FIT or FILL.
    // Passport photos usually must fill the box. So we force the crop to match the ratio.

    const targetRatio = dims.w / dims.h;

    // We get the data from cropper
    const cropData = cropper.getData();

    // If we want to avoid deformation, we should re-apply the aspect ratio to the cropper if it drifted,
    // OR we just take what the user cropped and draw it. 
    // If we draw a square crop into a rectangular slot, it stretches.
    // Solution: The cropper MUST be locked to the aspect ratio of the dimensions.
    // We already do `cropper.setAspectRatio(w / h)` in `updateCropperAspectRatio`.
    // We just need to make sure it updates when dims change.

    const croppedCanvas = cropper.getCroppedCanvas({
      width: dims.w * 2, // Higher res for print
      height: dims.h * 2,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      fillColor: bgColor
    });

    if (!croppedCanvas) return;

    // Draw Photos
    let drawn = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (drawn >= count) break;

        const x = startX + c * (dims.w + dims.gapH);
        const y = startY + r * (dims.h + dims.gapV);

        // Draw Image
        ctx.drawImage(croppedCanvas, x, y, dims.w, dims.h);

        // Draw Photo Border (Thin)
        if (els.addBorder && els.addBorder.checked) {
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1; // Thin 1px border
          ctx.strokeRect(x, y, dims.w, dims.h);
          ctx.restore();
        }

        drawn++;
      }
    }

    // Draw Grid Cutlines (Dotted lines in gaps)
    if (els.showCutlines.checked && rows > 0 && cols > 0) {
      ctx.save();

      // Style: Thin light dotted line
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#999999'; // Light gray
      ctx.setLineDash([2, 2]); // Small dots

      // Helper to check if a cell has a photo
      const hasPhoto = (r, c) => (r * cols + c) < count;

      // Vertical Lines (Inner gaps only)
      // Iterate through columns 1 to cols-1 (between columns)
      for (let c = 1; c < cols; c++) {
        const x = startX + c * (dims.w + dims.gapH) - dims.gapH / 2;

        // Iterate through rows to draw segments
        for (let r = 0; r < rows; r++) {
          // Draw vertical segment for this row if there is a photo on left OR right
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

      // Horizontal Lines (Inner gaps only)
      // Iterate through rows 1 to rows-1 (between rows)
      for (let r = 1; r < rows; r++) {
        const y = startY + r * (dims.h + dims.gapV) - dims.gapV / 2;

        // Iterate through columns to draw segments
        for (let c = 0; c < cols; c++) {
          // Draw horizontal segment for this col if there is a photo above OR below
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

  function downloadOutput(hq) {
    const ext = els.format.value || 'jpg';
    const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = hq ? 1.0 : 0.92;
    const filename = `passport-photo.${ext}`;

    // Use toBlob instead of toDataURL to avoid URL length limits
    els.outputCanvas.toBlob((blob) => {
      if (!blob) {
        alert('Error: Could not generate image. Please try again.');
        return;
      }

      console.log(`Downloading: ${filename}`); // Debug

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename); // Explicitly set attribute
      link.style.display = 'none'; // Hide it

      // Append to body to ensure click works in all browsers (Firefox requirement)
      document.body.appendChild(link);

      // Small delay to ensure DOM update
      setTimeout(() => {
        link.click();

        // Cleanup after a longer delay to ensure download starts
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 2000); // 2 seconds delay for cleanup
      }, 100);

    }, mime, quality);
  }

  // Start
  init();
});
