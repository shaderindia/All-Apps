const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../cnc-machinist/3DCADWEB/cad-core.js');

const base = {
  dialect: 'fanuc', unit: 'mm', macro: false, toolDiameter: 6, feed: 600,
  plunge: 150, rpm: 10000, safe: 5, retract: 2, allowance: 0,
  toolNumber: 1, offsetNumber: 1, programNumber: 1001, offsetZ: 20, partTop: 20
};

test('converts every NC coordinate and feed when inch output is selected', () => {
  assert.equal(core.outputNumber(25.4, 'in'), '1.0000');
  assert.equal(core.outputNumber(600, 'in'), '23.6220');
  assert.equal(core.unitCode('fanuc', 'in'), 'G20');
  assert.equal(core.unitCode('siemens', 'mm'), 'G71');
});

test('rejects unsafe and invalid CAM settings instead of silently clamping them', () => {
  assert.throws(() => core.validateCam({...base, feed: 0}), /Feed rate/);
  assert.throws(() => core.validateCam({...base, safe: 0}), /Safe Z/);
  assert.throws(() => core.validateCam({...base, dialect: 'siemens', macro: true}), /Fanuc\/Haas/);
  assert.throws(() => core.validateRetractPlane(2, 0, 20), /Retract plane/);
});

test('calculates height-field volume from cells without counting boundary vertices twice', () => {
  const flat = new Float32Array(12).fill(20);
  assert.equal(core.heightFieldVolume(flat, 4, 3, 10), 12000);
});

test('migrates version 1 projects and rejects unreasonable imports', () => {
  const migrated = core.validateProject({v:1,L:100,W:80,H:20,stockOpt:{},objects:[],masks:[],off:{x:50,y:40,z:20}});
  assert.equal(migrated.v, 2);
  assert.equal(migrated.unit, 'mm');
  assert.equal(migrated.wcs, 'G54');
  assert.equal(core.validateProject({...migrated,wcs:'G59'}).wcs, 'G59');
  assert.equal(core.validateProject({...migrated,wcs:'G53'}).wcs, 'G54');
  assert.throws(() => core.validateProject({...migrated,L:-1}), /Stock length/);
  assert.throws(() => core.validateProject({...migrated,objects:new Array(251)}), /too many/);
  assert.throws(() => core.validateProject({...migrated,objects:[{id:1,type:'sphere',mode:'add'}]}), /unsupported/);
});
