import test from 'node:test';
import assert from 'node:assert/strict';
import { stageState, stageLine, freezeProblem, reopenProblem, stageNameProblem, wouldLoop, stageLayers, toggleDependency } from '../src/views/tournaments/stageRules.js';
import { pitchChoices, pitchSummary, firstFreePitch } from '../src/views/grounds/pitchRules.js';
import { previewLinesFromServer, previewNote } from '../src/views/matches/correctionPreview.js';
import { OVERRIDE_FIELDS, injuryRuleText, buildOverrideChanges } from '../src/views/rules/ruleOverrides.js';

const S = (o) => ({ id: 'x', name: 'X', status: 'open', match_count: 0, open_count: 0, live_count: 0, done: false, blocked_by: [], depends_on: [], ...o });

test('stage state and wording', () => {
  assert.equal(stageState(S({ status: 'frozen' })), 'frozen');
  assert.equal(stageState(S({ blocked_by: ['Group'] })), 'waiting');
  assert.equal(stageState(S({})), 'empty');
  assert.equal(stageState(S({ match_count: 3, open_count: 1 })), 'ready');
  assert.equal(stageState(S({ match_count: 3, done: true })), 'done');
  assert.match(stageLine(S({ blocked_by: ['Group', 'Super 8'] })), /Waiting for: Group, Super 8/);
  assert.match(stageLine(S({ match_count: 4, open_count: 1 })), /1 of 4 matches still to play/);
  assert.match(stageLine(S({ match_count: 1 })), /All 1 match finished/);
  assert.match(stageLine(S({ status: 'frozen', freeze_reason: 'done' })), /locked.*done/);
});

test('freeze and reopen checks', () => {
  assert.equal(freezeProblem(S({ match_count: 2 })), null);
  assert.match(freezeProblem(S({ live_count: 1 })), /live/);
  assert.match(freezeProblem(S({ status: 'frozen' })), /Already/);
  const a = S({ id: 'a', status: 'frozen' }); const b = S({ id: 'b', status: 'frozen', depends_on: ['a'], name: 'Final' });
  assert.match(reopenProblem(a, [a, b], 'recount needed'), /Reopen Final first/);
  assert.match(reopenProblem(b, [a, b], 'x'), /reason/);
  assert.equal(reopenProblem(b, [a, b], 'scorer made a mistake'), null);
  assert.match(reopenProblem(S({}), [], 'long enough reason'), /not frozen/);
});

test('stage names', () => {
  assert.ok(stageNameProblem('a'));
  assert.ok(stageNameProblem('Group', [S({ id: '1', name: 'group' })]));
  assert.equal(stageNameProblem('Group', [S({ id: '1', name: 'group' })], '1'), null);
  assert.equal(stageNameProblem('Super 8', []), null);
});

test('dependency loops and layers', () => {
  const g = S({ id: 'g', name: 'Group' });
  const s8 = S({ id: 's', name: 'Super 8', depends_on: ['g'] });
  const f = S({ id: 'f', name: 'Final', depends_on: ['s'] });
  const all = [g, s8, f];
  assert.equal(wouldLoop(all, 'g', 'f'), true);
  assert.equal(wouldLoop(all, 'g', 's'), true);
  assert.equal(wouldLoop(all, 'f', 'g'), false);
  assert.equal(wouldLoop(all, 'g', 'g'), true);
  assert.deepEqual(stageLayers(all).map((l) => l.map((x) => x.name)), [['Group'], ['Super 8'], ['Final']]);
  const sf2 = S({ id: 'u', name: 'Plate', depends_on: ['g'] });
  assert.deepEqual(stageLayers([g, s8, sf2]).map((l) => l.length), [1, 2]);
  assert.deepEqual(toggleDependency(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleDependency(['a', 'b'], 'a'), ['b']);
});

test('pitch helpers', () => {
  assert.deepEqual(pitchChoices(null), []);
  const o = { ground_id: 'g', pitch_count: 3, pitch_no: 2, pitches: [{ pitch_no: 1, free: false }, { pitch_no: 2, free: true, selected: true }, { pitch_no: 3, free: true }] };
  const c = pitchChoices(o);
  assert.match(c[0].label, /busy/); assert.match(c[1].label, /this match/); assert.match(c[2].label, /free/);
  assert.equal(firstFreePitch(o), 3);
  assert.match(pitchSummary(o), /on pitch 2/);
  assert.match(pitchSummary(o), /1 other free/);
  assert.match(pitchSummary({ ground_id: 'g', pitch_count: 1 }), /one pitch/);
  assert.match(pitchSummary({ ground_id: null }), /Choose a ground/);
  assert.equal(firstFreePitch({ ground_id: 'g', pitches: [{ pitch_no: 1, free: false }] }), null);
});

test('server correction preview text', () => {
  const p = { lines: [{ label: 'Batter facing', from: 'Sahin', to: 'Habbu', effect: '4 runs and 1 ball faced move from Sahin to Habbu' }], note: 'Totals stay the same.' };
  assert.deepEqual(previewLinesFromServer(p), ['Batter facing: Sahin → Habbu. 4 runs and 1 ball faced move from Sahin to Habbu.']);
  assert.equal(previewNote(p), 'Totals stay the same.');
  assert.deepEqual(previewLinesFromServer(null), []);
  assert.equal(previewNote({}), '');
});

test('mid-over injury rule', () => {
  const keys = OVERRIDE_FIELDS.map((f) => f.key);
  assert.ok(keys.includes('mid_over_injury_replacement') && keys.includes('mid_over_injury_max'));
  assert.match(injuryRuleText({ mid_over_injury_replacement: false }), /Not allowed/);
  assert.equal(injuryRuleText({ mid_over_injury_replacement: true }), 'Allowed');
  assert.equal(injuryRuleText({ mid_over_injury_replacement: true, mid_over_injury_max: 2 }), 'Allowed, at most 2 per innings');
  const r = buildOverrideChanges({ mid_over_injury_replacement: true }, { mid_over_injury_replacement: false, mid_over_injury_max: '2' });
  assert.deepEqual(r.changes, { mid_over_injury_replacement: false, mid_over_injury_max: 2 });
  assert.ok(buildOverrideChanges({}, { mid_over_injury_max: '11' }).errors[0]);
});

import { phaseRunRate, phaseOversText, phaseLine, bestPhase } from '../src/views/matches/phaseView.js';
test('phase lines', () => {
  const pp = { key: 'powerplay', from_over: 1, to_over: 6, runs: 48, wickets: 3, legal_balls: 36, dots: 17, boundaries: 4 };
  const dd = { key: 'death', from_over: 17, to_over: 20, runs: 0, wickets: 0, legal_balls: 0, dots: 0, boundaries: 0 };
  assert.equal(phaseRunRate(pp), 8);
  assert.equal(phaseRunRate(dd), null);
  assert.equal(phaseOversText(pp), 'overs 1-6');
  assert.equal(phaseOversText({ from_over: 5, to_over: 5 }), 'over 5');
  assert.equal(phaseOversText({ from_over: 7, to_over: 6 }), 'none');
  assert.equal(phaseLine(pp), '48/3 · RR 8.00 · 17 dots · 4 boundaries');
  assert.equal(phaseLine(dd), 'Not reached');
  assert.equal(bestPhase([pp, dd]).key, 'powerplay');
  assert.equal(bestPhase([dd]), null);
  assert.equal(bestPhase([]), null);
});
