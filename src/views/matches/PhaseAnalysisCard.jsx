import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { phaseOversText, phaseLine, bestPhase } from './phaseView.js';

/** #351 Powerplay phase analysis and #352 death-overs analysis, innings by innings. */
export function PhaseAnalysisCard({ matchId, refreshKey = 0 }) {
  const [d, setD] = useState(null);
  useEffect(() => { dataService.fetchPhaseAnalysis(matchId).then(setD).catch(() => setD(null)); }, [matchId, refreshKey]);
  if (!d || !d.innings || d.innings.length === 0) return null;
  return (
    <Card title="Powerplay, middle and death overs" subtitle="How each innings went in its three phases">
      {d.innings.map((inn) => {
        const best = bestPhase(inn.phases);
        return (
          <div key={inn.innings_no} style={{ marginBottom: '0.8rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{inn.team || `Innings ${inn.innings_no}`}</div>
            {inn.phases.map((p) => (
              <div key={p.key} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.84rem', padding: '0.2rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ minWidth: 150, color: '#475569' }}>{p.label} <span style={{ color: '#94a3b8' }}>({phaseOversText(p)})</span></span>
                <span style={{ fontWeight: best && best.key === p.key ? 700 : 500 }}>{phaseLine(p)}</span>
              </div>
            ))}
          </div>
        );
      })}
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>RR is runs per over. The powerplay follows this match's rules; death overs are the last fifth of the innings. Bold marks the fastest phase.</p>
    </Card>
  );
}

export default PhaseAnalysisCard;
