// Batch 13: late penalty preview / history / arrival disputes, player recruitment, community moderation helpers
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventLine, simulationLines, validateRollback, validateMinutes, validateDispute, validateEvidence, validateDisputeDecision,
  lateTeamEvidenceCount, disputesSummary, localInputToIso
} from '../src/views/punctuality/latePenaltyExtras.js';
import {
  validateRecruitPost, slotsText, applicationSummary, applicationActions, validateApplication, validateReport, validateModeration, moderationLine, reasonList
} from '../src/views/community/recruitment.js';

test('history lines name the team, the action and who did it', () => {
  assert.equal(eventLine({ team: 'Tigers', action: 'auto_proposed', minutes_late: 25, value: 10, by: 'Ravi' }), 'Tigers: Proposed automatically at check-in (25 min late, value 10) by Ravi');
  assert.equal(eventLine({ team: 'Tigers', action: 'rolled_back', by: 'Asha' }), 'Tigers: Rolled back by Asha');
  assert.equal(eventLine({ action: 'something_new' }), 'something_new');
});

test('preview lists exactly what changes and says nothing was changed', () => {
  const res = {
    ok: true, method: 'penalty_runs', value: 10, minutes: 25,
    before: { innings: [{ innings_no: 1, team: 'Lions', runs: 40, penalty_runs: 0, overs_limit: 4, target: null }], late_effects: {} },
    after: { innings: [{ innings_no: 1, team: 'Lions', runs: 50, penalty_runs: 10, overs_limit: 4, target: null }], late_effects: {} }
  };
  const lines = simulationLines(res);
  assert.ok(lines.includes('Lions: penalty runs 0 → 10'));
  assert.ok(lines.includes('Lions: score 40 → 50'));
  assert.equal(lines.at(-1), 'This was only a preview. Nothing has been changed.');
});

test('preview before any innings explains when the penalty will apply', () => {
  const lines = simulationLines({ ok: true, method: 'overs_deduction', value: 2, before: { innings: [] }, after: { innings: [] } });
  assert.match(lines[0], /No innings has started yet.*2 over\(s\) cut/);
});

test('preview shows overs cut, fielding restriction and an existing active penalty', () => {
  const lines = simulationLines({
    ok: true, method: 'overs_deduction', value: 1, active_penalty_exists: true,
    before: { innings: [{ innings_no: 1, team: 'A', overs_limit: 4 }], late_effects: {} },
    after: { innings: [{ innings_no: 1, team: 'A', overs_limit: 3 }], late_effects: { overs_cut: 1, field_restriction: 2 } }
  });
  assert.ok(lines.includes('A: overs limit 4 → 3'));
  assert.ok(lines.includes('Overs cut for the late team: 0 → 1'));
  assert.ok(lines.includes('A fielding restriction will apply to the late team.'));
  assert.ok(lines.some((l) => /already has an active penalty/.test(l)));
});

test('preview passes server messages through when there is nothing to preview', () => {
  assert.deepEqual(simulationLines({ ok: false, message: 'This match has no late-arrival penalty set in its playing conditions.' }), ['This match has no late-arrival penalty set in its playing conditions.']);
  assert.deepEqual(simulationLines({ ok: true, no_penalty: true, message: 'At 3 minutes late, the rules give no penalty.' }), ['At 3 minutes late, the rules give no penalty.']);
  assert.deepEqual(simulationLines(null), []);
});

test('rollback needs a real reason and minutes must be a whole number in range', () => {
  assert.match(validateRollback('no'), /at least 5/);
  assert.equal(validateRollback('Wrong team charged'), null);
  assert.match(validateRollback('x'.repeat(1001)), /1000/);
  assert.equal(validateMinutes(''), null);
  assert.equal(validateMinutes('25'), null);
  assert.match(validateMinutes('-1'), /0 to 600/);
  assert.match(validateMinutes('601'), /0 to 600/);
  assert.match(validateMinutes('2.5'), /whole number/);
});

test('a dispute must claim an earlier time and give a reason', () => {
  const rec = '2026-11-16T12:30:00.000Z';
  assert.match(validateDispute({ claimedAt: '', recordedAt: rec, reason: 'at the gate' }), /Enter the time/);
  assert.match(validateDispute({ claimedAt: '2026-11-16T12:40:00.000Z', recordedAt: rec, reason: 'at the gate' }), /earlier than the recorded/);
  assert.match(validateDispute({ claimedAt: '2026-11-16T12:10:00.000Z', recordedAt: rec, reason: 'no' }), /at least 5/);
  assert.equal(validateDispute({ claimedAt: '2026-11-16T12:10:00.000Z', recordedAt: rec, reason: 'We were at the gate' }), null);
});

test('evidence needs a type and a link or a statement; links must be http(s)', () => {
  assert.match(validateEvidence({ kind: 'bad', url: 'https://a.b', statement: '' }), /type of evidence/);
  assert.match(validateEvidence({ kind: 'photo_link', url: '', statement: 'x' }), /link or write/);
  assert.match(validateEvidence({ kind: 'photo_link', url: 'ftp://x', statement: '' }), /http/);
  assert.equal(validateEvidence({ kind: 'photo_link', url: 'https://example.com/a.jpg', statement: '' }), null);
  assert.equal(validateEvidence({ kind: 'witness', url: '', statement: 'Groundsman saw us' }), null);
});

