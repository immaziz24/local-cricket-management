import React, { useEffect, useMemo, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { WagonChart } from '../matches/WagonWheel.jsx';
import { wagonZones } from './chartData.js';

/** #347 Wagon wheel for one innings, filtered by batter, with a breakdown by area of the ground. */
const sel = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' };

export function WagonExplorer({ matchId, inningsNo, players = [], refreshKey = 0 }) {
  const [shots, setShots] = useState(null);
  const [batter, setBatter] = useState('');
  const [left, setLeft] = useState(false);
  useEffect(() => { dataService.getWagonWheel(matchId, inningsNo, null).then((r) => setShots(r || [])).catch(() => setShots([])); }, [matchId, inningsNo, refreshKey]);
  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.player_id, p.name])), [players]);
  const batters = useMemo(() => [...new Set((shots || []).map((s) => s.batter_id).filter(Boolean))], [shots]);
  const shown = useMemo(() => (shots || []).filter((s) => !batter || s.batter_id === batter), [shots, batter]);
  const z = useMemo(() => wagonZones(shown, left), [shown, left]);
  if (!shots) return <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Loading wagon wheel…</div>;
  if (shots.length === 0) return <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No shot directions recorded in this innings yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={sel} value={batter} onChange={(e) => setBatter(e.target.value)} aria-label="Batter">
          <option value="">All batters</option>
          {batters.map((b) => <option key={b} value={b}>{names[b] || 'Batter'}</option>)}
        </select>
        <label style={{ fontSize: '0.78rem', color: '#475569', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={left} onChange={(e) => setLeft(e.target.checked)} /> Left-hander
        </label>
      </div>
      <WagonChart shots={shown} title={batter ? names[batter] : 'All batters'} />
      {z.total > 0 && (
        <div style={{ fontSize: '0.8rem', color: '#334155' }}>
          <div style={{ marginBottom: '0.3rem' }}>
            <strong>Off side:</strong> {z.offSide.runs} runs ({z.offSide.shots} shots) · <strong>Leg side:</strong> {z.legSide.runs} runs ({z.legSide.shots} shots)
            {z.favourite ? <> · Scores most: <strong>{z.favourite}</strong></> : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.3rem' }}>
            {z.zones.filter((q) => q.shots > 0).map((q) => (
              <div key={q.label} style={{ border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.3rem 0.5rem', background: '#f8fafc' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{q.label}</div>
                <div><strong>{q.runs}</strong> runs · {q.shots} shot{q.shots === 1 ? '' : 's'} · {q.share}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WagonExplorer;
