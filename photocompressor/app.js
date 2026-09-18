(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const ui = Object.fromEntries(['uploadBox','photoInput','fileSummary','fileName','fileMeta','changePhoto',
    'uploadStatus','errorStatus','settingsFields','targetSize','format','formatHint','targetOptions',
    'customWidth','customHeight','dimensionUnit','dpiInput','dpiBox','dimensionHint','allowResize',
    'cropToggle','cropArea','sourcePreview','cropBox','resetCrop','originalStage','originalEmpty',
    'resultPreview','resultEmpty','resultEmptyTitle','resultEmptyHint','resultStatus','resultStats',
    'originalSize','resultSize','savings','resultDimensions','originalDimensions',
    'compressBtn','resetBtn','downloadBtn','actionSummary','resultsPanel','themeBtn'].map(id => [id, byId(id)]));
  let file = null, source = null, sourceUrl = null, resultUrl = null;
  let uploadVersion = 0, jobVersion = 0, busy = false;
  let crop = { x: 0, y: 0, w: 1, h: 1 }, drag = null;
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
  const extension = mime => ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mime];
  const bytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  function status(element, text) {
    element.textContent = text; element.hidden = !text;
    if (element === ui.errorStatus && text) element.scrollIntoView({block:'nearest'});
  }
  function setBusy(value) {
    busy = value;
    ui.settingsFields.disabled = value;
    ui.compressBtn.disabled = value || !source;
    ui.compressBtn.textContent = value ? 'Compressing…' : 'Compress photo';
    ui.cropBox.setAttribute('aria-disabled', String(value));
    ui.resetCrop.disabled = value;
    ui.resultsPanel.setAttribute('aria-busy', String(value));
  }
  function clearResult() {
    jobVersion++;
    ui.resultPreview.hidden = true; ui.resultPreview.removeAttribute('src');
    ui.downloadBtn.hidden = true; ui.downloadBtn.removeAttribute('href');
    ui.resultStats.hidden = true; ui.resultEmpty.hidden = false;
    ui.resultDimensions.textContent = '';
    ui.resultEmptyTitle.textContent = source ? 'Ready when you are' : 'Your compressed photo appears here';
    ui.resultEmptyHint.textContent = source ? 'Choose your settings, then compress to compare the result.' : 'Choose a photo to see its size and create a smaller copy.';
    status(ui.resultStatus, ''); status(ui.errorStatus, '');
    ui.actionSummary.textContent = source ? 'Settings ready · compress to preview' : 'Choose a photo to get started';
    document.body.classList.remove('has-result');
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
  }
  function openPicker() { ui.photoInput.value = ''; ui.photoInput.click(); }
  ui.uploadBox.addEventListener('click', openPicker);
  ui.uploadBox.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); }
  });
  ui.changePhoto.addEventListener('click', openPicker);
  ui.photoInput.addEventListener('change', () => { if (ui.photoInput.files[0]) loadFile(ui.photoInput.files[0]); });
  ['dragover','dragenter','dragleave','drop'].forEach(name => ui.uploadBox.addEventListener(name, event => {
    event.preventDefault(); event.stopPropagation();
    ui.uploadBox.classList.toggle('drag-over', name === 'dragover' || name === 'dragenter');
    if (name === 'drop' && event.dataTransfer.files[0]) loadFile(event.dataTransfer.files[0]);
  }));
  function loadFile(nextFile) {
    const request = ++uploadVersion;
    status(ui.errorStatus, '');
    if (!nextFile.type.startsWith('image/')) { status(ui.errorStatus, 'Choose an image such as JPG, PNG or WebP.'); return; }
    if (!nextFile.size || nextFile.size > 25 * 1048576) { status(ui.errorStatus, 'Choose a non-empty photo up to 25 MB.'); return; }
    status(ui.uploadStatus, 'Opening photo…');
    const candidateUrl = URL.createObjectURL(nextFile);
    const image = new Image();
    const fail = message => {
      URL.revokeObjectURL(candidateUrl);
      if (request !== uploadVersion) return;
      status(ui.uploadStatus, '');
      status(ui.errorStatus, message + (source ? ' Your previous photo is unchanged.' : ''));
    };
    image.onerror = () => fail('This image could not be opened. Try exporting it as JPG or PNG.');
    image.onload = () => {
      if (request !== uploadVersion) { URL.revokeObjectURL(candidateUrl); return; }
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) { fail('Choose a photo up to 40 megapixels.'); return; }
      file = nextFile; source = image;
      clearResult(); setBusy(false);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl = candidateUrl;
      ui.sourcePreview.onload = () => { fitOriginal(); resetCrop(); };
      ui.sourcePreview.src = sourceUrl;
      ui.fileName.textContent = file.name;
      ui.fileMeta.textContent = bytes(file.size) + ' · ' + source.naturalWidth + ' × ' + source.naturalHeight + ' px';
      ui.originalDimensions.textContent = source.naturalWidth + ' × ' + source.naturalHeight + ' px';
      ui.originalEmpty.hidden = true; ui.cropArea.hidden = false;
      ui.fileSummary.hidden = false; ui.uploadBox.hidden = true;
      document.body.classList.add('has-photo');
      status(ui.uploadStatus, 'Photo ready. Choose a target size, then compress.');
      updateSettings();
    };
    image.src = candidateUrl;
  }
  function requestedSize() {
    const unit = ui.dimensionUnit.value, dpi = Number(ui.dpiInput.value);
    if (unit !== 'px' && (!ui.dpiInput.value || !ui.dpiInput.checkValidity())) throw new Error('Enter a DPI from 1 to 2400.');
    const read = input => {
      if (!input.value) return null;
      if (!input.checkValidity() || Number(input.value) <= 0) throw new Error('Width and height must be positive numbers, or leave them blank.');
      return PhotoCompression.toPixels(Number(input.value), unit, unit === 'px' ? 1 : dpi);
    };
    return { width: read(ui.customWidth), height: read(ui.customHeight) };
  }
  function updateSettings() {
    const png = ui.format.value === 'image/png';
    ui.targetOptions.disabled = png;
    ui.dpiBox.hidden = ui.dimensionUnit.value === 'px';
    ui.cropToggle.disabled = !source;
    ui.formatHint.textContent = png ? 'PNG keeps transparency. Its lossless encoding does not use a target KB size.' :
      ui.format.value === 'image/webp' ? 'WebP supports transparency. Check that your upload form accepts WebP.' :
      'JPG works with most upload forms. Transparent areas become white.';
    document.querySelectorAll('[data-size]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.size === ui.targetSize.value && !png)));
    document.querySelectorAll('.dimension-unit').forEach(label => { label.textContent = '(' + ui.dimensionUnit.value + ')'; });
    try {
      const size = requestedSize();
      ui.allowResize.disabled = png || !(size.width || size.height);
      ui.dimensionHint.textContent = size.width || size.height ?
        'Requested: ' + (size.width || 'auto') + ' × ' + (size.height || 'auto') + ' px. ' +
        (ui.cropToggle.checked ? 'Crop to this shape.' : 'Fit inside these dimensions without stretching.') :
        'Leave dimensions blank to start with the original size. JPG and WebP may be resized to reach your target.';
    } catch (error) { ui.dimensionHint.textContent = error.message; }
    ui.cropBox.hidden = !source || !ui.cropToggle.checked;
    ui.resetCrop.hidden = ui.cropBox.hidden;
  }
  document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
    ui.targetSize.value = button.dataset.size; clearResult(); updateSettings();
  }));
  [ui.targetSize, ui.format, ui.customWidth, ui.customHeight, ui.dimensionUnit, ui.dpiInput, ui.allowResize, ui.cropToggle].forEach(input => {
    input.addEventListener(input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input', () => {
      clearResult(); updateSettings();
      if ([ui.customWidth,ui.customHeight,ui.dimensionUnit,ui.dpiInput,ui.cropToggle].includes(input)) resetCrop();
    });
  });
  function fitOriginal() {
    if (!source) return;
    const height = Math.min(320, ui.originalStage.clientHeight - 16);
    const width = Math.min(ui.originalStage.clientWidth, height * source.naturalWidth / source.naturalHeight);
    ui.cropArea.style.width = width + 'px';
    paintCrop();
  }
  function resetCrop() {
    if (!source) return;
    let size;
    try { size = requestedSize(); } catch { return; }
    const ratio = size.width && size.height ? size.width / size.height : source.naturalWidth / source.naturalHeight;
    let w = source.naturalWidth * .8, h = w / ratio;
    if (h > source.naturalHeight * .8) { h = source.naturalHeight * .8; w = h * ratio; }
    crop = { x: (1 - w/source.naturalWidth)/2, y: (1 - h/source.naturalHeight)/2, w: w/source.naturalWidth, h: h/source.naturalHeight };
    paintCrop();
  }
  function paintCrop() {
    ui.cropBox.style.left = crop.x * 100 + '%'; ui.cropBox.style.top = crop.y * 100 + '%';
    ui.cropBox.style.width = crop.w * 100 + '%'; ui.cropBox.style.height = crop.h * 100 + '%';
  }
  ui.resetCrop.addEventListener('click', () => { clearResult(); resetCrop(); });
  ui.cropBox.addEventListener('pointerdown', event => {
    if (busy) return;
    event.preventDefault(); ui.cropBox.focus({preventScroll:true});
    drag = { x:event.clientX, y:event.clientY, crop:{...crop}, resize:event.target.classList.contains('resize-handle') };
    ui.cropBox.setPointerCapture(event.pointerId);
  });
  ui.cropBox.addEventListener('pointermove', event => {
    if (!drag || busy) return;
    const rect = ui.sourcePreview.getBoundingClientRect();
    const dx = (event.clientX-drag.x)/rect.width, dy = (event.clientY-drag.y)/rect.height;
    if (drag.resize) {
      const factor = clamp(1 + dx / drag.crop.w, .08, Math.min((1-crop.x)/drag.crop.w,(1-crop.y)/drag.crop.h));
      crop.w = drag.crop.w * factor; crop.h = drag.crop.h * factor;
    } else { crop.x = clamp(drag.crop.x+dx,0,1-crop.w); crop.y = clamp(drag.crop.y+dy,0,1-crop.h); }
    clearResult(); paintCrop();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(name => ui.cropBox.addEventListener(name, () => { drag = null; }));
  ui.cropBox.addEventListener('keydown', event => {
    if (busy || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    if (event.shiftKey) {
      const factor = clamp(1+direction*.04,.1,Math.min((1-crop.x)/crop.w,(1-crop.y)/crop.h));
      crop.w *= factor; crop.h *= factor;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') crop.x = clamp(crop.x+direction*.01,0,1-crop.w);
    else crop.y = clamp(crop.y+direction*.01,0,1-crop.h);
    clearResult(); paintCrop();
  });
  new ResizeObserver(fitOriginal).observe(ui.originalStage);

  ui.compressBtn.addEventListener('click', async () => {
    if (!source || busy) return;
    clearResult();
    const request = jobVersion;
    let size;
    const format = ui.format.value, targetKB = Number(ui.targetSize.value);
    try {
      if (format !== 'image/png' && (!ui.targetSize.value || !ui.targetSize.checkValidity())) throw new Error('Choose a target size from 10 to 20,000 KB.');
      size = requestedSize();
    } catch (error) { status(ui.errorStatus, error.message); return; }
    const input = source, inputFile = file;
    const area = ui.cropToggle.checked ? {...crop} : {x:0,y:0,w:1,h:1};
    const sx = area.x*input.naturalWidth, sy = area.y*input.naturalHeight;
    const sw = area.w*input.naturalWidth, sh = area.h*input.naturalHeight;
    const allowResize = !(size.width || size.height) || ui.allowResize.checked;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d'); // Keep alpha available when switching between JPG and PNG.
    setBusy(true);
    ui.actionSummary.textContent = 'Finding a smaller file…';
    try {
      const dimensions = PhotoCompression.outputDimensions(sw, sh, size.width, size.height, ui.cropToggle.checked);
      const result = await PhotoCompression.compress({
        ...dimensions, targetBytes: format === 'image/png' ? 1 : targetKB*1024, format, allowResize,
        cancelled: () => request !== jobVersion,
        draw(w,h) {
          canvas.width=w; canvas.height=h;
          if (format === 'image/jpeg') { ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); }
          ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
          ctx.drawImage(input,sx,sy,sw,sh,0,0,w,h);
        },
        encode(type,quality) { return new Promise(resolve => canvas.toBlob(resolve,type,quality)); }
      });
      if (request !== jobVersion) return;
      resultUrl = URL.createObjectURL(result.blob);
      ui.resultPreview.src=resultUrl; ui.resultPreview.hidden=false; ui.resultEmpty.hidden=true;
      ui.downloadBtn.href=resultUrl;
      ui.downloadBtn.download=(inputFile.name.replace(/\.[^.]+$/, '') || 'photo')+'-compressed.'+extension(result.blob.type);
      ui.downloadBtn.textContent='Download '+extension(result.blob.type).toUpperCase(); ui.downloadBtn.hidden=false;
      ui.originalSize.textContent=bytes(inputFile.size); ui.resultSize.textContent=bytes(result.blob.size);
      const saving=(1-result.blob.size/inputFile.size)*100;
      ui.savings.textContent=saving>=0 ? saving.toFixed(1)+'% smaller' : Math.abs(saving).toFixed(1)+'% larger';
      ui.resultDimensions.textContent=result.width+' × '+result.height+' px';
      ui.resultStats.hidden=false;
      const reached=result.blob.size<=targetKB*1024;
      let message=format==='image/png' ? 'PNG ready. Target KB does not apply to lossless PNG output.' :
        reached ? 'Target reached · '+bytes(result.blob.size)+' of '+targetKB+' KB' : 'Above target. Allow resizing or choose smaller dimensions to reduce the file further.';
      if (saving < 0) message += ' The new file is larger than your original; consider keeping the original or trying another format.';
      if (result.width!==dimensions.width || result.height!==dimensions.height) message+=' Dimensions were reduced to reach the target.';
      status(ui.resultStatus,message);
      ui.resultStatus.classList.toggle('warning-status', format!=='image/png' && !reached || saving<0);
      ui.actionSummary.textContent=bytes(result.blob.size)+' · '+result.width+' × '+result.height+' px';
      document.body.classList.add('has-result');
      ui.resultsPanel.scrollIntoView({behavior:'auto',block:'start'});
    } catch(error) {
      if (request === jobVersion) { status(ui.errorStatus,error.message); ui.actionSummary.textContent='Adjust your settings and try again'; }
    } finally {
      canvas.width=canvas.height=1;
      if (request === jobVersion) setBusy(false);
    }
  });
  ui.resetBtn.addEventListener('click', () => {
    uploadVersion++; file=null; source=null; drag=null;
    clearResult(); setBusy(false);
    if (sourceUrl) { URL.revokeObjectURL(sourceUrl); sourceUrl=null; }
    ui.photoInput.value=''; ui.sourcePreview.removeAttribute('src');
    ui.fileSummary.hidden=true; ui.uploadBox.hidden=false; ui.cropArea.hidden=true; ui.originalEmpty.hidden=false;
    ui.originalDimensions.textContent=''; status(ui.uploadStatus,'');
    ui.targetSize.value='100'; ui.format.value='image/jpeg'; ui.dimensionUnit.value='px';
    ui.customWidth.value=''; ui.customHeight.value=''; ui.dpiInput.value='300';
    ui.cropToggle.checked=false; ui.allowResize.checked=false;
    document.body.classList.remove('has-photo'); updateSettings(); ui.uploadBox.focus();
  });
  function applyTheme() {
    const dark = document.documentElement.dataset.theme==='dark';
    ui.themeBtn.textContent=dark ? 'Light mode' : 'Dark mode';
    ui.themeBtn.setAttribute('aria-label', 'Switch to '+(dark?'light':'dark')+' mode');
  }
  ui.themeBtn.addEventListener('click', () => { window.toggleShader7Theme(); applyTheme(); });
  window.addEventListener('beforeunload', () => { if(sourceUrl) URL.revokeObjectURL(sourceUrl); if(resultUrl) URL.revokeObjectURL(resultUrl); });
  applyTheme(); updateSettings(); setBusy(false);
})();