test('the organiser cannot accept a dispute until the late team has given evidence', () => {
  assert.match(validateDisputeDecision('Photo is credible', true, 0), /at least one piece of evidence/);
  assert.equal(validateDisputeDecision('Photo is credible', true, 1), null);
  assert.equal(validateDisputeDecision('Not convincing', false, 0), null);
  assert.match(validateDisputeDecision('ok', false, 0), /at least 5/);
  assert.equal(lateTeamEvidenceCount({ evidence: [{ side: 'other_team' }, { side: 'late_team' }, { side: 'late_team' }] }), 2);
  assert.equal(lateTeamEvidenceCount({}), 0);
});

test('dispute summary counts the open ones', () => {
  assert.equal(disputesSummary([]), 'No arrival disputes.');
  assert.equal(disputesSummary([{ status: 'open' }, { status: 'accepted' }]), '1 open dispute waiting for a decision.');
  assert.equal(disputesSummary([{ status: 'open' }, { status: 'open' }]), '2 open disputes waiting for a decision.');
  assert.equal(disputesSummary([{ status: 'rejected' }]), 'All disputes are decided.');
  assert.equal(localInputToIso(''), null);
  assert.equal(localInputToIso('garbage'), null);
  assert.match(localInputToIso('2026-11-16T18:00'), /^2026-11-16T\d\d:\d\d:00\.000Z$/);
});

test('recruitment post needs a title, 1 to 30 places and at most 6 roles', () => {
  assert.match(validateRecruitPost({ title: 'ab', slots: 2 }), /title/);
  assert.match(validateRecruitPost({ title: 'Need bowlers', slots: 0 }), /1 to 30/);
  assert.match(validateRecruitPost({ title: 'Need bowlers', slots: 31 }), /1 to 30/);
  assert.match(validateRecruitPost({ title: 'Need bowlers', slots: 2.5 }), /1 to 30/);
  assert.match(validateRecruitPost({ title: 'Need bowlers', slots: 2, roles: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }), /up to 6/);
  assert.equal(validateRecruitPost({ title: 'Need bowlers', slots: 2, roles: ['bowler'] }), null);
});

test('places text and application summary read clearly', () => {
  assert.equal(slotsText({ slots: 3, filled: 1 }), '2 of 3 places open');
  assert.equal(slotsText({ slots: 1, filled: 0 }), '1 of 1 place open');
  assert.equal(slotsText({ slots: 2, filled: 2 }), 'All places filled');
  assert.equal(applicationSummary([]), 'No applications yet.');
  assert.equal(applicationSummary([{ status: 'applied' }, { status: 'applied' }, { status: 'accepted' }, { status: 'declined' }]), '2 new, 1 accepted, 1 declined.');
});

test('the owner only sees buttons that make sense for the application', () => {
  const open = { slots: 2, filled: 0 };
  const full = { slots: 2, filled: 2 };
  assert.deepEqual(applicationActions({ status: 'applied' }, open), ['shortlist', 'accept', 'decline']);
  assert.deepEqual(applicationActions({ status: 'shortlisted' }, open), ['accept', 'decline']);
  assert.deepEqual(applicationActions({ status: 'applied' }, full), ['shortlist', 'decline']);
  assert.deepEqual(applicationActions({ status: 'accepted' }, full), ['decline']);
  assert.deepEqual(applicationActions({ status: 'declined' }, open), []);
  assert.deepEqual(applicationActions({ status: 'withdrawn' }, open), []);
  assert.deepEqual(applicationActions(null, open), []);
});

test('application message and report fields are checked', () => {
  assert.equal(validateApplication('I bowl fast'), null);
  assert.match(validateApplication('x'.repeat(501)), /500/);
  assert.match(validateReport('nonsense', ''), /reason/);
  assert.match(validateReport('spam', 'x'.repeat(501)), /500/);
  assert.equal(validateReport('scam', 'looks fake'), null);
});

test('moderation: hiding needs a reason, the others do not', () => {
  assert.match(validateModeration('hide', ''), /reason for hiding/);
  assert.equal(validateModeration('hide', 'Spam advert'), null);
  assert.equal(validateModeration('restore', ''), null);
  assert.equal(validateModeration('dismiss', ''), null);
  assert.match(validateModeration('delete', 'x'), /Unknown/);
  assert.match(validateModeration('dismiss', 'x'.repeat(501)), /500/);
});

test('moderation line names the reasons and whether the item is hidden now', () => {
  assert.equal(reasonList(['spam', 'scam', 'mystery']), 'Spam or advert, Looks like a scam, mystery');
  assert.equal(moderationLine({ reports: 3, reasons: ['spam'], hidden: true }), '3 reports: Spam or advert · hidden now');
  assert.equal(moderationLine({ reports: 1, reasons: ['other'], hidden: false }), '1 report: Something else');
});
