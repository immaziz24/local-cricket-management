// Batch 5: tiebreaker ranking on the table #327, series close-out #335 #336, registration tracker #334
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTiebreakers } from '../src/views/tournaments/standingsRank.js';
import { seriesStatus, seriesCloseOut } from '../src/views/tournaments/seriesLogic.js';
import { registrationTracker } from '../src/views/tournaments/registrationTracker.js';

const row = (id, pts, won, nrr, extra = {}) => ({ team_id: id, team_name: id, points: pts, won, lost: 0, nrr, rank_no: 0, qualified: false, ...extra });

test('no custom order keeps the database order', () => {
  const rows = [row('A', 4, 2, 0.1), row('B', 4, 2, 0.5)];
  assert.equal(applyTiebreakers(rows, null, []), rows);
  assert.equal(applyTiebreakers(rows, [], []), rows);
});
test('head-to-head can put the team that won the match ahead of a better net run rate', () => {
  const rows = [row('A', 4, 2, 0.9), row('B', 4, 2, 0.1)];
  const m = [{ stage: 'league', status: 'completed', winner_team_id: 'B', team_a_id: 'A', team_b_id: 'B' }];
  const r = applyTiebreakers(rows, ['head_to_head', 'nrr'], m);
  assert.deepEqual(r.map((x) => [x.team_id, x.rank_no]), [['B', 1], ['A', 2]]);
});
test('qualified flags follow the new order once the table has qualifiers', () => {
  const rows = [row('A', 4, 2, 0.9, { qualified: true }), row('B', 4, 2, 0.1), row('C', 0, 0, 0)];
  const m = [{ stage: 'league', status: 'completed', winner_team_id: 'B', team_a_id: 'A', team_b_id: 'B' }];
  const r = applyTiebreakers(rows, ['head_to_head'], m, 1);
  assert.deepEqual(r.map((x) => [x.team_id, x.qualified]), [['B', true], ['A', false], ['C', false]]);
});

const T = [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }];
const win = (id) => ({ id: `m${Math.random()}`, status: 'completed', winner_team_id: id });
test('a decided series can be closed and drops only unplayed matches', () => {
  const ms = [win('A'), win('A'), { id: 'x3', status: 'scheduled' }];
  const info = seriesStatus({ teams: T, matches: ms, planned: 3 });
  const plan = seriesCloseOut(info, ms);
  assert.equal(plan.winnerId, 'A'); assert.equal(plan.runnerUpId, 'B'); assert.deepEqual(plan.unneededMatchIds, ['x3']);
});
test('an undecided or drawn series cannot be closed', () => {
  const ms = [win('A'), { id: 'x2', status: 'scheduled' }, { id: 'x3', status: 'scheduled' }];
  assert.equal(seriesCloseOut(seriesStatus({ teams: T, matches: ms, planned: 3 }), ms), null);
  const drawn = [win('A'), win('B')];
  assert.equal(seriesCloseOut(seriesStatus({ teams: T, matches: drawn, planned: 2 }), drawn), null);
  assert.equal(seriesCloseOut(null, []), null);
});

test('registration tracker shows spots left, almost full, full and closed', () => {
  const regs = (n, status = 'approved') => Array.from({ length: n }, () => ({ status }));
  const open = { registration_open: true, status: 'registration', teams_count: 8 };
  assert.equal(registrationTracker(open, regs(3)).label, 'Registration open - 5 spots left');
  assert.equal(registrationTracker(open, regs(7)).tone, 'almost');
  assert.equal(registrationTracker(open, regs(8)).tone, 'full');
  assert.equal(registrationTracker({ ...open, registration_open: false }, regs(3)).tone, 'closed');
  const t = registrationTracker(open, [...regs(2), ...regs(3, 'pending'), ...regs(1, 'rejected')]);
  assert.deepEqual([t.approved, t.pending, t.rejected, t.percent], [2, 3, 1, 25]);
  assert.equal(registrationTracker({ registration_open: true, status: 'upcoming' }, []).percent, null);
});
