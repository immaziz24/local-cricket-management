// Batch 9: statistics charts and filters (#345 #346 #347 #354) and provenance/boundary tracker contract (#355 #356)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { manhattanData, wormComparison, wagonZones, careerForm, formOptions } from '../src/views/stats/chartData.js';

const inn1 = { innings_no: 1, team: 'Reds', runs: 30, wickets: 1, overs: [{ over: 1, runs: 10, wickets: 0, total: 10 }, { over: 2, runs: 8, wickets: 1, total: 18 }, { over: 3, runs: 12, wickets: 0, total: 30 }] };
const inn2 = { innings_no: 2, team: 'Blues', runs: 20, wickets: 2, overs: [{ over: 1, runs: 4, wickets: 1, total: 4 }, { over: 2, runs: 16, wickets: 1, total: 20 }] };

test('Manhattan pads missing overs and finds the best over', () => {
  const m = manhattanData([inn1, inn2]);
  assert.equal(m.maxOver, 3);
  assert.equal(m.series[1].bars.length, 3);
  assert.equal(m.series[1].bars[2].runs, 0);
  assert.equal(m.series[1].bars[2].played, false);
  assert.equal(m.series[0].best.over, 3);
  assert.equal(m.maxRuns, 16);
  assert.deepEqual(manhattanData([]).series, []);
});

test('worm comparison: cumulative wickets, target and readout', () => {
  const w = wormComparison([inn1, inn2]);
  assert.equal(w.target, 31);
  assert.equal(w.series[1].points[2].wickets, 2);
  assert.equal(w.maxRuns, 31);
  assert.match(w.readout(2), /Blues ahead by 2/);
  assert.match(w.readout(1), /Reds ahead by 6/);
  assert.match(w.readout(3), /Reds ahead by 10/);
  assert.equal(wormComparison([inn1]).target, null);
});

test('wagon zones count shots by sector and side', () => {
  const shots = [{ angle: 90, runs: 4 }, { angle: 92, runs: 1 }, { angle: 270, runs: 6 }, { angle: 0, runs: 2 }, { angle: 180, runs: 1 }, { angle: null, runs: 1 }];
  const z = wagonZones(shots);
  assert.equal(z.total, 5);
  assert.equal(z.zones[2].shots, 2);
  assert.equal(z.zones[2].boundaries, 1);
  assert.equal(z.offSide.runs, 5);
  assert.equal(z.legSide.runs, 6);
  assert.equal(z.favourite, 'Square leg side');
  const lh = wagonZones(shots, true);
  assert.equal(lh.offSide.runs, 6);
  assert.equal(lh.zones[2].label, 'Square leg side');
  assert.equal(wagonZones([]).total, 0);
  assert.equal(wagonZones([{ angle: 358, runs: 1 }]).zones[0].shots, 1);
});

const matches = [
  { match_id: 'a', date: '2026-01-01', tournament: 'Cup', batted: true, runs: 10, balls: 10, out: true, bowl_balls: 0 },
  { match_id: 'b', date: '2026-01-08', tournament: 'Cup', batted: true, runs: 30, balls: 20, out: false, bowl_balls: 12, runs_conceded: 18, wickets: 2 },
  { match_id: 'c', date: '2026-01-15', tournament: null, batted: true, runs: 50, balls: 30, out: true, bowl_balls: 0 },
  { match_id: 'd', date: '2026-01-22', tournament: 'Cup', batted: true, runs: 60, balls: 30, out: true, bowl_balls: 6, runs_conceded: 6, wickets: 1 },
  { match_id: 'e', date: '2026-01-29', tournament: 'League', batted: false, bowl_balls: 0 }
];

test('career form: filters, rolling average and trend', () => {
  const all = careerForm(matches);
  assert.equal(all.matches, 5);
  assert.equal(all.batting.innings, 4);
  assert.equal(all.batting.runs, 150);
  assert.equal(all.batting.average, 50); // 150 runs / 3 outs
  assert.equal(all.rolling[1].value, 40); // (10+30)/1 out
  assert.equal(all.trend, 'up');
  assert.equal(careerForm(matches, { tournament: 'Cup' }).matches, 3);
  assert.equal(careerForm(matches, { tournament: '__friendly__' }).matches, 1);
  assert.equal(careerForm(matches, { lastN: 2 }).matches, 2);
  const b = careerForm(matches).bowling;
  assert.equal(b.wickets, 3);
  assert.equal(b.economy, 8);
  assert.equal(careerForm([]).batting.average, null);
  assert.deepEqual(formOptions(matches), { tournaments: ['Cup', 'League'], hasFriendly: true });
});

test('not-out innings only: average falls back to runs', () => {
  const r = careerForm([{ match_id: 'x', date: '2026-01-01', batted: true, runs: 40, balls: 20, out: false, bowl_balls: 0 }]);
  assert.equal(r.batting.average, 40);
});

test('migration defines reconciliation and boundary tracker, readable by everyone', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const file = readdirSync(dir).find((f) => f.includes('stats_reconciliation_boundary_tracker'));
  assert.ok(file);
  const sql = readFileSync(new URL(file, dir), 'utf8');
  assert.match(sql, /function public\.stats_reconciliation/);
  assert.match(sql, /function public\.get_boundary_tracker/);
  assert.match(sql, /grant execute on function public\.get_boundary_tracker\(uuid, integer\) to anon, authenticated/);
  assert.match(sql, /not i\.is_super_over/);
});
