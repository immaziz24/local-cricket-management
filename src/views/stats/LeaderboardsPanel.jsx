import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { PlayerName, StatGrid, th, td } from './statsUi.jsx';
import { BoundaryTrackerCard } from './BoundaryTrackerCard.jsx';

/**
 * #57 / #102 Tournament (or whole-site) leaderboards and statistics, #97 MVP.
 * Pass tournamentId for one tournament; leave it empty for every match on the website.
 */
const BOARDS = [
  { key: 'most_runs', label: 'Most runs', cols: [['Runs', 'value'], ['Inn', 'innings'], ['Avg', 'average'], ['SR', 'strike_rate']] },
  { key: 'most_wickets', label: 'Most wickets', cols: [['Wkts', 'value'], ['Overs', 'overs'], ['Runs', 'runs'], ['Econ', 'economy']] },
  { key: 'mvp', label: 'MVP', cols: [['Points', 'value'], ['Runs', 'runs'], ['Wkts', 'wickets'], ['M', 'matches']] },
  { key: 'highest_scores', label: 'Highest scores', cols: [['Score', (r) => `${r.value}${r.not_out ? '*' : ''}`], ['Balls', 'balls']] },
  { key: 'best_bowling', label: 'Best bowling', cols: [['Figures', 'value']] },
  { key: 'most_sixes', label: 'Most sixes', cols: [['6s', 'value'], ['4s', 'fours']] },
  { key: 'best_strike_rate', label: 'Best strike rate', cols: [['SR', 'value'], ['Runs', 'runs'], ['Balls', 'balls']], note: 'Minimum 10 balls faced' },
  { key: 'best_economy', label: 'Best economy', cols: [['Econ', 'value'], ['Overs', 'overs'], ['Wkts', 'wickets']], note: 'Minimum 2 overs bowled' },
  { key: 'most_catches', label: 'Most dismissals (field)', cols: [['Total', 'value'], ['Ct', 'catches'], ['St', 'stumpings'], ['RO', 'run_outs']] }
];

function TournamentOverview({ data, onNavigate }) {
  const { totals } = data;
  const highlights = [
    ['Leading run scorer', data.most_runs?.[0]],
    ['Leading wicket taker', data.most_wickets?.[0]],
    ['Highest innings score', data.highest_scores?.[0]],
    ['Best bowling figures', data.best_bowling?.[0]]
  ];
  const foursRuns = totals.fours * 4;
  const sixesRuns = totals.sixes * 6;
  const boundaryRuns = foursRuns + sixesRuns;
  const boundaryShare = totals.runs > 0 ? Math.round(boundaryRuns / totals.runs * 100) : null;

  return (
    <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
      <section aria-label="Top performances" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '0.65rem' }}>
        {highlights.map(([label, player]) => (
          <div key={label} style={{ padding: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
            <div style={{ color: '#475569', fontSize: '0.8rem' }}>{label}</div>
            <strong style={{ display: 'block', fontSize: '1.35rem', color: '#065f46' }}>
              {player ? `${player.value}${player.not_out ? '*' : ''}` : '-'}
            </strong>
            {player && <PlayerName id={player.player_id} name={player.name} onNavigate={onNavigate} />}
          </div>
        ))}
      </section>
      <section aria-label="Boundary scoring">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Boundary scoring</h3>
        <StatGrid columns={4} items={[
          ['Runs from fours', foursRuns], ['Runs from sixes', sixesRuns],
          ['Boundary runs', boundaryRuns], ['Share of batter runs', boundaryShare === null ? '-' : `${boundaryShare}%`]
        ]} />
      </section>
    </div>
  );
}

export function LeaderboardsPanel({ tournamentId = null, onNavigate, title = 'Leaderboards', mode = 'leaderboard' }) {
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(mode === 'mvp' ? 'mvp' : mode === 'stats' ? 'overview' : 'most_runs');
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    dataService.fetchLeaderboards(tournamentId, 10).then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [tournamentId]);

  if (error) return <Card title={title}><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p></Card>;
  if (!data) return <Card title={title}><p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Loading.</p></Card>;

  const t = data.totals || {};
  if (!t.matches) {
    return <Card title={title}><p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Tournament statistics appear as matches are scored ball by ball.</p></Card>;
  }
  const options = mode === 'stats' ? [{ key: 'overview', label: 'Overview' }, ...BOARDS.filter((b) => b.key !== 'mvp')] : BOARDS;
  const def = BOARDS.find((b) => b.key === board);
  const rows = data[board] || [];

  return (
    <>
    <Card title={title} subtitle="From ball-by-ball scored matches">
      <StatGrid items={[['Matches', t.matches], [mode === 'stats' ? 'Batter runs' : 'Runs', t.runs], ['Wickets', t.wickets], ['Fours', t.fours], ['Sixes', t.sixes]]} columns={5} />
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', margin: '0.9rem 0 0.6rem' }}>
        {['leaderboard', 'stats'].includes(mode) && options.map((b) => (
          <button type="button" key={b.key} aria-pressed={board === b.key} onClick={() => setBoard(b.key)}
            style={{ padding: '0.3rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid ' + (board === b.key ? '#16a34a' : '#e2e8f0'),
                     backgroundColor: board === b.key ? '#dcfce7' : '#fff', color: board === b.key ? '#166534' : '#475569', fontWeight: board === b.key ? 700 : 500 }}>
            {b.label}
          </button>
        ))}
      </div>
      {mode === 'heroes' ? <StatGrid columns={3} items={[
        ['Top batter', data.most_runs?.[0]?.name || 'Pending'],
        ['Top bowler', data.most_wickets?.[0]?.name || 'Pending'],
        ['MVP leader', data.mvp?.[0]?.name || 'Pending'],
      ]} /> : board === 'overview' ? <TournamentOverview data={data} onNavigate={onNavigate} /> : rows.length === 0 ? <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>Nobody qualifies yet.{def.note ? ` (${def.note})` : ''}</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>#</th><th style={th}>Player</th>{def.cols.map(([h]) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.player_id}-${i}`} style={i === 0 ? { backgroundColor: '#fefce8' } : undefined}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>
                    <PlayerName id={r.player_id} name={r.name} onNavigate={onNavigate} />
                    {r.team && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.team}</div>}
                  </td>
                  {def.cols.map(([h, k]) => <td key={h} style={{ ...td, fontWeight: h === def.cols[0][0] ? 800 : 400 }}>{(typeof k === 'function' ? k(r) : r[k]) ?? '-'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {def.note && <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>{def.note}</p>}
        </div>
      )}
      {board === 'mvp' && <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>MVP points: 1 per run, +1 per four, +2 per six, +8 for 50, +24 for 100; 25 per wicket, 8 per maiden, 1 per dot ball; 8 per catch, 12 per stumping, 10 per run-out.</p>}
    </Card>
    {['leaderboard', 'stats'].includes(mode) && <BoundaryTrackerCard tournamentId={tournamentId} onNavigate={onNavigate} />}
    </>
  );
}

export default LeaderboardsPanel;
