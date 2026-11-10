import React from 'react';

/** Small shared pieces for the statistics screens (Category D). */

export const fmt = (v, empty = '–') => (v === null || v === undefined || v === '' ? empty : v);
export const oversOf = (balls) => `${Math.floor((balls || 0) / 6)}.${(balls || 0) % 6}`;

export function StatGrid({ items, columns = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${columns >= 5 ? 92 : 110}px, 1fr))`, gap: '0.5rem' }}>
      {items.map(([label, value, hint]) => (
        <div key={label} style={{ padding: '0.55rem 0.6rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{fmt(value)}</div>
          {hint && <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{hint}</div>}
        </div>
      ))}
    </div>
  );
}

/** #100 Simple vertical bar chart. bars: [{ label, value, mark?, color? }] */
export function BarChart({ bars, height = 120, color = '#16a34a', unit = '' }) {
  if (!bars || bars.length === 0) return <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No data yet.</p>;
  const max = Math.max(1, ...bars.map((b) => b.value || 0));
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: height + 34, minWidth: bars.length * 22 }}>
        {bars.map((b, i) => (
          <div key={i} title={`${b.label}: ${b.value}${unit}`} style={{ flex: 1, minWidth: 16, maxWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ fontSize: '0.62rem', color: '#475569' }}>{b.value}</div>
            <div style={{ position: 'relative', width: '100%', height: Math.max(2, Math.round(((b.value || 0) / max) * height)), backgroundColor: b.color || color, borderRadius: '3px 3px 0 0' }}>
              {b.mark > 0 && <div style={{ position: 'absolute', top: -2, left: '50%', transform: 'translate(-50%, -100%)', display: 'flex', gap: 1 }}>
                {Array.from({ length: Math.min(b.mark, 4) }).map((_, k) => <span key={k} style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }} />)}
              </div>}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap' }}>{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** #100 Worm chart: cumulative runs per over for one or two innings. series: [{ name, color, points:[{over,total}] }] */
export function WormChart({ series, height = 150 }) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No data yet.</p>;
  const maxX = Math.max(1, ...all.map((p) => p.over));
  const maxY = Math.max(1, ...all.map((p) => p.total));
  const W = 320; const H = height; const pad = 24;
  const x = (o) => pad + (o / maxX) * (W - pad - 6);
  const y = (t) => H - pad - (t / maxY) * (H - pad - 8);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 520, height: 'auto' }} role="img" aria-label="Runs by over">
        <line x1={pad} y1={H - pad} x2={W - 4} y2={H - pad} stroke="#cbd5e1" />
        <line x1={pad} y1={6} x2={pad} y2={H - pad} stroke="#cbd5e1" />
        <text x={pad - 4} y={12} fontSize="9" textAnchor="end" fill="#94a3b8">{maxY}</text>
        <text x={W - 6} y={H - 8} fontSize="9" textAnchor="end" fill="#94a3b8">{maxX} ov</text>
        {series.map((s) => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2"
            points={[`${x(0)},${y(0)}`, ...s.points.map((p) => `${x(p.over)},${y(p.total)}`)].join(' ')} />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem', color: '#475569', flexWrap: 'wrap' }}>
        {series.map((s) => <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 3, backgroundColor: s.color, display: 'inline-block' }} />{s.name}</span>)}
      </div>
    </div>
  );
}

export function PlayerName({ id, name, onNavigate }) {
  if (!onNavigate || !id) return <span>{name}</span>;
  return (
    <button onClick={() => onNavigate('player-profile', id)} style={{ background: 'none', border: 'none', padding: 0, color: '#0f172a', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontSize: 'inherit' }}>
      {name}
    </button>
  );
}

export const th = { textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
export const td = { padding: '0.4rem 0.5rem', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' };
