import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { makeCommentary } from './commentary.js';
import { ballLabel } from './ScoringPanel.jsx';

/**
 * #20 Live commentary: every ball written out, newest first, with an end-of-over summary
 * (runs in the over, score, bowler figures, batters at the crease). Refreshes every 10 s while live.
 */

const DISMISSAL = {
  bowled: (b) => `b ${b.bowler}`,
  caught: (b) => `c ${b.fielder || 'sub'} b ${b.bowler}`,
  caught_and_bowled: (b) => `c & b ${b.bowler}`,
  lbw: (b) => `lbw b ${b.bowler}`,
  stumped: (b) => `st ${b.fielder || ''} b ${b.bowler}`,
  run_out: (b) => `run out${b.fielder ? ` (${b.fielder})` : ''}`,
  hit_wicket: (b) => `hit wicket b ${b.bowler}`,
  retired_hurt: () => 'retired hurt',
  retired_out: () => 'retired out',
  obstructing: () => 'obstructing the field',
  timed_out: () => 'timed out'
};

function describe(b) {
  if (b.wicket) {
    const base = b.extra === 'wide' ? 'wide, ' : b.extra === 'no_ball' ? 'no ball, ' : '';
    return { text: `${base}${b.wicket === 'retired_hurt' ? '' : 'OUT! '}${b.out_name} ${DISMISSAL[b.wicket] ? DISMISSAL[b.wicket](b) : b.wicket}`, tone: b.wicket === 'retired_hurt' ? 'note' : 'out' };
  }
  if (b.extra === 'wide') return { text: b.extra_runs > 1 ? `wide, ${b.extra_runs - 1} run${b.extra_runs - 1 === 1 ? '' : 's'} as well` : 'wide', tone: 'extra' };
  if (b.extra === 'no_ball') return { text: b.runs === 6 ? 'no ball, SIX!' : b.runs === 4 ? 'no ball, FOUR!' : b.runs ? `no ball, ${b.runs} off the bat` : b.extra_runs > 1 ? `no ball, ${b.extra_runs - 1} bye${b.extra_runs - 1 === 1 ? '' : 's'}` : 'no ball', tone: 'extra' };
  if (b.extra === 'bye') return { text: `${b.extra_runs} bye${b.extra_runs === 1 ? '' : 's'}`, tone: 'extra' };
  if (b.extra === 'leg_bye') return { text: `${b.extra_runs} leg bye${b.extra_runs === 1 ? '' : 's'}`, tone: 'extra' };
  if (b.runs === 6) return { text: 'SIX!', tone: 'six' };
  if (b.runs === 4) return { text: 'FOUR!', tone: 'four' };
  if (b.runs === 0) return { text: 'no run', tone: 'dot' };
  return { text: `${b.runs} run${b.runs === 1 ? '' : 's'}`, tone: 'run' };
}

const ovs = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;

/** Walk the balls in order and build lines plus end-of-over summaries. */
function buildFeed(inn) {
  const bat = {}; const bowl = {}; const lines = [];
  let legal = 0; let overRuns = 0; let overWkts = 0; let curOver = null;
  inn.balls.forEach((b, idx) => {
    if (curOver === null) curOver = b.over_no;
    const batKey = b.batter;
    bat[batKey] = bat[batKey] || { r: 0, b: 0 };
    bat[batKey].r += b.runs;
    if (b.extra !== 'wide') bat[batKey].b += 1;
    bowl[b.bowler] = bowl[b.bowler] || { balls: 0, r: 0, w: 0 };
    if (b.legal) { bowl[b.bowler].balls += 1; legal += 1; }
    bowl[b.bowler].r += b.runs + (['wide', 'no_ball'].includes(b.extra) ? b.extra_runs : 0);
    if (b.is_wicket && !['run_out', 'retired_out', 'obstructing', 'timed_out'].includes(b.wicket)) bowl[b.bowler].w += 1;
    overRuns += b.runs + b.extra_runs; if (b.is_wicket) overWkts += 1;
    const d = describe(b);
    const outScore = b.wicket && b.out_name && bat[b.out_name] ? ` ${bat[b.out_name].r}(${bat[b.out_name].b})` : '';
    lines.push({ kind: 'ball', key: `b${b.seq}`, over: `${b.over_no}.${b.ball_in_over}`, b, text: `${b.bowler} to ${b.batter}, ${d.text}${outScore}`, tone: d.tone, note: b.commentary });
    const next = inn.balls[idx + 1];
    const overDone = b.legal && legal % 6 === 0;
    if (overDone) {
      const fig = bowl[b.bowler];
      lines.push({
        kind: 'over', key: `o${b.over_no}`, over: b.over_no + 1, runs: overRuns, wkts: overWkts, score: `${b.score}/${b.wkts}`,
        bowler: `${b.bowler} ${ovs(fig.balls)}-${fig.r}-${fig.w}`,
        batters: [b.batter, b.non_striker].filter((n, i, a) => n && a.indexOf(n) === i && !(b.is_wicket && n === b.out_name))
          .map((n) => `${n} ${bat[n] ? bat[n].r : 0}(${bat[n] ? bat[n].b : 0})`).join(', ')
      });
      overRuns = 0; overWkts = 0;
    }
    if (next && next.over_no !== b.over_no && !overDone) { overRuns = 0; overWkts = 0; }
  });
  return lines.reverse();
}

