/**
 * Qualification engine (#328): which teams have mathematically qualified or are out - never earlier.
 * Pure functions. Uses points only; a team counts as qualified only when no combination of the remaining
 * results can push it out, and as eliminated only when no combination can get it in. Ties on points are NOT
 * treated as resolved (net run rate is unknown in the future), so the answer is always the safe one.
 *
 * rows       [{ team_id, points }] - one group (or the whole league)
 * remaining  [{ team_a_id, team_b_id }] - matches still to be played between those teams
 * spots      how many teams qualify
 */

const outcomesFor = (win, tie, noResult) => {
  const list = [[win, 0], [0, win], [tie, tie], [noResult, noResult]];
  const seen = new Set();
  return list.filter((o) => { const k = o.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
};

/** @returns Map(team_id -> 'qualified' | 'eliminated' | 'alive') */
export function qualificationStatus({ rows, remaining = [], spots, pointsWin = 2, pointsTie = 1, pointsNoResult = 1, maxExhaustive = 10 }) {
  const out = new Map();
  const ids = rows.map((r) => r.team_id);
  const k = Number(spots);
  rows.forEach((r) => out.set(r.team_id, 'alive'));
  if (!k || k < 1) return out;
  if (k >= ids.length) { ids.forEach((id) => out.set(id, 'qualified')); return out; }

  const idSet = new Set(ids);
  const left = remaining.filter((m) => idSet.has(m.team_a_id) && idSet.has(m.team_b_id) && m.team_a_id !== m.team_b_id);
  const base = new Map(rows.map((r) => [r.team_id, Number(r.points) || 0]));

  if (left.length <= maxExhaustive) {
    const outcomes = outcomesFor(pointsWin, pointsTie, pointsNoResult);
    const sure = new Map(ids.map((id) => [id, true]));
    const out2 = new Map(ids.map((id) => [id, true]));
    const pts = new Map(base);
    const leaf = () => {
      for (const id of ids) {
        const p = pts.get(id);
        let ge = 0; let gt = 0;
        for (const o of ids) { if (o === id) continue; const q = pts.get(o); if (q >= p) ge += 1; if (q > p) gt += 1; }
        if (ge >= k) sure.set(id, false);
        if (gt < k) out2.set(id, false);
      }
    };
    const walk = (i) => {
      if (i === left.length) { leaf(); return; }
      const m = left[i];
      for (const [a, b] of outcomes) {
        pts.set(m.team_a_id, pts.get(m.team_a_id) + a); pts.set(m.team_b_id, pts.get(m.team_b_id) + b);
        walk(i + 1);
        pts.set(m.team_a_id, pts.get(m.team_a_id) - a); pts.set(m.team_b_id, pts.get(m.team_b_id) - b);
      }
    };
    walk(0);
    ids.forEach((id) => out.set(id, sure.get(id) ? 'qualified' : out2.get(id) ? 'eliminated' : 'alive'));
    return out;
  }

  // Too many matches left to try every result: use safe bounds (best / worst case for each team on its own).
  const best = new Map(base);
  left.forEach((m) => {
    best.set(m.team_a_id, best.get(m.team_a_id) + pointsWin);
    best.set(m.team_b_id, best.get(m.team_b_id) + pointsWin);
  });
  ids.forEach((id) => {
    const mine = base.get(id); const mineMax = best.get(id);
    const couldPass = ids.filter((o) => o !== id && best.get(o) >= mine).length;
    const alreadyAhead = ids.filter((o) => o !== id && base.get(o) > mineMax).length;
    if (couldPass < k) out.set(id, 'qualified');
    else if (alreadyAhead >= k) out.set(id, 'eliminated');
  });
  return out;
}
