/**
 * Fall-of-wickets timeline (#349, #350): where each wicket fell along the innings, with the partnership before it.
 * Pure functions - no React - so they can be tested. Overs are written the cricket way: "3.4" = 3 overs and 4 balls.
 */

/** "3.4" -> 22 balls. Returns null for anything that is not a valid over text. */
export function overToBalls(over) {
  const m = /^(\d+)(?:\.([0-5]))?$/.exec(String(over ?? '').trim());
  return m ? Number(m[1]) * 6 + Number(m[2] || 0) : null;
}

const COLLAPSE_RUNS = 15; // three wickets inside this many runs counts as a collapse

/**
 * @param fow        [{ runs, wicket, name, over }] in the order the wickets fell
 * @param totalBalls legal balls bowled in the innings so far
 * @param oversLimit overs allowed in the innings (optional) - the axis then runs to the full innings
 */
export function fowPoints(fow, { totalBalls = 0, oversLimit = null } = {}) {
  const list = (fow || []).map((f) => ({ ...f, balls: overToBalls(f.over) })).filter((f) => f.balls !== null);
  const axis = Math.max(1, Number(totalBalls) || 0, oversLimit ? Number(oversLimit) * 6 : 0, ...list.map((f) => f.balls));
  let prevRuns = 0; let prevBalls = 0;
  return list.map((f, i) => {
    const p = {
      ...f,
      x: Math.round((f.balls / axis) * 1000) / 10, // percent along the axis
      partnershipRuns: Math.max(0, f.runs - prevRuns),
      partnershipBalls: Math.max(0, f.balls - prevBalls),
      collapse: i >= 2 && f.runs - (list[i - 2].runs) <= COLLAPSE_RUNS
    };
    prevRuns = f.runs; prevBalls = f.balls;
    return p;
  });
}
