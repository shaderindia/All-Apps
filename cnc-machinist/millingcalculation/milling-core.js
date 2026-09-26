(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MillingCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Sandvik Coromant CoroMill Dura 1–2 × D cutting-data chart (short solid-carbide end mills).
  // The 100% and 50% radial-engagement columns use different axial-depth assumptions.
  const MATERIALS = Object.freeze({
    unalloyed_steel: { label: 'Unalloyed steel (~190 HB)', group: 'ISO P', slot: [145, 'F01'], side: [175, 'F04'] },
    low_alloy_steel: { label: 'Low-alloy steel (~240 HB)', group: 'ISO P', slot: [110, 'F01'], side: [135, 'F04'] },
    high_alloy_steel: { label: 'High-alloy steel (~380 HB)', group: 'ISO P', slot: [80, 'F02'], side: [100, 'F05'] },
    stainless_austenitic: { label: 'Austenitic stainless (~200 HB)', group: 'ISO M', slot: [70, 'F01'], side: [80, 'F04'] },
    grey_cast_iron: { label: 'Grey cast iron (~180 HB)', group: 'ISO K', slot: [150, 'F01'], side: [180, 'F04'] },
    aluminum_wrought: { label: 'Aluminium alloy, long-chip (~100 HB)', group: 'ISO N', slot: [680, 'F03'], side: [835, 'F03'] },
    nickel_superalloy: { label: 'Nickel superalloy (~320 HB)', group: 'ISO S', slot: [40, 'F02'], side: [50, 'F05'] }
  });
  const DIAMETERS = [2, 3, 4, 6, 8, 10, 12, 16, 20, 25];
  const FEEDS = {
    F01: [0.012, 0.016, 0.021, 0.029, 0.037, 0.046, 0.054, 0.071, 0.087, 0.108],
    F02: [0.011, 0.015, 0.018, 0.025, 0.032, 0.038, 0.045, 0.058, 0.072, 0.089],
    F03: [0.027, 0.033, 0.040, 0.053, 0.066, 0.079, 0.092, 0.118, 0.145, 0.177],
    F04: [0.025, 0.029, 0.034, 0.044, 0.053, 0.062, 0.072, 0.091, 0.110, 0.133],
    F05: [0.023, 0.027, 0.030, 0.037, 0.044, 0.051, 0.058, 0.072, 0.086, 0.104]
  };

  function suggestMaterial(material, diameter, ae) {
    const profile = MATERIALS[material];
    if (!profile) return null;
    const d = Number(diameter);
    const width = Number(ae);
    if (!Number.isFinite(d) || d < DIAMETERS[0] || d > DIAMETERS.at(-1) || !Number.isFinite(width) || width <= 0 || width > d) {
      return { error: 'Reference data applies only to 2–25 mm cutters with radial width between 0 and the cutter diameter.' };
    }
    if (width / d < 0.3) {
      return { error: 'Below 30% radial engagement, use tool-specific chip-thinning data instead of this simplified material baseline.' };
    }
    const slot = width / d > 0.5;
    const [vc, code] = slot ? profile.slot : profile.side;
    const points = FEEDS[code];
    let index = DIAMETERS.findIndex(value => value >= d);
    let fz = points[index];
    if (index > 0 && DIAMETERS[index] !== d) {
      const fraction = (d - DIAMETERS[index - 1]) / (DIAMETERS[index] - DIAMETERS[index - 1]);
      fz = points[index - 1] + fraction * (points[index] - points[index - 1]);
    }
    return {
      material: profile.label, group: profile.group, vc,
      fz: Number(fz.toFixed(4)),
      referenceAe: slot ? 1 : 0.5,
      referenceAp: slot ? 0.5 : 1,
      note: Math.abs(width / d - (slot ? 1 : 0.5)) > 0.05
        ? 'Actual radial width differs from this chart point; treat these values as a starting estimate.'
        : null
    };
  }

  function calculate(raw) {
    const values = {};
    const required = ['vc', 'fz', 'diameter', 'teeth', 'ap', 'ae', 'maxRpm', 'maxToolRpm', 'maxFeed', 'length', 'passes'];
    const labels = { vc: 'Cutting speed', fz: 'Feed per tooth', diameter: 'Cutter diameter', teeth: 'Effective teeth', ap: 'Axial depth', ae: 'Radial width', maxRpm: 'Machine maximum RPM', maxToolRpm: 'Tool maximum RPM', maxFeed: 'Maximum cutting feed', length: 'Cutting path length', passes: 'Pass count' };
    for (const key of required) {
      const value = Number(raw[key]);
      if (raw[key] === '' || !Number.isFinite(value) || value <= 0) {
        return { error: `${labels[key]} must be greater than zero.` };
      }
      values[key] = value;
    }
    if (!Number.isInteger(values.teeth) || values.teeth > 100) {
      return { error: 'Effective teeth must be a whole number from 1 to 100.' };
    }
    if (!Number.isInteger(values.passes) || values.passes > 10000) {
      return { error: 'Pass count must be a whole number from 1 to 10,000.' };
    }
    if (values.ae > values.diameter) {
      return { error: 'Radial engagement cannot exceed the cutter diameter.' };
    }
    const kc = raw.kc === '' || raw.kc == null ? null : Number(raw.kc);
    const availablePower = raw.availablePower === '' || raw.availablePower == null ? null : Number(raw.availablePower);
    if (kc !== null && (!Number.isFinite(kc) || kc <= 0)) return { error: 'Specific cutting force must be greater than zero.' };
    if (availablePower !== null && (!Number.isFinite(availablePower) || availablePower <= 0)) return { error: 'Available spindle power must be greater than zero.' };

    const requestedRpm = values.vc * 1000 / (Math.PI * values.diameter);
    const rpm = Math.floor(Math.min(requestedRpm, values.maxRpm, values.maxToolRpm));
    if (rpm < 1) return { error: 'The available RPM is below 1. Check speed, diameter and RPM limits.' };
    const requestedFeed = rpm * values.teeth * values.fz;
    const feed = Math.floor(Math.min(requestedFeed, values.maxFeed) * 10) / 10;
    if (feed < 0.1) return { error: 'The available cutting feed is below 0.1 mm/min. Check feed and machine limits.' };
    const actualVc = Math.PI * values.diameter * rpm / 1000;
    const actualFz = feed / (rpm * values.teeth);
    const mrr = values.ap * values.ae * feed / 1000;
    const minutes = values.length * values.passes / feed;
    const power = kc === null ? null : values.ap * values.ae * feed * kc / 60000000;
    if (![requestedRpm, requestedFeed, mrr, minutes, power === null ? 0 : power].every(Number.isFinite)) {
      return { error: 'The input values produce a result outside the calculator range.' };
    }
    const warnings = [];
    if (requestedRpm > Math.min(values.maxRpm, values.maxToolRpm)) warnings.push(`RPM capped by ${values.maxToolRpm <= values.maxRpm && values.maxToolRpm < requestedRpm ? 'tool rating' : 'machine'}. Actual cutting speed is lower than requested.`);
    if (requestedFeed > values.maxFeed) warnings.push('Feed capped by machine. Actual chip load is lower than requested; check for rubbing.');
    if (power !== null && availablePower !== null && power > availablePower) warnings.push('Estimated cutting power exceeds available spindle power. Reduce engagement or feed.');
    if (availablePower !== null && power === null) warnings.push('Enter specific cutting force to compare the pass with available spindle power.');
    if (values.ae / values.diameter < 0.5) warnings.push('Narrow radial engagement can reduce chip thickness. Review radial chip thinning for this cutter geometry.');
    const reference = suggestMaterial(raw.material, values.diameter, values.ae);
    if (reference && reference.error) warnings.push('Selected material baseline does not cover this diameter and radial engagement; use tool-specific cutting data.');
    else if (reference && values.ap > reference.referenceAp * values.diameter) warnings.push('Axial depth exceeds the selected material chart case. Confirm the tool maker permits this depth.');
    if (reference && !reference.error && reference.note) warnings.push(reference.note);
    return { requestedRpm, rpm, requestedFeed, feed, actualVc, actualFz, mrr, minutes, power, warnings, engagement: values.ae / values.diameter };
  }
  return { calculate, suggestMaterial, MATERIALS };
});
