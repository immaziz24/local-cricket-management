import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { StatGrid, PlayerName, th, td } from './statsUi.jsx';

/** #355 Boundary tracker: fours, sixes and how much of the scoring comes from boundaries, by team, player and phase. */
export function BoundaryTrackerCard({ tournamentId = null, onNavigate }) {
  const [d, setD] = useState(null);
  const [view, setView] = useState('teams');
  const [err, setErr] = useState(null);
  useEffect(() => {
    let alive = true;
    dataService.fetchBoundaryTracker(tournamentId, 10).then((r) => { if (alive) setD(r); }).catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [tournamentId]);
  if (err) return <Card title="Boundary tracker"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{err}</p></Card>;
  if (!d || !d.totals || !(d.totals.fours + d.totals.sixes)) return null;
  const t = d.totals;
  const maxPhase = Math.max(1, ...d.phases.map((p) => p.fours + p.sixes));
  const tab = (k, l) => (
    <button type="button" key={k} aria-pressed={view === k} onClick={() => setView(k)}
      style={{ padding: '0.3rem 0.65rem', borderRadius: 999, fontSize: '0.75rem', cursor: 'pointer', border: `1px solid ${view === k ? '#16a34a' : '#e2e8f0'}`, backgroundColor: view === k ? '#dcfce7' : '#fff', color: view === k ? '#166534' : '#475569', fontWeight: view === k ? 700 : 500 }}>{l}</button>
  );
  return (
    <Card title="Boundary tracker" subtitle={`${t.fours + t.sixes} boundaries in ${t.matches} match${t.matches === 1 ? '' : 'es'} (super overs not counted)`}>
      <StatGrid items={[['Fours', t.fours], ['Sixes', t.sixes], ['Boundary runs', t.fours * 4 + t.sixes * 6]]} />
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', margin: '0.8rem 0 0.5rem' }}>{tab('teams', 'By team')}{tab('players', 'By player')}{tab('phases', 'By phase')}{tab('matches', 'Biggest matches')}</div>
      {view === 'teams' && (
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Team</th><th style={th}>4s</th><th style={th}>6s</th><th style={th}>Boundary runs</th><th style={th}>% of runs</th><th style={th}>Balls / boundary</th></tr></thead>
          <tbody>{d.teams.map((r) => (
            <tr key={r.team_id}><td style={td}>{r.team}</td><td style={td}>{r.fours}</td><td style={td}>{r.sixes}</td><td style={{ ...td, fontWeight: 800 }}>{r.boundary_runs}</td><td style={td}>{r.boundary_share ?? '–'}%</td><td style={td}>{r.balls_per_boundary ?? '–'}</td></tr>
          ))}</tbody></table></div>
      )}
      {view === 'players' && (
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Player</th><th style={th}>4s</th><th style={th}>6s</th><th style={th}>Boundary runs</th><th style={th}>Runs</th><th style={th}>% in boundaries</th></tr></thead>
          <tbody>{d.players.map((r) => (
            <tr key={r.player_id}><td style={td}><PlayerName id={r.player_id} name={r.name} onNavigate={onNavigate} /></td><td style={td}>{r.fours}</td><td style={td}>{r.sixes}</td><td style={{ ...td, fontWeight: 800 }}>{r.boundary_runs}</td><td style={td}>{r.runs}</td><td style={td}>{r.boundary_share ?? '–'}%</td></tr>
          ))}</tbody></table></div>
      )}
      {view === 'phases' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {d.phases.map((p) => (
            <div key={p.label} style={{ fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{p.label}</span><span>{p.fours} fours · {p.sixes} sixes</span></div>
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                <div style={{ width: `${(p.fours / maxPhase) * 100}%`, backgroundColor: '#16a34a' }} />
                <div style={{ width: `${(p.sixes / maxPhase) * 100}%`, backgroundColor: '#7c3aed' }} />
              </div>
            </div>
          ))}
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Green = fours, purple = sixes. Over numbers are counted from the start of each innings.</p>
        </div>
      )}
      {view === 'matches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.84rem' }}>
          {d.top_matches.map((m) => (
            <div key={m.match_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', padding: '0.3rem 0', cursor: onNavigate ? 'pointer' : 'default' }}
                 onClick={() => onNavigate && onNavigate('match-centre', m.match_id)}>
              <span>{m.teams}</span><strong>{m.fours + m.sixes} <span style={{ fontWeight: 400, color: '#64748b' }}>({m.fours}×4, {m.sixes}×6)</span></strong>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default BoundaryTrackerCard;
