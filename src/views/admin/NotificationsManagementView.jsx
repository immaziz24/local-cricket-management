import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Bell, CheckCheck, Send, Save, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Feature #270 – Notifications management
 * - Every user: notification inbox + notification preferences
 * - Admin / Super-Admin: send a notification to all active members
 * In-app notifications work now; email / push / SMS delivery is added later.
 */

const when = (v) => new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
      {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
    </div>
  );
}

export function NotificationsManagementView() {
  const [inbox, setInbox] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [signedIn, setSignedIn] = useState(true);
  const [msg, setMsg] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [n, p] = await Promise.all([dataService.fetchMyNotifications(), dataService.fetchNotificationPreferences()]);
      setInbox(n || []);
      setPrefs(p);
      setSignedIn(true);
    } catch {
      setSignedIn(false);
    }
  };

  useEffect(() => { load(); }, []);

  const unread = inbox.filter((n) => !n.read_at);

  const markAllRead = async () => {
    try {
      await dataService.markNotificationsRead(unread.map((n) => n.id));
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const savePrefs = async () => {
    setBusy(true);
    try {
      await dataService.saveNotificationPreferences(prefs);
      setMsg({ ok: true, text: 'Notification settings saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setMsg({ ok: false, text: 'Please write a title.' }); return; }
    if (!window.confirm('Send this notification to every active member?')) return;
    setBusy(true);
    try {
      const res = await dataService.sendAnnouncement(title.trim(), body.trim());
      setMsg({ ok: true, text: `Sent to ${res.recipients} member${res.recipients === 1 ? '' : 's'}.` });
      setTitle(''); setBody('');
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  if (!signedIn) {
    return <Card><p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Please sign in to see your notifications.</p></Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.35rem 0 0.25rem' }}>Notifications</h2>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>Your messages from Local Cricket, and how you want to receive them.</p>
      </div>

      <Notice msg={msg} />

      <Card title={`Inbox · ${unread.length} unread`}>
        {unread.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <Button variant="secondary" onClick={markAllRead} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}><CheckCheck size={14} /> Mark all as read</Button>
          </div>
        )}
        {inbox.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>No notifications yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {inbox.map((n) => (
              <div key={n.id} style={{ padding: '0.7rem 0.85rem', borderRadius: '0.5rem', border: `1px solid ${n.read_at ? '#e2e8f0' : '#bfdbfe'}`, backgroundColor: n.read_at ? '#f8fafc' : '#eff6ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {!n.read_at && <Bell size={13} style={{ color: '#2563eb' }} />} {n.title}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{when(n.created_at)}</span>
                </div>
                {n.body && <div style={{ fontSize: '0.83rem', color: '#475569', marginTop: '0.2rem' }}>{n.body}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {prefs && (
        <Card title="How I receive notifications">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              ['in_app_enabled', 'On the website (inbox)', 'Available now'],
              ['email_enabled', 'By email', 'Coming soon'],
              ['push_enabled', 'Phone push notifications', 'Coming with the Android app'],
              ['sms_enabled', 'By SMS', 'Coming later']
            ].map(([key, label, hint]) => (
              <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer' }}>
                <span>
                  <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{label}</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{hint}</span>
                </span>
                <input type="checkbox" checked={!!prefs[key]} onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))} style={{ width: '18px', height: '18px' }} />
              </label>
            ))}
          </div>
          <div style={{ marginTop: '0.85rem' }}>
            <Button variant="primary" onClick={savePrefs} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Save size={14} /> Save</Button>
          </div>
        </Card>
      )}

      <Card title="Send to all members (Admins only)">
        <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title, e.g. New tournament season starts Monday" style={{ padding: '0.55rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem' }} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} placeholder="Message (optional)" style={{ padding: '0.55rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit' }} />
          <div>
            <Button type="submit" variant="primary" disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Send size={14} /> Send to everyone</Button>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Members who turned off website notifications will not receive it. Only Admins and the Super-Admin can send.</span>
        </form>
      </Card>
    </div>
  );
}

export default NotificationsManagementView;
