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
const defaults = Object.fromEntries([...form.elements].filter(el => el.name).map(el => [el.name, el.defaultValue]));
let latest = null;
let lastApplied = null;

function number(value, maximumFractionDigits = 1) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function duration(minutes) {
  const seconds = Math.round(minutes * 60);
  if (seconds < 1) return '<0:01';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function recommendation() {
  return MillingCore.suggestMaterial(material.value, form.elements.diameter.value, form.elements.ae.value);
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
  warnings.replaceChildren();
  if (result.error) return;

  const outputs = {
    rpm: number(result.rpm, 0), feed: number(result.feed, 1),
    requestedRpm: number(result.requestedRpm, 0), requestedFeed: number(result.requestedFeed, 0),
    actualVc: number(result.actualVc, 1), actualFz: number(result.actualFz, 4),
    mrr: number(result.mrr, 2), time: duration(result.minutes),
    engagement: number(result.engagement * 100, 1),
    power: result.power === null ? '—' : number(result.power, 2)
  };
  for (const [id, value] of Object.entries(outputs)) document.getElementById(id).textContent = value;
  const checks = result.warnings.length ? result.warnings : ['Entered machine limits do not cap this setup.'];
  for (const message of checks) {
    const item = document.createElement('li');
    item.textContent = message;
    warnings.append(item);
  }
  warnings.classList.toggle('all-clear', !result.warnings.length);
}

form.addEventListener('input', event => {
  if (event.target === material) return;
  if (event.target === vcInput || event.target === fzInput) lastApplied = null;
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
  showMaterial();
  update();
});
copy.addEventListener('click', async () => {
  if (!latest) return;
  const selected = MillingCore.MATERIALS[material.value];
  const materialName = selected ? selected.label : material.selectedOptions[0].textContent;
  const basis = selected && lastApplied ? 'Sandvik CoroMill Dura short-tool chart; confirm actual tool and conditions' : 'User-entered cutting data; confirm tool supplier values';
  const text = `Milling setup\nWorkpiece: ${materialName}\nCutting-data basis: ${basis}\nCutting data: ${vcInput.value} m/min Vc, ${fzInput.value} mm/tooth fz\nSpindle: ${number(latest.rpm, 0)} RPM\nCutting feed: ${number(latest.feed, 1)} mm/min\nActual Vc: ${number(latest.actualVc, 1)} m/min\nActual fz: ${number(latest.actualFz, 4)} mm/tooth\nMRR: ${number(latest.mrr, 2)} cm³/min\nTotal in-cut time: ${duration(latest.minutes)}\nEstimated cutting power: ${latest.power === null ? 'not calculated' : `${number(latest.power, 2)} kW`}\nChecks: ${latest.warnings.join(' ') || 'No machine-limit warnings.'}`;
  try {
    await navigator.clipboard.writeText(text);
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy setup'; }, 1800);
  } catch {
    copy.textContent = 'Copy unavailable';
    setTimeout(() => { copy.textContent = 'Copy setup'; }, 1800);
  }
});
showMaterial();
update();
