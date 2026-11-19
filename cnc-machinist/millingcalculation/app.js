const form = document.getElementById('milling-form');
const error = document.getElementById('error');
const content = document.getElementById('result-content');
const warnings = document.getElementById('warnings');
const copy = document.getElementById('copy');
const material = document.getElementById('material');
const materialNote = document.getElementById('material-note');
const applyMaterial = document.getElementById('apply-material');
const vcInput = document.getElementById('vc');
const fzInput = document.getElementById('fz');
const share = document.getElementById('share');
const copyGcode = document.getElementById('copy-gcode');
const thinning = document.getElementById('thinning');
const thinningText = document.getElementById('thinning-text');
const powerMeter = document.getElementById('power-meter');
const applyThinning = document.getElementById('apply-thinning');
let pendingThinning = null;
const initialValue = el => el.tagName === 'SELECT' ? ([...el.options].find(option => option.defaultSelected) || el.options[0]).value : el.defaultValue;
const defaults = Object.fromEntries([...form.elements].filter(el => el.name).map(el => [el.name, initialValue(el)]));
const field = name => form.elements.namedItem(name);
let latest = null;
let lastApplied = null;
let thinningApplied = null;

function number(value, maximumFractionDigits = 1) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function duration(minutes) {
  const seconds = Math.round(minutes * 60);
  if (seconds < 1) return '<0:01';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function flash(button, text, original) {
  button.textContent = text;
  setTimeout(() => { button.textContent = original; }, 1800);
}

async function copyText(button, text, original) {
  try {
    await navigator.clipboard.writeText(text);
    flash(button, 'Copied', original);
  } catch {
    flash(button, 'Copy unavailable', original);
  }
}

function fieldNames() {
  return [...form.elements].filter(el => el.name).map(el => el.name);
}

function setupUrl() {
  const params = new URLSearchParams();
  for (const name of fieldNames()) {
    const value = field(name).value;
    if (value !== '' && value !== defaults[name]) params.set(name, value);
  }
  const query = params.toString();
  return `${location.origin}${location.pathname}${query ? `?${query}` : ''}`;
}

function saveToUrl() {
  try { history.replaceState(null, '', setupUrl()); } catch { /* file:// or sandboxed preview */ }
}

function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  let loaded = false;
  for (const name of fieldNames()) {
    if (!params.has(name)) continue;
    const input = field(name);
    const value = params.get(name).slice(0, 32);
    if (input.tagName === 'SELECT' && ![...input.options].some(option => option.value === value)) continue;
    input.value = value;
    loaded = true;
  }
  if (loaded && (field('kc').value || field('availablePower').value)) form.querySelector('details').open = true;
  const reference = recommendation();
  if (reference && !reference.error && Number(vcInput.value) === reference.vc && Number(fzInput.value) === reference.fz) {
    lastApplied = { vc: vcInput.value, fz: fzInput.value };
  }
}

function recommendation() {
  return MillingCore.suggestMaterial(material.value, field('diameter').value, field('ae').value);
}

function showMaterial() {
  const reference = recommendation();
  applyMaterial.hidden = !reference || !!reference.error;
  if (!reference) {
    materialNote.textContent = material.value === 'custom'
      ? 'Manual cutting data selected. The loaded numbers are a calculation example.'
      : 'No verified short-tool baseline for this selection. Enter cutting speed and feed per tooth from your tool supplier.';
  } else if (reference.error) {
    materialNote.textContent = reference.error;
  } else {
    const context = `${Math.round(reference.referenceAe * 100)}% radial width and ap = ${reference.referenceAp} × D`;
    const applied = lastApplied && vcInput.value === lastApplied.vc && fzInput.value === lastApplied.fz;
    materialNote.textContent = `${reference.material} (${reference.group}): reference Vc ${reference.vc} m/min, fz ${reference.fz} mm/tooth. Short CoroMill Dura carbide end mill, ${context}. ${applied ? 'Reference values applied.' : 'Current cutting values are manual; use Apply to load this reference.'} ${reference.note || ''}`;
  }
}

