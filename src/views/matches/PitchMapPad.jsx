import React, { useState, useEffect } from 'react';
import { dataService } from '../../services/dataService.js';
import { pointToPitch, zoneOf } from './pitchMap.js';

/** #348 Scorer: after a ball, tap where it pitched. Optional, and off until the scorer turns it on. */
export function PitchMapPad({ matchId, ballKey, disabled }) {
  const [on, setOn] = useState(() => { try { return localStorage.getItem('lcm-pitchmap') === 'on'; } catch { return false; } });
  const [mark, setMark] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setMark(null); setMsg(null); setSaved(false); }, [ballKey]);
  const W = 120, H = 200;
  const tap = async (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = pointToPitch(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (!p) return;
    setMark(p); setMsg(null);
    try { await dataService.setLastBallPitch(matchId, p.x, p.y); setSaved(true); } catch (err) { setSaved(false); setMsg(err.message); }
  };
  return (
    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); try { localStorage.setItem('lcm-pitchmap', e.target.checked ? 'on' : 'off'); } catch { /* ignore */ } }} />
        Mark where the ball pitched (pitch map)
      </label>
      {on && !disabled && (
        <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} onClick={tap} role="button" aria-label="Tap where the last ball pitched" style={{ background: '#e7d9b4', borderRadius: '0.4rem', cursor: 'crosshair', touchAction: 'manipulation' }}>
            <text x={W / 2} y="11" textAnchor="middle" fontSize="8" fill="#78350f">Bowler</text>
            <text x={W / 2} y={H - 3} textAnchor="middle" fontSize="8" fill="#78350f">Batter</text>
            {mark && <circle cx={(mark.x / 100) * W} cy={((100 - mark.y) / 100) * H} r="5" fill={saved ? '#16a34a' : '#f59e0b'} stroke="#fff" />}
          </svg>
          <div>
            {!mark && 'Score the ball, then tap the spot on the pitch. Skip it if you did not see.'}
            {mark && saved && <span style={{ color: '#15803d', fontWeight: 700 }}>Saved: {zoneOf(mark.y).label}</span>}
            {msg && <div style={{ color: '#b91c1c' }}>{msg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default PitchMapPad;
