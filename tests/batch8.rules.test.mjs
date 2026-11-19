import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldsFor, diffChanges, validateCorrection, previewChanges, conflictMessage } from '../src/views/matches/ballCorrection.js';

const ball = { id: 1, is_wicket: false, striker_id: 'a', non_striker_id: 'b', bowler_id: 'c', fielder_id: null, dismissed_id: null,
  striker: 'Asif', non_striker: 'Bilal', bowler: 'Chand', fielder: null, dismissed: null };
const wk = { ...ball, is_wicket: true, dismissed_id: 'a', dismissed: 'Asif', fielder_id: 'd', fielder: 'Dev' };
const players = [{ id: 'a', name: 'Asif' }, { id: 'b', name: 'Bilal' }, { id: 'c', name: 'Chand' }, { id: 'd', name: 'Dev' }, { id: 'e', name: 'Eshan' }];

test('wicket-only fields appear only on wicket balls', () => {
  assert.equal(fieldsFor(ball).length, 3);
  assert.equal(fieldsFor(wk).length, 5);
});
test('diffChanges keeps only real changes', () => {
  assert.deepEqual(diffChanges(ball, { striker_id: 'a', bowler_id: 'e' }), { bowler_id: 'e' });
  assert.deepEqual(diffChanges(wk, { fielder_id: '' }), { fielder_id: null });
  assert.deepEqual(diffChanges(ball, { fielder_id: 'd' }), {});
});
test('validation: nothing, reason, same player, bowler is batter', () => {
  assert.match(validateCorrection(ball, {}, 'valid reason'), /Nothing/);
  assert.match(validateCorrection(ball, { bowler_id: 'e' }, 'abc'), /reason/);
  assert.match(validateCorrection(ball, { striker_id: 'b' }, 'valid reason'), /same player/);
  assert.match(validateCorrection(ball, { bowler_id: 'a' }, 'valid reason'), /bowler cannot/);
  assert.match(validateCorrection(ball, { striker_id: null }, 'valid reason'), /empty/);
  assert.equal(validateCorrection(ball, { bowler_id: 'e' }, 'wrong bowler picked'), null);
});
test('preview shows before → after', () => {
  assert.deepEqual(previewChanges(ball, { bowler_id: 'e' }, players), ['Bowler: Chand → Eshan']);
  assert.deepEqual(previewChanges(wk, { fielder_id: null }, players), ['Fielder (catch / run-out / stumping): Dev → none']);
});
test('conflict message', () => {
  assert.equal(conflictMessage([]), null);
  assert.match(conflictMessage([{ name: 'Rafi', same_user: false }]), /Rafi is also scoring/);
  assert.match(conflictMessage([{ name: 'Me', same_user: true }]), /you on another device are also/);
});
