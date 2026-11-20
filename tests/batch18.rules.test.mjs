import test from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_STATUS, inviteMessageProblem, CHECK_STATE, eligibilitySummary, rejectProblem, AVAIL, availabilityLine, approvalState, decideProblem, clubNameProblem, levelLabel, playersByTeam, CHALLENGE_STATUS, challengeProblem } from '../src/views/teams/squadRules.js';

test('invitation message and statuses (#339)', () => {
  assert.equal(inviteMessageProblem('Join us'), null);
  assert.ok(inviteMessageProblem('x'.repeat(301)));
  assert.equal(INVITE_STATUS.pending.label, 'Waiting');
  assert.equal(INVITE_STATUS.accepted.label, 'Joined');
});

test('squad eligibility summary and reject reason (#340)', () => {
  assert.equal(eligibilitySummary(null), '');
  assert.equal(eligibilitySummary({ squad_size: 11, players_per_side: 11, squad_big_enough: true, blocked: 0, warnings: 0 }), '11 in the squad');
  const s = eligibilitySummary({ squad_size: 8, players_per_side: 11, squad_big_enough: false, blocked: 1, warnings: 2 });
  assert.match(s, /needs at least 11/); assert.match(s, /1 not eligible/); assert.match(s, /2 to check/);
  assert.ok(rejectProblem('  ')); assert.equal(rejectProblem('No ID'), null);
  assert.equal(CHECK_STATE.block.label, 'Not eligible');
});

test('availability (#342)', () => {
  assert.equal(availabilityLine({ yes: 7, maybe: 2, no: 1, waiting: 1 }), '7 yes · 2 maybe · 1 no · 1 waiting');
  assert.equal(availabilityLine(null), '');
  assert.equal(AVAIL.no.label, 'Not available');
});

test('lineup approval states (#343)', () => {
  assert.equal(approvalState(null).key, 'none');
  assert.equal(approvalState({ has_lineup: false }).key, 'none');
  assert.equal(approvalState({ has_lineup: true, status: null }).key, 'unsent');
  assert.equal(approvalState({ has_lineup: true, status: 'pending', stale: false }).key, 'pending');
  assert.equal(approvalState({ has_lineup: true, status: 'approved', stale: true }).key, 'stale');
  assert.equal(approvalState({ has_lineup: true, status: 'approved', stale: false }).key, 'approved');
  assert.equal(approvalState({ has_lineup: true, status: 'changes_requested', stale: false }).key, 'changes');
  assert.equal(decideProblem(true, ''), null);
  assert.ok(decideProblem(false, 'x')); assert.equal(decideProblem(false, 'Swap keeper'), null);
});

test('clubs (#344)', () => {
  assert.ok(clubNameProblem('a')); assert.ok(clubNameProblem('x'.repeat(61))); assert.equal(clubNameProblem('Tigers'), null);
  assert.equal(levelLabel(1), '1st team'); assert.equal(levelLabel(3), 'Level 3'); assert.equal(levelLabel(null), 'No level');
  const g = playersByTeam({ teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], players: [{ player_id: 1, team_id: 'a' }, { player_id: 2, team_id: 'b' }, { player_id: 3, team_id: 'a' }] });
  assert.equal(g[0].players.length, 2); assert.equal(g[1].players.length, 1);
  assert.deepEqual(playersByTeam(null), []);
});

test('challenge checks (#367)', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  const ok = { fromTeamId: 'a', toTeamId: 'b', proposedAt: '2026-11-25T10:00:00Z', overs: '20', playersPerSide: '11', now };
  assert.equal(challengeProblem(ok), null);
  assert.ok(challengeProblem({ ...ok, fromTeamId: '' }));
  assert.ok(challengeProblem({ ...ok, toTeamId: 'a' }));
  assert.ok(challengeProblem({ ...ok, proposedAt: '' }));
  assert.ok(challengeProblem({ ...ok, proposedAt: '2026-11-19T10:00:00Z' }));
  assert.ok(challengeProblem({ ...ok, overs: '0' }));
  assert.ok(challengeProblem({ ...ok, overs: '101' }));
  assert.ok(challengeProblem({ ...ok, playersPerSide: '1' }));
  assert.equal(CHALLENGE_STATUS.expired.label, 'Expired');
});
