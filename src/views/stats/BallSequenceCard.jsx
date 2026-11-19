import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { groupBallIssues } from '../rules/ruleOverrides.js';

/** #382 Checks every ball: numbering, over count, legal vs illegal deliveries, batters, bowlers. */
export function BallSequenceCard({ matchId, refreshKey = 0 }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => dataService.fetchBallSequenceCheck(matchId).then((x) => { setR(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (err) return null;
  if (!r || !r.balls_checked) return null;
  const groups = groupBallIssues(r.issues);
  return (
    <Card title="Ball-by-ball check">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: r.ok ? '#15803d' : '#b91c1c', fontSize: '0.88rem' }}>
        {r.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        {r.ok ? `All ${r.balls_checked} balls are in order.` : `${r.issues.length} problem${r.issues.length === 1 ? '' : 's'} found in the ball record. Tell the match scorer or an admin.`}
      </div>
      {groups.map((g) => (
        <div key={g.innings_no} style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 700 }}>Innings {g.innings_no || ''}</div>
          {g.items.map((i, n) => <div key={n} style={{ color: '#475569' }}>{i.title}{i.seq ? ` (ball ${i.seq})` : ''}: {i.message}</div>)}
        </div>
      ))}
    </Card>
  );
}
export default BallSequenceCard;
