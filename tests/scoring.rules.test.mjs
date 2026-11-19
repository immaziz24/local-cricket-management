// Scoring integrity rules (#311-#314, #321-#323, #382)
import test from 'node:test';
import assert from 'node:assert/strict';
import { bowlerOverLimit, canBowlNextOver, validateCrease, replaceBowlerMidOver, oversText } from '../src/views/matches/scoringRules.js';

test('over limit is one fifth of the innings', () => {
  assert.equal(bowlerOverLimit(20), 4); assert.equal(bowlerOverLimit(50), 10); assert.equal(bowlerOverLimit(6), 2);
  assert.equal(bowlerOverLimit(10), 2); assert.equal(bowlerOverLimit(8), 2);
  assert.equal(bowlerOverLimit(null), null);
  assert.equal(bowlerOverLimit(20, { maxOversPerBowler: 5 }), 5);
});
test('same bowler cannot bowl two overs in a row', () => {
  assert.equal(canBowlNextOver({ bowlerId: 'P1', lastOverBowlerId: 'P1', oversPerInnings: 20 }).ok, false);
  assert.equal(canBowlNextOver({ bowlerId: 'P2', lastOverBowlerId: 'P1', oversPerInnings: 20 }).ok, true);
});
test('bowler cannot exceed the over limit', () => {
  const r = canBowlNextOver({ bowlerId: 'P2', lastOverBowlerId: 'P1', oversBowled: { P2: 4 }, oversPerInnings: 20 });
  assert.equal(r.ok, false); assert.match(r.reason, /maximum of 4/);
  assert.equal(canBowlNextOver({ bowlerId: 'P2', lastOverBowlerId: 'P1', oversBowled: { P2: 3 }, oversPerInnings: 20 }).ok, true);
});
test('a barred bowler cannot bowl again', () => {
  assert.equal(canBowlNextOver({ bowlerId: 'P9', lastOverBowlerId: 'P1', barred: ['P9'], oversPerInnings: 20 }).ok, false);
});
test('no bowler picked', () => {
  assert.equal(canBowlNextOver({ bowlerId: '', oversPerInnings: 20 }).ok, false);
});
test('crease: two different batters who are not out', () => {
  assert.equal(validateCrease({ strikerId: 'A', nonStrikerId: 'B' }).ok, true);
  assert.equal(validateCrease({ strikerId: 'A', nonStrikerId: 'A' }).ok, false);
  assert.equal(validateCrease({ strikerId: 'A', nonStrikerId: '' }).ok, false);
  assert.equal(validateCrease({ strikerId: 'A', nonStrikerId: 'B', outIds: ['B'] }).ok, false);
  assert.equal(validateCrease({ strikerId: 'A', nonStrikerId: 'Z', battingIds: ['A', 'B'] }).ok, false);
});
test('injured bowler mid-over: balls bowled stay, replacement finishes, hurt bowler is barred', () => {
  const r = replaceBowlerMidOver({ originalId: 'P1', replacementId: 'P2', legalBallsInOver: 2, lastOverBowlerId: 'P3', oversBowled: { P2: 1 }, oversPerInnings: 20, reason: 'Hamstring injury' });
  assert.equal(r.ok, true);
  assert.equal(r.ballsKeptByOriginal, 2); assert.equal(r.ballsLeftForReplacement, 4);
  assert.deepEqual(r.barredFromInnings, ['P1']); assert.equal(r.barredNextOver, 'P2');
  assert.equal(r.audit.action, 'BOWLER_REPLACED_MID_OVER'); assert.equal(r.audit.reason, 'Hamstring injury');
});
test('injured bowler replacement is checked', () => {
  const base = { originalId: 'P1', replacementId: 'P2', legalBallsInOver: 3, oversPerInnings: 20, reason: 'Injury' };
  assert.equal(replaceBowlerMidOver({ ...base, reason: ' ' }).ok, false);              // reason needed
  assert.equal(replaceBowlerMidOver({ ...base, replacementId: 'P1' }).ok, false);      // must be different
  assert.equal(replaceBowlerMidOver({ ...base, lastOverBowlerId: 'P2' }).ok, false);   // bowled the previous over
  assert.equal(replaceBowlerMidOver({ ...base, oversBowled: { P2: 4 } }).ok, false);   // used up his overs
  assert.equal(replaceBowlerMidOver({ ...base, barred: ['P2'] }).ok, false);
  assert.equal(replaceBowlerMidOver({ ...base, legalBallsInOver: 6 }).ok, false);      // over is already complete
  assert.equal(replaceBowlerMidOver({ ...base, legalBallsInOver: 0 }).ok, true);       // hurt before the first ball
});
test('overs text', () => { assert.equal(oversText(75), '12.3'); assert.equal(oversText(0), '0.0'); });
