import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Undo2, AlertCircle, Flag, CloudRain, WifiOff, RefreshCw } from 'lucide-react';
import { WagonWheelPicker } from './WagonWheel.jsx';
import { makeCommentary } from './commentary.js';
import { loadQueue, saveQueue, loadCachedState, saveCachedState, newClientId, isNetworkError, applyQueue } from './offlineScoring.js';

/**
 * Ball-by-ball scoring (#7–#19): runs, extras, wickets, automatic strike change, end of over,
 * bowler changes, innings changeover, target, result, undo, end innings, abandon.
 * Spectators see the same live score (instant updates).
 * #26 #27 Offline: without internet, balls are queued on this device, the screen keeps updating,
 * and the queue is sent automatically (in order, never twice) when the connection returns.
 */

const WICKETS = [
  ['bowled', 'Bowled'], ['caught', 'Caught'], ['caught_and_bowled', 'Caught & bowled'], ['lbw', 'LBW'],
  ['run_out', 'Run out'], ['stumped', 'Stumped'], ['hit_wicket', 'Hit wicket'],
  ['retired_hurt', 'Retired hurt (not out)'], ['retired_out', 'Retired out'], ['obstructing', 'Obstructing the field'], ['timed_out', 'Timed out']
];
const WICKET_LABEL = Object.fromEntries(WICKETS);
const field = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.88rem' };

export const oversText = (balls) => `${Math.floor((balls || 0) / 6)}.${(balls || 0) % 6}`;
const sr = (r, b) => (b ? ((r * 100) / b).toFixed(1) : '0.0');
const econ = (r, b) => (b ? ((r * 6) / b).toFixed(2) : '0.00');

export function ballLabel(b) {
  if (b.wicket && b.wicket !== 'retired_hurt') return 'W';
  if (b.extra === 'wide') return b.extra_runs > 1 ? `${b.extra_runs - 1}wd` : 'wd';
  if (b.extra === 'no_ball') return `${b.runs ? b.runs : ''}nb`;
  if (b.extra === 'bye') return `${b.extra_runs}b`;
  if (b.extra === 'leg_bye') return `${b.extra_runs}lb`;
  return String(b.runs);
}

export function dismissalText(out) {
  if (!out) return 'not out';
  const bw = out.bowler || '';
  switch (out.type) {
    case 'bowled': return `b ${bw}`;
    case 'caught': return `c ${out.fielder || 'sub'} b ${bw}`;
    case 'caught_and_bowled': return `c & b ${bw}`;
    case 'lbw': return `lbw b ${bw}`;
    case 'stumped': return `st ${out.fielder || ''} b ${bw}`;
    case 'run_out': return `run out${out.fielder ? ` (${out.fielder})` : ''}`;
    case 'hit_wicket': return `hit wicket b ${bw}`;
    case 'retired_hurt': return 'retired hurt';
    default: return WICKET_LABEL[out.type] || out.type;
  }
}

function BallChip({ b }) {
  const l = ballLabel(b);
  const bg = l === 'W' ? '#dc2626' : l.endsWith('4') && !b.extra ? '#2563eb' : l === '6' ? '#7c3aed' : b.extra ? '#f59e0b' : '#e2e8f0';
  const color = ['#e2e8f0'].includes(bg) ? '#0f172a' : '#fff';
  return <span style={{ minWidth: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, backgroundColor: bg, color, padding: '0 4px' }}>{l}</span>;
}

