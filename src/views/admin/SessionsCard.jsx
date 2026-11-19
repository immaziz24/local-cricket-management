import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { deviceLabel } from './deviceLabel.js';

/** #386 Devices signed in to my account, with a button to sign one out. */
export function SessionsCard() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => dataService.listMySessions().then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const revoke = async (id) => {
    if (!window.confirm('Sign this device out?')) return;
    try { setList(await dataService.revokeMySession(id)); setErr(null); } catch (e) { setErr(e.message); }
  };
  const when = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  return (
    <Card title="Signed-in devices">
      {err && <p style={{ margin: '0 0 0.5rem', fontSize: '0.83rem', color: '#b91c1c' }}>{err}</p>}
      {!list ? <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Loading…</p> : list.length === 0 ? <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>No other devices found.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {list.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.55rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
              <span style={{ flex: 1, minWidth: 160 }}>
                <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{deviceLabel(s.user_agent)}{s.is_current ? ' (this device)' : ''}</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Signed in {when(s.created_at)} · last active {when(s.last_active)}</span>
              </span>
              {!s.is_current && <Button size="sm" variant="secondary" onClick={() => revoke(s.id)}>Sign out</Button>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
