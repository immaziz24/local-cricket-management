// Batch 11: local rule overrides, bowler eligibility, ball-order check helpers
import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERRIDE_FIELDS, formatRuleValue, buildOverrideChanges, validateOverrideRequest, describeChanges, splitBowlers, groupBallIssues, OVERRIDE_STATUS } from '../src/views/rules/ruleOverrides.js';

const cur = { max_overs_per_bowler: null, wide_runs: 1, free_hit: true, lbw: true, retire_at: null };

test('only rules that differ are sent', () => {
  const { changes, errors } = buildOverrideChanges(cur, { max_overs_per_bowler: '3', wide_runs: '1', free_hit: 'true', lbw: false });
  assert.deepEqual(changes, { max_overs_per_bowler: 3, lbw: false });
  assert.deepEqual(errors, []);
});

test('bad numbers are reported, not sent', () => {
  const { changes, errors } = buildOverrideChanges(cur, { wide_runs: '9', powerplay_overs: 'abc', max_overs_per_bowler: '2.5' });
  assert.deepEqual(changes, {});
  assert.equal(errors.length, 3);
});

test('clearing a limit sends null; clearing a plain number is ignored', () => {
  assert.deepEqual(buildOverrideChanges({ max_overs_per_bowler: 4 }, { max_overs_per_bowler: '' }).changes, { max_overs_per_bowler: null });
  assert.deepEqual(buildOverrideChanges({ wide_runs: 1 }, { wide_runs: '' }).changes, {});
});

test('request needs a change and a reason', () => {
  assert.match(validateOverrideRequest({}, 'short ground'), /at least one/);
  assert.match(validateOverrideRequest({ lbw: false }, 'no'), /reason/);
  assert.match(validateOverrideRequest({ lbw: false }, 'x'.repeat(301)), /300/);
  assert.equal(validateOverrideRequest({ lbw: false }, 'No umpires for LBW'), null);
});

test('values read in plain words', () => {
  assert.equal(formatRuleValue('max_overs_per_bowler', null), 'No limit');
  assert.equal(formatRuleValue('retire_at', null), 'Never');
  assert.equal(formatRuleValue('lbw', false), 'No');
  assert.equal(formatRuleValue('wide_runs', 2), '2');
  const d = describeChanges({ max_overs_per_bowler: 3, lbw: false }, { lbw: true });
  assert.deepEqual(d.map((x) => [x.label, x.from, x.to]), [['Most overs per bowler', 'No limit', '3'], ['LBW allowed', 'Yes', 'No']]);
});

test('every field has a unique key and sensible limits', () => {
  const keys = new Set();
  for (const f of OVERRIDE_FIELDS) { assert.ok(!keys.has(f.key)); keys.add(f.key); if (f.type === 'int') assert.ok(f.min < f.max); }
  for (const s of ['pending', 'approved', 'rejected', 'expired']) assert.ok(OVERRIDE_STATUS[s].label);
});

test('bowlers split into allowed and blocked', () => {
  const { ok, blocked } = splitBowlers([{ name: 'A', can_start_over: true }, { name: 'B', can_start_over: false, reason: 'Bowled the previous over' }]);
  assert.equal(ok.length, 1); assert.equal(blocked[0].name, 'B');
  assert.deepEqual(splitBowlers(), { ok: [], blocked: [] });
});

test('ball issues group by innings with plain titles', () => {
  const g = groupBallIssues([{ innings_no: 2, seq: 5, code: 'seq_gap', message: 'm' }, { innings_no: 1, seq: 3, code: 'over_mismatch', message: 'n' }, { innings_no: 1, seq: null, code: 'x_new', message: 'o' }]);
  assert.deepEqual(g.map((x) => x.innings_no), [1, 2]);
  assert.equal(g[0].items[0].title, 'Over count');
  assert.equal(g[0].items[1].title, 'x_new');
  assert.deepEqual(groupBallIssues([]), []);
});
