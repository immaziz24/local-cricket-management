/** #341 Team membership history helpers (dates a player was in a team). Pure functions. */

/** Checks corrected dates the same way the database does, so mistakes show before saving. Dates are ISO strings or Date-parsable values. */
export function validateMembershipDates({ joined, left, isCurrent, others = [], now = Date.now() }) {
  const j = joined ? new Date(joined).getTime() : NaN;
  const l = left ? new Date(left).getTime() : null;
  if (Number.isNaN(j)) return 'Enter the date the player joined.';
  if (j > now) return 'The joining date must be in the past.';
  if (isCurrent && l !== null) return 'The player is still in the squad. Remove the player from the team to set a leaving date.';
  if (!isCurrent && l === null) return 'A past membership needs a leaving date.';
  if (l !== null && Number.isNaN(l)) return 'Enter a valid leaving date.';
  if (l !== null && l < j) return 'The leaving date cannot be before the joining date.';
  const end = l ?? Infinity;
  for (const o of others) {
    const oj = new Date(o.joined_at).getTime();
    const ol = o.left_at ? new Date(o.left_at).getTime() : Infinity;
    if (oj < end && ol > j) return 'These dates overlap another time this player was in the same team.';
  }
  return null;
}

/** "Mar 2025 - now", "Jan 2024 - Mar 2025" */
export function spellLabel(h) {
  const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return `${fmt(h.joined_at)} - ${h.left_at ? fmt(h.left_at) : 'now'}`;
}
