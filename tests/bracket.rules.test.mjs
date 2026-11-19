// Knockout (#56) and double-elimination (#46) round builders
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextKnockoutRound, nextDoubleEliminationRound } from '../src/views/tournaments/bracketLogic.js';

const done = (a, b, w, extra = {}) => ({ team_a_id: a, team_b_id: b, winner_team_id: w, status: 'completed', ...extra });

test('knockout: 8 teams start with quarter-finals, best seed meets the lowest', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const r = nextKnockoutRound({ structure: 'knockout', teamIds: ids, table: [], matches: [] });
  assert.equal(r.stage, 'quarter_final'); assert.equal(r.fixtures.length, 4); assert.equal(r.bye, null);
});
test('knockout: later round pairs the winners, then the final', () => {
  const ids = ['A', 'B', 'C', 'D'];
  const r1 = [done('A', 'B', 'A', { stage: 'semi_final', round_no: 1, match_no: 1 }), done('C', 'D', 'D', { stage: 'semi_final', round_no: 1, match_no: 2 })];
  const r = nextKnockoutRound({ structure: 'knockout', teamIds: ids, table: [], matches: r1 });
  assert.equal(r.stage, 'final'); assert.equal(r.fixtures.length, 1);
  assert.deepEqual([r.fixtures[0].team_a_id, r.fixtures[0].team_b_id].sort(), ['A', 'D']);
});
test('knockout: refuses while a match is still to be played', () => {
  assert.throws(() => nextKnockoutRound({ structure: 'knockout', teamIds: ['A', 'B'], table: [], matches: [{ stage: 'final', status: 'scheduled' }] }), /Finish/);
});
test('knockout: odd number of teams gives one bye', () => {
  const r = nextKnockoutRound({ structure: 'knockout', teamIds: ['A', 'B', 'C', 'D', 'E'], table: [], matches: [] });
  assert.ok(r.bye); assert.equal(r.fixtures.length, 2);
});
test('knockout after a league uses only the qualified teams, 1 v 4 and 2 v 3', () => {
  const table = [1, 2, 3, 4].map((n) => ({ team_id: `T${n}`, qualified: true, rank_no: n }));
  table.push({ team_id: 'T5', qualified: false, rank_no: 5 });
  const league = [done('T1', 'T2', 'T1', { stage: 'league' })];
  const r = nextKnockoutRound({ structure: 'league', teamIds: table.map((t) => t.team_id), table, matches: league });
  assert.equal(r.stage, 'semi_final');
  const pairs = r.fixtures.map((f) => [f.team_a_id, f.team_b_id].join('v'));
  assert.deepEqual(pairs, ['T1vT4', 'T2vT3']);
});
test('knockout after a league waits until every league match is done', () => {
  assert.throws(() => nextKnockoutRound({ structure: 'league', teamIds: ['A', 'B'], table: [], matches: [{ stage: 'league', status: 'live' }] }), /Finish/);
});
test('double elimination: unbeaten play unbeaten, one-loss play one-loss, then grand final', () => {
  const ids = ['A', 'B', 'C', 'D'];
  const r1 = nextDoubleEliminationRound({ teamIds: ids, matches: [] });
  assert.equal(r1.fixtures.length, 2);
  const m1 = [done('A', 'B', 'A', { bracket: 'winners', round_no: 1, match_no: 1 }), done('C', 'D', 'C', { bracket: 'winners', round_no: 1, match_no: 2 })];
  const r2 = nextDoubleEliminationRound({ teamIds: ids, matches: m1 });
  const brackets = r2.fixtures.map((f) => f.bracket).sort();
  assert.deepEqual(brackets, ['losers', 'winners']);
  const m2 = [...m1, done('A', 'C', 'A', { bracket: 'winners', round_no: 2, match_no: 3 }), done('B', 'D', 'B', { bracket: 'losers', round_no: 2, match_no: 4 })];
  const r3 = nextDoubleEliminationRound({ teamIds: ids, matches: m2 });
  // C lost once (to A) so is in the losers bracket with B; D is out (2 losses); A unbeaten waits
  assert.equal(r3.fixtures.length, 1); assert.equal(r3.fixtures[0].bracket, 'losers');
});
test('double elimination: grand final when one unbeaten and one one-loss team remain', () => {
  const ids = ['A', 'B'];
  const m = [done('A', 'B', 'A', { bracket: 'winners', round_no: 1, match_no: 1 })];
  const r = nextDoubleEliminationRound({ teamIds: ids, matches: m });
  assert.equal(r.fixtures[0].bracket, 'grand_final'); assert.equal(r.label, 'Grand final');
});
