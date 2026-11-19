// Series lifecycle (#333-#337): best-of-N with early clinch
import test from 'node:test';
import assert from 'node:assert/strict';
import { seriesStatus } from '../src/views/tournaments/seriesLogic.js';

const teams = [{ id: 'A', name: 'Lions' }, { id: 'B', name: 'Tigers' }];
const win = (w) => ({ status: 'completed', winner_team_id: w });
const todo = () => ({ status: 'scheduled', winner_team_id: null });

test('not started', () => {
  const s = seriesStatus({ teams, matches: [todo(), todo(), todo()], planned: 3 });
  assert.equal(s.decided, false); assert.equal(s.remaining, 3); assert.equal(s.text, 'Series not started');
});
test('1-0 in a 3-match series: leading, not decided', () => {
  const s = seriesStatus({ teams, matches: [win('A'), todo(), todo()], planned: 3 });
  assert.equal(s.decided, false); assert.equal(s.text, 'Lions lead the series 1-0');
});
test('2-0 in a 3-match series is decided early (clinched)', () => {
  const s = seriesStatus({ teams, matches: [win('A'), win('A'), todo()], planned: 3 });
  assert.equal(s.clinched, true); assert.equal(s.decided, true); assert.equal(s.winnerId, 'A');
  assert.equal(s.deadRubbers, 1); assert.match(s.note, /still to play/); assert.equal(s.text, 'Lions won the series 2-0');
});
test('3-0 in a 5-match series is decided with 2 dead rubbers; 2-0 is not', () => {
  const dec = seriesStatus({ teams, matches: [win('B'), win('B'), win('B'), todo(), todo()], planned: 5 });
  assert.equal(dec.winnerId, 'B'); assert.equal(dec.deadRubbers, 2);
  const open = seriesStatus({ teams, matches: [win('B'), win('B'), todo(), todo(), todo()], planned: 5 });
  assert.equal(open.decided, false);
});
test('2-1 after three matches of three: won', () => {
  const s = seriesStatus({ teams, matches: [win('A'), win('B'), win('A')], planned: 3 });
  assert.equal(s.winnerId, 'A'); assert.equal(s.deadRubbers, 0); assert.equal(s.note, null);
});
test('level after all matches: drawn', () => {
  const s = seriesStatus({ teams, matches: [win('A'), win('B'), { status: 'abandoned' }], planned: 3 });
  assert.equal(s.drawn, true); assert.equal(s.winnerId, null); assert.equal(s.text, 'Series drawn 1-1');
});
test('abandoned and cancelled matches are not left to play', () => {
  const s = seriesStatus({ teams, matches: [win('A'), { status: 'cancelled' }, { status: 'abandoned' }], planned: 3 });
  assert.equal(s.remaining, 0); assert.equal(s.winnerId, 'A');
});
test('a live match keeps the series open', () => {
  const s = seriesStatus({ teams, matches: [win('A'), { status: 'live' }, todo()], planned: 3 });
  assert.equal(s.live, true); assert.equal(s.decided, false);
});
test('planned count larger than created matches still counts the rest', () => {
  const s = seriesStatus({ teams, matches: [win('A'), win('A')], planned: 5 });
  assert.equal(s.remaining, 3); assert.equal(s.decided, false);
});
test('needs exactly two teams', () => {
  assert.equal(seriesStatus({ teams: [teams[0]], matches: [] }), null);
});
