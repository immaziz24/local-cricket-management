/**
 * Powerplay (#351) and death-overs (#352) analysis. Pure functions over ball-by-ball rows.
 * ball: { over_number (0-based), is_legal, runs_total (runs scored incl. extras), is_wicket }
 * Powerplay = first N overs (default 6 for T20 / scaled for shorter games); death = last N overs (default 4).
 */
const phase = (balls, from, to) => {
  let runs = 0; let wickets = 0; let legal = 0; let dots = 0; let boundaries = 0;
  for (const b of balls || []) {
    const o = Number(b.over_number);
    if (!(o >= from && o < to)) continue;
    const r = Number(b.runs_total) || 0;
    runs += r;
    if (b.is_wicket) wickets += 1;
    if (b.is_legal !== false) { legal += 1; if (r === 0 && !b.is_wicket) dots += 1; }
    if (r === 4 || r === 6) boundaries += 1;
  }
  const rr = legal ? Math.round((runs * 6 / legal) * 100) / 100 : 0;
  return { runs, wickets, legalBalls: legal, dots, boundaries, runRate: rr };
};

/** @param oversLimit overs in the innings; powerplay defaults to 30% (6 of 20), death to the last 20% */
export function phaseAnalysis(balls, { oversLimit = 20, powerplayOvers, deathOvers } = {}) {
  const limit = Math.max(1, Number(oversLimit) || 20);
  const pp = powerplayOvers ?? Math.max(1, Math.round(limit * 0.3));
  const dd = deathOvers ?? Math.max(1, Math.round(limit * 0.2));
  const midFrom = Math.min(pp, limit); const deathFrom = Math.max(midFrom, limit - dd);
  return {
    powerplay: { overs: pp, ...phase(balls, 0, pp) },
    middle: { overs: Math.max(0, deathFrom - midFrom), ...phase(balls, midFrom, deathFrom) },
    death: { overs: dd, ...phase(balls, deathFrom, limit) }
  };
}
