import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { INVITE_STATUS } from './squadRules.js';

/** #339 Player: team invitations waiting for me, with accept and decline. */
export function MyInvitationsCard({ onChanged }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const load = useCallback(() => dataService.fetchMyTeamInvitations().then((d) => setItems(d.items || [])).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (items.length === 0 && !err) return null;
  const answer = async (id, accept) => {
    setBusy(true); setErr(null);
    try { const d = await dataService.respondTeamInvitation(id, accept); setItems(d.items || []); if (accept) onChanged?.(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Card title="Team invitations" subtitle="Teams that want you in their squad">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{err}</div>}
      {items.map((i) => (
        <div key={i.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <strong>{i.team}</strong>{i.city ? <span style={{ color: '#64748b' }}> · {i.city}</span> : null}
            {i.message && <div style={{ fontSize: '0.8rem', color: '#475569' }}>“{i.message}”</div>}
          </div>
          {i.status === 'pending' ? (
            <>
              <Button size="sm" variant="primary" disabled={busy} onClick={() => answer(i.id, true)}>Join team</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => answer(i.id, false)}>Decline</Button>
            </>
          ) : <span style={{ fontWeight: 700, fontSize: '0.76rem', color: INVITE_STATUS[i.status].color }}>{INVITE_STATUS[i.status].label}</span>}
        </div>
      ))}
    </Card>
  );
}

export default MyInvitationsCard;