/** #18 Score correction: the scorer fixes one ball of this innings (runs, bye / leg bye, wide / no-ball runs). */
function BallEditor({ b, rules, busy, onSave, onCancel }) {
  const [extra, setExtra] = useState(b.extra || '');
  const [runs, setRuns] = useState(b.extra === 'wide' || b.extra === 'bye' || b.extra === 'leg_bye' ? 0 : b.runs);
  const [ran, setRan] = useState(() => {
    if (b.extra === 'wide') return Math.max(0, (b.extra_runs || 0) - (rules.wide_runs ?? 1));
    if (b.extra === 'no_ball') return Math.max(0, (b.extra_runs || 0) - (rules.no_ball_runs ?? 1));
    if (b.extra === 'bye' || b.extra === 'leg_bye') return b.extra_runs || 1;
    return 0;
  });
  const legal = !b.extra || b.extra === 'bye' || b.extra === 'leg_bye';
  const choices = legal ? [['', 'Runs off the bat'], ['bye', 'Byes'], ['leg_bye', 'Leg byes']] : [['wide', 'Wide'], ['no_ball', 'No ball']];
  const batRuns = !extra || extra === 'no_ball';
  const chip = (on) => ({ minWidth: 38, padding: '0.4rem 0.55rem', borderRadius: 8, fontWeight: 800, cursor: 'pointer', border: `2px solid ${on ? '#16a34a' : '#cbd5e1'}`, backgroundColor: on ? '#dcfce7' : '#fff' });
  return (
    <div style={{ border: '2px solid #f59e0b', backgroundColor: '#fffbeb', borderRadius: '0.6rem', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.2rem 0 0.4rem' }}>
      <strong style={{ fontSize: '0.84rem' }}>Correct ball {b.over} – {b.bowler} to {b.batter}</strong>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {choices.map(([v, l]) => <button key={v || 'bat'} type="button" style={chip(extra === v)} onClick={() => { setExtra(v); if (v === 'bye' || v === 'leg_bye') setRan((x) => Math.max(1, x)); }}>{l}</button>)}
      </div>
      {batRuns && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#475569' }}>Off the bat:</span>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => <button key={r} type="button" style={chip(runs === r)} onClick={() => setRuns(r)}>{r}</button>)}
        </div>
      )}
      {extra && extra !== 'no_ball' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#475569' }}>{extra === 'wide' ? 'Runs run (or 4 for a wide to the boundary):' : 'Runs:'}</span>
          {(extra === 'wide' ? [0, 1, 2, 3, 4] : [1, 2, 3, 4]).map((r) => <button key={r} type="button" style={chip(ran === r)} onClick={() => setRan(r)}>{r}</button>)}
        </div>
      )}
      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>To change a wicket, or to turn a legal ball into a wide / no-ball, use Undo.</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => onSave({ extra: extra || null, runs: batRuns ? runs : 0, extras: extra && extra !== 'no_ball' ? ran : 0 })}>Save correction</Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function ScoringPanel({ matchId, onChanged, mode = 'live', refreshKey = 0 }) {
  const [base, setBase] = useState(null);            // last state from the server
  const [queue, setQueue] = useState(() => loadQueue(matchId)); // actions waiting to be sent
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const queueRef = useRef(queue);
  const syncingRef = useRef(false);
  const [rs, setRs] = useState(() => { try { return JSON.parse(localStorage.getItem(`lcm-rules-${matchId}`) || 'null'); } catch { return null; } }); // playing conditions in force
  const st = useMemo(() => applyQueue(base, queue, rs?.rules), [base, queue, rs]);
  const setSt = (s) => { setBase(s); if (s) saveCachedState(matchId, s); };
  const updateQueue = (q) => { queueRef.current = q; setQueue(q); saveQueue(matchId, q); };
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState(null); // wide | no_ball | bye | leg_bye
  const [wk, setWk] = useState(null); // { type, out, fielder, runs }
  const [shot, setShot] = useState(null); // runs waiting for a wagon-wheel tap
  const [editSeq, setEditSeq] = useState(null); // ball being corrected
  const [wheelOn, setWheelOn] = useState(() => { try { return localStorage.getItem('lcm-wagon') !== 'off'; } catch { return true; } });
  const [pick, setPick] = useState({ striker: '', non_striker: '', bowler: '' });
  const [comment, setComment] = useState('');
  const [menu, setMenu] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const [pen, setPen] = useState({ to: 'batting', runs: 5, reason: '' }); // #123 penalty runs
  const [soWickets, setSoWickets] = useState(2); // #121 Super Over
  const lastStatus = useRef(null);

  const load = async () => {
    try {
      let s = await dataService.fetchLiveState(matchId);
      dataService.fetchScoringRules(matchId).then((r) => { setRs(r); try { localStorage.setItem(`lcm-rules-${matchId}`, JSON.stringify(r)); } catch { /* storage full or blocked */ } }).catch(() => {});
      // scorer opens a live match with no innings yet: create innings 1 so the openers can be picked
      if (s.can_score && s.status === 'live' && !s.current) s = await dataService.setInningsPlayers(matchId, {});
      setSt(s); setErr(null); return s;
    } catch (e) {
      const cached = loadCachedState(matchId);
      if (isNetworkError(e) && cached) { setBase(cached); setErr(null); return cached; }
      setErr(e.message); return null;
    }
  };

  // #27 send queued actions in order; stop on a network error (still offline) or a rule error (needs the scorer)
  const flush = async () => {
    if (syncingRef.current || !queueRef.current.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    syncingRef.current = true; setSyncing(true);
    try {
      while (queueRef.current.length) {
        const [first, ...rest] = queueRef.current;
        let res;
        try {
          res = first.kind === 'ball'
            ? await dataService.recordBall(matchId, first.payload)
            : await dataService.setInningsPlayers(matchId, first.payload);
        } catch (e) {
          if (!isNetworkError(e)) setSyncError(`Could not upload ${first.kind === 'ball' ? 'a ball' : 'a player change'}: ${e.message}`);
          break;
        }
        updateQueue(rest);
        if (res) setSt(res);
      }
      if (!queueRef.current.length) { setSyncError(null); await load(); onChanged && onChanged(true); }
    } finally { syncingRef.current = false; setSyncing(false); }
  };
  useEffect(() => {
    const on = () => { setOnline(true); flush(); };
    const off = () => setOnline(false);
    const foreground = () => {
      if (document.visibilityState === 'visible') {
        setOnline(navigator.onLine);
        if (navigator.onLine) flush();
      }
    };
    window.addEventListener('online', on); window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', foreground);
    flush();
    const id = setInterval(() => { if (queueRef.current.length) flush(); }, 10000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', foreground);
      clearInterval(id);
    };
  }, [matchId]);

  /** Ball or player change: send now, or keep on the device when there is no internet. */
  const submit = async (kind, payload, after) => {
    const action = { kind, payload: kind === 'ball' ? { ...payload, client_id: newClientId() } : payload, at: Date.now() };
    if (queueRef.current.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      updateQueue([...queueRef.current, action]); after && after(); flush(); return;
    }
    setBusy(true); setErr(null);
    try {
      const s = kind === 'ball' ? await dataService.recordBall(matchId, action.payload) : await dataService.setInningsPlayers(matchId, action.payload);
      setSt(s); after && after(); onChanged && onChanged(true);
    } catch (e) {
      if (isNetworkError(e)) { updateQueue([...queueRef.current, action]); after && after(); }
      else setErr(e.message);
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [matchId]);
  // #29 instant updates arrive through refreshKey; spectators also poll every 20 s as a fallback
  useEffect(() => { if (refreshKey && !busy) load(); }, [refreshKey]);
  useEffect(() => {
    if (!st || st.can_score || st.status !== 'live') return undefined;
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [st?.can_score, st?.status]);
  useEffect(() => {
    if (st && lastStatus.current && lastStatus.current !== st.status) onChanged && onChanged();
    if (st) lastStatus.current = st.status;
  }, [st?.status]);

  const act = async (fn) => {
    setBusy(true); setErr(null);
    try { const s = await fn(); if (s) setSt(s); onChanged && onChanged(true); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!st) return err ? <div style={{ color: '#b91c1c' }}>{err}</div> : <div style={{ color: '#94a3b8' }}>Loading score…</div>;

  const cur = st.current;
  const curInn = cur ? st.innings.find((x) => x.id === cur.innings_id) : null;
  const scoring = st.can_score && st.status === 'live';
  const nameIn = (list, id) => list?.find((p) => p.player_id === id)?.name || '';
  const atCrease = curInn ? curInn.batting.filter((p) => p.at_crease) : [];
  const needPick = scoring && cur && cur.status === 'in_progress' && (!cur.striker_id || !cur.non_striker_id || !cur.bowler_id);
  const crr = cur && cur.legal_balls ? ((cur.runs * 6) / cur.legal_balls).toFixed(2) : '0.00';
  const rrr = cur && cur.target && cur.balls_left ? ((cur.runs_needed * 6) / cur.balls_left).toFixed(2) : null;

  const send = (runs) => {
    if (wheelOn && (runs > 0 || extra === 'wide' || extra === 'no_ball')) { setShot({ runs }); return; }
    sendNow(runs, null);
  };
  // #19 every ball gets automatic commentary (25+ words); the scorer's own note is added at the end
  const autoComment = (p, dir) => {
    if (!cur) return comment;
    const isLegal = !p.extra || p.extra === 'bye' || p.extra === 'leg_bye';
    const exRuns = p.extra === 'wide' ? (rules.wide_runs ?? 1) + (p.extras || 0) : p.extra === 'no_ball' ? (rules.no_ball_runs ?? 1) + (p.extras || 0) : (p.extras || 0);
    const lb = cur.legal_balls || 0;
    const outId = p.wicket ? (p.out === 'non_striker' ? cur.non_striker_id : cur.striker_id) : null;
    const strikerInfo = cur.batting_side?.find((x) => x.player_id === cur.striker_id);
    try {
      return makeCommentary({
        over: `${Math.floor(lb / 6)}.${(lb % 6) + 1}`, bowler: nameIn(cur.bowling_side, cur.bowler_id), batter: strikerInfo?.name || '',
        runs: p.runs || 0, extra: p.extra || null, extraRuns: exRuns, wicket: p.wicket || null, outName: outId ? nameIn(cur.batting_side, outId) : '',
        fielder: p.fielder_id ? nameIn(cur.bowling_side, p.fielder_id) : '', angle: dir ? dir.angle : null, dist: dir ? dir.dist : null,
        leftHanded: /left/i.test(strikerInfo?.batting_style || ''), team: curInn?.batting_team?.name, total: (cur.runs || 0) + (p.runs || 0) + exRuns,
        wickets: (cur.wickets || 0) + (p.wicket && p.wicket !== 'retired_hurt' ? 1 : 0), legalAfter: lb + (isLegal ? 1 : 0), target: cur.target || null,
        freeHitNext: p.extra === 'no_ball' && rules.free_hit !== false, note: comment
      });
    } catch { return comment; }
  };
  const sendNow = (runs, dir) => {
    const p = { runs: 0, extras: 0 };
    if (dir) { p.shot_angle = dir.angle; p.shot_dist = dir.dist; }
    if (extra === 'wide') p.extras = runs;
    else if (extra === 'bye' || extra === 'leg_bye') { if (!runs) { setErr('Byes / leg-byes need at least 1 run.'); return; } p.extras = runs; }
    else p.runs = runs;
    if (extra) p.extra = extra;
    p.commentary = autoComment(p, dir);
    submit('ball', p, () => { setExtra(null); setComment(''); });
    setShot(null);
  };
  const sendWicket = () => {
    if (!wk?.type) { setErr('Choose how the batter got out.'); return; }
    const p = { wicket: wk.type, out: wk.out || 'striker', fielder_id: wk.fielder || null, commentary: comment, runs: 0, extras: 0 };
    const r = Number(wk.runs || 0);
    if (extra) { p.extra = extra; if (extra === 'no_ball') p.extras = r; else p.extras = extra === 'wide' ? r : Math.max(r, 1); }
    else p.runs = r;
    p.commentary = autoComment(p, null);
    submit('ball', p, () => { setWk(null); setExtra(null); setComment(''); });
  };

  // Playing conditions (Category E): free hit, powerplay, bowler quota, retire-at, extras and LBW switched on/off
  const rules = rs?.rules || {};
  const lastQueued = [...queue].reverse().find((a) => a.kind === 'ball');
  const freeHit = rules.free_hit !== false && (lastQueued ? lastQueued.payload.extra === 'no_ball' : !!rs?.free_hit_next);
  const powerplay = cur && cur.status === 'in_progress' && (rules.powerplay_overs || 0) > Math.floor(cur.legal_balls / 6);
  const maxOvers = rules.max_overs_per_bowler || null;
  const bowlerBalls = (id) => curInn?.bowling.find((x) => x.player_id === id)?.legal_balls ?? (rs?.bowler_overs?.[id] || 0);
  const atQuota = (id) => !!maxOvers && bowlerBalls(id) >= maxOvers * 6;
  const mustRetire = rules.retire_at ? atCrease.filter((p) => p.runs >= rules.retire_at) : [];
  const extraButtons = [['wide', 'Wide'], ['no_ball', 'No ball'], ['bye', 'Bye'], ['leg_bye', 'Leg bye']]
    .filter(([v]) => (v !== 'bye' || rules.byes !== false) && (v !== 'leg_bye' || rules.leg_byes !== false));
  const wicketChoices = WICKETS.filter(([v]) => (v !== 'lbw' || rules.lbw !== false)
    && (!freeHit || ['run_out', 'obstructing', 'retired_hurt', 'retired_out', 'timed_out'].includes(v)));

  const available = cur ? cur.batting_side.filter((p) => !p.out && p.player_id !== cur.striker_id && p.player_id !== cur.non_striker_id) : [];
  const bowlers = cur ? cur.bowling_side : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {err && <div style={{ padding: '0.6rem 0.85rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><AlertCircle size={15} /> {err}</div>}

      {/* #26 #27 offline status */}
      {mode === 'live' && st?.can_score && (!online || queue.length > 0 || syncError) && (
        <div style={{ padding: '0.65rem 0.9rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap',
                      backgroundColor: syncError ? '#fef2f2' : '#fffbeb', border: `1px solid ${syncError ? '#fecaca' : '#fde68a'}`, color: syncError ? '#b91c1c' : '#92400e' }}>
          {online ? <RefreshCw size={15} /> : <WifiOff size={15} />}
          <span style={{ flex: 1 }}>
            {!online ? 'No internet – keep scoring. ' : syncing ? 'Uploading… ' : ''}
            {queue.length > 0 ? `${queue.length} action${queue.length === 1 ? '' : 's'} saved on this device, waiting to upload.` : !online ? 'Nothing waiting.' : ''}
            {syncError ? ` ${syncError}` : ''}
          </span>
          {online && queue.length > 0 && !syncing && <Button variant="secondary" size="sm" onClick={() => { setSyncError(null); flush(); }}>Upload now</Button>}
          {syncError && queue.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => window.confirm(`Delete the ${queue.length} unsent action(s) on this device?`) && (updateQueue([]), setSyncError(null), load())}>Discard unsent</Button>
          )}
        </div>
      )}
      {mode === 'live' && st?.current?._endedOffline && queue.length > 0 && (
        <div style={{ padding: '0.6rem 0.9rem', borderRadius: '0.5rem', fontSize: '0.85rem', backgroundColor: '#eff6ff', color: '#1e3a8a' }}>
          The innings is over. The next innings opens as soon as the balls are uploaded.
        </div>
      )}

      {/* Scoreboard */}
      {mode === 'live' && curInn && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{curInn.batting_team.name} · {curInn.is_super_over ? <strong style={{ color: '#7c3aed' }}>SUPER OVER</strong> : `innings ${curInn.innings_no}`}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.1 }}>{cur.runs}/{cur.wickets} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>({oversText(cur.legal_balls)}{st.overs_limit ? ` / ${st.overs_limit}` : ''} ov)</span></div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#334155' }}>
                <div>CRR {crr}{rrr ? ` · RRR ${rrr}` : ''}</div>
                {cur.target && cur.status === 'in_progress' && <div style={{ fontWeight: 800, color: '#b45309' }}>Need {cur.runs_needed} from {cur.balls_left ?? '?'} balls</div>}
                {cur.target && <div>Target {cur.target}</div>}
              </div>
            </div>
            {st.status === 'live' && cur.status === 'in_progress' && (
              <>
                {/* Batters at the crease – full details */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 420 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.75rem', textAlign: 'right' }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th><th style={{ paddingRight: '0.6rem' }} title="Minutes at the crease">M</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atCrease.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '0.5rem 0.6rem', color: '#94a3b8' }}>Batters not picked yet</td></tr>
                      ) : [...atCrease].sort((x, y) => (y.on_strike ? 1 : 0) - (x.on_strike ? 1 : 0)).map((p) => (
                        <tr key={p.player_id} style={{ textAlign: 'right', borderTop: '1px solid #f1f5f9', backgroundColor: p.on_strike ? '#ecfdf5' : 'transparent' }}>
                          <td style={{ textAlign: 'left', padding: '0.45rem 0.6rem', fontWeight: p.on_strike ? 800 : 600 }}>{p.name}{p.on_strike ? ' *' : ''}</td>
                          <td style={{ fontWeight: 800 }}>{p.runs}</td><td>{p.balls}</td><td>{p.fours}</td><td>{p.sixes}</td>
                          <td>{sr(p.runs, p.balls)}</td><td style={{ paddingRight: '0.6rem', color: '#64748b' }}>{p.minutes ?? '-'}</td>
                        </tr>
                      ))}
                      {atCrease.length === 1 && <tr><td colSpan={7} style={{ padding: '0.4rem 0.6rem', color: '#b45309', fontSize: '0.8rem' }}>New batter needed</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Bowling – current bowler and the bowler of the last over, full details */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 420 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.75rem', textAlign: 'right' }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Wd</th><th>Nb</th><th style={{ paddingRight: '0.6rem' }}>Econ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[cur.bowler_id, cur.last_over_bowler_id].filter((id, k, arr) => id && arr.indexOf(id) === k).map((id) => {
                        const f = curInn.bowling.find((x) => x.player_id === id) || { legal_balls: 0, maidens: 0, runs: 0, wickets: 0, wides: 0, no_balls: 0 };
                        const now = id === cur.bowler_id;
                        return (
                          <tr key={id} style={{ textAlign: 'right', borderTop: '1px solid #f1f5f9', backgroundColor: now ? '#eff6ff' : 'transparent', color: now ? '#0f172a' : '#64748b' }}>
                            <td style={{ textAlign: 'left', padding: '0.45rem 0.6rem', fontWeight: now ? 800 : 600 }}>{nameIn(bowlers, id) || f.name}{now ? ' *' : ' (last over)'}</td>
                            <td>{oversText(f.legal_balls)}</td><td>{f.maidens}</td><td>{f.runs}</td><td style={{ fontWeight: 800 }}>{f.wickets}</td>
                            <td>{f.wides}</td><td>{f.no_balls}</td><td style={{ paddingRight: '0.6rem' }}>{econ(f.runs, f.legal_balls)}</td>
                          </tr>
                        );
                      })}
                      {!cur.bowler_id && <tr><td colSpan={8} style={{ padding: '0.4rem 0.6rem', color: '#b45309', fontSize: '0.8rem' }}>New bowler needed for the next over</td></tr>}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', gap: '0.25rem', padding: '0.45rem 0.6rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '0.3rem' }}>{cur.bowler_id ? 'This over' : 'Last over'}:</span>
                    {cur.this_over.length === 0 ? <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span> : cur.this_over.map((b, k) => <BallChip key={k} b={b} />)}
                    {cur.this_over.length > 0 && <span style={{ fontSize: '0.78rem', color: '#334155', marginLeft: '0.3rem', fontWeight: 700 }}>= {cur.this_over.reduce((t, b) => t + b.runs + b.extra_runs, 0)} runs</span>}
                  </div>
                </div>
                {rs?.late_restriction && (
                  <div style={{ padding: '0.4rem 0.7rem', borderRadius: '0.5rem', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.8rem' }}>
                    Late-arrival penalty: {rs.late_restriction.team} may have only {rs.late_restriction.max_outside} fielders outside the circle until over {rs.late_restriction.overs} is finished.
                  </div>
                )}
                {(freeHit || powerplay || mustRetire.length > 0) && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {freeHit && <span style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', backgroundColor: '#dc2626', color: '#fff', fontWeight: 900, fontSize: '0.8rem' }}>FREE HIT – only a run out counts</span>}
                    {powerplay && <span style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 800, fontSize: '0.78rem' }}>Powerplay (overs 1–{rules.powerplay_overs}) · max {rules.fielders_outside_powerplay} fielders outside the circle</span>}
                    {mustRetire.map((p) => <span key={p.player_id} style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.78rem' }}>{p.name} reached {rules.retire_at} – must retire (Wicket → Retired out)</span>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#475569' }}>
                  {cur.partnership && <span>Partnership: <strong>{cur.partnership.runs}</strong> ({cur.partnership.balls} balls)</span>}
                  {cur.yet_to_bat?.length > 0 && <span>Yet to bat: {cur.yet_to_bat.join(', ')}</span>}
                </div>
              </>
            )}
            {st.status !== 'live' && st.result_summary && <div style={{ fontWeight: 800, color: '#065f46' }}>{st.result_summary}</div>}
          </div>
        </Card>
      )}

      {/* Pick batters / bowler (#14) */}
      {mode === 'live' && scoring && (!cur || needPick) && (
        <Card title={!cur || (!cur.striker_id && !cur.non_striker_id && cur.legal_balls === 0 && !(curInn?.batting.length)) ? 'Openers and first bowler' : 'Next batter / bowler'}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
            {(!cur || !cur.striker_id) && (
              <label style={{ fontSize: '0.75rem', color: '#64748b' }}>{cur && cur.non_striker_id ? 'New batter (on strike)' : 'Striker'}<br />
                <select value={pick.striker} onChange={(e) => setPick({ ...pick, striker: e.target.value })} style={field}>
                  <option value="">Choose</option>
                  {(cur ? available : []).filter((p) => p.player_id !== pick.non_striker).map((p) => <option key={p.player_id} value={p.player_id}>{p.name}{p.retired_hurt ? ' (retired hurt)' : ''}</option>)}
                </select>
              </label>
            )}
            {(!cur || !cur.non_striker_id) && (
              <label style={{ fontSize: '0.75rem', color: '#64748b' }}>{cur && cur.striker_id ? 'New batter (non-striker)' : 'Non-striker'}<br />
                <select value={pick.non_striker} onChange={(e) => setPick({ ...pick, non_striker: e.target.value })} style={field}>
                  <option value="">Choose</option>
                  {(cur ? available : []).filter((p) => p.player_id !== pick.striker).map((p) => <option key={p.player_id} value={p.player_id}>{p.name}{p.retired_hurt ? ' (retired hurt)' : ''}</option>)}
                </select>
              </label>
            )}
            {(!cur || !cur.bowler_id) && (
              <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Bowler<br />
                <select value={pick.bowler} onChange={(e) => setPick({ ...pick, bowler: e.target.value })} style={field}>
                  <option value="">Choose</option>
                  {bowlers.map((p) => <option key={p.player_id} value={p.player_id} disabled={p.player_id === cur?.last_over_bowler_id || atQuota(p.player_id)}>{p.name}{p.player_id === cur?.last_over_bowler_id ? ' (bowled last over)' : atQuota(p.player_id) ? ` (bowled max ${maxOvers} ov)` : maxOvers ? ` (${oversText(bowlerBalls(p.player_id))}/${maxOvers})` : ''}</option>)}
                </select>
              </label>
            )}
            <Button variant="primary" disabled={busy} onClick={() => submit('players', { striker: pick.striker || null, nonStriker: pick.non_striker || null, bowler: pick.bowler || null },
              () => setPick({ striker: '', non_striker: '', bowler: '' }))}>Continue</Button>
            {cur && (cur.innings_no > 1 || cur.legal_balls > 0 || (curInn?.batting || []).length > 0 || queue.length > 0) && (
              <button type="button" disabled={busy || syncing} onClick={() => (queue.length ? updateQueue(queue.slice(0, -1)) : act(() => dataService.undoLastBall(matchId)))}
                style={{ padding: '0.55rem 0.9rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer', border: '1px solid #cbd5e1', backgroundColor: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Undo2 size={15} /> Undo last ball
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Scoring pad (#7–#11) */}
      {mode === 'live' && scoring && cur && cur.status === 'in_progress' && !needPick && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {extraButtons.map(([v, l]) => (
                <button key={v} type="button" onClick={() => setExtra(extra === v ? null : v)}
                  style={{ padding: '0.5rem 0.9rem', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', border: `2px solid ${extra === v ? '#f59e0b' : '#e2e8f0'}`, backgroundColor: extra === v ? '#fffbeb' : '#fff' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {extra === 'wide' ? `Wide: ${rules.wide_runs ?? 1} run${(rules.wide_runs ?? 1) === 1 ? ' is' : 's are'} added. Tap 0 for a plain wide, or the number of runs the batters ran.`
                : extra === 'no_ball' ? `No ball: ${rules.no_ball_runs ?? 1} run${(rules.no_ball_runs ?? 1) === 1 ? ' is' : 's are'} added${rules.free_hit !== false ? ' and the next ball is a free hit' : ''}. Tap the runs hit off the bat (4 / 6 for a boundary).`
                : extra ? 'Tap how many runs were run.' : 'Tap the runs scored off this ball.'}
            </div>
            {shot && <WagonWheelPicker runs={shot.runs} busy={busy} leftHanded={/left/i.test(cur.batting_side?.find((x) => x.player_id === cur.striker_id)?.batting_style || '')} onPick={(d) => sendNow(shot.runs, d)} onSkip={() => sendNow(shot.runs, null)} onCancel={() => setShot(null)} onChangeRuns={(r) => setShot({ runs: r })} />}
            {!shot && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[0, 1, 2, 3, 4, 6, 5, 7].map((r) => (
                <button key={r} type="button" disabled={busy} onClick={() => send(r)}
                  style={{ padding: '0.9rem 0', fontSize: '1.3rem', fontWeight: 900, borderRadius: '0.6rem', cursor: 'pointer', border: '1px solid #cbd5e1',
                           backgroundColor: r === 4 ? '#dbeafe' : r === 6 ? '#ede9fe' : '#fff', opacity: busy ? 0.6 : 1 }}>
                  {r}
                </button>
              ))}
            </div>}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#64748b', cursor: 'pointer' }}>
              <input type="checkbox" checked={wheelOn} onChange={(e) => { setWheelOn(e.target.checked); setShot(null); try { localStorage.setItem('lcm-wagon', e.target.checked ? 'on' : 'off'); } catch { /* ignore */ } }} />
              Ask where the ball went (wagon wheel)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={() => setWk(wk ? null : { type: '', out: 'striker', fielder: '', runs: 0 })}
                style={{ flex: 1, padding: '0.8rem', fontWeight: 900, fontSize: '1rem', borderRadius: '0.6rem', cursor: 'pointer', border: 'none', backgroundColor: '#dc2626', color: '#fff' }}>
                WICKET
              </button>
              <button type="button" disabled={busy || syncing} onClick={() => (queue.length ? updateQueue(queue.slice(0, -1)) : act(() => dataService.undoLastBall(matchId)))}
                style={{ padding: '0.8rem 1rem', fontWeight: 700, borderRadius: '0.6rem', cursor: 'pointer', border: '1px solid #cbd5e1', backgroundColor: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Undo2 size={16} /> Undo
              </button>
            </div>

            {wk && (
              <div style={{ border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '0.6rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select value={wk.type} onChange={(e) => setWk({ ...wk, type: e.target.value })} style={field}>
                    <option value="">How out?</option>
                    {wicketChoices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {['run_out', 'retired_hurt', 'retired_out', 'obstructing', 'timed_out'].includes(wk.type) && (
                    <select value={wk.out} onChange={(e) => setWk({ ...wk, out: e.target.value })} style={field}>
                      <option value="striker">{nameIn(cur.batting_side, cur.striker_id)} (striker)</option>
                      <option value="non_striker">{nameIn(cur.batting_side, cur.non_striker_id)} (non-striker)</option>
                    </select>
                  )}
                  {['caught', 'run_out', 'stumped'].includes(wk.type) && (
                    <select value={wk.fielder} onChange={(e) => setWk({ ...wk, fielder: e.target.value })} style={field}>
                      <option value="">{wk.type === 'stumped' ? 'Wicket-keeper' : 'Fielder'}</option>
                      {bowlers.map((p) => <option key={p.player_id} value={p.player_id}>{p.name}{p.is_wicket_keeper ? ' (WK)' : ''}</option>)}
                    </select>
                  )}
                  {wk.type === 'run_out' && (
                    <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                      Runs completed <input type="number" min={0} max={6} value={wk.runs} onChange={(e) => setWk({ ...wk, runs: e.target.value })} style={{ ...field, width: 60 }} />
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <Button variant="primary" disabled={busy || !wk.type} onClick={sendWicket}>Save wicket</Button>
                  <Button variant="secondary" onClick={() => setWk(null)}>Cancel</Button>
                </div>
              </div>
            )}

            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentary is written automatically – add your own note here (optional)" style={{ ...field, width: '100%', boxSizing: 'border-box' }} />

            <div>
              <button type="button" onClick={() => setMenu(!menu)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>{menu ? 'Hide more options' : 'More options (penalty runs, end innings, abandon)'}</button>
              {menu && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                  {/* #123 Penalty runs */}
                  <div style={{ width: '100%', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem' }}>Penalty runs</strong>
                    <select value={pen.to} onChange={(e) => setPen({ ...pen, to: e.target.value })} style={field}>
                      <option value="batting">to {curInn?.batting_team.name || 'batting side'} (batting)</option>
                      <option value="fielding">to {curInn?.bowling_team.name || 'fielding side'} (fielding)</option>
                    </select>
                    <input type="number" min="-10" max="10" value={pen.runs} onChange={(e) => setPen({ ...pen, runs: Number(e.target.value) })} style={{ ...field, width: 70 }} />
                    <input value={pen.reason} maxLength={300} onChange={(e) => setPen({ ...pen, reason: e.target.value })} placeholder="Reason (e.g. fake fielding)" style={{ ...field, flex: 1, minWidth: 160 }} />
                    <Button variant="secondary" size="sm" disabled={busy || !pen.reason.trim() || !pen.runs || queue.length > 0 || !online}
                      onClick={() => window.confirm(`Give ${pen.runs} penalty run(s) to the ${pen.to} side?`) && act(async () => { const s = await dataService.awardPenaltyRuns(matchId, pen.to, pen.runs, pen.reason); setPen({ to: 'batting', runs: 5, reason: '' }); return s; })}>
                      Add
                    </Button>
                  </div>
                  <Button variant="secondary" disabled={busy || queue.length > 0 || !online} onClick={() => window.confirm('End this innings now? (e.g. declared, or the team cannot continue)') && act(() => dataService.endInnings(matchId, 'closed'))} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Flag size={14} /> End innings
                  </Button>
                  <input value={abandonReason} onChange={(e) => setAbandonReason(e.target.value)} placeholder="Reason (e.g. rain)" style={field} />
                  <Button variant="secondary" disabled={busy || !abandonReason.trim() || queue.length > 0 || !online} onClick={() => window.confirm('Abandon this match? It will count as no result.') && act(() => dataService.abandonMatch(matchId, abandonReason))} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CloudRain size={14} /> Abandon match
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* #121 Super Over after a tie */}
      {mode === 'live' && st.can_score && st.status === 'completed' && st.result_type === 'tie' && st.match_type !== 'two_innings' && st.innings.length > 0 && (
        <Card title="Match tied – play a Super Over?">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span>One over each. {st.innings[st.innings.length - 1].batting_team.name} (batted last) bat first.</span>
            <label>Wickets <select value={soWickets} onChange={(e) => setSoWickets(Number(e.target.value))} style={field}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <Button variant="primary" disabled={busy || !online} onClick={() => act(() => dataService.startSuperOver(matchId, soWickets))}>Start Super Over</Button>
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Super Over runs do not count toward team totals, net run rate or player statistics.</p>
        </Card>
      )}

      {/* #120 Follow-on (two-innings matches, start of innings 3) */}
      {mode === 'live' && scoring && st.match_type === 'two_innings' && cur && cur.innings_no === 3 && cur.legal_balls === 0 && st.innings.length >= 2
        && st.innings[0].batting_team.id === cur.batting_team_id && st.innings[0].runs > st.innings[1].runs && (
        <Card>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span>{st.innings[0].batting_team.name} lead by <strong>{st.innings[0].runs - st.innings[1].runs}</strong> runs.</span>
            <Button variant="secondary" size="sm" disabled={busy || !online} onClick={() => window.confirm(`Ask ${st.innings[1].batting_team.name} to follow on (bat again)?`) && act(() => dataService.enforceFollowOn(matchId))}>Enforce follow-on</Button>
          </div>
        </Card>
      )}

      {/* Undo after the match ended (score correction) */}
      {mode === 'live' && st.can_score && st.status === 'completed' && st.innings.length > 0 && (
        <div>
          <Button variant="secondary" disabled={busy} onClick={() => window.confirm('Re-open the match and undo the last ball?') && act(() => dataService.undoLastBall(matchId))} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Undo2 size={14} /> Undo last ball (re-open match)
          </Button>
        </div>
      )}

      {/* Recent balls */}
      {mode === 'live' && cur && cur.recent.length > 0 && (
        <Card title="Recent balls">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.84rem' }}>
            {cur.recent.map((b) => (
              <React.Fragment key={b.seq}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <span style={{ width: 34, color: '#94a3b8', fontSize: '0.75rem' }}>{b.over}</span>
                <BallChip b={b} />
                <span>
                  {b.bowler} to {b.batter}: {b.wicket ? <strong style={{ color: '#b91c1c' }}>{b.out_name} {WICKET_LABEL[b.wicket]?.toLowerCase()}</strong>
                    : b.extra ? `${b.extra.replace('_', ' ')}${b.runs ? `, ${b.runs} off the bat` : ''}` : b.runs === 0 ? 'no run' : `${b.runs} run${b.runs === 1 ? '' : 's'}`}
                  <span style={{ display: 'block', color: '#475569', marginTop: '0.15rem' }}>
                    {b.commentary?.trim() || makeCommentary({
                      ...b, extraRuns: b.extra_runs, outName: b.out_name,
                      angle: b.shot_angle, dist: b.shot_dist
                    })}
                  </span>
                  {b.pending ? <span style={{ color: '#b45309', fontSize: '0.72rem' }}> (not uploaded yet)</span> : null}
                </span>
                {scoring && !b.pending && !queue.length && st.status === 'live' && editSeq !== b.seq && (
                  <button type="button" onClick={() => setEditSeq(b.seq)} style={{ marginLeft: 'auto', flexShrink: 0, border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer' }}>Edit</button>
                )}
              </div>
              {editSeq === b.seq && (
                <BallEditor b={b} rules={rules} busy={busy} onCancel={() => setEditSeq(null)}
                  onSave={(v) => act(async () => {
                    const commentary = makeCommentary({ over: b.over, bowler: b.bowler, batter: b.batter, runs: v.runs, extra: v.extra,
                      extraRuns: v.extra === 'wide' ? (rules.wide_runs ?? 1) + v.extras : v.extra === 'no_ball' ? (rules.no_ball_runs ?? 1) : v.extras,
                      angle: b.shot_angle, dist: b.shot_dist, freeHitNext: v.extra === 'no_ball' && rules.free_hit !== false });
                    const r = await dataService.editBall(matchId, b.seq, { ...v, commentary });
                    setEditSeq(null);
                    return r;
                  })} />
              )}
              </React.Fragment>
            ))}
          </div>
        </Card>
      )}

      {/* #23 Match summary */}
      {mode === 'scorecard' && st.innings.length > 0 && (
        <Card title="Match summary">
          {st.result_summary && <div style={{ fontWeight: 800, color: '#065f46', marginBottom: '0.6rem' }}>{st.result_summary}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {st.innings.map((inn) => {
              const topBat = [...inn.batting].sort((x, y) => y.runs - x.runs || x.balls - y.balls).slice(0, 2);
              const topBowl = [...inn.bowling].sort((x, y) => y.wickets - x.wickets || x.runs - y.runs).slice(0, 2);
              return (
                <div key={inn.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: '0.35rem' }}>
                    <span>{inn.batting_team.name}{inn.is_super_over ? ' (Super Over)' : ''}</span><span>{inn.runs}/{inn.wickets} ({oversText(inn.legal_balls)})</span>
                  </div>
                  {topBat.map((p) => <div key={p.player_id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{p.name}</span><span><strong>{p.runs}</strong> ({p.balls})</span></div>)}
                  <div style={{ borderTop: '1px dashed #e2e8f0', margin: '0.3rem 0' }} />
                  {topBowl.map((b) => <div key={b.player_id} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}><span>{b.name}</span><span><strong>{b.wickets}-{b.runs}</strong> ({oversText(b.legal_balls)})</span></div>)}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Scorecards (#21 #22) */}
      {mode === 'scorecard' && st.innings.length === 0 && (
        <Card><span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>The scorecard appears after the first ball.</span></Card>
      )}
      {mode === 'scorecard' && st.innings.length > 0 && (
        <Card title="Scorecard">
          {st.innings.map((inn) => (
            <div key={inn.id} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderBottom: '2px solid #0f172a', paddingBottom: '0.3rem', marginBottom: '0.3rem' }}>
                <span>{inn.batting_team.name}{inn.is_super_over ? ' (Super Over)' : ''}</span>
                <span>{inn.runs}/{inn.wickets} ({oversText(inn.legal_balls)} ov)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead><tr style={{ color: '#64748b', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>Batter</th><th style={{ textAlign: 'left' }}></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th><th title="Minutes at the crease">M</th></tr></thead>
                <tbody>
                  {inn.batting.map((p) => (
                    <tr key={p.player_id} style={{ textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'left', fontWeight: 700, padding: '0.25rem 0' }}>{p.name}{p.on_strike ? ' *' : ''}</td>
                      <td style={{ textAlign: 'left', color: '#64748b' }}>{p.at_crease && !p.out ? 'not out' : dismissalText(p.out)}</td>
                      <td style={{ fontWeight: 800 }}>{p.runs}</td><td>{p.balls}</td><td>{p.fours}</td><td>{p.sixes}</td><td>{sr(p.runs, p.balls)}</td><td style={{ color: '#64748b' }}>{p.minutes ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '0.78rem', color: '#475569', margin: '0.3rem 0' }}>
                Extras {inn.extras} (wd {inn.extras_detail.wides}, nb {inn.extras_detail.no_balls}, b {inn.extras_detail.byes}, lb {inn.extras_detail.leg_byes}{inn.penalty_runs ? `, pen ${inn.penalty_runs}` : ''})
                {inn.fall_of_wickets.length > 0 && <> · Fall of wickets: {inn.fall_of_wickets.map((f) => `${f.runs}-${f.wicket} (${f.name}, ${f.over})`).join(', ')}</>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                <thead><tr style={{ color: '#64748b', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Wd</th><th>Nb</th><th>Econ</th></tr></thead>
                <tbody>
                  {inn.bowling.map((b) => (
                    <tr key={b.player_id} style={{ textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'left', fontWeight: 700, padding: '0.25rem 0' }}>{b.name}</td>
                      <td>{oversText(b.legal_balls)}</td><td>{b.maidens}</td><td>{b.runs}</td><td style={{ fontWeight: 800 }}>{b.wickets}</td><td>{b.wides}</td><td>{b.no_balls}</td><td>{econ(b.runs, b.legal_balls)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export default ScoringPanel;
