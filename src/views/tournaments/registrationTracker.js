/**
 * #334 Public registration status tracker. Pure function.
 * tournament { registration_open, teams_count, status }; registrations [{ status: 'approved'|'pending'|'rejected'|... }]
 */
export function registrationTracker(tournament, registrations = []) {
  const count = (s) => registrations.filter((r) => r.status === s).length;
  const approved = count('approved'); const pending = count('pending'); const rejected = count('rejected');
  const capacity = Number(tournament?.teams_count) || 0;
  const open = tournament?.registration_open !== false && ['registration', 'upcoming'].includes(tournament?.status);
  const full = capacity > 0 && approved >= capacity;
  const spots = capacity > 0 ? Math.max(0, capacity - approved) : null;
  let label; let tone;
  if (!open) { label = 'Registration closed'; tone = 'closed'; }
  else if (full) { label = 'Full - registration open for waiting list only'; tone = 'full'; }
  else if (spots !== null && spots <= 2) { label = `Almost full - ${spots} spot${spots === 1 ? '' : 's'} left`; tone = 'almost'; }
  else { label = spots === null ? 'Registration open' : `Registration open - ${spots} spots left`; tone = 'open'; }
  return { open, full, approved, pending, rejected, capacity, spots, label, tone,
    percent: capacity > 0 ? Math.min(100, Math.round((approved / capacity) * 100)) : null };
}
