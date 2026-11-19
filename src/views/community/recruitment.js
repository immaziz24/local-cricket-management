// Batch 13 (#368 #370): pure helpers for player recruitment and community moderation.

export const ROLE_OPTIONS = ['batter', 'bowler', 'all-rounder', 'wicket-keeper', 'opener', 'spinner', 'fast bowler'];
export const LEVELS = [['any', 'Any level'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];

export const APPLICATION_STATUS = {
  applied: { label: 'Applied', color: '#475569' },
  shortlisted: { label: 'Shortlisted', color: '#7c3aed' },
  accepted: { label: 'Accepted', color: '#15803d' },
  declined: { label: 'Declined', color: '#b91c1c' },
  withdrawn: { label: 'Withdrawn', color: '#94a3b8' }
};

export const REPORT_REASONS = [
  ['spam', 'Spam or advert'],
  ['scam', 'Looks like a scam'],
  ['offensive', 'Offensive or abusive'],
  ['wrong_info', 'Wrong or misleading'],
  ['duplicate', 'Duplicate'],
  ['other', 'Something else']
];
export const REASON_LABEL = Object.fromEntries(REPORT_REASONS);

export function validateRecruitPost({ title, slots, roles }) {
  const t = String(title || '').trim();
  if (t.length < 3) return 'Enter a title (at least 3 characters).';
  if (t.length > 120) return 'The title can be at most 120 characters.';
  const n = Number(slots);
  if (!Number.isInteger(n) || n < 1 || n > 30) return 'Say how many players you need (1 to 30).';
  if ((roles || []).length > 6) return 'Choose up to 6 roles.';
  return null;
}

export function slotsText(p) {
  const left = Math.max((p.slots || 0) - (p.filled || 0), 0);
  if (left === 0) return 'All places filled';
  return `${left} of ${p.slots} place${p.slots === 1 ? '' : 's'} open`;
}

export function applicationSummary(items) {
  const c = { applied: 0, shortlisted: 0, accepted: 0, declined: 0, withdrawn: 0 };
  (items || []).forEach((a) => { if (c[a.status] != null) c[a.status] += 1; });
  if (!items || items.length === 0) return 'No applications yet.';
  const parts = [];
  if (c.applied) parts.push(`${c.applied} new`);
  if (c.shortlisted) parts.push(`${c.shortlisted} shortlisted`);
  if (c.accepted) parts.push(`${c.accepted} accepted`);
  if (c.declined) parts.push(`${c.declined} declined`);
  if (c.withdrawn) parts.push(`${c.withdrawn} withdrawn`);
  return parts.join(', ') + '.';
}

/** Buttons the post owner should see for an application. */
export function applicationActions(a, post) {
  if (!a) return [];
  if (['withdrawn', 'declined'].includes(a.status)) return [];
  if (a.status === 'accepted') return ['decline'];
  const full = post && (post.filled || 0) >= (post.slots || 0);
  const out = [];
  if (a.status === 'applied') out.push('shortlist');
  if (!full) out.push('accept');
  out.push('decline');
  return out;
}

export function validateApplication(message) {
  if (String(message || '').length > 500) return 'The message can be at most 500 characters.';
  return null;
}

export function validateReport(reason, details) {
  if (!REASON_LABEL[reason]) return 'Choose a reason.';
  if (String(details || '').length > 500) return 'Details can be at most 500 characters.';
  return null;
}

export function validateModeration(action, note) {
  if (!['hide', 'restore', 'dismiss'].includes(action)) return 'Unknown action.';
  const n = String(note || '').trim();
  if (action === 'hide' && n.length < 3) return 'Give a reason for hiding it. The owner will see it.';
  if (n.length > 500) return 'The note can be at most 500 characters.';
  return null;
}

export function reasonList(reasons) {
  return (reasons || []).map((r) => REASON_LABEL[r] || r).join(', ');
}

export function moderationLine(item) {
  const n = item.reports || 0;
  return `${n} report${n === 1 ? '' : 's'}: ${reasonList(item.reasons)}${item.hidden ? ' · hidden now' : ''}`;
}
