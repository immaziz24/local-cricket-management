// Batch 12: officials acceptance, scorer handover, ground conflicts, inspection checklist helpers
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDecline, acceptanceSummary, validateHandoverRequest, handoverNextStep, HANDOVER_STATUS, ACCEPTANCE_STATUS, conflictLine } from '../src/views/officials/officialsExtra.js';
import { summarizeConflicts, groupChecklist, validateChecklist, buildChecklistReport, checklistSummary, localToIso, conflictPairLine } from '../src/views/grounds/groundConflicts.js';

const TEMPLATE = [
  ...['pitch_dry', 'creases_marked', 'stumps_bails'].map((key) => ({ key, group: 'pitch', label: key, critical: false })),
  { key: 'pitch_no_cracks', group: 'pitch', label: 'No dangerous cracks', critical: true },
  { key: 'outfield_even', group: 'outfield', label: 'Outfield even', critical: true },
  ...['grass_cut', 'boundary_marked'].map((key) => ({ key, group: 'outfield', label: key, critical: false })),
  ...['drinking_water', 'toilets', 'changing_room', 'scoring_area'].map((key) => ({ key, group: 'facilities', label: key, critical: false })),
  { key: 'first_aid', group: 'safety', label: 'First-aid kit', critical: true },
  { key: 'emergency_access', group: 'safety', label: 'Ambulance access', critical: false },
];
const all = (v) => Object.fromEntries(TEMPLATE.map((t) => [t.key, { ok: v }]));

test('decline reason is optional and capped', () => {
  assert.equal(validateDecline(''), null);
  assert.equal(validateDecline('Already at another match'), null);
  assert.match(validateDecline('x'.repeat(301)), /300/);
});

test('acceptance summary tells the manager who is missing and who clashes', () => {
  assert.equal(acceptanceSummary([{ status: 'accepted', conflicts: [] }]), 'Everyone has answered.');
  assert.equal(acceptanceSummary([{ status: 'invited', conflicts: [] }, { status: 'accepted', conflicts: [{}] }, { status: 'declined', conflicts: [{}] }]),
    '1 still to answer. 1 has another match at about the same time.');
  assert.equal(acceptanceSummary([]), 'Everyone has answered.');
});

test('handover request needs a person and a reason', () => {
  assert.match(validateHandoverRequest({ reason: 'Need to leave early' }), /new scorer/);
  assert.match(validateHandoverRequest({ toUser: 'u', reason: 'no' }), /at least 5/);
  assert.match(validateHandoverRequest({ toUser: 'u', reason: 'x'.repeat(301) }), /300/);
  assert.equal(validateHandoverRequest({ toUser: 'u', reason: 'Need to leave early' }), null);
});

test('handover next step reads right for each person', () => {
  assert.match(handoverNextStep({ status: 'requested', can_decide: true }), /Approve or reject/);
  assert.match(handoverNextStep({ status: 'requested' }), /organiser must approve/);
  assert.match(handoverNextStep({ status: 'authorised', can_respond: true }), /Accept to take over/);
  assert.match(handoverNextStep({ status: 'authorised', to_name: 'Asha' }), /Asha must accept/);
  assert.match(handoverNextStep({ status: 'completed', snapshot: { innings_no: 1, runs: 54, wickets: 2, overs: '7.3' } }), /innings 1 at 54\/2 after 7\.3 overs/);
  assert.equal(handoverNextStep({ status: 'cancelled' }), '');
  for (const s of ['requested', 'authorised', 'completed', 'rejected', 'declined', 'cancelled']) assert.ok(HANDOVER_STATUS[s].label);
  for (const s of ['invited', 'accepted', 'declined', 'cancelled']) assert.ok(ACCEPTANCE_STATUS[s].label);
  assert.match(conflictLine({ teams: 'A vs B', scheduled_at: '2026-11-16T12:40:00Z' }), /A vs B/);
});

test('ground conflict levels', () => {
  assert.equal(summarizeConflicts({ hard: [], soft: [], outside_hours: false }).level, 'ok');
  assert.equal(summarizeConflicts({ hard: [], soft: [{ label: 'Another request is waiting for this time', starts_at: '2026-11-20T04:00:00Z', ends_at: '2026-11-20T06:00:00Z' }] }).level, 'warn');
  const b = summarizeConflicts({ hard: [{ label: 'Already booked', starts_at: '2026-11-20T04:00:00Z', ends_at: '2026-11-20T06:00:00Z' }], soft: [], outside_hours: true, open_time: '06:00:00', close_time: '20:00:00' });
  assert.equal(b.level, 'blocked'); assert.equal(b.lines.length, 2); assert.match(b.lines[1], /06:00 to 20:00/);
  assert.equal(summarizeConflicts(null).level, 'unknown');
  assert.match(conflictPairLine({ a: 'Booking', b: 'Match', b_starts: '2026-11-20T04:00:00Z', b_ends: '2026-11-20T08:00:00Z' }), /Booking and Match overlap/);
});

test('time boxes convert to India time', () => {
  assert.equal(localToIso('2026-11-20T10:00'), '2026-11-20T04:30:00.000Z');
  assert.equal(localToIso(''), null);
  assert.equal(localToIso('nonsense'), null);
});

test('checklist groups follow the database order', () => {
  assert.deepEqual(groupChecklist(TEMPLATE).map((g) => g.key), ['pitch', 'outfield', 'facilities', 'safety']);
  assert.deepEqual(groupChecklist([]), []);
});

test('checklist rules match the database', () => {
  assert.equal(validateChecklist(TEMPLATE, all('true')).errors.length, 0);
  assert.equal(validateChecklist(TEMPLATE, all('true')).fit, true);
  const few = validateChecklist(TEMPLATE, { toilets: { ok: 'true' } });
  assert.match(few.errors[0], /Answer at least 8 of the 13/);
  const noNote = validateChecklist(TEMPLATE, { ...all('true'), first_aid: { ok: 'false' } });
  assert.match(noNote.errors[0], /Say what is wrong with: First-aid kit/);
  const withNote = validateChecklist(TEMPLATE, { ...all('true'), first_aid: { ok: 'false', note: 'No kit on site' } });
  assert.equal(withNote.errors.length, 0); assert.equal(withNote.fit, false); assert.deepEqual(withNote.failedCritical, ['First-aid kit']);
  const nonCritical = validateChecklist(TEMPLATE, { ...all('true'), toilets: { ok: 'false' } });
  assert.equal(nonCritical.fit, true); assert.equal(nonCritical.errors.length, 0);
  assert.equal(validateChecklist(TEMPLATE, { ...all('na') }).answered, 0);
});

test('checklist report drops blanks and keeps notes', () => {
  const r = buildChecklistReport({ toilets: { ok: 'true', note: ' fine ' }, grass_cut: { ok: '' }, x: null }, { notes: 'n', matchId: 'm1' });
  assert.deepEqual(r.checklist, { toilets: { ok: 'true', note: 'fine' } });
  assert.equal(r.match_id, 'm1');
  assert.equal(checklistSummary({ checklist_total: 16, checklist_pass: 15, critical_failed: ['First-aid kit'] }), '15 of 16 checks passed. Must fix: First-aid kit');
  assert.equal(checklistSummary({ checklist_total: null }), null);
});
