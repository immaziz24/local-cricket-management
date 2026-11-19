// Batch 10: playing-conditions helpers for umpire decisions (#115-#117, #124-#126)
import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_PRESETS, buildDecisionReport, timeWastingStatus, describeReport } from '../src/views/matches/decisionPresets.js';

const p = (k) => DECISION_PRESETS.find((x) => x.key === k);

test('every preset has a key, label and kind the database accepts', () => {
  const keys = new Set();
  for (const x of DECISION_PRESETS) {
    assert.ok(x.key && x.label);
    assert.ok(['decision', 'incident', 'disciplinary'].includes(x.kind));
    assert.ok(!keys.has(x.key)); keys.add(x.key);
    if (x.action) assert.ok(['none', 'warning', 'suspension', 'referred'].includes(x.action));
  }
});

test('building a report', () => {
  assert.deepEqual(buildDecisionReport(p('dead_ball'), {}).report, { kind: 'decision', title: 'Dead ball called', details: null, action: 'none' });
  assert.equal(buildDecisionReport(p('short_run'), { note: ' second run short ' }).report.details, 'second run short');
  assert.match(buildDecisionReport(p('time_wasting'), {}).error, /team/i);
  const tw = buildDecisionReport(p('time_wasting'), { teamId: 't1' }).report;
  assert.equal(tw.kind, 'incident'); assert.equal(tw.action, 'warning'); assert.equal(tw.team_id, 't1');
  assert.match(buildDecisionReport(p('other'), { customTitle: ' ' }).error, /title/);
  assert.equal(buildDecisionReport(p('other'), { customTitle: 'Ball changed' }).report.title, 'Ball changed');
  assert.match(buildDecisionReport(p('other'), { customTitle: 'x'.repeat(121) }).error, /120/);
  assert.match(buildDecisionReport(p('dead_ball'), { note: 'x'.repeat(2001) }).error, /2000/);
  assert.match(buildDecisionReport(null).error, /Choose/);
});

test('time-wasting escalation', () => {
  const r = (team) => ({ title: 'Time-wasting warning', team });
  assert.equal(timeWastingStatus([], 'A').count, 0);
  assert.match(timeWastingStatus([r('A')], 'A').next, /final/i);
  assert.equal(timeWastingStatus([r('A'), r('B')], 'A').count, 1);
  assert.match(timeWastingStatus([r('A'), r('A')], 'A').next, /5 penalty runs/);
  assert.equal(timeWastingStatus(null, 'A').count, 0);
});

test('describeReport', () => {
  assert.equal(describeReport({ title: 'Dead ball called', innings_no: 1, over: '4.2' }), 'Dead ball called (innings 1, over 4.2)');
  assert.equal(describeReport({ title: 'Time-wasting warning', team: 'Reds' }), 'Time-wasting warning – Reds');
});
