// Category L calculators (#216-#232)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../src/views/tools/cricketMath.js';

test('#216 overs convert to balls the cricket way', () => {
  assert.equal(m.oversToBalls('12.3'), 75);
  assert.equal(m.oversToBalls('0.5'), 5);
  assert.equal(m.oversToBalls('3.6'), null); // 6 balls is not valid after the dot
  assert.equal(m.oversToBalls('abc'), null);
  assert.equal(m.oversToBalls(''), null);
  assert.equal(m.ballsToOvers(75), '12.3');
});
test('#216 run rate', () => {
  assert.equal(m.runRate(120, '20'), 6);
  assert.equal(m.runRate(50, '7.2'), 6.82);
  assert.equal(m.runRate(50, '0'), null);
});
test('#217 required run rate', () => {
  const r = m.requiredRate(151, 100, '10', '20');
  assert.equal(r.need, 51); assert.equal(r.ballsLeft, 60); assert.equal(r.rrr, 5.1);
  assert.equal(m.requiredRate(100, 100, '10', '20').won, true);
  assert.equal(m.requiredRate(151, 100, '20', '20').rrr, null);
});
test('#218-#221 strike rate, averages, economy', () => {
  assert.equal(m.strikeRate(50, 40), 125);
  assert.equal(m.battingAverage(300, 6), 50);
  assert.equal(m.battingAverage(300, 0), null);
  assert.equal(m.economy(24, '4'), 6);
  assert.deepEqual(m.bowlingAverage(60, 3, '10'), { average: 20, strikeRate: 20 });
});
test('#222 net run rate counts the full quota when all out', () => {
  const r = m.netRunRate([{ runsFor: 100, oversFor: '', oversFaced: '10', allOutFor: true, runsAgainst: 90, oversBowled: '20', allOutAgainst: false, quota: '20' }]);
  assert.equal(r.oversFor, '20.0');
  assert.equal(r.nrr, 0.5); // 100/20*... 5.00 - 4.50
});
test('#224 coin toss gives Heads or Tails', () => {
  for (let i = 0; i < 20; i++) assert.ok(['Heads', 'Tails'].includes(m.tossCoin()));
});
test('#225 teams are balanced and everyone is placed once', () => {
  const players = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, role: i === 0 ? 'wicket_keeper' : null, rating: (i % 5) + 1 }));
  const teams = m.makeTeams(players, 2);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].players.length + teams[1].players.length, 12);
  assert.ok(Math.abs(teams[0].total - teams[1].total) <= 3);
});
test('#226 playing XI has a keeper and the right size', () => {
  const squad = Array.from({ length: 14 }, (_, i) => ({ name: `P${i}`, role: i === 0 ? 'wicket_keeper' : i < 7 ? 'bowler' : 'batter', rating: 3 }));
  const r = m.pickPlayingXI(squad);
  assert.equal(r.xi.length, 11);
  assert.ok(r.xi.some((p) => p.role === 'wicket_keeper'));
  assert.equal(r.bench.length, 3);
});
test('#227 player list parsing', () => {
  const p = m.parsePlayers('Asif\nBilal, bowler, 4\nCharan, wk');
  assert.deepEqual(p.map((x) => x.name), ['Asif', 'Bilal', 'Charan']);
  assert.equal(p[1].role, 'bowler'); assert.equal(p[1].rating, 4); assert.equal(p[2].role, 'wicket_keeper');
});
test('#228 points table orders by points then NRR', () => {
  const t = m.pointsTable(['A', 'B', 'C'], [
    { a: 'A', b: 'B', aRuns: 150, aOvers: '20', bRuns: 120, bOvers: '20' },
    { a: 'B', b: 'C', aRuns: 130, aOvers: '20', bRuns: 100, bOvers: '20' },
    { a: 'A', b: 'C', noResult: true }
  ], { quota: '20' });
  assert.equal(t[0].team, 'A'); assert.equal(t[0].pts, 3);
  assert.equal(t[1].team, 'B'); assert.equal(t[1].pts, 2);
  assert.equal(t[2].pts, 1);
});
test('#229 budget and break-even fee', () => {
  const r = m.budget({ items: [{ label: 'Balls', amount: 1000 }, { label: 'Umpires', amount: 500, perMatch: true }], teams: 8, entryFee: 1500, matches: 10, sponsorship: 2000 });
  assert.equal(r.cost, 6000); assert.equal(r.income, 14000); assert.equal(r.balance, 8000);
});
test('#230 prize split never exceeds the pool', () => {
  const r = m.splitPrizes(10000, [{ name: '1st', percent: 50 }, { name: '2nd', percent: 30 }, { name: '3rd', percent: 20 }]);
  assert.equal(r.prizes.reduce((s, x) => s + x.amount, 0), 10000);
});
test('#231 auction max bid keeps base price for the empty slots', () => {
  const r = m.auctionBudget({ purse: 1000, spent: 400, squadSize: 5, bought: 2, basePrice: 50 });
  assert.equal(r.remaining, 600); assert.equal(r.slots, 3); assert.equal(r.maxBid, 500);
});
test('#232 ground size', () => {
  const g = m.groundSize(60, 50);
  assert.ok(g.area > 9000 && g.area < 9600);
  assert.equal(m.groundSize('', ''), null);
});
