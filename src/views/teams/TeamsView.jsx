import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Users, Plus, ChevronRight, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { ROLE_OPTIONS, BATTING_OPTIONS, BOWLING_OPTIONS } from './playerOptions.js';

/**
 * Phase 2 – My Teams
 * #68 Team profile (create), #59–#65 my player profile (role, batting, bowling).
 * Anyone can create a team and becomes its owner (open-platform rule).
 */

const field = { width: '100%', padding: '0.55rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem', boxSizing: 'border-box' };

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
      {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
    </div>
  );
}

export function TeamsView({ onNavigate }) {
  const [teams, setTeams] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', short_name: '', city: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([dataService.fetchMyTeams(), dataService.fetchMyPlayer()]);
      setTeams(t || []);
      setMe(p);
      setSignedOut(false);
    } catch {
      setSignedOut(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createTeam = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) { setMsg({ ok: false, text: 'Team name must be at least 2 letters.' }); return; }
    setBusy(true);
    try {
      const res = await dataService.createTeam({ name: form.name.trim(), short_name: form.short_name.trim(), city: form.city.trim() });
      setForm({ name: '', short_name: '', city: '' });
      setShowCreate(false);
      onNavigate && onNavigate('team-details', res.id);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const saveMe = async () => {
    setBusy(true);
    try {
      setMe(await dataService.saveMyPlayer(me));
      setMsg({ ok: true, text: 'Your player profile is saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading your teams…</div>;

  if (signedOut) {
    return (
      <Card>
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <Users size={32} style={{ color: '#94a3b8' }} />
          <h3 style={{ margin: '0.5rem 0 0.25rem' }}>Sign in to create and manage teams</h3>
          <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.875rem' }}>Anyone can create a team for free.</p>
          <Button variant="primary" onClick={() => onNavigate && onNavigate('login')}>Sign in</Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '1.25rem 1.5rem', backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#fff' }}>
        <div>
          <Badge variant="warning">PHASE 2 · TEAMS</Badge>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.35rem 0 0.2rem' }}>My Teams</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>Create a team, add players by mobile number, choose your captain.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Plus size={16} /> Create team
        </Button>
      </div>

      <Notice msg={msg} />

      {showCreate && (
        <Card title="Create a new team">
          <form onSubmit={createTeam} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', alignItems: 'end' }}>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Team name *
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="e.g. Titahipara Tigers" style={field} />
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Short name
              <input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value.toUpperCase() })} maxLength={6} placeholder="e.g. TTG" style={field} />
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>City / village
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={60} placeholder="e.g. Titahipara" style={field} />
            </label>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create team'}</Button>
          </form>
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>You become the team owner and are added to the squad automatically.</p>
        </Card>
      )}

      <Card title={`Teams (${teams.length})`}>
        {teams.length === 0 ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
            You are not in any team yet. Click <strong>Create team</strong> to start one.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {teams.map((t) => (
              <button key={t.id} onClick={() => onNavigate && onNavigate('team-details', t.id)}
                style={{ textAlign: 'left', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.6rem', backgroundColor: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                  {(t.short_name || t.name).slice(0, 3).toUpperCase()}
                </span>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{t.name}</strong>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{t.city ? `${t.city} · ` : ''}{t.squad_size || 0} players</span>
                  <span style={{ display: 'block', marginTop: '0.3rem' }}><Badge variant={t.i_own ? 'success' : 'neutral'}>{t.i_own ? 'Owner' : 'Member'}</Badge></span>
                </span>
                <ChevronRight size={18} style={{ color: '#94a3b8' }} />
              </button>
            ))}
          </div>
        )}
      </Card>

      {me && (
        <Card title="My player profile">
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
            <strong>{me.display_name}</strong> · this is how you appear in every team.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Playing role (#65)
              <select value={me.player_role || ''} onChange={(e) => setMe({ ...me, player_role: e.target.value })} style={field}>
                <option value="">Not set</option>
                {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Batting style (#63)
              <select value={me.batting_style || ''} onChange={(e) => setMe({ ...me, batting_style: e.target.value })} style={field}>
                <option value="">Not set</option>
                {BATTING_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.8rem', color: '#475569' }}>Bowling style (#64)
              <select value={me.bowling_style || ''} onChange={(e) => setMe({ ...me, bowling_style: e.target.value })} style={field}>
                <option value="">Not set</option>
                {BOWLING_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={saveMe} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Save size={14} /> Save</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default TeamsView;
