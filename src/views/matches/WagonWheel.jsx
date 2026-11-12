import React, { useEffect, useRef, useState } from 'react';
import { dataService } from '../../services/dataService.js';

/**
 * Wagon wheel (#8 record runs, #21 scorecard, #101 analysis).
 * The batter is at the centre of the picture; 0° = straight past the bowler (top), 180° = behind the keeper.
 */
const SIZE = 300; const C = SIZE / 2; const R = 138;
export const RUN_COLOR = { 1: '#64748b', 2: '#0ea5e9', 3: '#f59e0b', 4: '#16a34a', 5: '#f97316', 6: '#7c3aed', 7: '#db2777' };
const pt = (angle, dist) => { const a = (angle * Math.PI) / 180; const r = (R * dist) / 100; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };

function Field({ children, onClick, svgRef }) {
  return (
    <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: SIZE, display: 'block', margin: '0 auto', cursor: onClick ? 'crosshair' : 'default', touchAction: 'manipulation' }} onClick={onClick}>
      <circle cx={C} cy={C} r={R + 8} fill="#166534" />
      <circle cx={C} cy={C} r={R} fill="#22c55e" stroke="#fff" strokeWidth="2" />
      <circle cx={C} cy={C} r={R * 0.48} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="rgba(255,255,255,0.18)" />
      <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="rgba(255,255,255,0.18)" />
      <rect x={C - 7} y={C - 30} width={14} height={34} rx={2} fill="#d6b98c" />
      <circle cx={C} cy={C} r={3.5} fill="#0f172a" />
      <text x={C} y={C - R + 16} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.9)">Straight</text>
      <text x={C} y={C + R - 8} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.9)">Behind</text>
      {children}
    </svg>
  );
}

/** Scorer taps where the ball went. Boundaries (4, 6) always reach the rope.
 *  Tapping outside the box (or Cancel) closes it without saving anything; the runs can be changed inside. */
export function WagonWheelPicker({ runs, onPick, onSkip, onCancel, onChangeRuns, busy, leftHanded = false }) {
  const ref = useRef(null);
  const [mark, setMark] = useState(null);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' && onCancel) onCancel(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCancel]);
  const tap = (e) => {
    e.stopPropagation();
    if (busy || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * SIZE - C; const y = ((e.clientY - box.top) / box.height) * SIZE - C;
    if (Math.sqrt(x * x + y * y) > R + 10) return; // outside the field
    const angle = Math.round(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360) % 360;
    let dist = Math.max(5, Math.min(100, Math.round((Math.sqrt(x * x + y * y) / R) * 100)));
    if (runs === 4 || runs === 6) dist = 100;
    setMark({ angle, dist });
    onPick({ angle, dist });
  };
  const end = mark ? pt(mark.angle, mark.dist) : null;
  const chip = (on) => ({ minWidth: 40, padding: '0.35rem 0.6rem', borderRadius: 8, fontWeight: 800, cursor: 'pointer', border: `2px solid ${on ? '#16a34a' : '#cbd5e1'}`, backgroundColor: on ? '#dcfce7' : '#fff' });
  return (
    <div onClick={() => onCancel && onCancel()} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, border: '2px solid #16a34a', borderRadius: '0.9rem', padding: '0.8rem', backgroundColor: '#f0fdf4', display: 'flex', flexDirection: 'column', gap: '0.55rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ fontWeight: 800, textAlign: 'center' }}>Where did the {runs === 4 ? 'FOUR' : runs === 6 ? 'SIX' : `${runs} run${runs === 1 ? '' : 's'}`} go? Tap the field</div>
        {onChangeRuns && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#475569' }}>Wrong runs?</span>
            {[1, 2, 3, 4, 6].map((r) => <button key={r} type="button" disabled={busy} onClick={() => { setMark(null); onChangeRuns(r); }} style={chip(r === runs)}>{r}</button>)}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#475569', padding: '0 0.4rem' }}>
          <span>{leftHanded ? 'Off side' : 'Leg side'}</span><span>{leftHanded ? 'left-hander' : 'right-hander'}</span><span>{leftHanded ? 'Leg side' : 'Off side'}</span>
        </div>
        <Field onClick={tap} svgRef={ref}>
          {end && <line x1={C} y1={C} x2={end[0]} y2={end[1]} stroke={RUN_COLOR[runs] || '#0f172a'} strokeWidth="3" strokeLinecap="round" />}
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={onSkip} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: 999, padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem' }}>Save without direction</button>
          {onCancel && <button type="button" disabled={busy} onClick={onCancel} style={{ border: '1px solid #fecaca', backgroundColor: '#fff', color: '#b91c1c', borderRadius: 999, padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Cancel – don't save</button>}
        </div>
      </div>
    </div>
  );
}

/** Shows the shots of an innings (or one batter). */
export function WagonWheel({ matchId, inningsNo = null, batterId = null, title, refreshKey = 0 }) {
  const [shots, setShots] = useState(null);
  useEffect(() => { dataService.getWagonWheel(matchId, inningsNo, batterId).then((r) => setShots(r || [])).catch(() => setShots([])); }, [matchId, inningsNo, batterId, refreshKey]);
  if (!shots) return <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Loading wagon wheel…</div>;
  const count = (fn) => shots.filter(fn).length;
  const sum = shots.reduce((a, s) => a + (s.runs || 0), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
      {title && <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{title}</div>}
      {shots.length === 0 ? <div style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '0.5rem' }}>No shot directions recorded yet.</div> : (
        <>
          <Field>
            {shots.map((s, i) => { const [x, y] = pt(s.angle, s.dist); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={RUN_COLOR[s.runs] || '#0f172a'} strokeWidth={s.runs >= 4 ? 2.6 : 1.8} strokeLinecap="round" opacity="0.95" />; })}
          </Field>
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.76rem', color: '#334155' }}>
            {[[1, '1s'], [2, '2s'], [3, '3s'], [4, '4s'], [6, '6s']].map(([r, l]) => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 3, backgroundColor: RUN_COLOR[r], display: 'inline-block' }} />{l}: {count((s) => s.runs === r)}</span>
            ))}
            <span>· {sum} runs in {shots.length} shots</span>
          </div>
        </>
      )}
    </div>
  );
}

export default WagonWheel;
