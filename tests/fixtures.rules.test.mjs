// Automatic fixture generation (#48) and scheduling
import test from 'node:test';
import assert from 'node:assert/strict';
import { roundRobin, knockoutFirstRound, interleave, scheduleFixtures, shuffle } from '../src/views/tournaments/fixtureGenerator.js';

const pairKey = (f) => [f.team_a_id, f.team_b_id].sort().join('-');

test('round robin: every team plays every other once (3 to 8 teams)', () => {
  for (let n = 3; n <= 8; n++) {
    const ids = Array.from({ length: n }, (_, i) => `T${i}`);
    const fx = roundRobin(ids);
    assert.equal(fx.length, (n * (n - 1)) / 2, `${n} teams`);
    assert.equal(new Set(fx.map(pairKey)).size, fx.length, `${n} teams: no repeated pair`);
    fx.forEach((f) => assert.notEqual(f.team_a_id, f.team_b_id));
  }
});
test('round robin: no team plays twice in one round', () => {
  const fx = roundRobin(['A', 'B', 'C', 'D', 'E', 'F']);
  const rounds = new Map();
  fx.forEach((f) => { const s = rounds.get(f.round_no) || new Set(); [f.team_a_id, f.team_b_id].forEach((t) => { assert.ok(!s.has(t)); s.add(t); }); rounds.set(f.round_no, s); });
});
test('home and away doubles the matches and swaps sides', () => {
  const fx = roundRobin(['A', 'B', 'C', 'D'], true);
  assert.equal(fx.length, 12);
  assert.equal(fx.filter((f) => f.team_a_id === 'A' && f.team_b_id === 'B').length + fx.filter((f) => f.team_a_id === 'B' && f.team_b_id === 'A').length, 2);
});
test('fewer than two teams gives no fixtures', () => {
  assert.deepEqual(roundRobin(['A']), []);
  assert.deepEqual(roundRobin([]), []);
});
test('knockout first round: pairs teams and gives an odd team a bye', () => {
  const r = knockoutFirstRound(['A', 'B', 'C', 'D', 'E']);
  assert.equal(r.fixtures.length, 2); assert.deepEqual(r.byes, ['E']);
  assert.equal(knockoutFirstRound(['A', 'B', 'C', 'D']).byes.length, 0);
});
test('shuffle keeps the same teams', () => {
  const s = shuffle(['A', 'B', 'C', 'D']);
  assert.deepEqual([...s].sort(), ['A', 'B', 'C', 'D']);
});
test('interleave mixes groups', () => {
  assert.deepEqual(interleave([[1, 2, 3], ['a', 'b']]), [1, 'a', 2, 'b', 3]);
});
test('schedule: matches per day and the gap between them (IST)', () => {
  const fx = scheduleFixtures([{ id: 1 }, { id: 2 }, { id: 3 }], { startDate: '2026-12-01', firstTime: '09:00', perDay: 2, gapMinutes: 240 });
  assert.equal(fx[0].scheduled_at, '2026-12-01T03:30:00.000Z'); // 09:00 IST
  assert.equal(fx[1].scheduled_at, '2026-12-01T07:30:00.000Z'); // 13:00 IST
  assert.equal(fx[2].scheduled_at, '2026-12-02T03:30:00.000Z'); // next day 09:00 IST
});
