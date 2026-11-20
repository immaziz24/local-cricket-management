import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { twoPersonText } from './securityRules.js';

/** #384 Organiser: turn on two-person approval for score corrections and local rule changes. */
export function TwoPersonCard({ tournament }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dataService.fetchTournamentSecurity(tournament.id).then(setD).catch((e) => setErr(e.message)); }, [tournament.id]);
  if (!d || !d.can_manage) return null;
  const flip = async () => { setBusy(true); setErr(null); try { setD(await dataService.setTwoPersonApproval(tournament.id, !d.two_person)); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <Card title="Two-person approval" subtitle="Score corrections and local rule changes need a second person">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.4rem' }}>{err}</div>}
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.84rem', color: '#475569' }}>{twoPersonText(d.two_person)}</p>
      <Button variant={d.two_person ? 'secondary' : 'primary'} disabled={busy} onClick={flip}>{d.two_person ? 'Turn off' : 'Turn on'}</Button>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Needs a second organiser or the match owner to approve. Admins can always decide. Applies to ball corrections and local rule changes.</p>
    </Card>
  );
}

export default TwoPersonCard;
