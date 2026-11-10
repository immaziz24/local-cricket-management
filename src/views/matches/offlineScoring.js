/**
 * #26 Offline scoring support, #27 Automatic synchronisation.
 *
 * While there is no internet, every scoring action (a ball, or picking batters / bowler) is kept in a queue on
 * this device (localStorage) and the screen is updated with the same rules the server uses. When the connection
 * returns the queue is sent in order. Each ball carries a client id, so the server never records it twice.
 *
 * base state  = last state received from the server (also cached, so the page works after a reload offline)
 * shown state = base state with the queued actions applied on top
 */

const QKEY = (matchId) => `lc_offline_queue_${matchId}`;
const SKEY = (matchId) => `lc_live_state_${matchId}`;

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export const loadQueue = (matchId) => read(QKEY(matchId), []);
export const saveQueue = (matchId, q) => write(QKEY(matchId), q);
export const loadCachedState = (matchId) => read(SKEY(matchId), null);
export const saveCachedState = (matchId, s) => write(SKEY(matchId), s);

export function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** True when the error means "no connection" (not a rule problem like "pick the bowler first"). */
export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = String(err?.message || err || '').toLowerCase();
  return m.includes('cannot reach the server') || m.includes('failed to fetch') || m.includes('network') || m.includes('load failed');
}

const BOWLER_WICKETS = ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'caught_and_bowled'];
const clone = (x) => JSON.parse(JSON.stringify(x));

function refreshCrease(inn, cur) {
  inn.batting.forEach((b) => {
    b.at_crease = b.player_id === cur.striker_id || b.player_id === cur.non_striker_id;
    b.on_strike = b.player_id === cur.striker_id;
  });
}

function ensureBatter(inn, cur, id) {
  if (!id) return null;
  let b = inn.batting.find((x) => x.player_id === id);
  if (!b) {
    const p = cur.batting_side.find((x) => x.player_id === id);
    b = { player_id: id, name: p ? p.name : '?', runs: 0, balls: 0, fours: 0, sixes: 0, out: null, minutes: 0 };
    inn.batting.push(b);
  }
  return b;
}

function ensureBowler(inn, cur, id) {
  if (!id) return null;
  let b = inn.bowling.find((x) => x.player_id === id);
  if (!b) {
    const p = cur.bowling_side.find((x) => x.player_id === id);
    b = { player_id: id, name: p ? p.name : '?', legal_balls: 0, runs: 0, wickets: 0, wides: 0, no_balls: 0, maidens: 0 };
    inn.bowling.push(b);
  }
  return b;
}

