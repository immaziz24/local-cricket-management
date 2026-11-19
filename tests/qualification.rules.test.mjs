// Premature qualification prevention (#328)
import test from 'node:test';
import assert from 'node:assert/strict';
import { qualificationStatus } from '../src/views/tournaments/qualification.js';

const rows = (o) => Object.entries(o).map(([team_id, points]) => ({ team_id, points }));

test('nobody is qualified or out at the start', () => {
  const r = qualificationStatus({ rows: rows({ A: 0, B: 0, C: 0, D: 0 }), remaining: [{ team_a_id: 'A', team_b_id: 'B' }, { team_a_id: 'C', team_b_id: 'D' }, { team_a_id: 'A', team_b_id: 'C' }, { team_a_id: 'B', team_b_id: 'D' }, { team_a_id: 'A', team_b_id: 'D' }, { team_a_id: 'B', team_b_id: 'C' }], spots: 2 });
  assert.deepEqual([...r.values()], ['alive', 'alive', 'alive', 'alive']);
});
test('a team is qualified only when the others cannot catch it', () => {
  // A has 8 points. B 4, C 2, D 0, one match left (C v D): even if C wins it can only reach 4.
  const r = qualificationStatus({ rows: rows({ A: 8, B: 4, C: 2, D: 0 }), remaining: [{ team_a_id: 'C', team_b_id: 'D' }], spots: 2 });
  assert.equal(r.get('A'), 'qualified');
  assert.notEqual(r.get('B'), 'eliminated');
});
test('a tie on points is not treated as safe (NRR is unknown)', () => {
  const r = qualificationStatus({ rows: rows({ A: 8, B: 4, C: 2, D: 0 }), remaining: [{ team_a_id: 'C', team_b_id: 'D' }], spots: 2 });
  assert.equal(r.get('B'), 'alive');
});
test('a team that cannot reach the cut is eliminated', () => {
  const r = qualificationStatus({ rows: rows({ A: 8, B: 6, C: 0, D: 0 }), remaining: [{ team_a_id: 'C', team_b_id: 'D' }], spots: 2 });
  assert.equal(r.get('C'), 'eliminated'); assert.equal(r.get('D'), 'eliminated');
  assert.equal(r.get('A'), 'qualified'); assert.equal(r.get('B'), 'qualified');
});
test('a team that can still tie the cut is not eliminated', () => {
  // C has 2, one win gives 4 = ties B's 4: could still go through on NRR
  const r = qualificationStatus({ rows: rows({ A: 8, B: 4, C: 2, D: 0 }), remaining: [{ team_a_id: 'C', team_b_id: 'D' }], spots: 2 });
  assert.equal(r.get('C'), 'alive');
  assert.equal(r.get('D'), 'eliminated');
});
test('qualification honours custom points (win 3, tie 1, no result 1)', () => {
  const r = qualificationStatus({ rows: rows({ A: 9, B: 3, C: 0 }), remaining: [{ team_a_id: 'B', team_b_id: 'C' }], spots: 1, pointsWin: 3, pointsTie: 1, pointsNoResult: 1 });
  assert.equal(r.get('A'), 'qualified'); assert.equal(r.get('C'), 'eliminated');
});
test('all teams qualify when spots cover the group; zero spots decides nothing', () => {
  const all = qualificationStatus({ rows: rows({ A: 0, B: 0 }), remaining: [], spots: 2 });
  assert.deepEqual([...all.values()], ['qualified', 'qualified']);
  const none = qualificationStatus({ rows: rows({ A: 0, B: 0 }), remaining: [], spots: 0 });
  assert.deepEqual([...none.values()], ['alive', 'alive']);
});
test('finished league: places are final when there is a clear gap', () => {
  const r = qualificationStatus({ rows: rows({ A: 6, B: 4, C: 2, D: 0 }), remaining: [], spots: 2 });
  assert.deepEqual([r.get('A'), r.get('B'), r.get('C'), r.get('D')], ['qualified', 'qualified', 'eliminated', 'eliminated']);
});
test('safe fallback for many remaining matches never claims a result too early', () => {
  const teamIds = ['A', 'B', 'C', 'D', 'E', 'F'];
  const remaining = [];
  for (let i = 0; i < teamIds.length; i++) for (let j = i + 1; j < teamIds.length; j++) remaining.push({ team_a_id: teamIds[i], team_b_id: teamIds[j] });
  const r = qualificationStatus({ rows: rows({ A: 2, B: 2, C: 0, D: 0, E: 0, F: 0 }), remaining, spots: 4 });
  assert.ok(remaining.length > 10);
  assert.ok(![...r.values()].includes('qualified'));
});
test('bounds fallback can still prove a team is through', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const remaining = [];
  for (let i = 1; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) remaining.push({ team_a_id: ids[i], team_b_id: ids[j] });
  const r = qualificationStatus({ rows: rows({ A: 40, B: 0, C: 0, D: 0, E: 0, F: 0 }), remaining, spots: 2 });
  assert.equal(r.get('A'), 'qualified');
});
