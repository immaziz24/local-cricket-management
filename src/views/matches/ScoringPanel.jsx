import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Undo2, AlertCircle, Flag, CloudRain } from 'lucide-react';

/**
 * Ball-by-ball scoring (#7–#19): runs, extras, wickets, automatic strike change, end of over,
 * bowler changes, innings changeover, target, result, undo, end innings, abandon.
 * Spectators see the same live score, refreshed every 10 seconds.
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

export function ScoringPanel({ matchId, onChanged, mode = 'live', refreshKey = 0 }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState(null); // wide | no_ball | bye | leg_bye
  const [wk, setWk] = useState(null); // { type, out, fielder, runs }
  const [pick, setPick] = useState({ striker: '', non_striker: '', bowler: '' });
  const [comment, setComment] = useState('');
  const [menu, setMenu] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const lastStatus = useRef(null);

  const load = async () => {
    try {
      let s = await dataService.fetchLiveState(matchId);
      // scorer opens a live match with no innings yet: create innings 1 so the openers can be picked
      if (s.can_score && s.status === 'live' && !s.current) s = await dataService.setInningsPlayers(matchId, {});
      setSt(s); setErr(null); return s;
    } catch (e) { setErr(e.message); return null; }
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
  const bowlerFig = curInn?.bowling.find((b) => b.player_id === cur?.bowler_id);
  const needPick = scoring && cur && cur.status === 'in_progress' && (!cur.striker_id || !cur.non_striker_id || !cur.bowler_id);
  const crr = cur && cur.legal_balls ? ((cur.runs * 6) / cur.legal_balls).toFixed(2) : '0.00';
  const rrr = cur && cur.target && cur.balls_left ? ((cur.runs_needed * 6) / cur.balls_left).toFixed(2) : null;

  const send = (runs) => {
    const p = { runs: 0, extras: 0, commentary: comment };
    if (extra === 'wide') p.extras = runs;
    else if (extra === 'bye' || extra === 'leg_bye') { if (!runs) { setErr('Byes / leg-byes need at least 1 run.'); return; } p.extras = runs; }
    else p.runs = runs;
    if (extra) p.extra = extra;
    act(async () => { const s = await dataService.recordBall(matchId, p); setExtra(null); setComment(''); return s; });
  };
  const sendWicket = () => {
    if (!wk?.type) { setErr('Choose how the batter got out.'); return; }
    const p = { wicket: wk.type, out: wk.out || 'striker', fielder_id: wk.fielder || null, commentary: comment, runs: 0, extras: 0 };
    const r = Number(wk.runs || 0);
    if (extra) { p.extra = extra; if (extra === 'no_ball') p.extras = r; else p.extras = extra === 'wide' ? r : Math.max(r, 1); }
    else p.runs = r;
    act(async () => { const s = await dataService.recordBall(matchId, p); setWk(null); setExtra(null); setComment(''); return s; });
  };

  const available = cur ? cur.batting_side.filter((p) => !p.out && p.player_id !== cur.striker_id && p.player_id !== cur.non_striker_id) : [];
  const bowlers = cur ? cur.bowling_side : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {err && <div style={{ padding: '0.6rem 0.85rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><AlertCircle size={15} /> {err}</div>}

      {/* Scoreboard */}
      {mode === 'live' && curInn && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{curInn.batting_team.name} · innings {curInn.innings_no}</div>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', fontSize: '0.88rem' }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem 0.65rem' }}>
                    {atCrease.length === 0 ? <span style={{ color: '#94a3b8' }}>Batters not picked</span> : atCrease.map((p) => (
                      <div key={p.player_id} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: p.on_strike ? 800 : 500 }}>
                        <span>{p.name}{p.on_strike ? ' *' : ''}</span>
                        <span>{p.runs} ({p.balls}) <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>SR {sr(p.runs, p.balls)}</span></span>
                      </div>
                    ))}
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem 0.65rem' }}>
                    {cur.bowler_id ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{nameIn(bowlers, cur.bowler_id)}</strong>
                        <span>{bowlerFig ? `${oversText(bowlerFig.legal_balls)}-${bowlerFig.maidens}-${bowlerFig.runs}-${bowlerFig.wickets}` : '0.0-0-0-0'}</span>
                      </div>
                    ) : <span style={{ color: '#94a3b8' }}>New bowler needed</span>}
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                      {cur.this_over.map((b, i) => <BallChip key={i} b={b} />)}
                    </div>
                  </div>
                </div>
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
                  {bowlers.map((p) => <option key={p.player_id} value={p.player_id} disabled={p.player_id === cur?.last_over_bowler_id}>{p.name}{p.player_id === cur?.last_over_bowler_id ? ' (bowled last over)' : ''}</option>)}
                </select>
              </label>
            )}
            <Button variant="primary" disabled={busy} onClick={() => act(async () => {
              const s = await dataService.setInningsPlayers(matchId, { striker: pick.striker || null, nonStriker: pick.non_striker || null, bowler: pick.bowler || null });
              setPick({ striker: '', non_striker: '', bowler: '' });
              return s;
            })}>Continue</Button>
          </div>
        </Card>
      )}

      {/* Scoring pad (#7–#11) */}
      {mode === 'live' && scoring && cur && cur.status === 'in_progress' && !needPick && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[['wide', 'Wide'], ['no_ball', 'No ball'], ['bye', 'Bye'], ['leg_bye', 'Leg bye']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setExtra(extra === v ? null : v)}
                  style={{ padding: '0.5rem 0.9rem', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', border: `2px solid ${extra === v ? '#f59e0b' : '#e2e8f0'}`, backgroundColor: extra === v ? '#fffbeb' : '#fff' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {extra === 'wide' ? 'Wide: 1 run is added. Tap 0 for a plain wide, or the number of runs the batters ran.'
                : extra === 'no_ball' ? 'No ball: 1 run is added. Tap the runs hit off the bat (4 / 6 for a boundary).'
                : extra ? 'Tap how many runs were run.' : 'Tap the runs scored off this ball.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[0, 1, 2, 3, 4, 6, 5, 7].map((r) => (
                <button key={r} type="button" disabled={busy} onClick={() => send(r)}
                  style={{ padding: '0.9rem 0', fontSize: '1.3rem', fontWeight: 900, borderRadius: '0.6rem', cursor: 'pointer', border: '1px solid #cbd5e1',
                           backgroundColor: r === 4 ? '#dbeafe' : r === 6 ? '#ede9fe' : '#fff', opacity: busy ? 0.6 : 1 }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={() => setWk(wk ? null : { type: '', out: 'striker', fielder: '', runs: 0 })}
                style={{ flex: 1, padding: '0.8rem', fontWeight: 900, fontSize: '1rem', borderRadius: '0.6rem', cursor: 'pointer', border: 'none', backgroundColor: '#dc2626', color: '#fff' }}>
                WICKET
              </button>
              <button type="button" disabled={busy} onClick={() => act(() => dataService.undoLastBall(matchId))}
                style={{ padding: '0.8rem 1rem', fontWeight: 700, borderRadius: '0.6rem', cursor: 'pointer', border: '1px solid #cbd5e1', backgroundColor: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Undo2 size={16} /> Undo
              </button>
            </div>

            {wk && (
              <div style={{ border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '0.6rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select value={wk.type} onChange={(e) => setWk({ ...wk, type: e.target.value })} style={field}>
                    <option value="">How out?</option>
                    {WICKETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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

            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentary for this ball (optional)" style={{ ...field, width: '100%', boxSizing: 'border-box' }} />

            <div>
              <button type="button" onClick={() => setMenu(!menu)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>{menu ? 'Hide more options' : 'More options (end innings, abandon)'}</button>
              {menu && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                  <Button variant="secondary" disabled={busy} onClick={() => window.confirm('End this innings now? (e.g. declared, or the team cannot continue)') && act(() => dataService.endInnings(matchId, 'closed'))} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Flag size={14} /> End innings
                  </Button>
                  <input value={abandonReason} onChange={(e) => setAbandonReason(e.target.value)} placeholder="Reason (e.g. rain)" style={field} />
                  <Button variant="secondary" disabled={busy || !abandonReason.trim()} onClick={() => window.confirm('Abandon this match? It will count as no result.') && act(() => dataService.abandonMatch(matchId, abandonReason))} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CloudRain size={14} /> Abandon match
                  </Button>
                </div>
              )}
            </div>
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
              <div key={b.seq} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <span style={{ width: 34, color: '#94a3b8', fontSize: '0.75rem' }}>{b.over}</span>
                <BallChip b={b} />
                <span>
                  {b.bowler} to {b.batter}: {b.wicket ? <strong style={{ color: '#b91c1c' }}>{b.out_name} {WICKET_LABEL[b.wicket]?.toLowerCase()}</strong>
                    : b.extra ? `${b.extra.replace('_', ' ')}${b.runs ? `, ${b.runs} off the bat` : ''}` : b.runs === 0 ? 'no run' : `${b.runs} run${b.runs === 1 ? '' : 's'}`}
                  {b.commentary ? <span style={{ color: '#64748b' }}> – {b.commentary}</span> : null}
                </span>
              </div>
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
                    <span>{inn.batting_team.name}</span><span>{inn.runs}/{inn.wickets} ({oversText(inn.legal_balls)})</span>
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
                <span>{inn.batting_team.name}</span>
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
                Extras {inn.extras} (wd {inn.extras_detail.wides}, nb {inn.extras_detail.no_balls}, b {inn.extras_detail.byes}, lb {inn.extras_detail.leg_byes})
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