function applyBall(st, p, n, rules = {}) {
  const cur = st.current; const inn = st.innings.find((x) => x.id === cur.innings_id);
  if (!cur || !inn || cur.status !== 'in_progress') return st;
  const runs = Number(p.runs || 0); const ext = p.extra || null; const add = Number(p.extras || 0);
  const wk = p.wicket || null; const outEnd = p.out || 'striker';
  const extraRuns = ext === 'wide' ? (rules.wide_runs ?? 1) + add : ext === 'no_ball' ? (rules.no_ball_runs ?? 1) + add : ext === 'bye' || ext === 'leg_bye' ? add : 0;
  const legal = !ext || ext === 'bye' || ext === 'leg_bye';
  const isWkt = !!wk && wk !== 'retired_hurt';
  let ran = ext === 'wide' ? add : ext === 'no_ball' ? runs + add : ext === 'bye' || ext === 'leg_bye' ? add : runs;
  if ([4, 6].includes(runs) && !ext) ran = 0;
  if ([4, 6].includes(runs) && ext === 'no_ball') ran = add;

  let s = cur.striker_id; let ns = cur.non_striker_id; let b = cur.bowler_id;
  const batter = ensureBatter(inn, cur, s);
  const bowler = ensureBowler(inn, cur, b);
  const total = runs + extraRuns;

  if (batter) { batter.runs += runs; if (ext !== 'wide') batter.balls += 1; if (runs === 4) batter.fours += 1; if (runs === 6) batter.sixes += 1; }
  if (bowler) {
    if (legal) bowler.legal_balls += 1;
    bowler.runs += runs + (ext === 'wide' || ext === 'no_ball' ? extraRuns : 0);
    if (isWkt && BOWLER_WICKETS.includes(wk)) bowler.wickets += 1;
    if (ext === 'wide') bowler.wides += 1;
    if (ext === 'no_ball') bowler.no_balls += 1;
  }
  const dismissed = wk ? (outEnd === 'non_striker' ? ns : s) : null;
  if (dismissed) {
    const d = ensureBatter(inn, cur, dismissed);
    if (d) d.out = { type: wk, bowler: bowler ? bowler.name : '', fielder: (cur.bowling_side.find((x) => x.player_id === p.fielder_id) || {}).name || null };
    const side = cur.batting_side.find((x) => x.player_id === dismissed);
    if (side && isWkt) side.out = true;
    if (side && wk === 'retired_hurt') side.retired_hurt = true;
  }

  const overBefore = cur.legal_balls;
  cur.runs += total; inn.runs += total;
  inn.extras += extraRuns;
  if (inn.extras_detail) {
    if (ext === 'wide') inn.extras_detail.wides += extraRuns;
    if (ext === 'no_ball') inn.extras_detail.no_balls += extraRuns;
    if (ext === 'bye') inn.extras_detail.byes += extraRuns;
    if (ext === 'leg_bye') inn.extras_detail.leg_byes += extraRuns;
  }
  if (isWkt) { cur.wickets += 1; inn.wickets += 1; }
  if (legal) { cur.legal_balls += 1; inn.legal_balls += 1; }

  if (ran % 2 === 1) [s, ns] = [ns, s];
  if (dismissed) { if (s === dismissed) s = null; else if (ns === dismissed) ns = null; }
  let overEnded = false;
  if (legal && cur.legal_balls % 6 === 0) { [s, ns] = [ns, s]; cur.last_over_bowler_id = b; b = null; overEnded = true; }
  cur.striker_id = s; cur.non_striker_id = ns; cur.bowler_id = b;

  cur.this_over = [...(cur.this_over || []), { runs, extra: ext, extra_runs: extraRuns, wicket: wk, legal }];
  cur.partnership = dismissed ? { runs: 0, balls: 0 } : { runs: (cur.partnership?.runs || 0) + total, balls: (cur.partnership?.balls || 0) + (legal ? 1 : 0) };
  cur.recent = [{
    seq: `local-${n}`, over: `${Math.floor(overBefore / 6)}.${(overBefore % 6) + (legal ? 1 : 0)}`, runs, extra: ext, extra_runs: extraRuns, wicket: wk,
    bowler: bowler ? bowler.name : '', batter: batter ? batter.name : '', out_name: dismissed ? (inn.batting.find((x) => x.player_id === dismissed) || {}).name : null,
    commentary: p.commentary || null, pending: true
  }, ...(cur.recent || [])].slice(0, 18);
  if (cur.target) cur.runs_needed = Math.max(cur.target - cur.runs, 0);
  if (st.overs_limit) cur.balls_left = Math.max(st.overs_limit * 6 - cur.legal_balls, 0);
  cur._overEnded = overEnded;

  // innings over? (the server confirms and opens the next innings when the queue is sent)
  const allOutAt = Math.max(cur.batting_side.length - 1, 1);
  if ((cur.target && cur.runs >= cur.target) || cur.wickets >= allOutAt || (st.overs_limit && cur.legal_balls >= st.overs_limit * 6)) {
    cur.status = 'completed'; inn.status = 'completed'; cur.striker_id = null; cur.non_striker_id = null; cur.bowler_id = null;
    cur._endedOffline = true;
  }
  refreshCrease(inn, cur);
  return st;
}

function applyPlayers(st, p) {
  const cur = st.current; const inn = cur && st.innings.find((x) => x.id === cur.innings_id);
  if (!cur || !inn) return st;
  if (p.striker) cur.striker_id = p.striker;
  if (p.nonStriker) cur.non_striker_id = p.nonStriker;
  if (p.bowler) {
    if (!cur.bowler_id && cur.legal_balls % 6 === 0) cur.this_over = [];
    cur.bowler_id = p.bowler;
  }
  ensureBatter(inn, cur, cur.striker_id); ensureBatter(inn, cur, cur.non_striker_id);
  refreshCrease(inn, cur);
  return st;
}

/** Shown state = server state + queued actions. */
export function applyQueue(base, queue, rules) {
  if (!base || !queue?.length || !base.current) return base;
  const st = clone(base);
  queue.forEach((a, i) => { if (a.kind === 'ball') applyBall(st, a.payload, i, rules || {}); else if (a.kind === 'players') applyPlayers(st, a.payload); });
  return st;
}
