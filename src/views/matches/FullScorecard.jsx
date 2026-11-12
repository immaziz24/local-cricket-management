import React, { useEffect, useMemo, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { dismissalText, oversText } from './ScoringPanel.jsx';
import { WagonWheel } from './WagonWheel.jsx';

/**
 * #21 Full batting scorecard, #22 full bowling scorecard, #23 summary – international-style layout:
 * innings tabs, coloured innings bar, batting with dismissals, extras, total, yet to bat,
 * fall of wickets, bowling, partnerships and each batter's wagon wheel.
 */
const sr = (r, b) => (b ? ((r * 100) / b).toFixed(2) : '0.00');
const eco = (r, b) => (b ? ((r * 6) / b).toFixed(2) : '0.00');
const GREEN = '#059669';
const th = { padding: '0.55rem 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#334155', textAlign: 'right', whiteSpace: 'nowrap' };
const td = { padding: '0.55rem 0.5rem', fontSize: '0.86rem', textAlign: 'right', borderBottom: '1px solid #eef2f7', verticalAlign: 'top' };
const sec = { backgroundColor: '#f1f5f9', fontWeight: 700, fontSize: '0.84rem', padding: '0.5rem 0.6rem', color: '#334155' };
const linkBtn = { background: 'none', border: 'none', padding: 0, color: '#1d4ed8', cursor: 'pointer', font: 'inherit', textAlign: 'left' };

function innLabel(inn, all) {
  if (inn.is_super_over) return 'Super Over';
  const n = all.filter((x) => !x.is_super_over && x.batting_team.id === inn.batting_team.id && x.innings_no <= inn.innings_no).length;
  return n === 2 ? '2nd Inn' : '1st Inn';
}

export function FullScorecard({ matchId, refreshKey = 0, onNavigate }) {
  const [st, setSt] = useState(null);
  const [lu, setLu] = useState(null);
  const [an, setAn] = useState(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  const [wheelFor, setWheelFor] = useState(null);

  useEffect(() => {
    dataService.fetchLiveState(matchId).then((s) => { setSt(s); setErr(null); }).catch((e) => setErr(e.message));
    dataService.fetchMatchLineups(matchId).then(setLu).catch(() => setLu(null));
    dataService.fetchMatchAnalysis(matchId).then(setAn).catch(() => setAn(null));
  }, [matchId, refreshKey]);

  const inns = st?.innings || [];
  useEffect(() => { if (inns.length && (sel === null || sel >= inns.length)) setSel(inns.length - 1); }, [inns.length]);

  const status = useMemo(() => {
    if (!st) return null;
    if (st.status === 'completed' && st.result_summary) return { text: st.result_summary, color: '#047857' };
    const cur = st.current;
    if (cur && cur.target && cur.status === 'in_progress') return { text: `${cur.batting_team?.name || inns[inns.length - 1]?.batting_team.name} need ${cur.runs_needed} runs${cur.balls_left != null ? ` in ${cur.balls_left} balls` : ''}`, color: '#b91c1c' };
    if (st.match_type === 'two_innings' && inns.length >= 2) {
      const tot = {}; inns.filter((i) => !i.is_super_over).forEach((i) => { tot[i.batting_team.id] = (tot[i.batting_team.id] || 0) + i.runs; });
      const last = inns[inns.length - 1].batting_team; const other = Object.keys(tot).find((k) => k !== last.id);
      if (other) { const d = tot[last.id] - tot[other]; return { text: d < 0 ? `${last.name} trail by ${-d} runs` : d > 0 ? `${last.name} lead by ${d} runs` : 'Scores level', color: '#b91c1c' }; }
    }
    if (st.status === 'live' && inns.length) return { text: `${inns[inns.length - 1].batting_team.name} batting`, color: '#b91c1c' };
    return null;
  }, [st]);

  if (err) return <div style={{ color: '#b91c1c', fontSize: '0.88rem' }}>{err}</div>;
  if (!st) return <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Loading scorecard…</div>;
  if (!inns.length) return <div style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '0.8rem', color: '#94a3b8' }}>The scorecard appears after the first ball.</div>;

  const inn = inns[sel ?? inns.length - 1] || inns[inns.length - 1];
  const team = lu?.teams?.find((t) => t.team_id === inn.batting_team.id);
  const lineup = (team?.lineup || []).filter((p) => p.role === 'playing').sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99));
  const nameOf = (id) => team?.squad?.find((p) => p.player_id === id)?.name || lineup.find((p) => p.player_id === id)?.name || '';
  const capId = lineup.find((p) => p.is_captain)?.player_id; const wkId = lineup.find((p) => p.is_wicket_keeper)?.player_id;
  const batted = new Set(inn.batting.map((p) => p.player_id));
  const yetToBat = lineup.filter((p) => !batted.has(p.player_id)).map((p) => p.name || nameOf(p.player_id)).filter(Boolean);
  const done = inn.wickets >= ((lu?.players_per_side || st.players_per_side || 11) - 1) || inn.status === 'completed' || st.status === 'completed';
  const rr = inn.legal_balls ? ((inn.runs * 6) / inn.legal_balls).toFixed(2) : '0.00';
  const ex = inn.extras_detail || {};
  const pships = (an?.innings || []).find((x) => x.innings_no === inn.innings_no)?.partnerships || [];
  const tag = (id) => `${id === capId ? ' (c' : ''}${id === wkId ? (id === capId ? ' & wk)' : ' (wk)') : id === capId ? ')' : ''}`;
  const player = (id, text) => (onNavigate && id ? <button type="button" style={linkBtn} onClick={() => onNavigate('player-profile', id)}>{text}</button> : <span style={{ color: '#1d4ed8' }}>{text}</span>);

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '0.9rem', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {status && <div style={{ color: status.color, fontSize: '1rem', fontWeight: 600 }}>{status.text}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {inns.map((x, i) => {
          const on = i === (sel ?? inns.length - 1);
          return (
            <button key={x.id} type="button" onClick={() => { setSel(i); setWheelFor(null); }}
              style={{ padding: '0.45rem 0.95rem', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', backgroundColor: on ? GREEN : '#e2e8f0', color: on ? '#fff' : '#0f172a' }}>
              {x.batting_team.short_name || x.batting_team.name} ({innLabel(x, inns)})
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: GREEN, color: '#fff', padding: '0.65rem 0.75rem', fontWeight: 700, minWidth: 560 }}>
          <span>{inn.batting_team.name} {inn.is_super_over ? 'Super Over' : innLabel(inn, inns).replace('Inn', 'Innings')}</span>
          <span>{inn.runs}-{inn.wickets} <span style={{ fontWeight: 400 }}>({oversText(inn.legal_balls)} Ov)</span></span>
        </div>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead><tr style={{ backgroundColor: '#f1f5f9' }}>
            <th style={{ ...th, textAlign: 'left' }}>Batter</th><th style={{ ...th, textAlign: 'left' }} /><th style={th}>R</th><th style={th}>B</th><th style={th}>4s</th><th style={th}>6s</th><th style={th}>SR</th><th style={th} />
          </tr></thead>
          <tbody>
            {inn.batting.map((p) => (
              <React.Fragment key={p.player_id}>
                <tr>
                  <td style={{ ...td, textAlign: 'left', minWidth: 120 }}>{player(p.player_id, `${p.name}${tag(p.player_id)}`)}</td>
                  <td style={{ ...td, textAlign: 'left', color: '#64748b', fontSize: '0.82rem', minWidth: 150 }}>{p.out ? dismissalText(p.out) : p.at_crease ? (st.status === 'completed' ? 'not out' : 'batting') : 'not out'}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{p.runs}</td><td style={td}>{p.balls}</td><td style={td}>{p.fours}</td><td style={td}>{p.sixes}</td><td style={td}>{sr(p.runs, p.balls)}</td>
                  <td style={{ ...td, width: 34 }}>
                    <button type="button" title="Wagon wheel" onClick={() => setWheelFor(wheelFor === p.player_id ? null : p.player_id)} style={{ border: '1px solid #cbd5e1', borderRadius: 999, width: 26, height: 26, cursor: 'pointer', backgroundColor: wheelFor === p.player_id ? '#ecfdf5' : '#fff', fontSize: '0.7rem' }}>◔</button>
                  </td>
                </tr>
                {wheelFor === p.player_id && (
                  <tr><td colSpan={8} style={{ padding: '0.6rem', borderBottom: '1px solid #eef2f7' }}>
                    <WagonWheel matchId={matchId} inningsNo={inn.innings_no} batterId={p.player_id} title={`${p.name} – ${p.runs} (${p.balls})`} refreshKey={refreshKey} />
                  </td></tr>
                )}
              </React.Fragment>
            ))}
            <tr>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>Extras</td>
              <td colSpan={7} style={{ ...td, textAlign: 'left' }}><strong>{inn.extras}</strong> <span style={{ color: '#64748b' }}>(b {ex.byes || 0}, lb {ex.leg_byes || 0}, w {ex.wides || 0}, nb {ex.no_balls || 0}{inn.penalty_runs ? `, p ${inn.penalty_runs}` : ''})</span></td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Total</td>
              <td colSpan={7} style={{ ...td, textAlign: 'left' }}><strong>{inn.runs}</strong> <span style={{ color: '#64748b' }}>({inn.wickets} wkts, {oversText(inn.legal_balls)} Ov, RR {rr})</span></td>
            </tr>
            {yetToBat.length > 0 && (
              <tr>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{done ? 'Did not bat' : 'Yet to bat'}</td>
                <td colSpan={7} style={{ ...td, textAlign: 'left', color: '#1d4ed8' }}>{yetToBat.join(', ')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {inn.fall_of_wickets.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <div style={sec}>Fall of wickets</div>
          <table style={{ width: '100%', minWidth: 400, borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Batter</th><th style={th}>Score</th><th style={th}>Over</th></tr></thead>
            <tbody>{inn.fall_of_wickets.map((f) => (
              <tr key={f.wicket}><td style={{ ...td, textAlign: 'left', color: '#1d4ed8' }}>{f.name}</td><td style={td}>{f.runs}-{f.wicket}</td><td style={td}>{f.over}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead><tr style={{ backgroundColor: '#f1f5f9' }}>
            <th style={{ ...th, textAlign: 'left' }}>Bowler</th><th style={th}>O</th><th style={th}>M</th><th style={th}>R</th><th style={th}>W</th><th style={th}>NB</th><th style={th}>WD</th><th style={th}>ECO</th>
          </tr></thead>
          <tbody>{inn.bowling.map((b) => (
            <tr key={b.player_id}>
              <td style={{ ...td, textAlign: 'left' }}>{player(b.player_id, b.name)}</td>
              <td style={td}>{oversText(b.legal_balls).replace(/\.0$/, '')}</td><td style={td}>{b.maidens}</td><td style={td}>{b.runs}</td><td style={{ ...td, fontWeight: 800 }}>{b.wickets}</td>
              <td style={td}>{b.no_balls}</td><td style={td}>{b.wides}</td><td style={td}>{eco(b.runs, b.legal_balls)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {pships.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <div style={sec}>Partnerships</div>
          <table style={{ width: '100%', minWidth: 400, borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Wicket</th><th style={{ ...th, textAlign: 'left' }}>Batters</th><th style={th}>Runs</th><th style={th}>Balls</th></tr></thead>
            <tbody>{pships.map((p) => (
              <tr key={p.wicket}><td style={{ ...td, textAlign: 'left' }}>{p.wicket}</td><td style={{ ...td, textAlign: 'left' }}>{p.batters || '–'}</td><td style={{ ...td, fontWeight: 700 }}>{p.runs}</td><td style={td}>{p.balls}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FullScorecard;
