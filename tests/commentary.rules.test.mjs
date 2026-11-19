// Live commentary (#20): every ball gets a full sentence
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCommentary, shotArea } from '../src/views/matches/commentary.js';

const words = (t) => t.trim().split(/\s+/).length;
const base = { over: '3.2', bowler: 'Asif', batter: 'Bilal', runs: 0 };

test('dot ball, singles, four and six all produce commentary', () => {
  [0, 1, 2, 3, 4, 6].forEach((runs) => assert.ok(makeCommentary({ ...base, runs }).length > 20, `runs ${runs}`));
});
test('every ball has at least 25 words', () => {
  const cases = [
    { runs: 0 }, { runs: 1 }, { runs: 4, angle: 45, dist: 99 }, { runs: 6, angle: 10, dist: 100 },
    { extra: 'wide', extraRuns: 1 }, { extra: 'no_ball', extraRuns: 1, runs: 2 }, { extra: 'bye', extraRuns: 1 }, { extra: 'leg_bye', extraRuns: 2 },
    ...['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'caught_and_bowled'].map((wicket) => ({ wicket, fielder: 'Chetan', outName: 'Bilal' }))
  ];
  cases.forEach((c) => { const t = makeCommentary({ ...base, ...c }); assert.ok(words(t) >= 25, `${JSON.stringify(c)} -> ${words(t)} words: ${t}`); });
});
test('commentary names the bowler and batter', () => {
  const t = makeCommentary({ ...base, runs: 1 });
  assert.match(t, /Asif/); assert.match(t, /Bilal/);
});
test('a wicket says OUT', () => assert.match(makeCommentary({ ...base, wicket: 'bowled' }), /OUT/));
test('shot area mirrors for a left-hander and handles a missing angle', () => {
  assert.equal(shotArea(null, 50), null);
  assert.notEqual(shotArea(60, 80, false), shotArea(60, 80, true));
  assert.match(shotArea(0, 99), /rope/);
});
