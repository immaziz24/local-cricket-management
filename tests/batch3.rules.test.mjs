// Batch 3: fixture conflicts #331 #332, scenario simulator #329, tiebreakers #327, phase analysis #351 #352
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureConflicts } from '../src/views/tournaments/fixtureConflicts.js';
import { simulateScenario } from '../src/views/tournaments/scenarioSimulator.js';
import { rankTeams } from '../src/views/tournaments/tiebreakers.js';
import { phaseAnalysis } from '../src/views/matches/phaseAnalysis.js';

const at = (h) => `2026-12-01T${String(h).padStart(2, '0')}:00:00Z`;
const M = (id, a, b, h, venue = 'Ground 1') => ({ id, team_a_id: a, team_b_id: b, scheduled_at: at(h), venue, status: 'scheduled' });

test('a team in two overlapping matches is flagged', () => {
  const c = fixtureConflicts([M(1, 'A', 'B', 6), M(2, 'A', 'C', 8, 'Ground 2')]);
  assert.equal(c.filter((x) => x.type === 'team_clash').length, 1);
  assert.equal(c.filter((x) => x.type === 'ground_clash').length, 0);
});
test('one ground with two overlapping matches is flagged, case-insensitively', () => {
  const c = fixtureConflicts([M(1, 'A', 'B', 6, 'Main Ground'), M(2, 'C', 'D', 7, 'main ground ')]);
  assert.deepEqual(c.map((x) => x.type), ['ground_clash']);
});
test('matches far enough apart are fine; rest rule flags short rest only when set', () => {
  const ms = [M(1, 'A', 'B', 6), M(2, 'A', 'C', 12, 'Ground 2')];
  assert.equal(fixtureConflicts(ms).length, 0);
  const r = fixtureConflicts(ms, { minRestHours: 24 });
  assert.deepEqual(r.map((x) => x.type), ['rest']);
});
test('cancelled and undated matches are ignored', () => {
  const ms = [M(1, 'A', 'B', 6), { ...M(2, 'A', 'C', 6), status: 'cancelled' }, { id: 3, team_a_id: 'A', team_b_id: 'D', scheduled_at: null }];
  assert.equal(fixtureConflicts(ms).length, 0);
});

test('scenario: picking results can lock a place', () => {
  const rows = [{ team_id: 'A', points: 8 }, { team_id: 'B', points: 2 }, { team_id: 'C', points: 2 }];
  const remaining = [{ id: 1, team_a_id: 'B', team_b_id: 'C' }, { id: 2, team_a_id: 'A', team_b_id: 'B' }];
  const open = simulateScenario({ rows, remaining, spots: 1 });
  assert.equal(open.status.get('A'), 'qualified');
  const s = simulateScenario({ rows, remaining, spots: 1, picks: { 1: 'B', 2: 'tie' } });
  assert.equal(s.points.get('B'), 5);
  assert.equal(s.points.get('A'), 9);
  assert.equal(s.status.get('C'), 'eliminated');
});

test('tiebreakers: wins, then net run rate, then head-to-head', () => {
  const rows = [
    { team_id: 'A', name: 'A', points: 4, won: 2, lost: 1, nrr: 0.5 },
    { team_id: 'B', name: 'B', points: 4, won: 2, lost: 1, nrr: 0.5 },
    { team_id: 'C', name: 'C', points: 6, won: 3, lost: 0, nrr: -1 }
  ];
  const r = rankTeams(rows, { order: ['wins', 'nrr', 'head_to_head'], results: [{ winner_id: 'B', loser_id: 'A' }] });
  assert.deepEqual(r.map((x) => x.team_id), ['C', 'B', 'A']);
  const r2 = rankTeams([{ team_id: 'A', name: 'A', points: 4, won: 1, nrr: 0.1 }, { team_id: 'B', name: 'B', points: 4, won: 2, nrr: -0.1 }], { order: ['nrr', 'wins'] });
  assert.equal(r2[0].team_id, 'A');
  assert.deepEqual(rankTeams([], {}), []);
});
test('tiebreakers ignore unknown rules and fall back to name', () => {
  const r = rankTeams([{ team_id: 'z', name: 'Zed', points: 2 }, { team_id: 'a', name: 'Ace', points: 2 }], { order: ['bogus', 'name'] });
  assert.equal(r[0].name, 'Ace');
});

test('phase analysis splits powerplay, middle and death overs', () => {
  const balls = [];
  for (let o = 0; o < 20; o += 1) for (let i = 0; i < 6; i += 1) balls.push({ over_number: o, is_legal: true, runs_total: o < 6 ? 1 : o >= 16 ? 2 : 0, is_wicket: o === 17 && i === 0 });
  const p = phaseAnalysis(balls, { oversLimit: 20 });
  assert.equal(p.powerplay.overs, 6); assert.equal(p.powerplay.runs, 36); assert.equal(p.powerplay.runRate, 6);
  assert.equal(p.death.overs, 4); assert.equal(p.death.runs, 48); assert.equal(p.death.wickets, 1);
  assert.equal(p.middle.runs, 0); assert.equal(p.middle.dots, 60);
  assert.equal(phaseAnalysis([], {}).powerplay.runRate, 0);
});
