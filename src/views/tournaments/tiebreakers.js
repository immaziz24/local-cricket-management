/**
 * Configurable tiebreakers (#327). Pure functions. Teams are ordered by points, then by the organiser's chosen
 * rules in order: 'wins', 'nrr', 'head_to_head', 'fewer_losses', 'name'. Head-to-head is applied only between
 * teams that are tied on everything before it, using the results between just those teams.
 * rows    [{ team_id, name, points, won, lost, nrr }]
 * results [{ winner_id, loser_id }] finished matches with a winner (ties/no-results are left out)
 */
export const TIEBREAKER_RULES = ['wins', 'nrr', 'head_to_head', 'fewer_losses', 'name'];

const num = (v) => Number(v) || 0;

function h2h(group, results) {
  const ids = new Set(group.map((r) => r.team_id));
  const w = new Map(group.map((r) => [r.team_id, 0]));
  for (const r of results || []) if (ids.has(r.winner_id) && ids.has(r.loser_id)) w.set(r.winner_id, w.get(r.winner_id) + 1);
  return w;
}

export function rankTeams(rows, { order = ['wins', 'nrr', 'head_to_head'], results = [] } = {}) {
  const rules = order.filter((r) => TIEBREAKER_RULES.includes(r));
  const cmp = {
    wins: (a, b) => num(b.won) - num(a.won),
    nrr: (a, b) => num(b.nrr) - num(a.nrr),
    fewer_losses: (a, b) => num(a.lost) - num(b.lost),
    name: (a, b) => String(a.name || '').localeCompare(String(b.name || ''))
  };
  const sortGroup = (group, ri) => {
    if (group.length < 2 || ri >= rules.length) return group;
    const rule = rules[ri];
    let ordered;
    if (rule === 'head_to_head') {
      const w = h2h(group, results);
      ordered = [...group].sort((a, b) => w.get(b.team_id) - w.get(a.team_id));
      return splitTies(ordered, (a, b) => w.get(a.team_id) === w.get(b.team_id), ri);
    }
    ordered = [...group].sort(cmp[rule]);
    return splitTies(ordered, (a, b) => cmp[rule](a, b) === 0, ri);
  };
  const splitTies = (ordered, same, ri) => {
    if (ordered.length === 0) return [];
    const out = []; let run = [ordered[0]];
    for (let i = 1; i < ordered.length; i += 1) {
      if (same(run[0], ordered[i])) run.push(ordered[i]); else { out.push(...sortGroup(run, ri + 1)); run = [ordered[i]]; }
    }
    out.push(...sortGroup(run, ri + 1));
    return out;
  };
  const byPoints = [...rows].sort((a, b) => num(b.points) - num(a.points));
  return splitTies(byPoints, (a, b) => num(a.points) === num(b.points), -1);
}
