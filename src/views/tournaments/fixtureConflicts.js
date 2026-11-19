/**
 * Fixture conflict detection (#331) and rest constraints (#332). Pure functions.
 * matches: [{ id, team_a_id, team_b_id, scheduled_at, venue, status, team_a?:{name}, team_b?:{name} }]
 * Finds: a team in two matches at overlapping times, one ground used by two matches at overlapping times,
 * and a team given less than the minimum rest between matches. Cancelled matches and matches with no date are ignored.
 */
const HOUR = 3600000;

const live = (matches) => (matches || []).filter((m) => m && m.scheduled_at && m.status !== 'cancelled' && !Number.isNaN(new Date(m.scheduled_at).getTime()));
const norm = (v) => String(v || '').trim().toLowerCase();

/**
 * @param matchHours  how long a match is expected to take (default 4h) - two matches closer than this overlap
 * @param minRestHours minimum rest for a team between the start of one match and the next (0 = off)
 * @returns [{ type: 'team_clash'|'ground_clash'|'rest', matchIds:[a,b], teamId?, venue?, text }]
 */
export function fixtureConflicts(matches, { matchHours = 4, minRestHours = 0 } = {}) {
  const list = live(matches).map((m) => ({ ...m, t: new Date(m.scheduled_at).getTime() })).sort((a, b) => a.t - b.t);
  const out = [];
  const name = (m, side) => m[side]?.name || 'TBD';
  const label = (m) => `${name(m, 'team_a')} vs ${name(m, 'team_b')}`;
  const when = (m) => new Date(m.t + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ');
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]; const b = list[j];
      const gap = (b.t - a.t) / HOUR;
      if (gap >= Math.max(matchHours, minRestHours)) break; // sorted: nothing later can conflict
      const shared = [a.team_a_id, a.team_b_id].filter((id) => id && (id === b.team_a_id || id === b.team_b_id));
      for (const teamId of shared) {
        if (gap < matchHours) out.push({ type: 'team_clash', matchIds: [a.id, b.id], teamId, text: `${teamId === a.team_a_id ? name(a, 'team_a') : name(a, 'team_b')} is in two matches at the same time: ${label(a)} and ${label(b)} (${when(a)}).` });
        else if (gap < minRestHours) out.push({ type: 'rest', matchIds: [a.id, b.id], teamId, text: `${teamId === a.team_a_id ? name(a, 'team_a') : name(a, 'team_b')} gets only ${Math.round(gap * 10) / 10} hours between ${label(a)} and ${label(b)} (minimum ${minRestHours}).` });
      }
      if (gap < matchHours && a.venue && norm(a.venue) === norm(b.venue)) {
        out.push({ type: 'ground_clash', matchIds: [a.id, b.id], venue: a.venue, text: `${a.venue} is booked for two matches at once: ${label(a)} and ${label(b)} (${when(a)}).` });
      }
    }
  }
  return out;
}
