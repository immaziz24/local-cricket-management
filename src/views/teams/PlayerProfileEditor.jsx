import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowUpRight, Pencil, Save } from 'lucide-react';
import { ROLE_OPTIONS, BATTING_OPTIONS, BOWLING_OPTIONS } from './playerOptions.js';
import { Avatar } from './Avatar.jsx';
import './PlayerProfileEditor.css';

const field = { width: '100%', padding: '0.55rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', boxSizing: 'border-box' };

const formatName = (name = '') => name.trim().replace(/\s+/g, ' ').replace(/(^|[\s\-’'])(\p{L})/gu, (_, separator, letter) => separator + letter.toUpperCase());

export function PlayerProfileEditor({ onNavigate, onProfileSaved }) {
  const [me, setMe] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const photoInput = useRef(null);
  const editPhotoButton = useRef(null);

  useEffect(() => {
    let active = true;
    dataService.fetchMyPlayer().then((player) => {
      if (active) setMe(player && { ...player, display_name: formatName(player.display_name || "") });
    }).catch((err) => {
      if (active) setMsg({ ok: false, text: err.message });
    });
    return () => { active = false; };
  }, []);

  const saveMe = async () => {
    setBusy(true);
    try {
      const saved = await dataService.saveMyPlayer({ ...me, display_name: formatName(me.display_name || "") });
      setMe(saved);
      onProfileSaved?.(saved);
      setMsg({ ok: true, text: 'Your player profile is saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const updateMyPhoto = async (file) => {
    setBusy(true);
    try {
      const updated = await dataService.setPlayerPhoto(me.id, file);
      setMe((current) => ({ ...current, photo_url: updated.photo_url }));
      setPhotoActionsOpen(false);
      setMsg({ ok: true, text: file === null ? 'Photo removed from your profile.' : 'Photo updated.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  if (!me) return <p role={msg ? 'alert' : 'status'}>{msg?.text || 'Loading your player profile…'}</p>;
  return (
        <Card title="My player profile">
          <div className="player-editor-header" onKeyDown={(event) => {
            if (event.key === 'Escape' && photoActionsOpen) {
              setPhotoActionsOpen(false);
              editPhotoButton.current?.focus();
            }
          }}>
            <div className="player-editor-identity">
              <h3>{formatName(me.display_name || '') || 'Player'}</h3>
              <div className="player-editor-code">Player ID <strong>{me.player_code}</strong></div>
              <button className="player-editor-profile-link" type="button" onClick={() => onNavigate?.('player-profile', me.id)}>
                View public profile <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="player-editor-avatar">
              <Avatar url={me.photo_url} name={me.display_name} size={112} />
              <button ref={editPhotoButton} className="player-editor-pencil" type="button" aria-label="Edit profile photo"
                aria-expanded={photoActionsOpen} disabled={busy} onClick={() => setPhotoActionsOpen((open) => !open)}>
                <Pencil size={16} aria-hidden="true" />
              </button>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) updateMyPhoto(file);
                }} />
              {photoActionsOpen && (
                <div className="player-editor-photo-actions" role="group" aria-label="Profile photo actions">
                  <Button type="button" variant="secondary" disabled={busy || !me.photo_url} onClick={() => updateMyPhoto(null)}>
                    Remove
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => photoInput.current?.click()}>
                    Choose file
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <label>Full name
              <input maxLength={100} value={me.display_name || ''} onChange={(e) => setMe({ ...me, display_name: e.target.value })} onBlur={() => setMe((current) => ({ ...current, display_name: formatName(current.display_name || '') }))} style={field} />
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