const TONE = { out: '#dc2626', six: '#7c3aed', four: '#2563eb', extra: '#d97706', dot: '#94a3b8', run: '#0f172a', note: '#b45309' };
const RUN_COLORS = ['#475569', '#047857', '#0e7490', '#4338ca', '#1d4ed8', '#a21caf', '#7e22ce', '#9f1239'];
const EXTRA_COLORS = { wide: '#b45309', no_ball: '#c2410c', bye: '#3f6212', leg_bye: '#854d0e' };

export function CommentaryPanel({ matchId, live, refreshKey = 0, byOver = false }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [inn, setInn] = useState(null);

  const load = async () => {
    try { const d = await dataService.fetchCommentary(matchId); setData(d || []); setErr(null); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [matchId, refreshKey]);
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [live, matchId]);

  if (err) return <Card><span style={{ color: '#b91c1c' }}>{err}</span></Card>;
  if (!data) return <div style={{ color: '#94a3b8' }}>Loading commentary…</div>;
  if (data.length === 0) return <Card><span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Commentary starts with the first ball.</span></Card>;

  const shown = data.find((x) => x.innings_no === inn) || data[data.length - 1];
  const feed = buildFeed(shown);
  const overs = new Map();
  if (byOver) {
    for (const line of [...feed].reverse()) {
      if (line.kind !== 'ball') continue;
      const number = Number(line.b.over_no) + 1;
      if (!overs.has(number)) overs.set(number, []);
      overs.get(number).push(line);
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {data.map((x) => (
          <button key={x.innings_no} type="button" onClick={() => setInn(x.innings_no)}
            style={{ padding: '0.35rem 0.8rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                     border: `1px solid ${shown.innings_no === x.innings_no ? '#0f172a' : '#cbd5e1'}`, backgroundColor: shown.innings_no === x.innings_no ? '#0f172a' : '#fff', color: shown.innings_no === x.innings_no ? '#fff' : '#334155' }}>
            {x.batting_team} {x.runs}/{x.wickets} ({ovs(x.legal_balls)})
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {byOver ? Array.from(overs, ([number, balls]) => (
          <section key={number} style={{ marginBottom: '0.75rem', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '0.65rem', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Over {number}</h3>
              <span style={{ color: '#475569', fontSize: '0.85rem' }}>{balls.reduce((total, { b }) => total + b.runs + b.extra_runs, 0)} runs · {balls.filter(({ b }) => b.legal).length} legal balls</span>
            </div>
            <ol aria-label={`Deliveries in over ${number}`} tabIndex={0}
              style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', listStyle: 'none', margin: 0, padding: '0.65rem 0.15rem 0.3rem' }}>
              {balls.map(({ key, b, over, text, tone }) => {
                const label = b.extra && tone === 'out' ? `W+${ballLabel({ ...b, wicket: null })}` : ballLabel(b);
                return (
                  <li key={key} title={`${over} · ${text}`} aria-label={`${over} · ${text}`}
                    style={{ flexShrink: 0, minWidth: '2.25rem', height: '2.25rem', padding: '0 0.35rem', borderRadius: '999px', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 800,
                      background: EXTRA_COLORS[b.extra] || (tone === 'out' ? '#b91c1c' : RUN_COLORS[b.runs] || '#334155') }}>
                    {label}
                  </li>
                );
              })}
            </ol>
          </section>
        )) : feed.map((l) => l.kind === 'over' ? (
          <div key={l.key} style={{ margin: '0.5rem 0', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', fontSize: '0.8rem', color: '#0f172a' }}>
            <strong>End of over {l.over}</strong> · {l.runs} run{l.runs === 1 ? '' : 's'}{l.wkts ? `, ${l.wkts} wicket${l.wkts === 1 ? '' : 's'}` : ''} · <strong>{shown.batting_team} {l.score}</strong>
            <div style={{ color: '#475569', marginTop: '0.15rem' }}>{l.batters}{l.batters ? ' · ' : ''}{l.bowler}</div>
          </div>
        ) : (
          <div key={l.key} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ width: 34, color: '#94a3b8', fontSize: '0.78rem', paddingTop: '0.35rem' }}>{l.over}</span>
            <span style={{ minWidth: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800,
                           backgroundColor: l.tone === 'out' ? '#dc2626' : l.tone === 'six' ? '#7c3aed' : l.tone === 'four' ? '#2563eb' : l.tone === 'extra' ? '#f59e0b' : '#e2e8f0',
                           color: ['out', 'six', 'four', 'extra'].includes(l.tone) ? '#fff' : '#0f172a', padding: '0 4px' }}>{ballLabel({ ...l.b, wicket: l.b.wicket })}</span>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.4 }}>
              <span style={{ color: TONE[l.tone], fontWeight: ['out', 'six', 'four'].includes(l.tone) ? 800 : 500 }}>{l.text}</span>
              <div style={{ color: '#475569', fontSize: '0.82rem' }}>{l.note || makeCommentary({ ...l.b, extraRuns: l.b.extra_runs, outName: l.b.out_name, team: shown.batting_team, total: l.b.score, wickets: l.b.wkts })}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default CommentaryPanel;
