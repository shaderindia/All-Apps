const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'cvbanao');

function createEditor(id, { sample = false, storageThrows = false, initialData } = {}) {
  const html = fs.readFileSync(path.join(root, `template${id}`, 'index.html'), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .find(source => source.includes('function saveResume('));
  assert.ok(script, `Template ${id} editor script exists`);

  const entries = new Map(initialData === undefined ? [] : [['saved', initialData]]);
  const calls = { reads: 0, writes: 0, removes: 0 };
  const timers = new Map();
  let nextTimer = 0;
  const context = vm.createContext({
    window: {
      CV_SAMPLE_MODE: sample,
      addEventListener() {}
    },
    document: { addEventListener() {} },
    localStorage: {
      getItem() { calls.reads += 1; if (storageThrows) throw Error('Storage unavailable'); return entries.get('saved') ?? null; },
      setItem(key, value) { calls.writes += 1; if (storageThrows) throw Error('Storage unavailable'); entries.set('saved', value); },
      removeItem() { calls.removes += 1; if (storageThrows) throw Error('Storage unavailable'); entries.delete('saved'); }
    },
    setTimeout(callback, delay) { const timer = ++nextTimer; timers.set(timer, { callback, delay }); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    confirm() { return true; },
    console: { error() {}, warn() {} }
  });

  vm.runInContext(script, context, { filename: `template${id}/index.html` });
  vm.runInContext(`
    getFormData = function() { return { fullName: testName }; };
    showToast = function(message, type) { lastToast = { message, type }; };
  `, context);
  context.testName = 'First';
  return { context, entries, calls, timers, run: code => vm.runInContext(code, context) };
}

for (let id = 1; id <= 6; id += 1) {
  test(`Template ${id} sample preview never reads or changes a saved resume`, () => {
    const editor = createEditor(id, { sample: true, initialData: 'private resume' });
    editor.run('safeGetStorage(STORAGE_KEY)');
    editor.run('saveResume(true)');
    editor.run(id <= 4 ? 'autoSaveResume()' : 'scheduleAutoSave()');
    editor.run('loadResume(true)');
    editor.run('clearSavedData()');
    assert.equal(editor.entries.get('saved'), 'private resume');
    assert.deepEqual(editor.calls, { reads: 0, writes: 0, removes: 0 });
    assert.equal(editor.timers.size, 0);
  });

  test(`Template ${id} remains usable when browser storage fails`, () => {
    const editor = createEditor(id, { storageThrows: true });
    assert.equal(editor.run('safeGetStorage(STORAGE_KEY)'), null);
    assert.equal(editor.run('safeSetStorage(STORAGE_KEY, "x")'), false);
    assert.equal(editor.run('safeRemoveStorage(STORAGE_KEY)'), false);
    editor.run('saveResume(true)');
    assert.equal(editor.run('lastToast.type'), 'error');
  });

  test(`Template ${id} debounces edits and cancels pending saves on clear`, () => {
    const editor = createEditor(id);
    const schedule = id <= 4 ? 'autoSaveResume()' : 'scheduleAutoSave()';
    editor.run(schedule);
    editor.context.testName = 'Latest';
    editor.run(schedule);
    assert.equal(editor.calls.writes, 0);
    assert.equal(editor.timers.size, 1);
    const [{ delay }] = editor.timers.values();
    assert.equal(delay, 350);
    editor.run('flushAutoSave()');
    assert.equal(JSON.parse(editor.entries.get('saved')).fullName, 'Latest');
    assert.equal(editor.timers.size, 0);

    editor.run(schedule);
    editor.run('saveResume(true)');
    assert.equal(editor.timers.size, 0);
    assert.equal(editor.calls.writes, 2);

    editor.run(schedule);
    editor.run('clearSavedData()');
    assert.equal(editor.timers.size, 0);
    assert.equal(editor.entries.has('saved'), false);
    assert.equal(editor.calls.removes, 1);
  });
}

for (let id = 1; id <= 6; id += 1) {
  test(`Template ${id} opens demo data if saved JSON is damaged`, () => {
    const editor = createEditor(id, { initialData: '{invalid' });
    editor.run(`
      demoLoaded = false;
      fillDemoData = function() { demoLoaded = true; };
      ${id <= 4 ? `updateThemeColor = function() {}; ${id === 2 ? 'addLanguage' : 'addLanguageField'} = function() {};` : ''}
      setupInitialData();
    `);
    assert.equal(editor.run('demoLoaded'), true);
  });
}
