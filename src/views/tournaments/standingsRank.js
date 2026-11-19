/**
 * Applies the organiser's tiebreaker order (#327) to the points-table rows of one group.
 * rows    [{ team_id, team_name, points, won, lost, nrr, qualified, rank_no }] as returned by the database
 * order   e.g. ['wins','nrr','head_to_head'] - null/empty keeps the database order
 * matches all tournament matches; finished league/group matches with a winner feed head-to-head
 */
import { rankTeams } from './tiebreakers.js';

export function applyTiebreakers(rows, order, matches = [], spots = 2) {
  if (!Array.isArray(order) || order.length === 0 || rows.length < 2) return rows;
  const ids = new Set(rows.map((r) => r.team_id));
  const results = (matches || [])
    .filter((m) => (m.stage === 'league' || m.stage === 'group') && m.status === 'completed' && m.winner_team_id && ids.has(m.team_a_id) && ids.has(m.team_b_id))
    .map((m) => ({ winner_id: m.winner_team_id, loser_id: m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id }));
  const ranked = rankTeams(rows.map((r) => ({ ...r, name: r.team_name })), { order, results });
  const anyQualified = rows.some((r) => r.qualified);
  return ranked.map((r, i) => ({ ...r, rank_no: i + 1, qualified: anyQualified ? i < spots : r.qualified }));
}
