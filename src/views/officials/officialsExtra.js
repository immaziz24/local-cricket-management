// Batch 12: #361 digital acceptance and #363 scorer handover helpers (screen wording and checks).

const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');
export const formatStamp = stamp;

export const ACCEPTANCE_STATUS = {
  invited: { label: 'Waiting for an answer', color: '#b45309' },
  accepted: { label: 'Accepted', color: '#15803d' },
  declined: { label: 'Declined', color: '#b91c1c' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
};

export const HANDOVER_STATUS = {
  requested: { label: 'Waiting for the organiser', color: '#b45309' },
  authorised: { label: 'Approved, waiting for the new scorer', color: '#1d4ed8' },
  completed: { label: 'Done', color: '#15803d' },
  rejected: { label: 'Rejected by the organiser', color: '#b91c1c' },
  declined: { label: 'Declined by the new scorer', color: '#b91c1c' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
};

/** A decline reason is optional but limited to 300 characters. */
export function validateDecline(reason) {
  return String(reason || '').trim().length > 300 ? 'The reason can be at most 300 characters.' : null;
}

export function conflictLine(c) {
  return `${c.teams} (${stamp(c.scheduled_at)})`;
}

/** One sentence for the manager: who has not answered yet and who has a clash. */
export function acceptanceSummary(items = []) {
  const active = items.filter((i) => i.status === 'invited' || i.status === 'accepted');
  const waiting = active.filter((i) => i.status === 'invited').length;
  const clashes = active.filter((i) => (i.conflicts || []).length > 0).length;
  const parts = [];
  parts.push(waiting === 0 ? 'Everyone has answered.' : `${waiting} still to answer.`);
  if (clashes) parts.push(`${clashes} ${clashes === 1 ? 'has' : 'have'} another match at about the same time.`);
  return parts.join(' ');
}

export function validateHandoverRequest({ toUser, reason } = {}) {
  if (!toUser) return 'Choose the new scorer.';
  const r = String(reason || '').trim();
  if (r.length < 5) return 'Give a reason (at least 5 characters).';
  if (r.length > 300) return 'The reason can be at most 300 characters.';
  return null;
}

/** Plain next step for whoever is looking at this handover. */
export function handoverNextStep(h) {
  if (h.status === 'requested') return h.can_decide ? 'Approve or reject this handover.' : 'The organiser must approve first.';
  if (h.status === 'authorised') return h.can_respond ? 'Accept to take over scoring.' : `${h.to_name || 'The new scorer'} must accept.`;
  if (h.status === 'completed' && h.snapshot && h.snapshot.innings_no) return `Handed over in innings ${h.snapshot.innings_no} at ${h.snapshot.runs}/${h.snapshot.wickets} after ${h.snapshot.overs} overs.`;
  return '';
}
