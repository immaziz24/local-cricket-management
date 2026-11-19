// Batch 13 (#398 #399 #400): pure helpers for the penalty preview, history and arrival disputes.

export const EVENT_LABEL = {
  proposed: 'Proposed',
  auto_proposed: 'Proposed automatically at check-in',
  approved: 'Approved',
  rejected: 'Rejected',
  waived: 'Waived',
  appealed: 'Appealed',
  appeal_turned_down: 'Appeal turned down',
  rolled_back: 'Rolled back',
  adjusted: 'Adjusted after an arrival correction',
  fine_set: 'Fine changed',
  fine_paid: 'Fine marked paid',
  fine_unpaid: 'Fine marked unpaid'
};

export const DISPUTE_STATUS = {
  open: { label: 'Open', color: '#b45309' },
  accepted: { label: 'Accepted', color: '#15803d' },
  rejected: { label: 'Rejected', color: '#b91c1c' },
  withdrawn: { label: 'Withdrawn', color: '#64748b' }
};

export const EVIDENCE_KIND = {
  photo_link: 'Photo link',
  video_link: 'Video link',
  message: 'Message / chat',
  witness: 'Witness',
  other: 'Other'
};

export const SIDE_LABEL = { late_team: 'Late team', other_team: 'Other team', official: 'Official' };

/** One line for the history timeline. */
export function eventLine(e) {
  const what = EVENT_LABEL[e.action] || e.action;
  const who = e.by ? ` by ${e.by}` : '';
  const team = e.team ? `${e.team}: ` : '';
  const detail = e.minutes_late != null && ['proposed', 'auto_proposed', 'adjusted'].includes(e.action) ? ` (${e.minutes_late} min late, value ${e.value})` : '';
  return `${team}${what}${detail}${who}`;
}

/** What the preview changed. before/after are the snapshots returned by simulate_late_penalty. */
export function simulationLines(res) {
  if (!res) return [];
  if (res.ok === false || res.no_penalty) return [res.message || 'Nothing to preview.'];
  const lines = [];
  const b = res.before || {};
  const a = res.after || {};
  const bi = b.innings || [];
  const ai = a.innings || [];
  ai.forEach((inn, idx) => {
    const old = bi[idx] || {};
    const name = inn.team || `Innings ${inn.innings_no}`;
    if (inn.penalty_runs !== old.penalty_runs) lines.push(`${name}: penalty runs ${old.penalty_runs ?? 0} → ${inn.penalty_runs ?? 0}`);
    if (inn.overs_limit !== old.overs_limit) lines.push(`${name}: overs limit ${old.overs_limit ?? '-'} → ${inn.overs_limit ?? '-'}`);
    if (inn.target !== old.target) lines.push(`${name}: target ${old.target ?? '-'} → ${inn.target ?? '-'}`);
    if (inn.runs !== old.runs) lines.push(`${name}: score ${old.runs ?? 0} → ${inn.runs ?? 0}`);
  });
  const bl = JSON.stringify(b.late_effects || {});
  const al = JSON.stringify(a.late_effects || {});
  if (bl !== al) {
    const le = a.late_effects || {};
    if (le.overs_cut != null) lines.push(`Overs cut for the late team: ${(b.late_effects || {}).overs_cut ?? 0} → ${le.overs_cut}`);
    if (le.field_restriction != null) lines.push('A fielding restriction will apply to the late team.');
  }
  if (JSON.stringify(b.pending_penalty || null) !== JSON.stringify(a.pending_penalty || null)) lines.push('The penalty is kept ready and will be added when the innings starts.');
  if (res.active_penalty_exists) lines.push('Note: this team already has an active penalty for this match.');
  if (lines.length === 0) lines.push(`No innings has started yet. The ${res.value} ${res.method === 'penalty_runs' ? 'penalty runs' : res.method === 'overs_deduction' ? 'over(s) cut' : 'over(s) of fielding restriction'} will apply once approved.`);
  lines.push('This was only a preview. Nothing has been changed.');
  return lines;
}

export function validateRollback(reason) {
  const r = String(reason || '').trim();
  if (r.length < 5) return 'Give the reason for the rollback (at least 5 characters).';
  if (r.length > 1000) return 'The reason can be at most 1000 characters.';
  return null;
}

export function validateMinutes(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 600 || !Number.isInteger(n)) return 'Minutes late must be a whole number from 0 to 600.';
  return null;
}

export function validateDispute({ claimedAt, recordedAt, reason }) {
  if (!claimedAt) return 'Enter the time you really arrived.';
  const c = new Date(claimedAt).getTime();
  if (!Number.isFinite(c)) return 'That time is not valid.';
  if (recordedAt && c >= new Date(recordedAt).getTime()) return 'The time you claim must be earlier than the recorded arrival.';
  const r = String(reason || '').trim();
  if (r.length < 5) return 'Say why the recorded time is wrong (at least 5 characters).';
  if (r.length > 1000) return 'The reason can be at most 1000 characters.';
  return null;
}

export function validateEvidence({ kind, url, statement }) {
  if (!EVIDENCE_KIND[kind]) return 'Choose the type of evidence.';
  const u = String(url || '').trim();
  const s = String(statement || '').trim();
  if (!u && s.length < 3) return 'Add a link or write a statement.';
  if (u && !/^https?:\/\//i.test(u)) return 'Links must start with http:// or https://.';
  if (u.length > 500) return 'The link is too long.';
  if (s.length > 1000) return 'The statement can be at most 1000 characters.';
  return null;
}

export function validateDisputeDecision(note, accept, evidenceCount) {
  const n = String(note || '').trim();
  if (n.length < 5) return 'Write the reason for your decision (at least 5 characters).';
  if (n.length > 1000) return 'The reason can be at most 1000 characters.';
  if (accept && !evidenceCount) return 'Ask the team for at least one piece of evidence before accepting.';
  return null;
}

/** Evidence the late team has given, counted for the accept button. */
export function lateTeamEvidenceCount(dispute) {
  return (dispute?.evidence || []).filter((e) => e.side === 'late_team').length;
}

export function disputesSummary(items) {
  const open = (items || []).filter((d) => d.status === 'open').length;
  if (!items || items.length === 0) return 'No arrival disputes.';
  return open ? `${open} open dispute${open === 1 ? '' : 's'} waiting for a decision.` : 'All disputes are decided.';
}

/** datetime-local value (no zone, local time) to an ISO string. */
export function localInputToIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
