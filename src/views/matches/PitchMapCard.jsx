import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { ZONES, ballColour, zoneSummary, coverageText } from './pitchMap.js';

/** #348 Where the bowlers pitched the ball. Bowler's end is at the top, the batter's stumps at the bottom. */
export function PitchMapCard({ matchId, refreshKey = 0 }) {
  const [d, setD] = useState(null);
  const [bowler, setBowler] = useState('');
  const [innings, setInnings] = useState('');
  useEffect(() => { dataService.fetchPitchMap(matchId, innings ? Number(innings) : null, bowler || null).then(setD).catch(() => setD(null)); }, [matchId, bowler, innings, refreshKey]);
  if (!d || (!d.marked && !bowler && !innings)) return null;
  const sum = zoneSummary(d.balls).filter((z) => z.balls > 0);
  const W = 180, H = 360;
  return (
    <Card title="Pitch map" subtitle="Where the ball pitched">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <select value={innings} onChange={(e) => setInnings(e.target.value)} style={{ padding: '0.3rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }}>
          <option value="">Both innings</option><option value="1">1st innings</option><option value="2">2nd innings</option>
        </select>
        <select value={bowler} onChange={(e) => setBowler(e.target.value)} style={{ padding: '0.3rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }}>
          <option value="">All bowlers</option>
          {(d.bowlers || []).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.count})</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Pitch map" style={{ background: '#e7d9b4', borderRadius: '0.4rem', maxWidth: '100%' }}>
          <text x={W / 2} y="12" textAnchor="middle" fontSize="9" fill="#78350f">Bowler's end</text>
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#78350f">Batter's stumps</text>
          {ZONES.slice(1).map((z) => <line key={z.key} x1="0" x2={W} y1={((100 - z.from) / 100) * H} y2={((100 - z.from) / 100) * H} stroke="#b45309" strokeDasharray="3 3" strokeWidth="0.6" />)}
          {(d.balls || []).map((b, i) => <circle key={i} cx={(b.x / 100) * W} cy={((100 - b.y) / 100) * H} r="5" fill={ballColour(b)} fillOpacity="0.85" stroke="#fff" strokeWidth="0.8"><title>{`Over ${b.over}.${b.ball}: ${b.wicket ? 'wicket' : `${b.runs} off the bat`}`}</title></circle>)}
        </svg>
        <div style={{ flex: 1, minWidth: 190, fontSize: '0.82rem' }}>
          {sum.map((z) => <div key={z.key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '0.2rem 0' }}><span>{z.label}</span><span>{z.balls} balls · {z.runs} runs{z.wickets ? ` · ${z.wickets} wkt` : ''}</span></div>)}
          <div style={{ marginTop: '0.5rem', fontSize: '0.74rem', color: '#64748b' }}>
            <span style={{ color: '#dc2626' }}>●</span> wicket <span style={{ color: '#7c3aed' }}>●</span> six <span style={{ color: '#2563eb' }}>●</span> four <span style={{ color: '#64748b' }}>●</span> dot <span style={{ color: '#16a34a' }}>●</span> other runs
          </div>
          <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#94a3b8' }}>{coverageText(d)} The scorer marks the spot while scoring, so only marked balls appear.</div>
        </div>
      </div>
    </Card>
  );
}

export default PitchMapCard;
