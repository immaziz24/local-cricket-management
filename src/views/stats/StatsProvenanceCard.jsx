import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

/** #356 Where do these figures come from, and do they add up? Rebuilt from the balls every time, so a correction shows up immediately. */
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–');
const mark = (ok) => (ok ? <span style={{ color: '#15803d' }}>✔</span> : <span style={{ color: '#b91c1c', fontWeight: 800 }}>✖</span>);

export function StatsProvenanceCard({ matchId, refreshKey = 0, onRefreshed }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => dataService.fetchStatsReconciliation(matchId).then((d) => { setR(d); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  const refresh = async () => { setBusy(true); await load(); onRefreshed?.(); setBusy(false); };

  if (err) return <Card title="Where these figures come from"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{err}</p></Card>;
  if (!r) return null;
  if (!r.ball_count) return null;
  return (
    <Card title="Where these figures come from">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: r.all_ok ? '#15803d' : '#b91c1c' }}>
        {r.all_ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        {r.all_ok ? 'Every figure adds up to the scoreboard.' : 'Some figures do not add up. Tell the match scorer or an admin.'}
      </div>
      <p style={{ margin: '0.4rem 0', fontSize: '0.82rem', color: '#475569' }}>
        Worked out from {r.ball_count} scored ball{r.ball_count === 1 ? '' : 's'}{r.scorers?.length ? ` entered by ${r.scorers.join(', ')}` : ''}, between {when(r.first_ball_at)} and {when(r.last_ball_at)}.
        {r.corrections_applied > 0 ? ` ${r.corrections_applied} correction${r.corrections_applied === 1 ? '' : 's'} applied (latest ${when(r.last_correction_at)}); the figures already include them.` : ' No corrections have been made.'}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead><tr>{['Innings', 'Scoreboard', 'Batters + extras', 'Bowlers + byes', 'Wickets', 'Balls'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>{r.innings.map((i) => (
            <tr key={i.innings_no}>
              <td style={{ padding: '0.3rem 0.5rem', whiteSpace: 'nowrap' }}>{i.team}{i.super_over ? ' (Super Over)' : ''}</td>
              <td style={{ padding: '0.3rem 0.5rem' }}>{i.scoreboard_runs}</td>
              <td style={{ padding: '0.3rem 0.5rem', whiteSpace: 'nowrap' }}>{i.batters_runs} + {i.extras + i.penalty} {mark(i.runs_ok)}</td>
              <td style={{ padding: '0.3rem 0.5rem', whiteSpace: 'nowrap' }}>{i.bowlers_conceded} + {i.byes_leg_byes + i.penalty} {mark(i.bowling_ok)}</td>
              <td style={{ padding: '0.3rem 0.5rem', whiteSpace: 'nowrap' }}>{i.scoreboard_wickets} / {i.wickets_from_balls} {mark(i.wickets_ok)}</td>
              <td style={{ padding: '0.3rem 0.5rem', whiteSpace: 'nowrap' }}>{i.scoreboard_balls} / {i.legal_balls_from_balls} {mark(i.balls_ok)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
        Player totals vs balls: batting runs {r.player_batting_runs} / {r.ball_batting_runs}, runs conceded {r.player_conceded} / {r.ball_conceded} {mark(r.players_ok)} (super overs are left out of player statistics).
      </p>
      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={refresh} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={13} /> Refresh figures</Button>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Checked {when(r.computed_at)}</span>
      </div>
    </Card>
  );
}

export default StatsProvenanceCard;
