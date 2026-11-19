// #380 Plain rules for the match recap approval screen (kept free of React so they can be tested).
export const RECAP_STATUS = { pending: 'Waiting for approval', approved: 'Approved and published', rejected: 'Rejected', superseded: 'Replaced by a newer draft' };

export function recapStatusLabel(r) {
  if (!r) return '';
  const base = RECAP_STATUS[r.status] || r.status;
  return r.status === 'approved' && r.edited ? `${base} (edited by a person first)` : base;
}

/** The label readers see on the published report. */
export function recapCredit(edited) {
  return edited ? 'Drafted automatically from the scorecard, edited and approved by a match official.'
    : 'Drafted automatically from the scorecard and approved by a match official.';
}

export function recapRejectProblem(reason) {
  return String(reason || '').trim().length < 5 ? 'Tell us why (at least 5 characters).' : null;
}

export function recapEditProblem(title, body) {
  if (String(title || '').trim().length < 5) return 'Write a headline (at least 5 characters).';
  const n = String(body || '').trim().length;
  if (n < 20 || n > 20000) return 'The recap must be 20 to 20,000 characters.';
  return null;
}

export function recapIsChanged(r, title, body) {
  return !!r && (String(title).trim() !== r.drafted_title || String(body).trim() !== r.drafted_body);
}

export function pendingRecap(list) { return (list || []).find((r) => r.status === 'pending') || null; }
