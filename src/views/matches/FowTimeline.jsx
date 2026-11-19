import React from 'react';
import { fowPoints } from './fowTimeline.js';

/** #349 #350 Visual fall-of-wickets timeline: one marker per wicket along the innings, red when wickets fell in a cluster. */
export function FowTimeline({ fow, totalBalls, oversLimit }) {
  const pts = fowPoints(fow, { totalBalls, oversLimit });
  if (pts.length === 0) return null;
  const W = 600; const pad = 18;
  const px = (x) => pad + ((W - pad * 2) * x) / 100;
  return (
    <div className="scorecard-section" style={{ padding: '0.5rem 0.75rem' }}>
      <svg viewBox={`0 0 ${W} 74`} role="img" aria-label="Fall of wickets timeline" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={pad} y1={34} x2={W - pad} y2={34} stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
        {pts.map((p) => (
          <g key={`${p.wicket}-${p.over}`}>
            <title>{`Wicket ${p.wicket}: ${p.name} out at ${p.runs}/${p.wicket} in ${p.over} overs. Partnership ${p.partnershipRuns} runs (${p.partnershipBalls} balls).`}</title>
            <circle cx={px(p.x)} cy={34} r={11} fill={p.collapse ? '#dc2626' : '#0f172a'} />
            <text x={px(p.x)} y={38} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{p.wicket}</text>
            <text x={px(p.x)} y={64} textAnchor="middle" fontSize="10" fill="#475569">{p.runs}/{p.wicket}</text>
            <text x={px(p.x)} y={14} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.over} ov</text>
          </g>
        ))}
      </svg>
      <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Each circle is a wicket. Red means wickets fell in quick succession. Touch or hover a circle for details.</p>
    </div>
  );
}

export default FowTimeline;
