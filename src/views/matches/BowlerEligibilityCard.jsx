import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { splitBowlers } from '../rules/ruleOverrides.js';

/** #359 Who may bowl the next over, and why the others may not. Worked out by the database from the match rules and the balls bowled. */
export function BowlerEligibilityCard({ matchId, refreshKey = 0 }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => dataService.fetchBowlerEligibility(matchId).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (err || !d || !d.innings_in_progress) return null;
  const { ok, blocked } = splitBowlers(d.bowlers);
  return (
    <Card title="Who can bowl" subtitle={d.max_overs_per_bowler ? `Most ${d.max_overs_per_bowler} over${d.max_overs_per_bowler === 1 ? '' : 's'} each` : 'No over limit per bowler'}>
      <div style={{ fontSize: '0.84rem' }}>
        <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '0.2rem' }}>Can bowl the next over</div>
        <div style={{ marginBottom: '0.5rem' }}>{ok.length ? ok.map((b) => `${b.name} (${b.overs})`).join(', ') : <span style={{ color: '#b91c1c' }}>Nobody is allowed. Check the over limit.</span>}</div>
        {blocked.length > 0 && (<>
          <div style={{ fontWeight: 700, color: '#b45309', marginBottom: '0.2rem' }}>Cannot start an over</div>
          {blocked.map((b) => <div key={b.player_id}>{b.name} ({b.overs}) <span style={{ color: '#64748b' }}>- {b.reason}</span></div>)}
        </>)}
      </div>
    </Card>
  );
}
export default BowlerEligibilityCard;
