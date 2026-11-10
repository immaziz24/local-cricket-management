import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { Award, Trophy, Star, Medal } from 'lucide-react';
import { StatGrid, BarChart, fmt, oversOf, th, td } from './statsUi.jsx';

/**
 * #77 Player career statistics, #78 awards and achievements,
 * #79–#85 batting, #86–#92 bowling, #93–#95 fielding, #100 performance chart.
 * Worked out from every scored ball.
 */
export function PlayerStatsPanel({ playerId, onNavigate }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    dataService.fetchPlayerStats(playerId).then((d) => { if (alive) setS(d); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [playerId]);

  if (error) return <Card title="Statistics"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p></Card>;
  if (!s) return <Card title="Statistics"><p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Loading statistics…</p></Card>;

  const b = s.batting || {}; const w = s.bowling || {}; const f = s.fielding || {};
  const matches = s.matches || [];
  if (b.matches === 0) {
    return <Card title="Statistics"><p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>No scored matches yet. Statistics appear after this player plays a ball-by-ball scored match.</p></Card>;
  }

  const hs = b.highest ? `${b.highest.runs}${b.highest.not_out ? '*' : ''}` : null;
  const best = w.best && w.best.wickets > 0 ? `${w.best.wickets}/${w.best.runs}` : null;
  const recent = [...matches].reverse().slice(-12);

  const awards = [
    [Star, 'Player of the Match', s.player_of_match],
    [Trophy, 'Tournaments won', s.trophies],
    [Medal, 'Fifties', b.fifties],
    [Medal, 'Hundreds', b.hundreds],
    [Award, '3-wicket hauls', w.three_wickets],
    [Award, '5-wicket hauls', w.five_wickets]
  ].filter(([, , n]) => n > 0);

  return (
    <>
      <Card title="Batting" subtitle={`${b.matches} matches · MVP points ${s.mvp_points}`}>
        <StatGrid items={[
          ['Innings', b.innings], ['Runs', b.runs], ['Average', b.average, `${b.not_outs} not out`], ['Strike rate', b.strike_rate],
          ['Highest', hs], ['4s', b.fours], ['6s', b.sixes], ['50s / 100s', `${b.fifties} / ${b.hundreds}`], ['Ducks', b.ducks]
        ]} />
      </Card>

      <Card title="Bowling">
        {w.balls > 0 ? (
          <StatGrid items={[
            ['Overs', oversOf(w.balls)], ['Wickets', w.wickets], ['Average', w.average], ['Economy', w.economy],
            ['Strike rate', w.strike_rate], ['Best', best], ['Maidens', w.maidens], ['Dot balls', w.dots], ['Wides / NB', `${w.wides} / ${w.no_balls}`]
          ]} />
        ) : <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Has not bowled yet.</p>}
      </Card>

      <Card title="Fielding">
        <StatGrid items={[['Catches', f.catches], ['Run-outs', f.run_outs], ['Stumpings', f.stumpings]]} />
      </Card>

      <Card title="Awards & achievements">
        {awards.length === 0
          ? <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>No awards yet.</p>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {awards.map(([Icon, label, n]) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', borderRadius: '999px', backgroundColor: '#fef9c3', color: '#854d0e', fontSize: '0.8rem', fontWeight: 600 }}>
                  <Icon size={14} /> {label} × {n}
                </span>
              ))}
            </div>}
      </Card>

      <Card title="Form" subtitle="Runs in recent matches (red dots = wickets taken)">
        <BarChart bars={recent.map((m, i) => ({ label: `M${matches.length - recent.length + i + 1}`, value: m.runs, mark: m.wickets }))} />
      </Card>

      <Card title={`Match by match (${matches.length})`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Date</th><th style={th}>Match</th><th style={th}>Bat</th><th style={th}>Bowl</th><th style={th}>Field</th><th style={th}>Pts</th>
            </tr></thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.match_id} onClick={() => onNavigate && onNavigate('match-centre', m.match_id)} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
                  <td style={td}>{m.date ? new Date(m.date).toLocaleDateString() : '–'}</td>
                  <td style={td}>
                    vs {fmt(m.opponent)} {m.player_of_match && <Star size={12} style={{ color: '#ca8a04', verticalAlign: '-1px' }} />}
                    <div style={{ fontSize: '0.7rem', color: m.won ? '#15803d' : '#94a3b8' }}>{m.status === 'live' ? 'Live' : (m.result || m.tournament || 'Friendly')}</div>
                  </td>
                  <td style={td}>{m.batted ? `${m.runs}${m.out ? '' : '*'} (${m.balls})` : '–'}</td>
                  <td style={td}>{m.bowl_balls > 0 ? `${m.wickets}/${m.runs_conceded} (${oversOf(m.bowl_balls)})` : '–'}</td>
                  <td style={td}>{m.catches + m.run_outs + m.stumpings > 0 ? [m.catches && `${m.catches}c`, m.stumpings && `${m.stumpings}st`, m.run_outs && `${m.run_outs}ro`].filter(Boolean).join(' ') : '–'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{m.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export default PlayerStatsPanel;
