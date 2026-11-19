// Fall-of-wickets timeline (#349, #350)
import test from 'node:test';
import assert from 'node:assert/strict';
import { overToBalls, fowPoints } from '../src/views/matches/fowTimeline.js';

test('overs convert to balls', () => {
  assert.equal(overToBalls('3.4'), 22); assert.equal(overToBalls('0.1'), 1); assert.equal(overToBalls('12'), 72);
  assert.equal(overToBalls('3.6'), null); assert.equal(overToBalls('x'), null); assert.equal(overToBalls(null), null);
});
test('each wicket is placed along the innings and gets its partnership', () => {
  const p = fowPoints([{ runs: 20, wicket: 1, name: 'A', over: '3.0' }, { runs: 55, wicket: 2, name: 'B', over: '8.0' }], { totalBalls: 120, oversLimit: 20 });
  assert.equal(p.length, 2);
  assert.equal(p[0].x, 15); assert.equal(p[1].x, 40);
  assert.equal(p[0].partnershipRuns, 20); assert.equal(p[0].partnershipBalls, 18);
  assert.equal(p[1].partnershipRuns, 35); assert.equal(p[1].partnershipBalls, 30);
});
test('the axis grows to fit a longer innings and never divides by zero', () => {
  const p = fowPoints([{ runs: 5, wicket: 1, name: 'A', over: '1.0' }], { totalBalls: 0 });
  assert.equal(p[0].x, 100);
  assert.deepEqual(fowPoints([], {}), []);
  assert.deepEqual(fowPoints(null), []);
});
test('three wickets in a few runs are flagged as a collapse', () => {
  const p = fowPoints([{ runs: 40, wicket: 1, name: 'A', over: '5.0' }, { runs: 45, wicket: 2, name: 'B', over: '6.0' }, { runs: 50, wicket: 3, name: 'C', over: '7.0' }, { runs: 120, wicket: 4, name: 'D', over: '14.0' }], { totalBalls: 120 });
  assert.deepEqual(p.map((x) => x.collapse), [false, false, true, false]);
});
test('wickets with an unreadable over are skipped', () => {
  const p = fowPoints([{ runs: 5, wicket: 1, name: 'A', over: '??' }, { runs: 9, wicket: 2, name: 'B', over: '2.1' }], { totalBalls: 30 });
  assert.equal(p.length, 1); assert.equal(p[0].wicket, 2);
});
