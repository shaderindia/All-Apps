(function () {
  'use strict';

  const Core = window.FairShareCore;
  const STORAGE_KEY = 'fairshareStateV2';
  const LEGACY_KEY = 'roommateSlipBillData';
  const MAX_PEOPLE = 30;
  const byId = id => document.getElementById(id);

  const elements = {
    addForm: byId('addPersonForm'),
    personName: byId('personName'),
    participantList: byId('participantList'),
    participantEmpty: byId('participantEmpty'),
    sampleBtn: byId('sampleBtn'),
    peopleCount: byId('peopleCount'),
    livePeople: byId('livePeople'),
    liveTotal: byId('liveTotal'),
    billTitle: byId('billTitle'),
    currency: byId('currencySelect'),
    calculateBtn: byId('calculateBtn'),
    results: byId('resultsSection'),
    resultsTitle: byId('resultsTitle'),
    resultsSubtitle: byId('resultsSubtitle'),
    resultTotal: byId('resultTotal'),
    resultAverage: byId('resultAverage'),
    resultTransfers: byId('resultTransfers'),
    paymentList: byId('paymentList'),
    noPayments: byId('noPayments'),
    balanceBody: byId('balanceBody'),
    copyBtn: byId('copySummaryBtn'),
    previewBtn: byId('previewBtn'),
    downloadImageBtn: byId('downloadImageBtn'),
    downloadBtn: byId('downloadPdfBtn'),
    previewPanel: byId('previewPanel'),
    previewCanvas: byId('previewCanvas'),
    closePreviewBtn: byId('closePreviewBtn'),
    resetBtn: byId('resetBtn'),
    messageDialog: byId('messageDialog'),
    messageText: byId('messageText'),
    loadingOverlay: byId('loadingOverlay'),
    loadingText: byId('loadingText'),
    reportContent: byId('reportContent')
  };

  let state = loadState();
  let settlement = null;

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `person-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultState() {
    return { version: 3, title: 'Group expenses', currency: 'RON', participants: [] };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.participants)) {
        return {
          version: 3,
          title: String(saved.title || 'Group expenses').slice(0, 80),
          currency: Number(saved.version) >= 3 ? Core.normalizeCurrency(saved.currency) : 'RON',
          participants: saved.participants.slice(0, MAX_PEOPLE).map((person, index) => ({
            id: String(person.id || createId()),
            name: Core.cleanName(person.name) || `Person ${index + 1}`,
            spent: numberOr(person.spent, 0),
            weight: numberOr(person.weight, 1)
          }))
        };
      }

      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (Array.isArray(legacy) && legacy.length) {
        const migrated = defaultState();
        migrated.participants = legacy.slice(0, MAX_PEOPLE)
          .filter(person => person && Core.cleanName(person.name))
          .map(person => ({
            id: String(person.id || createId()),
            name: Core.cleanName(person.name),
            spent: numberOr(person.spent, 0),
            weight: 1
          }));
        return migrated;
      }
    } catch (error) {
      console.warn('FairShare could not restore saved data.', error);
    }
    return defaultState();
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('FairShare could not save this bill.', error);
    }
  }

  function format(value) {
    return Core.formatMoney(value, state.currency);
  }

  function showMessage(message, title = 'Check your bill') {
    byId('messageTitle').textContent = title;
    elements.messageText.textContent = message;
    if (typeof elements.messageDialog.showModal === 'function') {
      if (elements.messageDialog.open) elements.messageDialog.close();
      elements.messageDialog.showModal();
    } else {
      window.alert(message);
    }
  }

  function setLoading(visible, message = 'Creating your report…') {
    elements.loadingText.textContent = message;
    elements.loadingOverlay.hidden = !visible;
  }

  function invalidateSettlement() {
    settlement = null;
    elements.results.hidden = true;
    elements.previewPanel.hidden = true;
    elements.reportContent.replaceChildren();
  }

  function initials(name) {
    return Core.cleanName(name).split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  }

  function labeledControl(labelText, input) {
    const wrap = document.createElement('div');
    wrap.className = 'participant-control';
    const label = document.createElement('label');
    label.className = 'mobile-label';
    label.htmlFor = input.id;
    label.textContent = labelText;
    wrap.append(label, input);
    return wrap;
  }

  function renderParticipants() {
    elements.participantList.replaceChildren();
    const hasPeople = state.participants.length > 0;
    elements.participantEmpty.hidden = hasPeople;

    state.participants.forEach((person, index) => {
      const row = document.createElement('div');
      row.className = 'participant-row';
      row.dataset.id = person.id;

      const nameWrap = document.createElement('div');
      nameWrap.className = 'participant-name';
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = initials(person.name);
      const name = document.createElement('input');
      name.type = 'text';
      name.id = `name-${person.id}`;
      name.value = person.name;
      name.maxLength = 60;
      name.setAttribute('aria-label', `Name for person ${index + 1}`);
      name.addEventListener('input', () => {
        person.name = name.value;
        avatar.textContent = initials(name.value);
        saveState();
        invalidateSettlement();
      });
      nameWrap.append(avatar, name);

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.id = `spent-${person.id}`;
      amount.min = '0';
      amount.max = '1000000000';
      amount.step = '0.01';
      amount.inputMode = 'decimal';
      amount.placeholder = '0.00';
      amount.value = person.spent ? String(person.spent) : '';
      amount.setAttribute('aria-label', `Amount paid by ${person.name}`);
      amount.addEventListener('input', () => {
        person.spent = amount.value === '' ? 0 : Number(amount.value);
        saveState();
        updateLiveSummary();
        invalidateSettlement();
      });
      const amountField = document.createElement('div');
      amountField.className = 'money-field';
      const currencyCode = document.createElement('span');
      currencyCode.className = 'currency-code';
      currencyCode.textContent = state.currency;
      amountField.append(currencyCode, amount);
      const amountControl = labeledControl('Amount paid', amountField);
      amountControl.querySelector('label').htmlFor = amount.id;

      const weight = document.createElement('input');
      weight.type = 'number';
      weight.id = `weight-${person.id}`;
      weight.min = '0.01';
      weight.max = '1000';
      weight.step = '0.1';
      weight.inputMode = 'decimal';
      weight.value = String(person.weight);
      weight.setAttribute('aria-label', `Share weight for ${person.name}`);
      weight.addEventListener('input', () => {
        person.weight = weight.value === '' ? '' : Number(weight.value);
        saveState();
        invalidateSettlement();
      });
      const weightControl = labeledControl('Share weight', weight);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-person';
      remove.setAttribute('aria-label', `Remove ${person.name}`);
      const removeIcon = document.createElement('i');
      removeIcon.className = 'fa-solid fa-trash-can';
      removeIcon.setAttribute('aria-hidden', 'true');
      remove.append(removeIcon);
      remove.addEventListener('click', () => {
        state.participants = state.participants.filter(candidate => candidate.id !== person.id);
        saveState();
        invalidateSettlement();
        renderParticipants();
        updateLiveSummary();
        elements.personName.focus();
      });

      row.append(nameWrap, amountControl, weightControl, remove);
      elements.participantList.append(row);
    });

    const label = `${state.participants.length} ${state.participants.length === 1 ? 'person' : 'people'}`;
    elements.peopleCount.textContent = label;
    elements.livePeople.textContent = label;
    elements.calculateBtn.disabled = state.participants.length < 2;
  }

  function updateCurrencyLabels() {
    document.querySelectorAll('.currency-code').forEach(label => { label.textContent = state.currency; });
  }

  function updateLiveSummary() {
    const total = state.participants.reduce((sum, person) => {
      const amount = Number(person.spent);
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    }, 0);
    elements.liveTotal.textContent = format(total);
    const label = `${state.participants.length} ${state.participants.length === 1 ? 'person' : 'people'}`;
    elements.livePeople.textContent = label;
  }

  function addPerson(nameValue) {
    const name = Core.cleanName(nameValue);
    if (!name) {
      showMessage('Enter a person’s name before adding them.');
      elements.personName.focus();
      return;
    }
    if (state.participants.length >= MAX_PEOPLE) {
      showMessage(`A bill can include up to ${MAX_PEOPLE} people.`);
      return;
    }
    if (state.participants.some(person => Core.cleanName(person.name).toLowerCase() === name.toLowerCase())) {
      showMessage(`${name} is already in this group.`);
      elements.personName.select();
      return;
    }
    state.participants.push({ id: createId(), name, spent: 0, weight: 1 });
    elements.personName.value = '';
    saveState();
    invalidateSettlement();
    renderParticipants();
    updateLiveSummary();
    elements.personName.focus();
  }

  function loadSample() {
    state.title = 'Weekend expenses';
    state.currency = 'RON';
    state.participants = [
      { id: createId(), name: 'Alex', spent: 0, weight: 1 },
      { id: createId(), name: 'Blair', spent: 120, weight: 1 },
      { id: createId(), name: 'Casey', spent: 60, weight: 1 }
    ];
    elements.billTitle.value = state.title;
    elements.currency.value = state.currency;
    saveState();
    invalidateSettlement();
    renderParticipants();
    updateLiveSummary();
  }

  function calculate() {
    state.title = Core.cleanName(elements.billTitle.value) || 'Group expenses';
    elements.billTitle.value = state.title;
    state.currency = Core.normalizeCurrency(elements.currency.value);
    try {
      settlement = Core.calculateSettlement(state.participants);
    } catch (error) {
      showMessage(error.message);
      return;
    }
    saveState();
    renderResults();
    elements.results.hidden = false;
    window.requestAnimationFrame(() => {
      elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      elements.resultsTitle.focus({ preventScroll: true });
    });
  }

  function appendTextCell(row, text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    row.append(cell);
  }

  function renderResults() {
    if (!settlement) return;
    elements.resultTotal.textContent = format(settlement.total);
    elements.resultAverage.textContent = format(settlement.average);
    elements.resultTransfers.textContent = String(settlement.payments.length);
    elements.resultsSubtitle.textContent = settlement.totalWeight === settlement.balances.length
      ? 'Equal shares, with every cent accounted for.'
      : `Weighted by ${settlement.totalWeight.toLocaleString()} total shares, with every cent accounted for.`;

    elements.paymentList.replaceChildren();
    elements.noPayments.hidden = settlement.payments.length !== 0;
    settlement.payments.forEach(payment => {
      const item = document.createElement('li');
      item.className = 'payment-item';

      const from = document.createElement('div');
      from.className = 'payment-person';
      const fromLabel = document.createElement('span');
      fromLabel.textContent = 'From';
      const fromName = document.createElement('strong');
      fromName.textContent = payment.from;
      from.append(fromLabel, fromName);

      const arrow = document.createElement('div');
      arrow.className = 'payment-arrow';
      const amount = document.createElement('strong');
      amount.textContent = format(payment.amount);
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-arrow-right';
      icon.setAttribute('aria-hidden', 'true');
      arrow.append(amount, icon);

      const to = document.createElement('div');
      to.className = 'payment-person to';
      const toLabel = document.createElement('span');
      toLabel.textContent = 'To';
      const toName = document.createElement('strong');
      toName.textContent = payment.to;
      to.append(toLabel, toName);

      item.append(from, arrow, to);
      elements.paymentList.append(item);
    });

    elements.balanceBody.replaceChildren();
    settlement.balances.forEach(person => {
      const row = document.createElement('tr');
      appendTextCell(row, person.name);
      appendTextCell(row, format(person.spent));
      appendTextCell(row, format(person.share));
      const className = person.balance > 0 ? 'balance-positive' : person.balance < 0 ? 'balance-negative' : 'balance-zero';
      const prefix = person.balance > 0 ? '+' : '';
      appendTextCell(row, `${prefix}${format(person.balance)}`, className);
      elements.balanceBody.append(row);
    });
  }

  function summaryText() {
    if (!settlement) return '';
    const lines = [
      `${state.title} — FairShare settlement`,
      `Total: ${format(settlement.total)}`,
      ''
    ];
    if (settlement.payments.length) {
      lines.push('Payments:');
      settlement.payments.forEach(payment => lines.push(`• ${payment.from} pays ${payment.to} ${format(payment.amount)}`));
    } else {
      lines.push('Everyone is already settled.');
    }
    lines.push('', 'Created with SHADER7 FairShare');
    return lines.join('\n');
  }

  async function copySummary() {
    if (!settlement) return;
    const text = summaryText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.append(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
    const original = elements.copyBtn.innerHTML;
    elements.copyBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Copied';
    window.setTimeout(() => { elements.copyBtn.innerHTML = original; }, 1600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function buildReport() {
    if (!settlement) throw new Error('Calculate the settlement before creating a report.');
    const payments = settlement.payments.length
      ? settlement.payments.map(payment => `<div class="report-payment"><span>${escapeHtml(payment.from)} pays ${escapeHtml(payment.to)}</span><strong>${escapeHtml(format(payment.amount))}</strong></div>`).join('')
      : '<div class="report-payment"><span>Everyone is already settled.</span><strong>Balanced</strong></div>';
    const rows = settlement.balances.map(person => `
      <tr>
        <td>${escapeHtml(person.name)}</td>
        <td>${escapeHtml(format(person.spent))}</td>
        <td>${escapeHtml(format(person.share))}</td>
        <td>${escapeHtml((person.balance > 0 ? '+' : '') + format(person.balance))}</td>
      </tr>`).join('');

    elements.reportContent.innerHTML = `
      <div class="report-brand"><span class="report-logo">SHADER7 · FAIRSHARE</span><span class="report-date">${escapeHtml(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}</span></div>
      <h1 class="report-title">${escapeHtml(state.title)}</h1>
      <p class="report-subtitle">Shared expense settlement · ${escapeHtml(state.currency)}</p>
      <div class="report-metrics">
        <div class="report-metric"><span>Total spent</span><strong>${escapeHtml(format(settlement.total))}</strong></div>
        <div class="report-metric"><span>People</span><strong>${settlement.balances.length}</strong></div>
        <div class="report-metric"><span>Payments</span><strong>${settlement.payments.length}</strong></div>
      </div>
      <section class="report-block"><h2>Payment plan</h2>${payments}</section>
      <section class="report-block">
        <h2>Individual breakdown</h2>
        <table class="report-table"><thead><tr><th>Person</th><th>Paid</th><th>Share</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
      <p class="report-footer">Calculated locally with SHADER7 FairShare. A positive balance means the person receives money; a negative balance means the person pays.</p>`;
  }

  async function createReportCanvas() {
    if (typeof window.html2canvas !== 'function') throw new Error('The report renderer is still loading. Please try again in a moment.');
    buildReport();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.html2canvas(elements.reportContent, {
      scale: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });
  }

  async function previewReport() {
    if (!settlement) return;
    setLoading(true, 'Rendering your preview…');
    try {
      const canvas = await createReportCanvas();
      elements.previewCanvas.width = canvas.width;
      elements.previewCanvas.height = canvas.height;
      const context = elements.previewCanvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(canvas, 0, 0);
      elements.previewPanel.hidden = false;
      elements.previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showMessage(error.message, 'Report unavailable');
    } finally {
      setLoading(false);
    }
  }

  function reportFileName(extension) {
    const safeName = state.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fairshare';
    return `${safeName}-settlement.${extension}`;
  }

  async function downloadImage() {
    if (!settlement) return;
    setLoading(true, 'Preparing your image…');
    try {
      const canvas = await createReportCanvas();
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(result => {
          if (result) resolve(result);
          else reject(new Error('The report image could not be created. Please try again.'));
        }, 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = reportFileName('png');
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showMessage(error.message, 'Image unavailable');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!settlement) return;
    setLoading(true, 'Building your PDF…');
    try {
      if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') throw new Error('The PDF library is still loading. Please try again in a moment.');
      const canvas = await createReportCanvas();
      const image = canvas.toDataURL('image/jpeg', .95);
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = canvas.height * pageWidth / canvas.width;
      let heightLeft = imageHeight;
      let position = 0;
      pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      pdf.save(reportFileName('pdf'));
    } catch (error) {
      showMessage(error.message, 'PDF unavailable');
    } finally {
      setLoading(false);
    }
  }

  function resetBill() {
    if (state.participants.length && !window.confirm('Start a new bill? This clears the saved people and amounts on this device.')) return;
    state = defaultState();
    settlement = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch (error) {
      console.warn('FairShare could not clear local data.', error);
    }
    elements.billTitle.value = state.title;
    elements.currency.value = state.currency;
    invalidateSettlement();
    renderParticipants();
    updateLiveSummary();
    elements.personName.focus();
    window.scrollTo({ top: elements.addForm.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  }

  elements.addForm.addEventListener('submit', event => {
    event.preventDefault();
    addPerson(elements.personName.value);
  });
  elements.sampleBtn.addEventListener('click', loadSample);
  elements.calculateBtn.addEventListener('click', calculate);
  elements.copyBtn.addEventListener('click', copySummary);
  elements.previewBtn.addEventListener('click', previewReport);
  elements.downloadImageBtn.addEventListener('click', downloadImage);
  elements.downloadBtn.addEventListener('click', downloadPdf);
  elements.closePreviewBtn.addEventListener('click', () => {
    elements.previewPanel.hidden = true;
    elements.previewBtn.focus();
  });
  elements.resetBtn.addEventListener('click', resetBill);
  elements.billTitle.addEventListener('input', () => {
    state.title = elements.billTitle.value;
    saveState();
    invalidateSettlement();
  });
  elements.currency.addEventListener('change', () => {
    state.currency = Core.normalizeCurrency(elements.currency.value);
    saveState();
    updateCurrencyLabels();
    updateLiveSummary();
    invalidateSettlement();
  });

  elements.billTitle.value = state.title;
  elements.currency.value = state.currency;
  saveState();
  renderParticipants();
  updateLiveSummary();
})();
