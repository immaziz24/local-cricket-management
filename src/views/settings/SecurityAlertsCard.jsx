import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { alertLabel } from '../tournaments/securityRules.js';

/** #387 Security alerts: password, email, phone or mobile changes, account status and admin role changes on your account. */
export function SecurityAlertsCard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { dataService.fetchSecurityAlerts().then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <Card title="Security alerts"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.84rem' }}>{err}</p></Card>;
  if (!d) return null;
  return (
    <Card title="Security alerts" subtitle="We tell you when something sensitive changes on your account">
      {d.items.length === 0 && <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>No alerts. You will see one here if your password, email, phone, mobile number or account status changes.</p>}
      {d.items.map((a) => (
        <div key={a.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9', opacity: a.read ? 0.7 : 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase' }}>{alertLabel(a.kind)}</span>
            <strong style={{ fontSize: '0.88rem' }}>{a.title}</strong>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#475569' }}>{a.body}</div>
        </div>
      ))}
      {d.unread > 0 && <div style={{ marginTop: '0.6rem' }}><Button size="sm" variant="secondary" onClick={() => dataService.ackSecurityAlerts().then(setD).catch((e) => setErr(e.message))}>Mark {d.unread} as seen</Button></div>}
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Alerts also appear in your notifications. If a change was not made by you, reset your password and contact support.</p>
    </Card>
  );
}

export default SecurityAlertsCard;
