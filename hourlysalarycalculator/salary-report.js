/* Preview zoom never changes the physical report or the export dimensions. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const find = id => document.getElementById(id);
    const modal = find('report-preview-modal');
    const page = find('report-preview-content');
    const stage = find('report-stage');
    const scroller = find('report-scrollable-content');
    const paper = find('report-paper-size');
    const zoomLabel = find('zoom-level');
    const main = document.querySelector('main');
    let zoom = 1, mode = 'page', busy = false, previousFocus, previousOverflow, previousInert;
    const isOpen = () => !modal.classList.contains('hidden');
    const size = () => paper.value === 'landscape' ? { width: 297, height: 210 } : { width: 210, height: 297 };
    const pixels = () => { const { width, height } = size(); return { width: width * 96 / 25.4, height: height * 96 / 25.4 }; };

    function fittedZoom(view) {
      const bounds = pixels();
      const style = getComputedStyle(scroller);
      const width = scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = scroller.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return Math.min(1, view === 'width' ? width / bounds.width : Math.min(width / bounds.width, height / bounds.height));
    }

    function setZoom(value, view = 'custom', anchor) {
      const bounds = pixels();
      const oldZoom = zoom;
      const point = anchor || { x: scroller.clientWidth / 2, y: scroller.clientHeight / 2 };
      const oldRect = stage.getBoundingClientRect();
      const scrollRect = scroller.getBoundingClientRect();
      const documentX = (scrollRect.left + point.x - oldRect.left) / oldZoom;
      const documentY = (scrollRect.top + point.y - oldRect.top) / oldZoom;
      zoom = Math.min(3, Math.max(view === 'custom' ? 0.2 : 0.05, value));
      mode = view;
      stage.style.width = `${bounds.width * zoom}px`;
      stage.style.height = `${bounds.height * zoom}px`;
      page.style.transform = `scale(${zoom})`;
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      find('zoom-fit-btn').setAttribute('aria-pressed', String(view === 'page'));
      find('zoom-width-btn').setAttribute('aria-pressed', String(view === 'width'));
      find('zoom-actual-btn').setAttribute('aria-pressed', String(view === 'actual'));
      find('zoom-out-btn').disabled = zoom <= 0.2;
      find('zoom-in-btn').disabled = zoom >= 3;
      if (view === 'page' || view === 'width') scroller.scrollTo(0, 0);
      else {
        const newRect = stage.getBoundingClientRect();
        scroller.scrollLeft += newRect.left + documentX * zoom - scrollRect.left - point.x;
        scroller.scrollTop += newRect.top + documentY * zoom - scrollRect.top - point.y;
      }
    }
    const fit = view => setZoom(fittedZoom(view), view);

    function arrangePaper() {
      page.dataset.orientation = paper.value;
      const inner = page.querySelector('.report-sheet-inner');
      inner.style.transform = '';
      inner.style.minHeight = '100%';
      // Compress unusually long names or wrapped numbers as a whole, without clipping rows.
      const style = getComputedStyle(page);
      const available = pixels().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const natural = inner.scrollHeight;
      const scale = natural > available + 1 ? available / natural : 1;
      if (scale < 1) inner.style.transform = `scale(${scale})`;
      const { width, height } = size();
      find('report-page-details').textContent = `A4 ${paper.value} · ${width} × ${height} mm · 1 page`;
      find('report-layout-note').textContent = scale < 0.85 ? 'Content reduced to fit A4. Try the other orientation for a larger layout.' : 'Preview and downloads use the same A4 layout. Print at 100% or Actual size.';
      find('report-print-page').textContent = `@page { size: A4 ${paper.value}; margin: 0; }`;
      fit(mode === 'width' ? 'width' : 'page');
    }

    function open() {
      const message = validateReportInputs();
      if (message) return showToast(message);
      const hasHours = Array.from(document.querySelectorAll('.hours-select')).some(select => Number(select.value) > 0);
      if (!hasHours && !confirm('No hours have been entered. Generate a report anyway?')) return;
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      previousInert = main.hasAttribute('inert');
      page.innerHTML = `<div class="report-sheet-inner">${generateReportHTML()}</div>`;
      modal.classList.remove('hidden');
      document.body.classList.add('salary-report-open');
      document.body.style.overflow = 'hidden';
      main.setAttribute('inert', '');
      mode = 'page';
      arrangePaper();
      find('modal-close-btn').focus({ preventScroll: true });
      document.fonts.ready.then(() => { if (isOpen()) arrangePaper(); });
    }

    function close() {
      if (busy) return;
      modal.classList.add('hidden');
      document.body.classList.remove('salary-report-open');
      document.body.style.overflow = previousOverflow;
      if (!previousInert) main.removeAttribute('inert');
      previousFocus?.focus({ preventScroll: true });
    }

    async function download(format) {
      if (busy) return;
      if (!window.html2canvas || (format === 'pdf' && !window.jspdf?.jsPDF)) return showToast('Report tools are loading. Please try again in a moment.');
      busy = true;
      modal.setAttribute('aria-busy', 'true');
      const controls = Array.from(modal.querySelectorAll('button, select'));
      const disabled = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      const button = find(`modal-download-${format}-btn`);
      const label = button.innerHTML;
      button.textContent = `Creating ${format.toUpperCase()}…`;
      try {
        await document.fonts.ready;
        const bounds = pixels();
        const canvas = await html2canvas(page, {
          scale: 3, backgroundColor: '#ffffff', logging: false, useCORS: true,
          width: bounds.width, height: bounds.height, windowWidth: Math.ceil(bounds.width), windowHeight: Math.ceil(bounds.height),
          scrollX: 0, scrollY: 0,
          onclone(doc) {
            const copy = doc.getElementById('report-preview-content');
            doc.body.appendChild(copy);
            copy.style.cssText = 'position:absolute;left:0;top:0;transform:none;margin:0;box-shadow:none;';
          }
        });
        const safe = value => value.trim().replace(/[^a-z0-9_-]+/gi, '_').slice(0, 70) || 'Report';
        const filename = `Salary_Report_${safe(find('employee-name-input').value)}_${getMonthKey()}_A4_${paper.value}`;
        if (format === 'pdf') {
          const pdf = new window.jspdf.jsPDF({ orientation: paper.value, unit: 'mm', format: 'a4', compress: true });
          pdf.addImage(canvas, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
          pdf.save(`${filename}.pdf`);
        } else {
          const link = document.createElement('a');
          link.download = `${filename}.jpg`;
          link.href = canvas.toDataURL('image/jpeg', 0.95);
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        showToast(`${format.toUpperCase()} report downloaded.`);
      } catch (error) {
        console.error('Salary report export failed:', error);
        showToast('Could not download the report. Please try again.');
      } finally {
        busy = false;
        modal.removeAttribute('aria-busy');
        controls.forEach((control, index) => { control.disabled = disabled[index]; });
        button.innerHTML = label;
        button.focus({ preventScroll: true });
      }
    }

    find('report-btn').addEventListener('click', open);
    find('modal-close-btn').addEventListener('click', close);
    paper.addEventListener('change', arrangePaper);
    find('zoom-fit-btn').addEventListener('click', () => fit('page'));
    find('zoom-width-btn').addEventListener('click', () => fit('width'));
    find('zoom-actual-btn').addEventListener('click', () => setZoom(1, 'actual'));
    find('zoom-out-btn').addEventListener('click', () => setZoom(zoom - 0.1));
    find('zoom-in-btn').addEventListener('click', () => setZoom(zoom + 0.1));
    find('modal-download-pdf-btn').addEventListener('click', () => download('pdf'));
    find('modal-download-jpg-btn').addEventListener('click', () => download('jpg'));
    find('modal-print-btn').addEventListener('click', () => window.print());
    new ResizeObserver(() => { if (isOpen() && (mode === 'page' || mode === 'width')) fit(mode); }).observe(scroller);

    document.addEventListener('keydown', event => {
      if (!isOpen()) return;
      if (busy) { if (event.key === 'Tab' || event.key === 'Escape') event.preventDefault(); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Tab') {
        const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), select:not(:disabled), [tabindex="0"]'));
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); window.print(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom + 0.1); }
      if (event.key === '-') { event.preventDefault(); setZoom(zoom - 0.1); }
      if (event.key === '0') { event.preventDefault(); fit('page'); }
    });

    let pinch;
    scroller.addEventListener('touchstart', event => {
      if (event.touches.length !== 2 || busy) return;
      event.preventDefault();
      pinch = { distance: Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY), zoom };
    }, { passive: false });
    scroller.addEventListener('touchmove', event => {
      if (!pinch || event.touches.length !== 2 || busy) return;
      event.preventDefault();
      const [a, b] = event.touches, rect = scroller.getBoundingClientRect();
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch.distance) setZoom(pinch.zoom * distance / pinch.distance, 'custom', { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top });
    }, { passive: false });
    scroller.addEventListener('touchend', () => { pinch = null; });
    scroller.addEventListener('touchcancel', () => { pinch = null; });
  });
})();