function applyRecommendation() {
  const reference = recommendation();
  if (!reference || reference.error) return;
  vcInput.value = String(reference.vc);
  fzInput.value = String(reference.fz);
  lastApplied = { vc: vcInput.value, fz: fzInput.value };
  thinningApplied = null;
  showMaterial();
  update();
}

function update() {
  const input = Object.fromEntries(new FormData(form).entries());
  const result = MillingCore.calculate(input);
  latest = result.error ? null : result;
  error.hidden = !result.error;
  error.textContent = result.error || '';
  content.hidden = !!result.error;
  copy.disabled = !!result.error;
  share.disabled = !!result.error;
  copyGcode.disabled = !!result.error;
  warnings.replaceChildren();
  saveToUrl();
  if (result.error) {
    thinning.hidden = true;
    powerMeter.hidden = true;
    return;
  }

  const outputs = {
    rpm: number(result.rpm, 0), feed: number(result.feed, 1),
    requestedRpm: number(result.requestedRpm, 0), requestedFeed: number(result.requestedFeed, 0),
    actualVc: number(result.actualVc, 1), actualFz: number(result.actualFz, 4),
    mrr: number(result.mrr, 2), time: duration(result.minutes),
    engagement: number(result.engagement * 100, 1),
    angle: number(result.engagementAngle, 0),
    hex: number(result.hex, 4),
    power: result.power === null ? '—' : number(result.power, 2),
    torque: result.torque === null ? '—' : number(result.torque, 1),
    feedIpm: number(result.feed / 25.4, 1),
    actualSfm: number(result.actualVc * 3.28084, 0),
    gcode: MillingCore.gcode(result)
  };
  for (const [id, value] of Object.entries(outputs)) document.getElementById(id).textContent = value;
  const checks = result.warnings.length ? result.warnings : ['Entered machine limits do not cap this setup.'];
  for (const message of checks) {
    const item = document.createElement('li');
    item.textContent = message;
    warnings.append(item);
  }
  warnings.classList.toggle('all-clear', !result.warnings.length);

  const factor = MillingCore.chipThinningFactor(Number(field('diameter').value), Number(field('ae').value));
  const compensated = thinningApplied && fzInput.value === thinningApplied.fz;
  if (thinningApplied && !compensated) thinningApplied = null;
  const target = compensated ? thinningApplied.target : Number(fzInput.value);
  const suggested = Number((target / factor).toFixed(4));
  const upToDate = Math.abs(suggested - Number(fzInput.value)) < 0.00005;
  thinning.hidden = factor >= 1 && !compensated;
  applyThinning.hidden = upToDate;
  applyThinning.textContent = compensated ? 'Update compensated fz' : 'Use compensated fz';
  pendingThinning = { fz: suggested, target };
  if (factor >= 1 && compensated) {
    thinningText.textContent = `Radial width is now 50% of D or more, so chip thinning no longer applies. Consider returning fz to ${target} mm/tooth.`;
    applyThinning.hidden = false;
    applyThinning.textContent = `Restore fz ${target}`;
    pendingThinning = { fz: target, target: null };
  } else if (upToDate) {
    thinningText.textContent = `fz is compensated for chip thinning: the maximum chip is about ${target} mm at ${number(result.engagement * 100, 1)}% engagement.`;
  } else {
    thinningText.textContent = `Chip thinning at ${number(result.engagement * 100, 1)}% engagement: fz ≈ ${number(suggested, 4)} mm/tooth gives a maximum chip of ${target} mm.`;
  }

  powerMeter.hidden = result.powerUse === null;
  if (result.powerUse !== null) {
    const percent = result.powerUse * 100;
    document.getElementById('power-use').textContent = `${number(percent, 0)}%`;
    document.getElementById('power-fill').style.width = `${Math.min(percent, 100)}%`;
    document.getElementById('power-track').setAttribute('aria-valuenow', String(Math.round(Math.min(percent, 100))));
    powerMeter.classList.toggle('high', percent > 80 && percent <= 100);
    powerMeter.classList.toggle('over', percent > 100);
  }
}

