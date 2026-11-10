import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { StatGrid } from './statsUi.jsx';

/** #99 Team record: played, won, lost, win %, average and highest totals, recent form. */
export function TeamStatsCard({ teamId, onNavigate }) {
  const [s, setS] = useState(null);
  useEffect(() => { dataService.fetchTeamStats(teamId).then(setS).catch(() => setS(null)); }, [teamId]);
  if (!s) return null;
  return (
    <Card title="Team record">
      {s.played === 0 ? <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>No finished matches yet.</p> : (
        <>
          <StatGrid items={[
            ['Played', s.played], ['Won', s.won], ['Lost', s.lost], ['Win %', s.win_percent],
            ['Avg score', s.average_score], ['Highest', s.highest_total], ['Lowest', s.lowest_total], ['Titles', s.tournaments_won]
          ]} />
          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '0.2rem' }}>Recent:</span>
            {(s.recent || []).map((r) => (
              <button key={r.match_id} title={`vs ${r.opponent || '?'} – ${r.result || ''}`} onClick={() => onNavigate && onNavigate('match-centre', r.match_id)}
                style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, color: '#fff',
                         backgroundColor: r.won ? '#16a34a' : r.won === false && r.result ? '#dc2626' : '#94a3b8' }}>
                {r.won ? 'W' : r.won === false && r.result ? 'L' : '–'}
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

export default TeamStatsCard;
