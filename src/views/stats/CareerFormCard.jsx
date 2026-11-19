import React, { useMemo, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { StatGrid } from './statsUi.jsx';
import { careerForm, formOptions } from './chartData.js';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/** #354 Career form trend: pick a tournament and how many recent matches, see the rolling batting average and bowling figures. */
const sel = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' };

export function CareerFormCard({ matches }) {
  const [tournament, setTournament] = useState('all');
  const [lastN, setLastN] = useState(0);
  const opts = useMemo(() => formOptions(matches), [matches]);
  const f = useMemo(() => careerForm(matches, { tournament, lastN }), [matches, tournament, lastN]);
  if (!matches || matches.length < 2) return null;
  const W = 320; const H = 110; const pad = 22;
  const pts = f.rolling;
  const maxV = Math.max(10, ...pts.map((p) => p.value || 0));
  const x = (i) => pad + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * (W - pad - 8));
  const y = (v) => H - 16 - ((v || 0) / maxV) * (H - 28);
  const Trend = f.trend === 'up' ? TrendingUp : f.trend === 'down' ? TrendingDown : Minus;
  const trendText = f.trend === 'up' ? 'Improving' : f.trend === 'down' ? 'Dropping' : pts.length < 4 ? 'Too few innings for a trend' : 'Steady';
  return (
    <Card title="Career form trend" subtitle="Rolling batting average over the last 5 innings">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        <select style={sel} value={tournament} onChange={(e) => setTournament(e.target.value)} aria-label="Tournament filter">
          <option value="all">All matches</option>
          {opts.tournaments.map((t) => <option key={t} value={t}>{t}</option>)}
          {opts.hasFriendly && <option value="__friendly__">Friendlies (no tournament)</option>}
        </select>
        <select style={sel} value={lastN} onChange={(e) => setLastN(Number(e.target.value))} aria-label="How many matches">
          <option value={0}>Whole career</option><option value={5}>Last 5 matches</option><option value={10}>Last 10 matches</option><option value={20}>Last 20 matches</option>
        </select>
      </div>
      {f.matches === 0 ? <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>No matches for this filter.</p> : (
        <>
          <StatGrid items={[
            ['Matches', f.matches], ['Runs', f.batting.runs], ['Average', f.batting.average], ['Strike rate', f.batting.strike_rate],
            ['Wickets', f.bowling.wickets], ['Economy', f.bowling.economy]
          ]} />
          {pts.length >= 2 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.7rem 0 0.2rem', fontSize: '0.82rem', fontWeight: 700, color: f.trend === 'up' ? '#15803d' : f.trend === 'down' ? '#b91c1c' : '#475569' }}>
                <Trend size={16} /> {trendText}
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 480, height: 'auto' }} role="img" aria-label="Rolling batting average">
                <line x1={pad} y1={H - 16} x2={W - 6} y2={H - 16} stroke="#cbd5e1" />
                <text x={pad - 3} y={12} fontSize="8" textAnchor="end" fill="#94a3b8">{Math.round(maxV)}</text>
                <polyline fill="none" stroke="#16a34a" strokeWidth="2.2" points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} />
                {pts.map((p, i) => <circle key={p.match_id} cx={x(i)} cy={y(p.value)} r="3" fill={p.out ? '#16a34a' : '#fff'} stroke="#16a34a" strokeWidth="1.5"><title>{`${p.runs}${p.out ? '' : '*'} · average ${p.value}`}</title></circle>)}
              </svg>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Hollow dot = not out in that innings.</p>
            </>
          ) : <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Needs at least two innings with the bat for a trend line.</p>}
        </>
      )}
    </Card>
  );
}

export default CareerFormCard;
