/** Pure helpers for Batch 18: invitations, squad checks, availability, lineup approval, clubs and challenges. */

export const INVITE_STATUS = {
  pending: { label: 'Waiting', color: '#b45309' },
  accepted: { label: 'Joined', color: '#15803d' },
  declined: { label: 'Declined', color: '#b91c1c' },
  cancelled: { label: 'Cancelled', color: '#64748b' }
};

export function inviteMessageProblem(text) {
  const t = String(text || '').trim();
  return t.length > 300 ? 'Keep the message under 300 characters.' : null;
}

/** #340 Colour and label for a squad player's check state. */
export const CHECK_STATE = {
  ok: { label: 'Eligible', color: '#15803d' },
  warn: { label: 'Check', color: '#b45309' },
  block: { label: 'Not eligible', color: '#b91c1c' }
};

export function eligibilitySummary(d) {
  if (!d) return '';
  const parts = [`${d.squad_size} in the squad`];
  if (!d.squad_big_enough) parts.push(`needs at least ${d.players_per_side} to field a side`);
  if (d.blocked > 0) parts.push(`${d.blocked} not eligible`);
  if (d.warnings > 0) parts.push(`${d.warnings} to check`);
  return parts.join(' · ');
}

export function rejectProblem(note) {
  return String(note || '').trim().length < 1 ? 'Give a reason when rejecting a player.' : null;
}

/** #342 Availability. */
export const AVAIL = {
  yes: { label: 'Available', color: '#15803d' },
  maybe: { label: 'Maybe', color: '#b45309' },
  no: { label: 'Not available', color: '#b91c1c' }
};

export function availabilityLine(t) {
  if (!t) return '';
  return `${t.yes} yes · ${t.maybe} maybe · ${t.no} no · ${t.waiting} waiting`;
}

/** #343 Lineup approval. */
export function approvalState(a) {
  if (!a || !a.has_lineup) return { key: 'none', label: 'No lineup yet', color: '#64748b' };
  if (!a.status) return { key: 'unsent', label: 'Not sent to the captain', color: '#64748b' };
  if (a.stale) return { key: 'stale', label: 'Lineup changed after sending', color: '#b45309' };
  if (a.status === 'approved') return { key: 'approved', label: 'Approved by the captain', color: '#15803d' };
  if (a.status === 'changes_requested') return { key: 'changes', label: 'Captain asked for changes', color: '#b91c1c' };
  return { key: 'pending', label: 'Waiting for the captain', color: '#b45309' };
}

export function decideProblem(approve, note) {
  if (approve) return null;
  return String(note || '').trim().length < 3 ? 'Say what should change (at least 3 characters).' : null;
}

/** #344 Clubs. */
export function clubNameProblem(name) {
  const t = String(name || '').trim();
  return t.length < 2 || t.length > 60 ? 'Give the club a name of 2 to 60 characters.' : null;
}

export function levelLabel(level) {
  return level ? (level === 1 ? '1st team' : `Level ${level}`) : 'No level';
}

/** Group a club's players by team, top team first. */
export function playersByTeam(club) {
  if (!club) return [];
  return (club.teams || []).map((t) => ({ ...t, players: (club.players || []).filter((p) => p.team_id === t.id) }));
}

/** #367 Challenges. */
export const CHALLENGE_STATUS = {
  pending: { label: 'Waiting', color: '#b45309' },
  accepted: { label: 'Accepted', color: '#15803d' },
  declined: { label: 'Declined', color: '#b91c1c' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
  expired: { label: 'Expired', color: '#64748b' }
};

export function challengeProblem({ fromTeamId, toTeamId, proposedAt, overs, playersPerSide, now = new Date() }) {
  if (!fromTeamId) return 'Choose your team.';
  if (!toTeamId) return 'Choose the team you are challenging.';
  if (fromTeamId === toTeamId) return 'Choose two different teams.';
  if (!proposedAt || Number.isNaN(new Date(proposedAt).getTime())) return 'Choose a date and time.';
  if (new Date(proposedAt) <= now) return 'Choose a date and time in the future.';
  const o = Number(overs);
  if (!Number.isInteger(o) || o < 1 || o > 100) return 'Overs must be between 1 and 100.';
  const p = Number(playersPerSide);
  if (!Number.isInteger(p) || p < 2 || p > 15) return 'Players a side must be between 2 and 15.';
  return null;
}
