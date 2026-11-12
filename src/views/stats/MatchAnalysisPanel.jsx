import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Star } from 'lucide-react';
import { WagonWheel } from '../matches/WagonWheel.jsx';
import { BarChart, WormChart, PlayerName, StatGrid, oversOf, th, td } from './statsUi.jsx';

/**
 * #101 Match analysis (runs per over, worm, partnerships, boundaries),
 * #96 Player of the Match (picked automatically from MVP points; the scorer can change it), #100 charts.
 */
const COLORS = ['#16a34a', '#2563eb', '#ea580c', '#9333ea'];

export function MatchAnalysisPanel({ matchId, matchStatus, canScore, refreshKey, onNavigate }) {
  const [a, setA] = useState(null);
  const [error, setError] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => dataService.fetchMatchAnalysis(matchId).then((d) => { setA(d); setError(null); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [matchId, refreshKey]);

  const savePom = async (playerId) => {
    setBusy(true);
    try { await dataService.setPlayerOfMatch(matchId, playerId); setPick(''); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!a) return <Card><p style={{ margin: 0, color: error ? '#b91c1c' : '#64748b', fontSize: '0.85rem' }}>{error || 'Loading analysis…'}</p></Card>;
  const inns = a.innings || [];
  if (inns.length === 0) return <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Analysis appears once scoring starts.</p></Card>;

  const pom = a.player_of_match;
  const players = a.players || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p>}

      <Card title="Player of the Match">
        {pom ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Star size={22} style={{ color: '#ca8a04' }} fill="#facc15" />
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800 }}><PlayerName id={pom.player_id} name={pom.name} onNavigate={onNavigate} /></div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{pom.points} MVP points · {pom.by_hand ? 'chosen by the scorer' : 'picked automatically'}</div>
            </div>
          </div>
        ) : <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>{matchStatus === 'completed' ? 'Not chosen.' : 'Picked automatically when the match finishes.'}</p>}
        {canScore && matchStatus === 'completed' && (
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}>
              <option value="">Choose another player…</option>
              {players.map((p) => <option key={p.player_id} value={p.player_id}>{p.name} ({p.points} pts)</option>)}
            </select>
            <Button size="sm" variant="primary" disabled={busy || !pick} onClick={() => savePom(pick)}>Save</Button>
            {pom && pom.by_hand && <Button size="sm" variant="secondary" disabled={busy} onClick={() => savePom(null)}>Back to automatic</Button>}
          </div>
        )}
      </Card>

      {inns.length > 0 && (
        <Card title="Worm" subtitle="Total runs after each over">
          <WormChart series={inns.map((i, k) => ({ name: `${i.team} (${i.runs}/${i.wickets})`, color: COLORS[k % 4], points: (i.overs || []).map((o) => ({ over: o.over, total: o.total })) }))} />
        </Card>
      )}

      {inns.map((i, k) => (
        <Card key={i.innings_no} title={`${i.team} – ${i.runs}/${i.wickets} (${oversOf(i.legal_balls)} ov)`} subtitle={`Innings ${i.innings_no}`}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>Runs per over (red dots = wickets)</div>
          <BarChart color={COLORS[k % 4]} bars={(i.overs || []).map((o) => ({ label: String(o.over), value: o.runs, mark: o.wickets }))} />
          <div style={{ marginTop: '0.8rem' }}>
            <StatGrid items={[
              ['Fours', i.boundaries?.fours], ['Sixes', i.boundaries?.sixes],
              ['Boundary runs', i.boundaries?.boundary_runs, i.runs ? `${Math.round((i.boundaries?.boundary_runs || 0) * 100 / i.runs)}% of total` : null],
              ['Dot balls', i.boundaries?.dots]
            ]} />
          </div>
          <div style={{ marginTop: '0.8rem' }}><WagonWheel matchId={matchId} inningsNo={i.innings_no} title="Wagon wheel" refreshKey={refreshKey} /></div>
          {(i.partnerships || []).length > 0 && (
            <div style={{ marginTop: '0.8rem', overflowX: 'auto' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>Partnerships</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Wkt</th><th style={th}>Batters</th><th style={th}>Runs</th><th style={th}>Balls</th></tr></thead>
                <tbody>{i.partnerships.map((p) => (
                  <tr key={p.wicket}><td style={td}>{p.wicket}</td><td style={td}>{p.batters || '–'}</td><td style={{ ...td, fontWeight: 700 }}>{p.runs}</td><td style={td}>{p.balls}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>
      ))}

      <Card title="Top performers" subtitle="MVP points in this match">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Player</th><th style={th}>Bat</th><th style={th}>Bowl</th><th style={th}>Pts</th></tr></thead>
          <tbody>{players.filter((p) => p.points > 0).slice(0, 8).map((p) => (
            <tr key={p.player_id}>
              <td style={td}><PlayerName id={p.player_id} name={p.name} onNavigate={onNavigate} /></td>
              <td style={td}>{p.balls > 0 || p.runs > 0 ? `${p.runs} (${p.balls})` : '–'}</td>
              <td style={td}>{p.wickets > 0 || p.runs_conceded > 0 ? `${p.wickets}/${p.runs_conceded}` : '–'}</td>
              <td style={{ ...td, fontWeight: 800 }}>{p.points}</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

export default MatchAnalysisPanel;