form.addEventListener('input', event => {
  if (event.target === material) return;
  if (event.target === vcInput || event.target === fzInput) lastApplied = null;
  if (event.target === fzInput) thinningApplied = null;
  if ((event.target.name === 'diameter' || event.target.name === 'ae') && lastApplied && vcInput.value === lastApplied.vc && fzInput.value === lastApplied.fz) {
    const reference = recommendation();
    if (reference && !reference.error) {
      vcInput.value = String(reference.vc);
      fzInput.value = String(reference.fz);
      lastApplied = { vc: vcInput.value, fz: fzInput.value };
    } else if (reference && reference.error) {
      vcInput.value = '';
      fzInput.value = '';
      lastApplied = null;
    }
  }
  showMaterial();
  update();
});
material.addEventListener('change', () => {
  lastApplied = null;
  const reference = recommendation();
  if (reference && !reference.error) applyRecommendation();
  else {
    if (material.value !== 'custom') { vcInput.value = ''; fzInput.value = ''; }
    showMaterial(); update();
  }
});
applyMaterial.addEventListener('click', applyRecommendation);
form.addEventListener('submit', event => event.preventDefault());
document.getElementById('reset').addEventListener('click', () => {
  for (const [name, value] of Object.entries(defaults)) form.querySelector(`[name="${name}"]`).value = value;
  lastApplied = null;
  thinningApplied = null;
  showMaterial();
  update();
});
copy.addEventListener('click', () => {
  if (!latest) return;
  const selected = MillingCore.MATERIALS[material.value];
  const materialName = selected ? selected.label : material.selectedOptions[0].textContent;
  const basis = selected && lastApplied ? 'Sandvik CoroMill Dura short-tool chart; confirm actual tool and conditions' : 'User-entered cutting data; confirm tool supplier values';
  const f = Object.fromEntries(fieldNames().map(name => [name, field(name)]));
  const lines = [
    'Milling setup',
    `Workpiece: ${materialName}`,
    `Cutting-data basis: ${basis}`,
    `Tool: Ø${f.diameter.value} mm, ${f.teeth.value} effective teeth`,
    `Pass: ap ${f.ap.value} mm × ae ${f.ae.value} mm, ${f.length.value} mm × ${f.passes.value} pass(es)`,
    `Cutting data: ${vcInput.value} m/min Vc, ${fzInput.value} mm/tooth fz`,
    `Spindle: ${number(latest.rpm, 0)} RPM`,
    `Cutting feed: ${number(latest.feed, 1)} mm/min (${number(latest.feed / 25.4, 1)} in/min)`,
    `Actual Vc: ${number(latest.actualVc, 1)} m/min (${number(latest.actualVc * 3.28084, 0)} SFM)`,
    `Actual fz: ${number(latest.actualFz, 4)} mm/tooth; max chip thickness ${number(latest.hex, 4)} mm`,
    `MRR: ${number(latest.mrr, 2)} cm³/min`,
    `Total in-cut time: ${duration(latest.minutes)}`,
    `Estimated cutting power: ${latest.power === null ? 'not calculated' : `${number(latest.power, 2)} kW, ${number(latest.torque, 1)} N·m`}`,
    `G-code: ${MillingCore.gcode(latest).replace('\n', ' / ')}`,
    `Checks: ${latest.warnings.join(' ') || 'No machine-limit warnings.'}`,
    `Link: ${setupUrl()}`
  ];
  copyText(copy, lines.join('\n'), 'Copy setup');
});
copyGcode.addEventListener('click', () => { if (latest) copyText(copyGcode, MillingCore.gcode(latest), 'Copy G-code'); });
share.addEventListener('click', () => { if (latest) copyText(share, setupUrl(), 'Copy link'); });
applyThinning.addEventListener('click', () => {
  if (!latest || !pendingThinning) return;
  fzInput.value = String(pendingThinning.fz);
  thinningApplied = pendingThinning.target === null ? null : { fz: fzInput.value, target: pendingThinning.target };
  lastApplied = null;
  showMaterial();
  update();
});
loadFromUrl();
showMaterial();
update();
