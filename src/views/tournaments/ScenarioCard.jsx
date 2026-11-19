import React, { useState } from 'react';
import { simulateScenario } from './scenarioSimulator.js';

/** #329 "What if?" - pick results for matches still to play and see who would qualify or be out. */
export function ScenarioCard({ rows, remaining, spots, pointsWin, pointsTie, nameOf }) {
  const [picks, setPicks] = useState({});
  if (!remaining.length || rows.length < 2) return null;
  const sim = simulateScenario({ rows: rows.map((r) => ({ team_id: r.team_id, points: r.points })), remaining, spots, picks, pointsWin, pointsTie });
  const sel = { padding: '0.3rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem', maxWidth: '100%' };
  const chosen = Object.values(picks).filter(Boolean).length;
  const tag = { qualified: ['Qualified', '#047857'], eliminated: ['Out', '#b91c1c'], alive: ['Still alive', '#64748b'] };
  return (
    <details style={{ marginTop: '0.75rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>What if? Try results for the matches left</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
        {remaining.slice(0, 12).map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.83rem' }}>
            <span style={{ flex: 1, minWidth: 150 }}>{nameOf(m.team_a_id)} vs {nameOf(m.team_b_id)}</span>
            <select value={picks[m.id] || ''} onChange={(e) => setPicks({ ...picks, [m.id]: e.target.value })} style={sel} aria-label={`Result of ${nameOf(m.team_a_id)} vs ${nameOf(m.team_b_id)}`}>
              <option value="">Not decided</option>
              <option value={m.team_a_id}>{nameOf(m.team_a_id)} win</option>
              <option value={m.team_b_id}>{nameOf(m.team_b_id)} win</option>
              <option value="tie">Tie / no result</option>
            </select>
          </div>
        ))}
        {remaining.length > 12 && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Showing the first 12 of {remaining.length} matches.</span>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem 0.6rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          {[...rows].sort((a, b) => (sim.points.get(b.team_id) || 0) - (sim.points.get(a.team_id) || 0)).map((r) => {
            const [label, color] = tag[sim.status.get(r.team_id)] || tag.alive;
            return <div key={r.team_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}><span>{r.team_name} <span style={{ color: '#94a3b8' }}>({sim.points.get(r.team_id)} pts)</span></span><strong style={{ color }}>{label}</strong></div>;
          })}
        </div>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{chosen ? `${chosen} result${chosen === 1 ? '' : 's'} tried.` : 'Nothing tried yet.'} Teams level on points are not called until net run rate is known. This is only a what-if; nothing is saved.</span>
      </div>
    </details>
  );
}
