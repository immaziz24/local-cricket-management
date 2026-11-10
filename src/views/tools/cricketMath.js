/**
 * Category L – pure cricket calculations used by the Tools page (no database).
 * Overs are written the cricket way: "12.3" = 12 overs and 3 balls.
 */

/** "12.3" -> 75 balls. Returns null for empty or invalid input (ball part must be 0–5). */
export function oversToBalls(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const s = String(v).trim();
  if (!/^\d+(\.\d)?$/.test(s)) return null;
  const [o, b = '0'] = s.split('.');
  const balls = Number(b);
  if (balls > 5) return null;
  return Number(o) * 6 + balls;
}
export const ballsToOvers = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
const round2 = (x) => Math.round(x * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

/** #216 Run rate (runs per over). */
export function runRate(runs, overs) {
  const r = num(runs); const b = oversToBalls(overs);
  return r === null || !b ? null : round2((r * 6) / b);
}

/** #217 Required run rate: target, current score, overs bowled so far, total overs. */
export function requiredRate(target, runs, oversDone, totalOvers) {
  const t = num(target); const r = num(runs); const done = oversToBalls(oversDone); const total = oversToBalls(totalOvers);
  if (t === null || r === null || done === null || !total || done > total) return null;
  const need = t - r; const left = total - done;
  if (need <= 0) return { need: 0, ballsLeft: left, rrr: 0, won: true };
  if (left === 0) return { need, ballsLeft: 0, rrr: null, won: false };
  return { need, ballsLeft: left, rrr: round2((need * 6) / left), won: false };
}

/** #218 Batting strike rate. */
export const strikeRate = (runs, balls) => (num(runs) === null || !num(balls) ? null : round2((num(runs) * 100) / num(balls)));
/** #219 Batting average (runs ÷ times out). */
export const battingAverage = (runs, outs) => (num(runs) === null || !num(outs) ? null : round2(num(runs) / num(outs)));
/** #220 Bowling economy (runs per over). */
export function economy(runs, overs) { return runRate(runs, overs); }
/** #221 Bowling average and bowling strike rate. */
export function bowlingAverage(runs, wickets, overs) {
  const r = num(runs); const w = num(wickets); const b = oversToBalls(overs);
  return { average: r === null || !w ? null : round2(r / w), strikeRate: !w || !b ? null : round2(b / w) };
}

/**
 * #222 Net Run Rate over several matches.
 * row: { runsFor, oversFaced, allOutFor, runsAgainst, oversBowled, allOutAgainst, quota }
 * When a side is all out its full quota of overs counts (as in tournament rules).
 */
export function netRunRate(rows) {
  let rf = 0; let bf = 0; let ra = 0; let ba = 0; let used = 0;
  for (const x of rows) {
    const quota = oversToBalls(x.quota);
    const faced = x.allOutFor && quota ? quota : oversToBalls(x.oversFaced);
    const bowled = x.allOutAgainst && quota ? quota : oversToBalls(x.oversBowled);
    if (num(x.runsFor) === null || num(x.runsAgainst) === null || !faced || !bowled) continue;
    rf += num(x.runsFor); bf += faced; ra += num(x.runsAgainst); ba += bowled; used += 1;
  }
  if (!used) return null;
  const forRate = (rf * 6) / bf; const againstRate = (ra * 6) / ba;
  return { matches: used, runsFor: rf, oversFor: ballsToOvers(bf), runsAgainst: ra, oversAgainst: ballsToOvers(ba),
           forRate: round2(forRate), againstRate: round2(againstRate), nrr: Math.round((forRate - againstRate) * 1000) / 1000 };
}

/** #224 Fair coin toss using the browser's secure random numbers. */
export function tossCoin() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] % 2 === 0 ? 'Heads' : 'Tails';
}

function secureShuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const r = new Uint32Array(1); globalThis.crypto.getRandomValues(r);
    const j = r[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Parse a players list: one per line, "Name", "Name, 4" (rating 1–5) or "Name, bowler, 4".
 * Roles: batter, bowler, all_rounder (all, ar), wicket_keeper (wk, keeper).
 */
export function parsePlayers(text) {
  const roleOf = (w) => {
    const s = w.toLowerCase().replace(/[^a-z]/g, '');
    if (['bat', 'batter', 'batsman'].includes(s)) return 'batter';
    if (['bowl', 'bowler'].includes(s)) return 'bowler';
    if (['all', 'ar', 'allrounder'].includes(s)) return 'all_rounder';
    if (['wk', 'keeper', 'wicketkeeper'].includes(s)) return 'wicket_keeper';
    return null;
  };
  return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
    const p = { name: parts[0], role: null, rating: 3 };
    parts.slice(1).forEach((x) => { if (/^[1-5]$/.test(x)) p.rating = Number(x); else if (roleOf(x)) p.role = roleOf(x); });
    return p;
  });
}

/** #225 Split players into N balanced teams: shuffle, then snake draft by rating; keepers spread out first. */
export function makeTeams(players, n) {
  const k = Math.max(2, Math.min(Number(n) || 2, players.length || 2));
  const teams = Array.from({ length: k }, (_, i) => ({ name: `Team ${String.fromCharCode(65 + i)}`, players: [], total: 0 }));
  const keepers = secureShuffle(players.filter((p) => p.role === 'wicket_keeper')).sort((a, b) => b.rating - a.rating);
  const rest = secureShuffle(players.filter((p) => p.role !== 'wicket_keeper')).sort((a, b) => b.rating - a.rating);
  const add = (p) => {
    // weakest team (by rating total, then size) picks next – keeps teams even
    const t = [...teams].sort((a, b) => a.players.length - b.players.length || a.total - b.total)[0];
    t.players.push(p); t.total += p.rating;
  };
  keepers.forEach(add); rest.forEach(add);
  return teams;
}

/**
 * #226 Pick a Playing XI from a squad: a keeper, enough bowling options, then the best remaining players.
 * Returns { xi (in batting order), bench, notes }.
 */
export function pickPlayingXI(squad, { size = 11, bowlersNeeded = 5 } = {}) {
  const pool = secureShuffle(squad).sort((a, b) => b.rating - a.rating);
  const xi = []; const notes = [];
  const take = (p) => { if (p && !xi.includes(p) && xi.length < size) xi.push(p); };
  const wk = pool.find((p) => p.role === 'wicket_keeper');
  if (wk) take(wk); else notes.push('No wicket-keeper in the squad – choose someone to keep.');
  const bowlingOptions = pool.filter((p) => p.role === 'bowler' || p.role === 'all_rounder');
  bowlingOptions.slice(0, Math.min(bowlersNeeded, size - xi.length)).forEach(take);
  if (bowlingOptions.length < bowlersNeeded) notes.push(`Only ${bowlingOptions.length} bowling option(s) – some batters will need to bowl.`);
  pool.forEach(take);
  if (xi.length < size) notes.push(`Only ${xi.length} players available for ${size} places.`);
  const order = { wicket_keeper: 1, batter: 0, all_rounder: 2, bowler: 3 };
  const sorted = [...xi].sort((a, b) => (order[a.role] ?? 1.5) - (order[b.role] ?? 1.5) || b.rating - a.rating);
  return { xi: sorted, bench: pool.filter((p) => !xi.includes(p)), notes };
}

/**
 * #228 Points table from results.
 * results: [{ a, b, aRuns, aOvers, aAllOut, bRuns, bOvers, bAllOut, noResult }], quota overs, points.
 */
