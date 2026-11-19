// Offline scoring (#26) and sync queue (#27): the screen applies the same rules while there is no internet
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyQueue, isNetworkError, newClientId } from '../src/views/matches/offlineScoring.js';

const side = (prefix, n) => Array.from({ length: n }, (_, i) => ({ player_id: `${prefix}${i + 1}`, name: `${prefix}${i + 1}` }));
function base(over = {}) {
  return {
    overs_limit: 20,
    innings: [{ id: 'i1', status: 'in_progress', runs: 0, wickets: 0, legal_balls: 0, extras: 0, extras_detail: { wides: 0, no_balls: 0, byes: 0, leg_byes: 0 }, batting: [], bowling: [] }],
    current: {
      innings_id: 'i1', status: 'in_progress', striker_id: 'B1', non_striker_id: 'B2', bowler_id: 'F1',
      batting_side: side('B', 11), bowling_side: side('F', 11), runs: 0, wickets: 0, legal_balls: 0, this_over: [], recent: [], partnership: { runs: 0, balls: 0 }, ...over
    }
  };
}
const ball = (payload) => ({ kind: 'ball', payload });

test('a single run changes the strike (#12)', () => {
  const s = applyQueue(base(), [ball({ runs: 1 })]);
  assert.equal(s.current.runs, 1); assert.equal(s.current.legal_balls, 1);
  assert.equal(s.current.striker_id, 'B2'); assert.equal(s.current.non_striker_id, 'B1');
});
test('a four does not change the strike', () => {
  const s = applyQueue(base(), [ball({ runs: 4 })]);
  assert.equal(s.current.runs, 4); assert.equal(s.current.striker_id, 'B1');
  assert.equal(s.innings[0].batting.find((b) => b.player_id === 'B1').fours, 1);
});
test('a wide adds a run and is not a legal ball (#9)', () => {
  const s = applyQueue(base(), [ball({ extra: 'wide' })]);
  assert.equal(s.current.runs, 1); assert.equal(s.current.legal_balls, 0); assert.equal(s.innings[0].extras, 1);
});
test('a no-ball adds a run and is not a legal ball', () => {
  const s = applyQueue(base(), [ball({ extra: 'no_ball', runs: 2 })]);
  assert.equal(s.current.runs, 3); assert.equal(s.current.legal_balls, 0);
});
test('the end of an over swaps the batters and asks for a new bowler (#13)', () => {
  const six = Array.from({ length: 6 }, () => ball({ runs: 0 }));
  const s = applyQueue(base(), six);
  assert.equal(s.current.legal_balls, 6); assert.equal(s.current.bowler_id, null);
  assert.equal(s.current.last_over_bowler_id, 'F1'); assert.equal(s.current.striker_id, 'B2');
});
test('a wicket is counted and the dismissed batter leaves the crease', () => {
  const s = applyQueue(base(), [ball({ wicket: 'bowled' })]);
  assert.equal(s.current.wickets, 1); assert.equal(s.current.striker_id, null);
  assert.equal(s.innings[0].bowling.find((b) => b.player_id === 'F1').wickets, 1);
});
test('a run out is not credited to the bowler', () => {
  const s = applyQueue(base(), [ball({ wicket: 'run_out' })]);
  assert.equal(s.current.wickets, 1); assert.equal(s.innings[0].bowling.find((b) => b.player_id === 'F1').wickets, 0);
});
test('the innings ends when the overs are finished (#15)', () => {
  const st = base(); st.overs_limit = 1;
  const s = applyQueue(st, Array.from({ length: 6 }, () => ball({ runs: 1 })));
  assert.equal(s.current.status, 'completed'); assert.equal(s.current.runs, 6);
});
test('the innings ends when the target is reached (#16)', () => {
  const st = base({ target: 5 });
  const s = applyQueue(st, [ball({ runs: 4 }), ball({ runs: 1 })]);
  assert.equal(s.current.status, 'completed'); assert.equal(s.current.runs_needed, 0);
});
test('the server copy is never changed', () => {
  const st = base(); const before = JSON.stringify(st);
  applyQueue(st, [ball({ runs: 6 })]);
  assert.equal(JSON.stringify(st), before);
});
test('an empty queue returns the same state', () => {
  const st = base(); assert.equal(applyQueue(st, []), st);
});
test('picking batters and bowler offline (#14)', () => {
  const st = base({ striker_id: null, non_striker_id: null, bowler_id: null });
  const s = applyQueue(st, [{ kind: 'players', payload: { striker: 'B3', nonStriker: 'B4', bowler: 'F2' } }]);
  assert.equal(s.current.striker_id, 'B3'); assert.equal(s.current.bowler_id, 'F2');
});
test('network errors are told apart from rule errors', () => {
  assert.equal(isNetworkError(new Error('Failed to fetch')), true);
  assert.equal(isNetworkError(new Error('Pick the bowler first')), false);
});
test('every ball gets its own client id so it is never counted twice (#27)', () => {
  const ids = new Set(Array.from({ length: 50 }, () => newClientId()));
  assert.equal(ids.size, 50);
});
