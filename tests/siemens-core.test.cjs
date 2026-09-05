const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../cnc-machinist/siemens/siemens-core.js');

const base = {
  operation:'rough', turnType:'od', blank:80, target:40, length:60, infeed:2,
  allowX:.4, allowZ:.1, speedMode:'G96', speed:220, lims:3000,
  roughFeed:.25, plungeFeed:.175, finishFeed:.16, dwell:0, chipLength:0,
  liftOff:.5, profile:'straight', stepDia:60, stepLen:30, includeFacing:true
};

test('maps every longitudinal CYCLE95 mode to Siemens VARI values', () => {
  assert.equal(core.cycle95Variant('rough_only','od'), 1);
  assert.equal(core.cycle95Variant('rough_only','id'), 3);
  assert.equal(core.cycle95Variant('finish_only','od'), 5);
  assert.equal(core.cycle95Variant('finish_only','id'), 7);
  assert.equal(core.cycle95Variant('rough','od'), 9);
  assert.equal(core.cycle95Variant('rough','id'), 11);
});

test('builds complete, rough-only, and finish-only feed parameters', () => {
  assert.match(core.cycle95Call(base).line, /0\.250, 0\.175, 0\.160, 9,/);
  assert.match(core.cycle95Call(base,'START:END').line, /^CYCLE95\("START:END"/);
  assert.match(core.cycle95Call({...base,operation:'rough_only'}).line, /0\.250, 0\.175, 0\.000, 1,/);
  assert.match(core.cycle95Call({...base,operation:'finish_only'}).line, /0\.000, 0\.000, 0\.160, 5,/);
});

test('reports zero roughing passes for finishing and facing', () => {
  assert.equal(core.turningMetrics({...base,operation:'finish_only'}).roughPasses, 0);
  assert.equal(core.turningMetrics({...base,operation:'facing'}).roughPasses, 0);
  assert.equal(core.turningMetrics(base).roughPasses, 10);
  assert.equal(core.turningMetrics({...base,speedMode:'G97',speed:1000}).mrr, 94.2);
});

test('rejects invalid OD, ID, and stepped profiles', () => {
  assert.throws(()=>core.validateTurningInput({...base,target:80}), /OD turning/);
  assert.throws(()=>core.validateTurningInput({...base,turnType:'id',blank:30,target:20}), /ID turning/);
  assert.throws(()=>core.validateTurningInput({...base,profile:'step',stepDia:20}), /Step diameter/);
});

test('calculates turning speeds, feed, MRR, and finish', () => {
  assert.deepEqual(core.calculateSpeedFeed({diameter:60,cuttingSpeed:200,feed:.25,depth:2,radius:.8}), {
    rpm:1061, tableFeed:265, mrr:100, ra:2.44, rz:9.77
  });
  assert.throws(()=>core.calculateSpeedFeed({diameter:0,cuttingSpeed:200,feed:.25,depth:2,radius:.8}), /diameter/);
});

test('exports offsets using entered T numbers and rejects duplicates', () => {
  const tool={num:'T12 (ROUGH_OD)',edge:2,type:'Rougher',typeCode:500,l1:120,l2:80,rad:.8,dir:3,wx:.01,wz:0};
  const toa=core.buildTOAArchive([tool],'2026-09-05');
  assert.match(toa,/\$TC_DP1\[12,2\]=500/);
  assert.match(toa,/\$TC_DP12\[12,2\]=0\.010/);
  assert.throws(()=>core.buildTOAArchive([tool,tool]),/Duplicate T12 D2/);
  assert.throws(()=>core.parseToolNumber('ROUGH_OD'),/must start/);
});
