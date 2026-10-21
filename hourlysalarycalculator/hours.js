(() => {
  'use strict';
  const math = window.ShaderHours;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = { 
    currentZoom: 1, 
    month: '', 
    drafts: new Map(), 
    dirty: new Set(), 
    saved: new Set(), 
    lastFocus: null,
    calendarView: localStorage.getItem('hours_calendar_view') || (window.innerWidth <= 768 ? 'cards' : 'table')
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const formatNumber = (value, decimals = 1) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  const dayLabel = count => `${count} ${count === 1 ? 'day' : 'days'}`;
  const getMonthKey = () => state.month;
  const monthLabel = key => new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3500);
  }
  function updateEmployeeInfo() {
    const employee = $('#employee-name-input').value.trim(), company = $('#company-name').value.trim();
    if (employee) localStorage.setItem('shader7_active_employee', employee);
    if (company) localStorage.setItem('shader7_active_company', company);
    $('#employee-display-name').textContent = employee || 'Guest';
    $('#employee-info-display').textContent = [employee, company].filter(Boolean).join(' / ') || 'Not entered';
  }
  function collectMonthData() {
    const hours = {}, shifts = {};
    $$('.hours-select').forEach(select => { hours[select.dataset.day] = select.value; });
    $$('.shift-select').forEach(select => { shifts[select.dataset.day] = select.value; });
    return math.normalizeMonthData(state.month, { hours, shifts, employeeName: $('#employee-name-input').value.trim(), companyName: $('#company-name').value.trim() });
  }
  let autoSaveTimer = null;
  
  function updateToolSwitcherUrls(monthKey) {
    if (!monthKey) return;
    const salaryTab = $('#tool-tab-salary');
    const hoursTab = $('#tool-tab-hours');
    const attendanceTab = $('#tool-tab-attendance');
    if (salaryTab) salaryTab.href = `app.html?month=${monthKey}`;
    if (hoursTab) hoursTab.href = `hours.html?month=${monthKey}`;
    if (attendanceTab) attendanceTab.href = `attendance.html?month=${monthKey}`;
  }

  function syncSharedMonthData(monthKey, data) {
    if (!monthKey || !data) return;
    try {
      // Sync to salary calculator schema preserving rates if exists
      const existingCalStr = localStorage.getItem(`calendarData_${monthKey}`);
      let calObj = {};
      if (existingCalStr) {
        try { calObj = JSON.parse(existingCalStr) || {}; } catch (e) {}
      }
      calObj.hours = { ...data.hours };
      calObj.shifts = { ...data.shifts };
      calObj.employeeName = data.employeeName || calObj.employeeName || '';
      calObj.companyName = data.companyName || calObj.companyName || '';
      calObj.savedDate = new Date().toISOString();
      localStorage.setItem(`calendarData_${monthKey}`, JSON.stringify(calObj));
      localStorage.setItem('shader7_active_month', monthKey);
      if (data.employeeName) localStorage.setItem('shader7_active_employee', data.employeeName);
      if (data.companyName) localStorage.setItem('shader7_active_company', data.companyName);
    } catch (e) {
      console.error('Shared sync error from hours:', e);
    }
  }

  function setSaveBadge(status) {
    const badge = $('#save-status-badge');
    if (!badge) return;
    if (status === 'saving') {
      badge.className = 'save-status-badge saving';
      badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Saving draft...';
    } else if (status === 'saved') {
      badge.className = 'save-status-badge saved';
      badge.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Saved in browser ✓';
    } else if (status === 'unsaved') {
      badge.className = 'save-status-badge unsaved';
      badge.innerHTML = '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Unsaved changes';
    }
  }

  function scheduleAutoSave() {
    if (!state.month || !math.isMonthKey(state.month)) return;
    setSaveBadge('saving');
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      try {
        const data = collectMonthData();
        localStorage.setItem(math.storageKey(state.month), JSON.stringify(data));
        syncSharedMonthData(state.month, data);
        updateToolSwitcherUrls(state.month);
        state.drafts.set(state.month, data);
        state.saved.add(state.month);
        state.dirty.delete(state.month);
        setSaveBadge('saved');
        updateSaveStatus();
      } catch (e) {
        console.error(e);
        setSaveBadge('unsaved');
      }
    }, 500);
  }

  function applyQuickFill(action) {
    if (!state.month || !math.isMonthKey(state.month)) return showToast('Please select a valid month first.');
    const count = math.getMonthDays(state.month);

    for (let day = 1; day <= count; day++) {
      const weekday = math.dayOfWeek(state.month, day);
      const isWeekend = weekday === 0 || weekday === 6;
      const hoursSelect = $(`#hours-${day}`);
      const shiftSelect = $(`#shift-${day}`);
      if (!hoursSelect || !shiftSelect) continue;

      if (action === 'weekdays-8') {
        if (!isWeekend) {
          hoursSelect.value = '8';
          shiftSelect.value = '8';
        }
      } else if (action === 'weekdays-12-day') {
        if (!isWeekend) {
          hoursSelect.value = '12';
          shiftSelect.value = 'Day';
        }
      } else if (action === 'weekdays-12-night') {
        if (!isWeekend) {
          hoursSelect.value = '12';
          shiftSelect.value = 'Night';
        }
      } else if (action === 'weekends-off') {
        if (isWeekend) {
          hoursSelect.value = '0';
          shiftSelect.value = '0';
        }
      } else if (action === 'clear-all') {
        hoursSelect.value = '';
        shiftSelect.value = '';
      }
      updateCardState(day);
    }
    markChanged();

    if (action === 'weekdays-8') showToast('Set weekdays to 8h shifts.');
    else if (action === 'weekdays-12-day') showToast('Set weekdays to 12h Day shifts.');
    else if (action === 'weekdays-12-night') showToast('Set weekdays to 12h Night shifts.');
    else if (action === 'weekends-off') showToast('Set weekends to Off.');
    else if (action === 'clear-all') showToast('Cleared month entries.');
  }

  function updateSaveStatus() {
    const isDirty = state.dirty.has(state.month);
    $('#save-status').textContent = isDirty
      ? 'Unsaved changes. Changes are kept automatically in draft.'
      : state.saved.has(state.month) ? 'This month is saved in this browser.' : 'Save this month to keep your work log in this browser.';
    setSaveBadge(isDirty ? 'unsaved' : 'saved');
  }
  function recalculateHours() {
    if (!state.month) return;
    const totals = math.calculateHours(state.month, collectMonthData());
    $('#summary-hours').textContent = `${formatNumber(totals.totalHours)} hrs`;
    $('#summary-days').textContent = dayLabel(totals.daysWorked);
    for (const [id, value] of Object.entries({ 'weekday-hours': totals.weekdayHours, 'weekend-hours': totals.weekendHours, 'night-hours': totals.nightHours, 'c-shift-hours': totals.cShiftHours, 'ot-hours': totals.overtimeHours, 'average-hours': totals.averageHours })) {
      $(`#${id}`).textContent = `${formatNumber(value, 2)} hrs`;
    }

    // Update sticky summary bar
    const stickyHours = $('#sticky-hours');
    const stickyDays = $('#sticky-days');
    const stickyAvg = $('#sticky-avg');
    if (stickyHours) stickyHours.textContent = `${formatNumber(totals.totalHours)} hrs`;
    if (stickyDays) stickyDays.textContent = dayLabel(totals.daysWorked);
    if (stickyAvg) stickyAvg.textContent = `${formatNumber(totals.averageHours, 2)} hrs`;
    $('#log-status').textContent = `${dayLabel(totals.daysLogged)} logged · ${dayLabel(totals.daysOff)} off · ${dayLabel(totals.daysUnlogged)} not entered`;
    $('#totals-announcement').textContent = `${formatNumber(totals.totalHours)} total hours across ${totals.daysWorked} working days.`;
  }
  function markChanged() {
    state.dirty.add(state.month);
    state.drafts.set(state.month, collectMonthData());
    updateEmployeeInfo();
    recalculateHours();
    updateAllCards();
    updateSaveStatus();
    scheduleAutoSave();
  }
  function setCalendarView(viewMode) {
    if (state.calendarView === viewMode) return;
    const currentData = collectMonthData();
    state.calendarView = viewMode;
    localStorage.setItem('hours_calendar_view', viewMode);
    $('#view-cards-btn')?.classList.toggle('active', viewMode === 'cards');
    $('#view-table-btn')?.classList.toggle('active', viewMode === 'table');
    generateCalendar(state.month);
    $$('.hours-select').forEach(select => { select.value = currentData.hours?.[select.dataset.day] ?? ''; });
    $$('.shift-select').forEach(select => { select.value = currentData.shifts?.[select.dataset.day] ?? ''; });
    updateAllCards();
    recalculateHours();
  }

  function updateCardState(day) {
    const hoursSelect = $(`#hours-${day}`);
    const shiftSelect = $(`#shift-${day}`);
    const hours = parseFloat(hoursSelect?.value) || 0;
    const shift = shiftSelect?.value || '';
    const isOff = (hoursSelect?.value === '0' || shift === '0');

    // Cards view
    const card = $(`#card-day-${day}`);
    if (card) {
      card.classList.toggle('has-hours', hours > 0);
      card.classList.toggle('is-off-day', isOff);

      card.querySelectorAll('.quick-pill').forEach(pill => {
        const pHours = pill.dataset.hours;
        const pShift = pill.dataset.shift;
        const isMatch = (pHours === String(hours) && (pShift === shift || (!shift && hours === 0 && pShift === '0')));
        pill.classList.toggle('active', isMatch);
      });

      const chip = $(`#hours-chip-${day}`);
      if (chip) {
        chip.textContent = hours > 0 ? `${hours} hrs` : (isOff ? 'Off (0h)' : '0 hrs');
        chip.style.opacity = hours > 0 ? '1' : '0.6';
      }
    }

    // Table view
    const td = hoursSelect?.closest('td');
    if (td) {
      td.classList.toggle('has-hours', hours > 0);
      td.classList.toggle('is-off-day', isOff);
      let badge = td.querySelector('.shift-tag-pill');
      if (shift || hours > 0 || isOff) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'shift-tag-pill';
          td.querySelector('.calendar-day')?.appendChild(badge);
        }
        const shiftKey = (shift || (hours > 0 ? String(hours) : 'off')).toLowerCase();
        badge.className = `shift-tag-pill shift-${shiftKey}`;
        badge.textContent = shift ? (shiftSelect?.options[shiftSelect.selectedIndex]?.text || shift) : (hours > 0 ? `${hours}h` : 'Off');
      } else if (badge) {
        badge.remove();
      }
    }
  }

  function updateAllCards() {
    if (!state.month) return;
    const count = math.getMonthDays(state.month);
    for (let day = 1; day <= count; day++) updateCardState(day);
  }

  function handleQuickShift(button) {
    const day = button.dataset.day;
    const hours = button.dataset.hours;
    const shift = button.dataset.shift;
    const hoursSelect = $(`#hours-${day}`);
    const shiftSelect = $(`#shift-${day}`);
    if (hoursSelect && shiftSelect) {
      hoursSelect.value = hours;
      shiftSelect.value = shift;
      updateCardState(day);
      markChanged();
    }
  }

  function generateCalendar(month) {
    const count = math.getMonthDays(month), firstDay = math.dayOfWeek(month, 1);
    const container = $('#calendar-container');
    let hoursOptions = '<option value="">Hrs</option>';
    for (let h = 0; h <= 24; h += 0.5) hoursOptions += `<option value="${h}">${h}</option>`;
    const shiftOptions = ['', '8', '12', '0', 'A', 'B', 'C', 'Day', 'Night', 'OT'].map(value => `<option value="${value}">${value ? math.SHIFTS[value] : 'Shift'}</option>`).join('');

    $('#view-cards-btn')?.classList.toggle('active', state.calendarView === 'cards');
    $('#view-table-btn')?.classList.toggle('active', state.calendarView === 'table');

    if (state.calendarView === 'cards') {
      container.className = 'calendar-wrapper cards-mode';
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let cardsHtml = '<div class="calendar-cards-wrapper">';
      for (let day = 1; day <= count; day++) {
        const weekday = math.dayOfWeek(month, day), weekend = weekday === 0 || weekday === 6;
        const weekdayName = weekdayNames[weekday];
        cardsHtml += `
          <div class="work-card ${weekend ? 'is-weekend' : ''}" id="card-day-${day}" data-day="${day}">
            <div class="work-card-header">
              <div class="work-card-date">
                <span>${day} ${weekdayName}</span>
                <span class="work-card-badge ${weekend ? 'badge-weekend' : 'badge-weekday'}">${weekend ? 'Weekend' : 'Weekday'}</span>
              </div>
              <span class="daily-hours-chip" id="hours-chip-${day}">0 hrs</span>
            </div>
            <div class="quick-shifts-row" role="group" aria-label="Quick shift presets for day ${day}">
              <button type="button" class="quick-pill pill-off" data-day="${day}" data-hours="0" data-shift="0">Off (0h)</button>
              <button type="button" class="quick-pill" data-day="${day}" data-hours="8" data-shift="8">8h Day</button>
              <button type="button" class="quick-pill" data-day="${day}" data-hours="12" data-shift="Day">12h Day</button>
              <button type="button" class="quick-pill" data-day="${day}" data-hours="12" data-shift="Night">12h Night</button>
            </div>
            <div class="card-inputs-row">
              <div>
                <label for="hours-${day}">Hours Worked</label>
                <select id="hours-${day}" class="hours-select" data-day="${day}">
                  ${hoursOptions}
                </select>
              </div>
              <div>
                <label for="shift-${day}">Shift Type</label>
                <select id="shift-${day}" class="shift-select" data-day="${day}">
                  ${shiftOptions}
                </select>
              </div>
            </div>
          </div>`;
      }
      cardsHtml += '</div>';
      container.innerHTML = cardsHtml;
    } else {
      container.className = 'calendar-wrapper';
      let html = `<table class="calendar-table"><caption class="sr-only">Daily work log for ${monthLabel(month)}</caption><thead><tr>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<th scope="col">${day}</th>`).join('')}</tr></thead><tbody><tr>`;
      for (let i = 0; i < firstDay; i++) html += '<td class="empty-day" aria-hidden="true"></td>';
      for (let day = 1; day <= count; day++) {
        const weekday = math.dayOfWeek(month, day), weekend = weekday === 0 || weekday === 6;
        html += `<td class="${weekend ? 'weekend' : ''}"><div class="calendar-day"><div class="day-number"><span>${day}</span>${weekend ? '<span class="weekend-label">Weekend</span>' : ''}</div><div class="day-inputs"><label class="sr-only" for="hours-${day}">Hours for day ${day}</label><select id="hours-${day}" class="hours-select" data-day="${day}">${hoursOptions}</select><label class="sr-only" for="shift-${day}">Shift for day ${day}</label><select id="shift-${day}" class="shift-select" data-day="${day}">${shiftOptions}</select></div></div></td>`;
        if ((firstDay + day) % 7 === 0 && day < count) html += '</tr><tr>';
      }
      for (let i = 0; i < (7 - (firstDay + count) % 7) % 7; i++) html += '<td class="empty-day" aria-hidden="true"></td>';
      container.innerHTML = html + '</tr></tbody></table>';
    }
  }
  function loadMonth(month) {
    if (!math.isMonthKey(month)) {
      $('#month-year-picker').value = state.month;
      showToast('Choose a valid month and year.');
      return;
    }
    if (state.month) state.drafts.set(state.month, collectMonthData());
    state.month = month;
    let data = state.drafts.get(month);
    if (!data) {
      try {
        const stored = localStorage.getItem(math.storageKey(month));
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && parsed.version === 1 && parsed.month === month) {
            data = math.normalizeMonthData(month, parsed);
            state.saved.add(month);
          }
        }
      } catch {
        showToast('Saved hours could not be loaded. You can still calculate and export a report.');
      }
    }

    // If no data or empty hours, check calendarData_${month}
    if (!data || !data.hours || Object.keys(data.hours).length === 0) {
      try {
        const calStored = localStorage.getItem(`calendarData_${month}`);
        if (calStored) {
          const calParsed = JSON.parse(calStored);
          if (calParsed && calParsed.hours && Object.keys(calParsed.hours).length > 0) {
            data = math.normalizeMonthData(month, {
              hours: calParsed.hours,
              shifts: calParsed.shifts || {},
              employeeName: calParsed.employeeName || '',
              companyName: calParsed.companyName || ''
            });
            state.saved.add(month);
          }
        }
      } catch (e) {}
    }

    // Populate active employee / company fallback if empty
    const activeEmp = localStorage.getItem('shader7_active_employee') || '';
    const activeComp = localStorage.getItem('shader7_active_company') || '';
    const fallbackEmp = activeEmp || $('#employee-name-input').value.trim();
    const fallbackComp = activeComp || $('#company-name').value.trim();
    updateToolSwitcherUrls(month);
    data ||= math.normalizeMonthData(month, { employeeName: fallbackEmp, companyName: fallbackComp });
    generateCalendar(month);
    for (const [day, value] of Object.entries(data.hours)) $(`#hours-${day}`).value = value;
    for (const [day, value] of Object.entries(data.shifts)) $(`#shift-${day}`).value = value;
    const effectiveEmp = data.employeeName || fallbackEmp;
    const effectiveComp = data.companyName || fallbackComp;
    data.employeeName = effectiveEmp;
    data.companyName = effectiveComp;
    $('#employee-name-input').value = effectiveEmp;
    $('#company-name').value = effectiveComp;
    $('#current-period').textContent = monthLabel(month);
    state.drafts.set(month, data);
    updateEmployeeInfo();
    recalculateHours();
    updateAllCards();
    updateSaveStatus();
  }
  function saveMonthData() {
    try {
      const data = collectMonthData();
      localStorage.setItem(math.storageKey(state.month), JSON.stringify(data));
      syncSharedMonthData(state.month, data);
      updateToolSwitcherUrls(state.month);
      state.drafts.set(state.month, data);
      state.saved.add(state.month);
      state.dirty.delete(state.month);
      updateSaveStatus();
      showToast(`Hours for ${monthLabel(state.month)} saved.`);
    } catch {
      showToast('Could not save. Browser storage may be unavailable or full. Your current hours are still available to export.');
    }
  }
  function clearAllHours() {
    $$('.hours-select, .shift-select').forEach(select => { select.value = ''; });
    $('#clear-dialog').close();
    markChanged();
    showToast('Hours cleared. Save this month to update its saved log.');
  }
  function generateReportHTML() {
    const data = collectMonthData(), totals = math.calculateHours(state.month, data);
    const employee = escapeHTML(data.employeeName || 'Not entered'), company = escapeHTML(data.companyName || 'Work Hours');
    const [year, month] = state.month.split('-').map(Number);
    const left = [], right = [], days = math.getMonthDays(state.month);
    for (let day = 1; day <= days; day++) {
      const date = new Date(year, month - 1, day);
      const weekday = math.dayOfWeek(state.month, day), weekend = weekday === 0 || weekday === 6;
      const raw = data.hours[day], shift = data.shifts[day];
      const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' });
      const row = `<tr${weekend ? ' style="background:#fff7f7;"' : ''}><td>${dateLabel}</td><td>${escapeHTML(shift ? math.SHIFTS[shift] : '—')}</td><td>${raw === '' ? '—' : `${formatNumber(raw)} h`}</td></tr>`;
      (day <= Math.ceil(days / 2) ? left : right).push(row);
    }
    const table = rows => `<table class="report-table"><thead><tr><th>Date</th><th>Shift</th><th>Hours</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
    return `<div class="report-watermark">${company}</div><div>
      <div class="report-company-name">${company}</div>
      <div class="report-header"><h2>Monthly Hours Report</h2><p>${monthLabel(state.month)} · Generated ${new Date().toLocaleDateString('en-GB')}</p></div>
      <div class="report-details"><div><p><strong>Employee:</strong> ${employee}</p><p><strong>Total hours:</strong> ${formatNumber(totals.totalHours)} h</p><p><strong>Weekdays:</strong> ${formatNumber(totals.weekdayHours)} h</p><p><strong>Weekends:</strong> ${formatNumber(totals.weekendHours)} h</p><p><strong>Average per working day:</strong> ${formatNumber(totals.averageHours, 2)} h</p></div>
      <div><p><strong>Days worked:</strong> ${totals.daysWorked}</p><p><strong>Days off:</strong> ${totals.daysOff} · <strong>Not entered:</strong> ${totals.daysUnlogged}</p><p><strong>Night shift:</strong> ${formatNumber(totals.nightHours)} h</p><p><strong>C shift:</strong> ${formatNumber(totals.cShiftHours)} h</p><p><strong>OT:</strong> ${formatNumber(totals.overtimeHours)} h</p></div></div>
      <p class="report-explanation">Shift subtotals are included in total hours. Every hour is counted once. A dash means hours have not been entered.</p>
      <div class="report-table-title">Daily Work Log</div><div class="report-table-container">${table(left)}${table(right)}</div>
      </div><div><div class="report-footer"><div><p><strong>Employee signature:</strong> __________________</p><p><strong>Date:</strong> __________________</p></div><div class="right"><p><strong>Approved by:</strong> __________________</p><p><strong>Date:</strong> __________________</p></div></div><div class="report-meta-note">SHADER7 · Hours Calculator · Based on the hours entered</div></div>`;
  }

    function getOptimalZoom() {
      const scrollArea = $('#report-scrollable-content');
      const availableWidth = Math.max(1, scrollArea.clientWidth - 24);
      const availableHeight = Math.max(1, scrollArea.clientHeight - 24);
      return Math.min(1, availableWidth / 794, availableHeight / 1123);
    }

    function setReportZoom(zoom, updateLayout = true) {
      state.currentZoom = Math.min(2.2, Math.max(0.28, zoom));
      const reportEl = $('#report-preview-content');
      if (reportEl) {
        reportEl.style.transform = `scale(${state.currentZoom})`;
        if (updateLayout) {
          const marginX = (794 * (state.currentZoom - 1)) / 2;
          const marginBottom = 1123 * (state.currentZoom - 1);
          reportEl.style.marginLeft = `${marginX}px`;
          reportEl.style.marginRight = `${marginX}px`;
          reportEl.style.marginBottom = `${Math.max(16, marginBottom + 16)}px`;
        }
      }
      $('#zoom-level').textContent = `${Math.round(state.currentZoom * 100)}%`;
    }

    function zoomReport(factor) {
      setReportZoom(state.currentZoom + factor, true);
    }

    function resetZoom() {
      setReportZoom(getOptimalZoom(), true);
    }

    async function downloadReport(format) {
      const reportElement = $('#report-preview-content');
      const pdfBtn = $('#modal-download-pdf-btn');
      const jpgBtn = $('#modal-download-jpg-btn');
      const targetBtn = format === 'pdf' ? pdfBtn : jpgBtn;
      const originalText = targetBtn.innerHTML;

      if (!window.html2canvas) return showToast('Report library is still loading. Try again in a moment.');
      targetBtn.disabled = true;
      targetBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating ${format.toUpperCase()}...`;

      const currentZoom = state.currentZoom;
      try {
        // Reset scale and margins for high-resolution capture
        reportElement.style.transform = 'scale(1)';
        reportElement.style.marginLeft = '0px';
        reportElement.style.marginRight = '0px';
        reportElement.style.marginBottom = '0px';

        const canvas = await html2canvas(reportElement, {
          scale: 2.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          windowHeight: 1123
        });

        const safeName = ($('#employee-name-input').value.trim() || 'Employee').replace(/[^a-z0-9_-]+/gi, '_');
        const safeCompany = ($('#company-name').value.trim() || 'Company').replace(/[^a-z0-9_-]+/gi, '_');
        const filePrefix = `Hours_Report_${safeName}_${safeCompany}_${getMonthKey()}`;

        if (format === 'pdf') {
          if (!window.jspdf?.jsPDF) return showToast('PDF library is still loading. Try again in a moment.');
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const margin = 4;
          const usableWidth = pdfWidth - margin * 2;
          const usableHeight = pdfHeight - margin * 2;
          const imgAspect = canvas.width / canvas.height;
          const pageAspect = usableWidth / usableHeight;
          let renderWidth, renderHeight;
          if (imgAspect > pageAspect) {
            renderWidth = usableWidth;
            renderHeight = usableWidth / imgAspect;
          } else {
            renderHeight = usableHeight;
            renderWidth = usableHeight * imgAspect;
          }
          const xOffset = margin + (usableWidth - renderWidth) / 2;
          const yOffset = margin + (usableHeight - renderHeight) / 2;
          pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');
          pdf.save(`${filePrefix}.pdf`);
        } else {
          const link = document.createElement('a');
          link.download = `${filePrefix}.jpg`;
          link.href = canvas.toDataURL('image/jpeg', 0.95);
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        showToast(`${format.toUpperCase()} downloaded successfully.`);
      } catch (error) {
        console.error(error);
        showToast('Could not generate report. Please try again.');
      } finally {
        setReportZoom(currentZoom, true);
        targetBtn.disabled = false;
        targetBtn.innerHTML = originalText;
      }
    }

    async function shareApp() {
      const shareData = { title: document.title, text: 'Calculate monthly work hours with this free hours calculator.', url: window.location.href };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (error) { if (error.name !== 'AbortError') showToast('Sharing failed.'); }
      } else {
        try { await navigator.clipboard.writeText(window.location.href); showToast('Link copied to clipboard.'); } catch { showToast(`Copy this link: ${window.location.href}`); }
      }
    }

    function setupTouchGestures() {
      const scrollArea = $('#report-scrollable-content');
      const reportEl = $('#report-preview-content');
      if (!scrollArea || !reportEl) return;

      let isPinching = false;
      let initialDistance = 0;
      let baseZoom = 1;
      let targetZoom = 1;
      let rafId = null;
      let lastTap = 0;

      scrollArea.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
          e.preventDefault();
          isPinching = true;
          reportEl.classList.add('is-pinching');
          initialDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          baseZoom = state.currentZoom;
          targetZoom = baseZoom;
        }
      }, { passive: false });

      scrollArea.addEventListener('touchmove', e => {
        if (isPinching && e.touches.length === 2 && initialDistance > 0) {
          e.preventDefault();
          const currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const ratio = currentDistance / initialDistance;
          targetZoom = Math.min(2.2, Math.max(0.28, baseZoom * ratio));

          if (!rafId) {
            rafId = requestAnimationFrame(() => {
              reportEl.style.transform = `scale(${targetZoom})`;
              $('#zoom-level').textContent = `${Math.round(targetZoom * 100)}%`;
              rafId = null;
            });
          }
        }
      }, { passive: false });

      const endPinch = () => {
        if (isPinching) {
          isPinching = false;
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          reportEl.classList.remove('is-pinching');
          setReportZoom(targetZoom, true);
        }
      };

      scrollArea.addEventListener('touchend', e => {
        if (e.touches.length < 2) {
          endPinch();
        }

        // Double tap handler
        if (e.touches.length === 0) {
          const now = Date.now();
          if (now - lastTap < 300) {
            const optimal = getOptimalZoom();
            if (Math.abs(state.currentZoom - optimal) < 0.08) setReportZoom(1.0, true);
            else setReportZoom(optimal, true);
          }
          lastTap = now;
        }
      });

      scrollArea.addEventListener('touchcancel', endPinch);
    }



  function showReportPreview() {
    $('#report-preview-content').innerHTML = generateReportHTML();
    state.lastFocus = document.activeElement;
    $('#report-preview-modal').classList.remove('hidden');
    $('.page-shell').inert = true;
    document.body.style.overflow = 'hidden';
    resetZoom();
    $('#report-scrollable-content').scrollTop = 0;
    $('#report-scrollable-content').scrollLeft = 0;
    $('#modal-close-btn').focus();
  }
  function hideReportPreview() {
    $('#report-preview-modal').classList.add('hidden');
    $('.page-shell').inert = false;
    document.body.style.overflow = '';
    state.lastFocus?.focus();
  }
  function bindEvents() {
    $('#month-year-picker').addEventListener('change', event => loadMonth(event.target.value));
    $('#employee-name-input').addEventListener('input', () => {
      const val = $('#employee-name-input').value.trim();
      if (val) localStorage.setItem('shader7_active_employee', val);
      else localStorage.removeItem('shader7_active_employee');
      markChanged();
    });
    $('#company-name').addEventListener('input', () => {
      const comp = $('#company-name').value.trim();
      if (comp) localStorage.setItem('shader7_active_company', comp);
      else localStorage.removeItem('shader7_active_company');
      markChanged();
    });
    $('#calendar-container').addEventListener('change', event => {
      const select = event.target;
      if (select.matches('.shift-select')) {
        const preset = math.defaultHoursForShift(select.value);
        if (preset !== null) $(`#hours-${select.dataset.day}`).value = preset;
      }
      if (select.matches('.hours-select,.shift-select')) {
        updateCardState(select.dataset.day);
        markChanged();
      }
    });

    $('#calendar-container').addEventListener('click', event => {
      const pill = event.target.closest('.quick-pill');
      if (pill) {
        handleQuickShift(pill);
      }
    });

    $('#view-cards-btn')?.addEventListener('click', () => setCalendarView('cards'));
    $('#view-table-btn')?.addEventListener('click', () => setCalendarView('table'));
    $('#save-month-btn').addEventListener('click', () => {
      clearTimeout(autoSaveTimer);
      saveMonthData();
    });
    $('#clear-hours-btn').addEventListener('click', () => $('#clear-dialog').showModal());
    $('#confirm-clear-btn').addEventListener('click', clearAllHours);

    // Dialog click outside dismiss
    const clearDialog = $('#clear-dialog');
    clearDialog?.addEventListener('click', event => {
      const rect = clearDialog.getBoundingClientRect();
      const inside = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
      if (!inside) clearDialog.close();
    });

    // Quick-fill buttons
    $$('.btn-quick-fill').forEach(btn => {
      btn.addEventListener('click', () => applyQuickFill(btn.dataset.action));
    });

    // Sticky floating summary bar
    const stickyBar = $('#sticky-summary-bar');
    $('#sticky-report-btn')?.addEventListener('click', () => $('#report-btn')?.click());
    const onScrollCheck = () => {
      if (!stickyBar) return;
      if (window.scrollY > 200 || (window.innerWidth <= 640 && window.scrollY > 80)) {
        stickyBar.classList.add('visible');
      } else {
        stickyBar.classList.remove('visible');
      }
    };
    window.addEventListener('scroll', onScrollCheck, { passive: true });
    window.addEventListener('resize', onScrollCheck, { passive: true });
    onScrollCheck();

    $('#report-btn').addEventListener('click', showReportPreview);
    $('#share-btn').addEventListener('click', shareApp);
    $('#modal-close-btn').addEventListener('click', hideReportPreview);
    $('#report-scrollable-content')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) hideReportPreview();
    });
    $('#zoom-out-btn').addEventListener('click', () => zoomReport(-0.1));
    $('#zoom-in-btn').addEventListener('click', () => zoomReport(0.1));
    $('#zoom-fit-btn').addEventListener('click', resetZoom);
    $('#modal-download-pdf-btn').addEventListener('click', () => downloadReport('pdf'));
    $('#modal-download-jpg-btn').addEventListener('click', () => downloadReport('jpg'));
    document.addEventListener('keydown', event => {
      if ($('#report-preview-modal').classList.contains('hidden')) return;
      if (event.key === 'Escape') hideReportPreview();
      else if (event.key === 'Tab') {
        const buttons = $$('#report-preview-modal button:not([disabled])'), first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomReport(0.1); }
      else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomReport(-0.1); }
      else if (event.key === '0') { event.preventDefault(); resetZoom(); }
    });
    window.addEventListener('resize', () => { if (!$('#report-preview-modal').classList.contains('hidden')) resetZoom(); });
    setupTouchGestures();
  }
  const now = new Date();
  $('#copyright-year').textContent = now.getFullYear();
  const urlParams = new URLSearchParams(window.location.search);
  const queryMonth = urlParams.get('month');
  const sharedMonth = localStorage.getItem('shader7_active_month');
  const activeEmp = localStorage.getItem('shader7_active_employee');
  const activeComp = localStorage.getItem('shader7_active_company');
  if (activeEmp && !$('#employee-name-input').value) $('#employee-name-input').value = activeEmp;
  if (activeComp && !$('#company-name').value) $('#company-name').value = activeComp;

  const picker = $('#month-year-picker');
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  picker.value = queryMonth || sharedMonth || fallbackMonth;

  bindEvents();
  updateToolSwitcherUrls(picker.value);

  window.addEventListener('storage', event => {
    if (event.key === 'shader7_active_employee') {
      const newName = event.newValue || '';
      if ($('#employee-name-input') && $('#employee-name-input').value !== newName) {
        $('#employee-name-input').value = newName;
        if (state && state.month && state.drafts) {
          const curDraft = state.drafts.get(state.month);
          if (curDraft) curDraft.employeeName = newName;
        }
        updateEmployeeInfo();
      }
    } else if (event.key === 'shader7_active_company') {
      const newComp = event.newValue || '';
      if ($('#company-name') && $('#company-name').value !== newComp) {
        $('#company-name').value = newComp;
        if (state && state.month && state.drafts) {
          const curDraft = state.drafts.get(state.month);
          if (curDraft) curDraft.companyName = newComp;
        }
        updateEmployeeInfo();
      }
    } else if (event.key && (event.key.startsWith('shader7_hours_v1_') || event.key.startsWith('calendarData_'))) {
      if (state.month && event.key.endsWith(state.month)) {
        state.drafts.delete(state.month);
        loadMonth(state.month);
      }
    }
  });

  $$('.tool-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      clearTimeout(autoSaveTimer);
      if (state.month) {
        const data = collectMonthData();
        localStorage.setItem(math.storageKey(state.month), JSON.stringify(data));
        syncSharedMonthData(state.month, data);
      }
    });
  });

  loadMonth(picker.value);
})();
