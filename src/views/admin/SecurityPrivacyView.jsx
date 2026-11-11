import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Lock, Download, LogOut, Save, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Feature #269 – Security and privacy management (for every user)
 * - Privacy settings: who can see my profile, phone and email
 * - Download my personal data (DPDP Act)
 * - Sign out of all devices
 */

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.7rem 0.85rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer' }}>
      <span>
        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{label}</strong>
        {hint && <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{hint}</span>}
      </span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ width: '18px', height: '18px' }} />
    </label>
  );
}

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
      {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
    </div>
  );
}

export function SecurityPrivacyView() {
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dataService.fetchPrivacySettings()
      .then(setSettings)
      .catch((err) => setLoadError(err.message || 'Please sign in to manage your privacy.'));
  }, []);

  const set = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      await dataService.savePrivacySettings(settings);
      setMsg({ ok: true, text: 'Privacy settings saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const downloadMyData = async () => {
    setBusy(true);
    try {
      const data = await dataService.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `my-local-cricket-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg({ ok: true, text: 'Your data has been downloaded.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const signOutAll = async () => {
    if (!window.confirm('Sign out of Local Cricket on all your devices (phone, laptop, etc.)?')) return;
    setBusy(true);
    try {
      await dataService.signOutEverywhere();
      window.location.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.35rem 0 0.25rem' }}>Security & Privacy</h2>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>Control who sees your details, download your data, and sign out everywhere.</p>
      </div>

      <Notice msg={msg} />

      {loadError ? (
        <Card><p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{loadError}</p></Card>
      ) : !settings ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Loading…</div>
      ) : (
        <>
          <Card title="Privacy">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.7rem 0.85rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                <span>
                  <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>Who can see my profile</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Your name and cricket stats</span>
                </span>
                <select value={settings.profile_visibility} onChange={(e) => set('profile_visibility', e.target.value)} style={{ padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1' }}>
                  <option value="public">Everyone</option>
                  <option value="members">Signed-in members</option>
                  <option value="private">Only me</option>
                </select>
              </label>
              <Toggle label="Show my phone number" hint="Visible to members who can see your profile" checked={settings.show_phone} onChange={(v) => set('show_phone', v)} />
              <Toggle label="Show my email address" checked={settings.show_email} onChange={(v) => set('show_email', v)} />
              <Toggle label="Allow messages from other members" checked={settings.allow_messages} onChange={(v) => set('allow_messages', v)} />
              <Toggle label="Help improve Local Cricket" hint="Share anonymous usage statistics" checked={settings.analytics_opt_in} onChange={(v) => set('analytics_opt_in', v)} />
            </div>
            <div style={{ marginTop: '0.85rem' }}>
              <Button variant="primary" onClick={save} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Save size={14} /> Save privacy settings</Button>
            </div>
          </Card>

          <Card title="My data">
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
              Download everything Local Cricket stores about you (your right under India's DPDP Act).
            </p>
            <Button variant="secondary" onClick={downloadMyData} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Download size={14} /> Download my data</Button>
          </Card>

          <Card title="Sessions">
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
              Lost your phone or used a shared computer? Sign out everywhere. You will need to log in again.
            </p>
            <Button variant="danger" onClick={signOutAll} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><LogOut size={14} /> Sign out of all devices</Button>
          </Card>

          <Card>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              <Lock size={16} style={{ flexShrink: 0 }} />
              Passwords are stored encrypted by Supabase and are never visible to admins. Two-step login (2FA) will be added later.
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default SecurityPrivacyView;
