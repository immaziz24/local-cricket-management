import React, { useState } from 'react';
import { manhattanData, wormComparison } from './chartData.js';

/** #345 Manhattan (runs in every over, both innings side by side, wickets marked) and #346 worm comparison (both innings on one graph). */
const COLORS = ['#16a34a', '#2563eb', '#ea580c', '#9333ea'];

export function ManhattanChart({ innings }) {
  const d = manhattanData(innings);
  if (d.series.length === 0) return <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Appears once an over has been bowled.</p>;
  const n = d.series.length;
  const group = 28; const bw = Math.max(5, Math.floor(22 / n)); const H = 150; const pad = 22; const top = 14;
  const W = pad + d.maxOver * group + 8;
  const y = (r) => H - pad - (r / d.maxRuns) * (H - pad - top);
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: Math.max(W, 300), maxWidth: 'none', height: 'auto' }} role="img" aria-label="Runs in every over">
          <line x1={pad} y1={H - pad} x2={W - 4} y2={H - pad} stroke="#cbd5e1" />
          <text x={pad - 3} y={top} fontSize="8" textAnchor="end" fill="#94a3b8">{d.maxRuns}</text>
          {Array.from({ length: d.maxOver }).map((_, k) => (
            <g key={k}>
              <text x={pad + k * group + group / 2} y={H - 8} fontSize="8" textAnchor="middle" fill="#94a3b8">{k + 1}</text>
              {d.series.map((s, si) => {
                const b = s.bars[k]; if (!b.played) return null;
                const x = pad + k * group + (group - bw * n) / 2 + si * bw;
                return (
                  <g key={si}>
                    <rect x={x} y={y(b.runs)} width={bw - 1} height={Math.max(1, H - pad - y(b.runs))} fill={COLORS[si % 4]} rx="1.5"><title>{`${s.team} over ${b.over}: ${b.runs} runs${b.wickets ? `, ${b.wickets} wkt` : ''}`}</title></rect>
                    {b.wickets > 0 && Array.from({ length: Math.min(b.wickets, 3) }).map((__, w) => <circle key={w} cx={x + (bw - 1) / 2} cy={y(b.runs) - 4 - w * 6} r="2.4" fill="#dc2626" />)}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
        {d.series.map((s, si) => <span key={s.innings_no} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, backgroundColor: COLORS[si % 4], display: 'inline-block', borderRadius: 2 }} />{s.team} · best over {s.best.runs} (over {s.best.over})</span>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }} />wicket</span>
      </div>
    </div>
  );
}

export function WormComparison({ innings }) {
  const w = wormComparison(innings);
  const [over, setOver] = useState(null);
  if (w.series.length === 0) return <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Appears once an over has been bowled.</p>;
  const sel = over == null ? w.maxOver : over;
  const W = 340; const H = 170; const pad = 26;
  const x = (o) => pad + (o / Math.max(1, w.maxOver)) * (W - pad - 8);
  const y = (t) => H - pad - (t / w.maxRuns) * (H - pad - 10);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 560, height: 'auto' }} role="img" aria-label="Both innings compared over by over">
        <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="#cbd5e1" />
        <line x1={pad} y1={8} x2={pad} y2={H - pad} stroke="#cbd5e1" />
        <text x={pad - 4} y={14} fontSize="9" textAnchor="end" fill="#94a3b8">{w.maxRuns}</text>
        <text x={W - 8} y={H - 10} fontSize="9" textAnchor="end" fill="#94a3b8">{w.maxOver} ov</text>
        {w.target != null && <g><line x1={pad} x2={W - 8} y1={y(w.target)} y2={y(w.target)} stroke="#64748b" strokeDasharray="4 3" /><text x={W - 8} y={y(w.target) - 3} fontSize="9" textAnchor="end" fill="#64748b">target {w.target}</text></g>}
        <line x1={x(sel)} x2={x(sel)} y1={8} y2={H - pad} stroke="#cbd5e1" strokeDasharray="2 3" />
        {w.series.map((s, si) => (
          <g key={s.innings_no}>
            <polyline fill="none" stroke={COLORS[si % 4]} strokeWidth="2.2" points={s.points.map((p) => `${x(p.over)},${y(p.total)}`).join(' ')} />
            {s.points.slice(1).filter((p, k) => p.wickets > s.points[k].wickets).map((p) => <circle key={p.over} cx={x(p.over)} cy={y(p.total)} r="3" fill="#dc2626" stroke="#fff" strokeWidth="1"><title>{`${s.team}: wicket(s) in over ${p.over}, ${p.total}/${p.wickets}`}</title></circle>)}
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#475569' }}>
        {w.series.map((s, si) => <span key={s.innings_no} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 3, backgroundColor: COLORS[si % 4], display: 'inline-block' }} />{s.team} ({s.runs}/{s.wickets})</span>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }} />wicket</span>
      </div>
      {w.maxOver > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
          Over {sel}
          <input type="range" min="1" max={w.maxOver} value={sel} onChange={(e) => setOver(Number(e.target.value))} style={{ flex: 1, maxWidth: 320 }} />
        </label>
      )}
      <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{w.readout(sel)}</p>
    </div>
  );
}
