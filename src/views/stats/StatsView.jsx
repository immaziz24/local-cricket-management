import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { BarChart3, Users, User, X } from 'lucide-react';
import { LeaderboardsPanel } from './LeaderboardsPanel.jsx';
import { fmt, oversOf, th, td } from './statsUi.jsx';

/** Statistics page: website leaderboards (#102), player comparison (#98), team comparison / head-to-head (#99). */

function Picker({ placeholder, search, value, onChange }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setList([]); return undefined; }
    const id = setTimeout(() => search(q.trim()).then((r) => setList(r || [])).catch(() => setList([])), 250);
    return () => clearTimeout(id);
  }, [q]);
  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.6rem', border: '1px solid #16a34a', borderRadius: '0.45rem', backgroundColor: '#f0fdf4', fontSize: '0.85rem', fontWeight: 700 }}>
        {value.name}
        <button onClick={() => onChange(null)} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}><X size={15} /></button>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.85rem' }} />
      {list.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.45rem', boxShadow: '0 6px 16px rgba(0,0,0,0.08)', maxHeight: 220, overflowY: 'auto' }}>
          {list.map((x) => (
            <button key={x.id} onClick={() => { onChange(x); setQ(''); setList([]); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.6rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.83rem' }}>
              {x.name} <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{x.player_code || x.city || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareTable({ left, right, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}></th><th style={{ ...th, textAlign: 'right' }}>{left}</th><th style={{ ...th, textAlign: 'right' }}>{right}</th></tr></thead>
        <tbody>
          {rows.map(([label, a, b, higherIsBetter = true]) => {
            const na = Number(a); const nb = Number(b);
            const both = a != null && b != null && !Number.isNaN(na) && !Number.isNaN(nb) && na !== nb;
            const aWins = both && (higherIsBetter ? na > nb : na < nb);
            const bWins = both && !aWins;
            return (
              <tr key={label}>
                <td style={{ ...td, color: '#64748b' }}>{label}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: aWins ? 800 : 500, color: aWins ? '#15803d' : '#0f172a' }}>{fmt(a)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: bWins ? 800 : 500, color: bWins ? '#15803d' : '#0f172a' }}>{fmt(b)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerCompare() {
  const [p1, setP1] = useState(null); const [p2, setP2] = useState(null);
  const [s1, setS1] = useState(null); const [s2, setS2] = useState(null);
  useEffect(() => { setS1(null); if (p1) dataService.fetchPlayerStats(p1.id).then(setS1).catch(() => {}); }, [p1]);
  useEffect(() => { setS2(null); if (p2) dataService.fetchPlayerStats(p2.id).then(setS2).catch(() => {}); }, [p2]);
  const search = (q) => dataService.searchPlayers(q);
  const hs = (s) => (s.batting.highest ? `${s.batting.highest.runs}${s.batting.highest.not_out ? '*' : ''}` : null);
  const best = (s) => (s.bowling.best && s.bowling.best.wickets > 0 ? `${s.bowling.best.wickets}/${s.bowling.best.runs}` : null);
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}><User size={16} /> Compare players</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
        <Picker placeholder="First player (name or ID)" search={search} value={p1} onChange={setP1} />
        <Picker placeholder="Second player" search={search} value={p2} onChange={setP2} />
      </div>
      {s1 && s2 ? (
        <CompareTable left={p1.name} right={p2.name} rows={[
          ['Matches', s1.batting.matches, s2.batting.matches],
          ['Runs', s1.batting.runs, s2.batting.runs],
          ['Batting average', s1.batting.average, s2.batting.average],
          ['Strike rate', s1.batting.strike_rate, s2.batting.strike_rate],
          ['Highest score', hs(s1), hs(s2), null],
          ['50s / 100s', `${s1.batting.fifties} / ${s1.batting.hundreds}`, `${s2.batting.fifties} / ${s2.batting.hundreds}`, null],
          ['4s', s1.batting.fours, s2.batting.fours], ['6s', s1.batting.sixes, s2.batting.sixes],
          ['Overs', oversOf(s1.bowling.balls), oversOf(s2.bowling.balls), null],
          ['Wickets', s1.bowling.wickets, s2.bowling.wickets],
          ['Bowling average', s1.bowling.average, s2.bowling.average, false],
          ['Economy', s1.bowling.economy, s2.bowling.economy, false],
          ['Best bowling', best(s1), best(s2), null],
          ['Catches', s1.fielding.catches, s2.fielding.catches],
          ['Run-outs + stumpings', s1.fielding.run_outs + s1.fielding.stumpings, s2.fielding.run_outs + s2.fielding.stumpings],
          ['Player of the Match', s1.player_of_match, s2.player_of_match],
          ['MVP points', s1.mvp_points, s2.mvp_points]
        ]} />
      ) : <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Pick two players to compare their career figures. Better figure shown in green.</p>}
    </Card>
  );
}

function TeamCompare() {
  const [t1, setT1] = useState(null); const [t2, setT2] = useState(null);
  const [s1, setS1] = useState(null); const [s2, setS2] = useState(null); const [h2h, setH2h] = useState(null);
  useEffect(() => {
    setS1(null); setS2(null); setH2h(null);
    if (t1) dataService.fetchTeamStats(t1.id).then(setS1).catch(() => {});
    if (t2) dataService.fetchTeamStats(t2.id).then(setS2).catch(() => {});
    if (t1 && t2) dataService.fetchTeamStats(t1.id, t2.id).then(setH2h).catch(() => {});
  }, [t1, t2]);
  const search = (q) => dataService.searchTeams(q);
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}><Users size={16} /> Compare teams</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
        <Picker placeholder="First team" search={search} value={t1} onChange={setT1} />
        <Picker placeholder="Second team" search={search} value={t2} onChange={setT2} />
      </div>
      {s1 && s2 ? (
        <>
          <CompareTable left={t1.name} right={t2.name} rows={[
            ['Played', s1.played, s2.played], ['Won', s1.won, s2.won], ['Lost', s1.lost, s2.lost, false],
            ['Win %', s1.win_percent, s2.win_percent], ['Average score', s1.average_score, s2.average_score],
            ['Highest total', s1.highest_total, s2.highest_total], ['Average conceded', s1.average_conceded, s2.average_conceded, false],
            ['Tournaments won', s1.tournaments_won, s2.tournaments_won]
          ]} />
          {h2h && (
            <div style={{ marginTop: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc', fontSize: '0.85rem' }}>
              <strong>Head to head:</strong> {h2h.played === 0 ? 'these teams have not played each other yet.'
                : `${h2h.played} played · ${t1.name} won ${h2h.won} · ${t2.name} won ${h2h.lost}${h2h.tied ? ` · ${h2h.tied} tied` : ''}${h2h.no_result ? ` · ${h2h.no_result} no result` : ''}`}
            </div>
          )}
        </>
      ) : <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Pick two teams to compare records and see their head-to-head.</p>}
    </Card>
  );
}

export function StatsView({ onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={22} /> Statistics</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Leaderboards from every scored match, and side-by-side comparisons.</p>
      </div>
      <LeaderboardsPanel onNavigate={onNavigate} title="All matches – leaderboards" />
      <PlayerCompare />
      <TeamCompare />
    </div>
  );
}

export default StatsView;
