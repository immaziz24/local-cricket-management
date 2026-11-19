/**
 * Qualification scenario simulator (#329). Pure functions. The organiser or a fan picks a result for some
 * remaining matches ("A beats B", "tie / no result") and sees who is then qualified, out, or still alive.
 * Built on qualificationStatus (#328), so it is exact for the same sizes and safe beyond them.
 */
import { qualificationStatus } from './qualification.js';

/**
 * @param picks { [matchKey]: team_id | 'tie' } - matchKey is match.id; unpicked matches stay open
 * @returns { status: Map, points: Map }
 */
export function simulateScenario({ rows, remaining = [], spots, picks = {}, pointsWin = 2, pointsTie = 1 }) {
  const points = new Map(rows.map((r) => [r.team_id, Number(r.points) || 0]));
  const open = [];
  for (const m of remaining) {
    const pick = picks[m.id];
    if (pick === 'tie') { [m.team_a_id, m.team_b_id].forEach((id) => points.has(id) && points.set(id, points.get(id) + pointsTie)); }
    else if (pick && (pick === m.team_a_id || pick === m.team_b_id)) { if (points.has(pick)) points.set(pick, points.get(pick) + pointsWin); }
    else open.push(m);
  }
  const status = qualificationStatus({ rows: rows.map((r) => ({ team_id: r.team_id, points: points.get(r.team_id) })), remaining: open, spots, pointsWin, pointsTie });
  return { status, points };
}
