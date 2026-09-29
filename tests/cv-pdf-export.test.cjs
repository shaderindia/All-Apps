const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'cvbanao');

function editor(id, document = { addEventListener() {} }) {
  const html = fs.readFileSync(path.join(root, `template${id}`, 'index.html'), 'utf8');
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .find(script => script.includes('async function downloadPDF()'));
  assert.ok(source, `Template ${id} has an export script`);
  const context = vm.createContext({
    window: { addEventListener() {} },
    document,
    console: { error() {}, warn() {} },
    setTimeout() { return 1; },
    clearTimeout() {}
  });
  vm.runInContext(source, context, { filename: `template${id}/index.html` });
  return { context, run: code => vm.runInContext(code, context) };
}

for (const [id, formatter] of [
  [1, 'formatSkills'], [2, 'linesToBullets'], [3, 'formatSkillsList'],
  [4, 'formatSkillsTags'], [5, 'linesToList']
]) {
  test(`Template ${id} keeps ordinary leading letters while removing bullet markers`, () => {
    const { context, run } = editor(id);
    context.listInput = 'business\nultra\nlanguage\n- Welding\n• Fabrication\n&bull; Assembly';
    const result = String(run(`${formatter}(listInput)`));
    for (const word of ['business', 'ultra', 'language', 'Welding', 'Fabrication', 'Assembly']) {
      assert.ok(result.includes(word), `${word} survives formatting`);
    }
    assert.doesNotMatch(result, /[-•]|&bull;/);
  });
}

test('Template 5 displays every entered list item, education, job, and responsibility', () => {
  const { context, run } = editor(5);
  context.listInput = Array.from({ length: 7 }, (_, i) => `Skill ${i + 1}`).join('\n');
  assert.match(run('formatSimpleList(listInput)'), /Skill 7/);
  assert.match(run('formatLanguages(listInput)'), /Skill 7/);
  context.education = Array.from({ length: 4 }, (_, i) => ({ institute: `School ${i + 1}` }));
  assert.match(run('formatEducation(education)'), /School 4/);
  context.jobs = Array.from({ length: 4 }, (_, i) => ({
    company: `Company ${i + 1}`,
    responsibilities: 'Task 1\nTask 2\nTask 3\nTask 4'
  }));
  const jobs = run('formatExperience(jobs)');
  assert.match(jobs, /Company 4/);
  assert.match(jobs, /Task 4/);
});

function exportHarness(id) {
  const page = { style: { transform: 'scale(0.5)', boxShadow: 'shadow' } };
  const holder = { style: { width: '400px', height: '600px' } };
  const panel = { style: { display: '' } };
  const elements = { resumePreview: page, a4PreviewHolder: holder, previewPanel: panel };
  const document = {
    addEventListener() {},
    getElementById(key) { return elements[key]; },
    querySelector(selector) { return selector === '.preview-panel' ? panel : null; },
    fonts: { ready: Promise.resolve() }
  };
  const { context, run } = editor(id, document);
  const calls = { canvas: 0, pdf: 0, images: [], files: [], options: null, toasts: [] };
  context.window.getComputedStyle = () => ({ display: 'none' });
  context.window.html2canvas = context.html2canvas = async (element, options) => {
    calls.canvas += 1;
    calls.options = options;
    assert.equal(element, page);
    assert.equal(page.style.transform, 'none');
    assert.equal(holder.style.width, '210mm');
    assert.equal(panel.style.display, 'block');
    return { toDataURL: () => 'data:image/jpeg;base64,test' };
  };
  context.window.jspdf = { jsPDF: class {
    constructor(options) { calls.pdf += 1; calls.pdfOptions = options; }
    addImage(...args) { calls.images.push(args); }
    save(name) { calls.files.push(name); }
  } };
  context.exportName = 'Zoë 李';
  context.overflowState = false;
  run(`
    getFormData = () => ({
      fullName: exportName, designation: 'Engineer', email: 'test@example.com',
      phone: '123', address: 'City', summary: 'Summary', experience: 'Experience',
      education: 'Education', technicalSkills: 'Skills'
    });
    validateRequiredFields = () => true;
    isResumeOverflowing = () => overflowState;
    showToast = (message, type) => { exportToasts.push({ message, type }); };
    updatePreviewScale = () => {};
  `);
  context.exportToasts = calls.toasts;
  return { context, run, calls, page, holder, panel };
}

for (let id = 1; id <= 6; id += 1) {
  test(`Template ${id} exports one A4 PDF with a Unicode filename and restores the preview`, async () => {
    const { run, calls, page, holder, panel } = exportHarness(id);
    await run('downloadPDF()');
    assert.equal(calls.canvas, 1);
    assert.equal(calls.pdf, 1);
    assert.equal(calls.options.scale, 3);
    assert.equal(calls.pdfOptions.format, 'a4');
    assert.deepEqual(Array.from(calls.images[0]), ['data:image/jpeg;base64,test', 'JPEG', 0, 0, 210, 297]);
    assert.equal(calls.files[0], `Zoë_李${id === 5 ? '_CV' : id === 6 ? '_Europass_CV' : ''}.pdf`);
    assert.equal(page.style.transform, 'scale(0.5)');
    assert.equal(holder.style.width, '400px');
    assert.equal(holder.style.height, '600px');
    assert.equal(panel.style.display, '');
  });

  test(`Template ${id} rejects overflowing content before rasterizing`, async () => {
    const { context, run, calls, page, holder, panel } = exportHarness(id);
    context.overflowState = true;
    await run('downloadPDF()');
    assert.equal(calls.canvas, 0);
    assert.equal(calls.pdf, 0);
    assert.equal(calls.toasts.at(-1).type, 'error');
    assert.match(calls.toasts.at(-1).message, /A4 page/);
    assert.equal(page.style.transform, 'scale(0.5)');
    assert.equal(holder.style.width, '400px');
    assert.equal(panel.style.display, '');
  });
}