export function pointsTable(teamNames, results, { quota, win = 2, tie = 1, noResult = 1 } = {}) {
  const t = Object.fromEntries(teamNames.map((n) => [n, { team: n, p: 0, w: 0, l: 0, tie: 0, nr: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0 }]));
  const q = oversToBalls(quota);
  for (const r of results) {
    const A = t[r.a]; const B = t[r.b];
    if (!A || !B || r.a === r.b) continue;
    A.p += 1; B.p += 1;
    if (r.noResult) { A.nr += 1; B.nr += 1; A.pts += noResult; B.pts += noResult; continue; }
    const ar = num(r.aRuns); const br = num(r.bRuns);
    if (ar === null || br === null) { A.p -= 1; B.p -= 1; continue; }
    if (ar > br) { A.w += 1; B.l += 1; A.pts += win; } else if (br > ar) { B.w += 1; A.l += 1; B.pts += win; } else { A.tie += 1; B.tie += 1; A.pts += tie; B.pts += tie; }
    const ab = r.aAllOut && q ? q : oversToBalls(r.aOvers); const bb = r.bAllOut && q ? q : oversToBalls(r.bOvers);
    if (ab && bb) { A.rf += ar; A.bf += ab; A.ra += br; A.ba += bb; B.rf += br; B.bf += bb; B.ra += ar; B.ba += ab; }
  }
  return Object.values(t).map((x) => ({ ...x, nrr: x.bf && x.ba ? Math.round(((x.rf * 6) / x.bf - (x.ra * 6) / x.ba) * 1000) / 1000 : 0 }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || b.w - a.w || a.team.localeCompare(b.team));
}

/** #229 Tournament budget. items: [{ label, amount, perMatch }] */
export function budget({ items, teams, entryFee, matches, sponsorship }) {
  const m = num(matches) || 0; const tc = num(teams) || 0;
  const cost = items.reduce((s, i) => s + (num(i.amount) || 0) * (i.perMatch ? m : 1), 0);
  const income = tc * (num(entryFee) || 0) + (num(sponsorship) || 0);
  return { cost, income, balance: income - cost, breakEvenFee: tc ? Math.ceil(Math.max(cost - (num(sponsorship) || 0), 0) / tc) : null };
}

/** #230 Prize split: shares in %, rounded down to `roundTo`; leftover goes to the first prize. */
export function splitPrizes(pool, shares, roundTo = 100) {
  const total = num(pool) || 0; const rt = Math.max(1, num(roundTo) || 1);
  const sum = shares.reduce((s, x) => s + (num(x.percent) || 0), 0);
  const out = shares.map((x) => ({ ...x, amount: Math.floor(((num(x.percent) || 0) / 100) * total / rt) * rt }));
  const used = out.reduce((s, x) => s + x.amount, 0);
  if (out.length && sum === 100) out[0].amount += total - used;
  return { prizes: out, percentTotal: sum, leftover: sum === 100 ? 0 : total - used };
}

/** #231 Player auction: what a team can still bid. */
export function auctionBudget({ purse, spent, squadSize, bought, basePrice }) {
  const p = num(purse) || 0; const s = num(spent) || 0; const size = num(squadSize) || 0; const b = num(bought) || 0; const base = num(basePrice) || 0;
  const remaining = p - s; const slots = Math.max(size - b, 0);
  const maxBid = slots > 0 ? remaining - (slots - 1) * base : 0;
  return { remaining, slots, maxBid: Math.max(maxBid, 0), averagePerSlot: slots ? Math.floor(remaining / slots) : 0, short: maxBid < base && slots > 0 };
}

/** #232 Ground size from boundary distances (metres). Oval: straight (long) and square (short) radius. */
export function groundSize(straightM, squareM) {
  const a = num(straightM); const b = num(squareM) ?? a;
  if (!a || !b) return null;
  const area = Math.PI * a * b;
  const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); // Ramanujan
  return { area: Math.round(area), perimeter: Math.round(perimeter), straightYards: Math.round(a * 1.0936), squareYards: Math.round(b * 1.0936),
           acres: Math.round((area / 4046.86) * 100) / 100 };
}
