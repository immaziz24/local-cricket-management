import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Save } from 'lucide-react';
import { ROLE_OPTIONS, BATTING_OPTIONS, BOWLING_OPTIONS } from './playerOptions.js';
import { Avatar } from './Avatar.jsx';

const field = { width: '100%', padding: '0.55rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', boxSizing: 'border-box' };

export function PlayerProfileEditor({ onNavigate, onProfileSaved }) {
  const [me, setMe] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    dataService.fetchMyPlayer().then((player) => {
      if (active) setMe(player);
    }).catch((err) => {
      if (active) setMsg({ ok: false, text: err.message });
    });
    return () => { active = false; };
  }, []);

  const saveMe = async () => {
    setBusy(true);
    try {

      const saved = await dataService.saveMyPlayer(me);
      setMe(saved);
      onProfileSaved?.(saved);
      setMsg({ ok: true, text: 'Your player profile is saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const uploadMyPhoto = async (file) => {
    setBusy(true);
    try {
      await dataService.setPlayerPhoto(me.id, file);
      const updated = await dataService.fetchMyPlayer();
      setMe((current) => ({ ...current, photo_url: updated.photo_url }));
      setMsg({ ok: true, text: 'Photo updated.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  if (!me) return <p role={msg ? 'alert' : 'status'}>{msg?.text || 'Loading your player profile…'}</p>;
  return (
        <Card title="My player profile">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <Avatar url={me.photo_url} name={me.display_name} size={64}  />
            <div style={{ flex: 1 }}>
              <label style={{ display: "block" }}>Profile photo
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) uploadMyPhoto(file);
                }} />
              </label>
              <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{me.display_name}</strong>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Player ID: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{me.player_code}</strong> · this is how you appear in every team.</div>
              <button type="button" onClick={() => onNavigate && onNavigate('player-profile', me.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.8rem', marginTop: '0.2rem' }}>View my public profile →</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <label>Full name
              <input maxLength={100} value={me.display_name || ''} onChange={(e) => setMe({ ...me, display_name: e.target.value })} style={field} />
            </label>
            <label>Location
              <input maxLength={120} value={me.location || ''} onChange={(e) => setMe({ ...me, location: e.target.value })} style={field} />
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Date of birth – others see only your age
              <input type="date" value={me.date_of_birth || ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setMe({ ...me, date_of_birth: e.target.value })} style={field} />
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Playing role
              <select value={me.player_role || ''} onChange={(e) => setMe({ ...me, player_role: e.target.value })} style={field}>
                <option value="">Not set</option>
                {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Batting style
              <select value={me.batting_style || ''} onChange={(e) => setMe({ ...me, batting_style: e.target.value })} style={field}>
                <option value="">Not set</option>
                {BATTING_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Bowling style
              <select value={me.bowling_style || ''} onChange={(e) => setMe({ ...me, bowling_style: e.target.value })} style={field}>
                <option value="">Not set</option>
                {BOWLING_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          {msg && <p role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={saveMe} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Save size={14} /> Save</Button>
          </div>
        </Card>
  );
}
