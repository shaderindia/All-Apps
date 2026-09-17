(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const core = window.Shader7Attendance;
    const page = $('attendance-page');
    const stage = $('preview-stage');
    const viewport = $('preview-viewport');
    const form = $('attendance-builder');
    const printStyle = $('attendance-print-page');
    let busy = false;
    let toastTimer;

    const escapeHTML = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
    const valueOrLine = (id, fallback = '') => escapeHTML($(id).value.trim() || fallback);
    const selectedValue = name => form.querySelector(`input[name="${name}"]:checked`).value;
    const monthCount = () => Number(selectedValue('month-count'));
    const orientation = () => selectedValue('orientation');
    const paperMM = () => orientation() === 'landscape' ? { width:297, height:210 } : { width:210, height:297 };
    const paperPX = () => { const size = paperMM(); return { width:size.width * 96 / 25.4, height:size.height * 96 / 25.4 }; };
    function hasValidStartMonth() {
      try { core.assertMonthKey($('start-month').value); return true; }
      catch { return false; }
    }

    function showToast(message) {
      $('toast').textContent = message;
      $('toast').classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
    }

    function makeMonthPanel(monthKey) {
      const rows = core.getMonthRows(monthKey).map(row => {
        const classes = [row.weekend ? 'weekend-row' : '', row.empty ? 'unused-row' : ''].filter(Boolean).join(' ');
        const date = row.empty ? '—' : `${row.day} ${escapeHTML(row.weekday)}`;
        return `<tr class="${classes}"><td class="date-cell">${date}</td><td></td><td></td><td></td><td></td><td class="initial-cell"></td></tr>`;
      }).join('');
      return `<section class="month-panel" aria-label="${escapeHTML(core.formatMonth(monthKey))}">
        <h3 class="month-heading">${escapeHTML(core.formatMonth(monthKey))}</h3>
        <table class="attendance-table"><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Break</th><th>Hours</th><th>Initial</th></tr></thead><tbody>${rows}</tbody></table>
      </section>`;
    }

    function render() {
      if (!hasValidStartMonth()) {
        const advice = $('layout-advice');
        advice.classList.add('warning');
        advice.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span>Choose the first month to update and download the attendance sheet.</span>';
        return;
      }
      const count = monthCount();
      const layout = orientation();
      const months = core.getMonthSequence($('start-month').value, count);
      const period = count === 1 ? core.formatMonth(months[0]) : `${core.formatMonth(months[0])} – ${core.formatMonth(months.at(-1))}`;
      page.dataset.orientation = layout;
      page.dataset.months = String(count);
      page.style.setProperty('--month-columns', count);
      page.innerHTML = `<div class="sheet-inner">
        <header class="sheet-top"><div><h2 class="sheet-company">${valueOrLine('company-name','Company / Organisation')}</h2><p class="sheet-title">Employee attendance record</p></div><div class="sheet-period"><strong>${escapeHTML(period)}</strong><span>${count} month${count > 1 ? 's' : ''} · A4 ${layout}</span></div></header>
        <section class="sheet-meta">
          <div class="meta-item"><span class="meta-label">Employee name</span><span class="meta-value">${valueOrLine('employee-name')}</span></div>
          <div class="meta-item"><span class="meta-label">Employee ID</span><span class="meta-value">${valueOrLine('employee-id')}</span></div>
          <div class="meta-item"><span class="meta-label">Department</span><span class="meta-value">${valueOrLine('department')}</span></div>
          <div class="meta-item"><span class="meta-label">Supervisor</span><span class="meta-value">${valueOrLine('supervisor')}</span></div>
        </section>
        <div class="months-grid">${months.map(makeMonthPanel).join('')}</div>
        <section class="sheet-bottom"><p class="legend"><strong>Attendance notes:</strong> Record arrival and departure times, unpaid break, total worked hours, and employee initials each day. Shade weekends; leave unused dates blank.</p><div class="signatures"><div class="signature-line">Employee signature / date</div><div class="signature-line">Supervisor signature / date</div></div></section>
        <div class="sheet-footer">Created with Shader7 · Blank attendance form · Keep completed records according to your local policy</div>
      </div>`;
      const size = paperMM();
      $('paper-details').textContent = `A4 ${layout} · ${size.width} × ${size.height} mm · ${count} month${count > 1 ? 's' : ''} · 1 page`;
      printStyle.textContent = `@page { size: A4 ${layout}; margin: 0; }`;
      const advice = $('layout-advice');
      advice.classList.toggle('warning', layout === 'portrait' && count > 1);
      advice.innerHTML = layout === 'portrait' && count > 1
        ? '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span>Portrait works, but landscape gives two- and three-month forms wider handwriting boxes.</span>'
        : '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>This layout keeps every selected month on one A4 page.</span>';
      requestAnimationFrame(fitPreview);
    }

    function fitPreview() {
      const bounds = paperPX();
      const style = getComputedStyle(viewport);
      const available = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const scale = Math.min(1, available / bounds.width);
      stage.style.width = `${bounds.width * scale}px`;
      stage.style.height = `${bounds.height * scale}px`;
      page.style.transform = `scale(${scale})`;
    }

    function filename() {
      const safe = valueOrLine('company-name','Attendance').replace(/&[^;]+;/g,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,55) || 'Attendance';
      return `Attendance_${safe}_${$('start-month').value}_${monthCount()}mo_A4_${orientation()}`;
    }

    async function exportSheet(format) {
      if (busy) return;
      if (!hasValidStartMonth()) return showToast('Choose the first month before downloading.');
      if (!window.html2canvas || (format === 'pdf' && !window.jspdf?.jsPDF)) return showToast('Export tools are still loading. Please try again in a moment.');
      busy = true;
      document.body.classList.add('is-exporting');
      const buttons = Array.from(document.querySelectorAll('.actions button'));
      buttons.forEach(button => { button.disabled = true; });
      const active = format === 'pdf' ? $('download-pdf') : $('download-jpg');
      const original = active.innerHTML;
      active.textContent = `Creating ${format.toUpperCase()}…`;
      try {
        await document.fonts.ready;
        const bounds = paperPX();
        const canvas = await window.html2canvas(page, {
          scale:3, backgroundColor:'#ffffff', logging:false, useCORS:true,
          width:bounds.width, height:bounds.height, windowWidth:Math.ceil(bounds.width), windowHeight:Math.ceil(bounds.height), scrollX:0, scrollY:0,
          onclone(doc) {
            const copy = doc.getElementById('attendance-page');
            doc.body.appendChild(copy);
            copy.style.cssText += ';position:absolute;left:0;top:0;transform:none;margin:0;box-shadow:none;';
          }
        });
        if (format === 'pdf') {
          const pdf = new window.jspdf.jsPDF({ orientation:orientation(), unit:'mm', format:'a4', compress:true });
          pdf.addImage(canvas,'PNG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight(),undefined,'FAST');
          pdf.save(`${filename()}.pdf`);
        } else {
          const link = document.createElement('a');
          link.download = `${filename()}.jpg`;
          link.href = canvas.toDataURL('image/jpeg',.95);
          document.body.appendChild(link); link.click(); link.remove();
        }
        showToast(`${format.toUpperCase()} attendance form downloaded.`);
      } catch (error) {
        console.error('Attendance export failed:', error);
        showToast('Could not create the download. Please try again.');
      } finally {
        busy = false;
        document.body.classList.remove('is-exporting');
        buttons.forEach(button => { button.disabled = false; });
        active.innerHTML = original;
        active.focus({ preventScroll:true });
      }
    }

    const now = new Date();
    $('start-month').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    $('copyright-year').textContent = now.getFullYear();
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    $('download-pdf').addEventListener('click', () => exportSheet('pdf'));
    $('download-jpg').addEventListener('click', () => exportSheet('jpg'));
    $('print-sheet').addEventListener('click', () => window.print());
    new ResizeObserver(fitPreview).observe(viewport);
    render();
  });
})();
