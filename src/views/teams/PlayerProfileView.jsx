import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowLeft, Lock, Phone, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { ROLE_OPTIONS, BATTING_OPTIONS, BOWLING_OPTIONS, labelOf } from './playerOptions.js';
import { Avatar } from './Avatar.jsx';
import { PlayerStatsPanel } from '../stats/PlayerStatsPanel.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { PlayerShareCard } from '../media/ShareStudio.jsx';
import { PlayerAwardsCard } from '../brand/AwardsPanel.jsx';

/**
 * #60 Player profile (public view)
 * Shows player ID (#62), photo (#61), age (#66 — never the full date of birth to others),
 * contact details only if the player allows it (#67), badges (#265) and teams.
 */

const BADGE_LABELS = { identity: 'Verified person', umpire: 'Verified umpire', scorer: 'Verified scorer' };

export function PlayerProfileView({ playerId, onNavigate }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);

  const load = async () => {
    try { setP(await dataService.fetchPlayerProfile(playerId)); setError(null); }
    catch (err) { setError(err.message); }
  };

  useEffect(() => { if (playerId) load(); }, [playerId]);
  useEffect(() => { if (playerId) dataService.fetchPlayerStats(playerId).then(setStats).catch(() => setStats(null)); }, [playerId]);

  const uploadPhoto = async (file) => {
    setBusy(true);
    try { await dataService.setPlayerPhoto(playerId, file); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const back = (
    <button onClick={() => onNavigate && onNavigate('teams')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', padding: 0 }}>
      <ArrowLeft size={15} /> My Teams
    </button>
  );

  if (error && !p) return <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{back}<Card><p style={{ color: '#b91c1c', margin: 0 }}>{error}</p></Card></div>;
  if (!p) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading player…</div>;

  if (p.private || p.members_only) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {back}
        <Card>
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <Lock size={28} style={{ color: '#94a3b8' }} />
            <h3 style={{ margin: '0.5rem 0 0.25rem' }}>{p.display_name} <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{p.player_code}</span></h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              {p.private ? 'This player keeps their profile private.' : 'Sign in to see this player’s profile.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const details = [
    ['Role', labelOf(ROLE_OPTIONS, p.player_role)],
    ['Batting', labelOf(BATTING_OPTIONS, p.batting_style)],
    ['Bowling', labelOf(BOWLING_OPTIONS, p.bowling_style)],
    ['Age', p.age != null ? `${p.age} years` : '']
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {back}
      {error && <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', gap: '0.4rem' }}><AlertCircle size={16} /> {error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#fff', flexWrap: 'wrap' }}>
        <Avatar url={p.photo_url} name={p.display_name} size={84} dark onPick={p.can_edit_photo ? uploadPhoto : undefined} busy={busy} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{p.display_name}</h2>
          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.2rem' }}>Player ID: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{p.player_code}</strong></div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <Badge variant={p.is_registered ? 'success' : 'neutral'}>{p.is_registered ? 'Registered' : 'Not registered yet'}</Badge>
            {(p.badges || []).map((b) => (
              <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.55rem', borderRadius: '999px', backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.72rem', fontWeight: 700 }}>
                <ShieldCheck size={12} /> {BADGE_LABELS[b] || b}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Card title="Cricket details">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
          {details.map(([k, v]) => (
            <div key={k} style={{ padding: '0.7rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{k}</div>
              <div style={{ fontWeight: 700, color: v ? '#0f172a' : '#94a3b8' }}>{v || 'Not set'}</div>
            </div>
          ))}
        </div>
        {p.is_me && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            Edit these in <button onClick={() => onNavigate && onNavigate('teams')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.78rem' }}>My Teams → My player profile</button>.
          </p>
        )}
      </Card>

      {(p.mobile_number || p.email || p.is_me) && (
        <Card title="Contact">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
            {p.mobile_number && <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}><Phone size={14} /> {p.mobile_number}</span>}
            {p.email && <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}><Mail size={14} /> {p.email}</span>}
            {p.is_me && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Only you see these unless you allow it in <strong>Settings &amp; Privacy</strong>.</span>}
          </div>
        </Card>
      )}

      <Card title={`Teams (${(p.teams || []).length})`}>
        {(p.teams || []).length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Not in any team yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {p.teams.map((t) => (
              <button key={t.id} onClick={() => onNavigate && onNavigate('team-details', t.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <Avatar url={t.logo_url} name={t.short_name || t.name} size={34} square />
                <span style={{ flex: 1, fontWeight: 600, color: '#0f172a' }}>{t.name}</span>
                {t.is_captain && <Badge variant="warning">Captain</Badge>}
                {t.is_vice_captain && <Badge variant="primary">Vice-captain</Badge>}
                {t.is_icon && <Badge variant="neutral">Icon</Badge>}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* #77 career statistics, #78 awards, Category D */}
      <PlayerStatsPanel playerId={playerId} onNavigate={onNavigate} />
      <PlayerAwardsCard playerId={playerId} onNavigate={onNavigate} />

      {/* #182 player video profile, #187 player card */}
      <MediaGallery scope="player" scopeId={playerId} kinds={['video']} title="Video profile" subtitle="Batting, bowling and fielding clips – added by the player or their team owner" />
      <PlayerShareCard profile={p} stats={stats} />
    </div>
  );
}

export default PlayerProfileView;
