import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowLeft, Search, UserPlus, UserMinus, Crown, Star, Shield, AlertCircle, CheckCircle, Phone } from 'lucide-react';
import { ROLE_OPTIONS, BATTING_OPTIONS, BOWLING_OPTIONS, labelOf } from './playerOptions.js';

/**
 * Phase 2 – Team page
 * #68 Team profile, #70 Captain and vice-captain (+ icon player), #71 Squad management,
 * #59 Player registration by the team owner: search by mobile number; if not found, add by name.
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

const cleanMobile = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

export function TeamDetailView({ teamId, onNavigate }) {
  const [team, setTeam] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // Add-player flow
  const [mobile, setMobile] = useState('');
  const [lookup, setLookup] = useState(null); // null | { found: true, ... } | { found: false }
  const [manual, setManual] = useState({ name: '', player_role: '', batting_style: '', bowling_style: '' });
  const [manualNoMobile, setManualNoMobile] = useState(false);

  // Leadership
  const [lead, setLead] = useState({ captain: '', vice: '', icon: '' });

  const load = async () => {
    try {
      const t = await dataService.fetchTeam(teamId);
      setTeam(t);
      setLead({
        captain: t.squad.find((p) => p.is_captain)?.id || '',
        vice: t.squad.find((p) => p.is_vice_captain)?.id || '',
        icon: t.squad.find((p) => p.is_icon)?.id || ''
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { if (teamId) load(); }, [teamId]);

  const resetAdd = () => {
    setMobile(''); setLookup(null); setManualNoMobile(false);
    setManual({ name: '', player_role: '', batting_style: '', bowling_style: '' });
  };

  const searchMobile = async (e) => {
    e.preventDefault();
    const m = cleanMobile(mobile);
    if (!/^[6-9]\d{9}$/.test(m)) { setMsg({ ok: false, text: 'Enter a valid 10-digit mobile number (starting with 6, 7, 8 or 9).' }); return; }
    setBusy(true); setMsg(null);
    try {
      setLookup(await dataService.findPlayerByMobile(m));
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const addFound = async () => {
    setBusy(true);
    try {
      await dataService.addPlayerToTeam(teamId, lookup.id);
      setMsg({ ok: true, text: `${lookup.display_name} added to the squad.` });
      resetAdd(); await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const addManual = async (e) => {
    e.preventDefault();
    if (manual.name.trim().length < 2) { setMsg({ ok: false, text: 'Please type the player name.' }); return; }
    setBusy(true);
    try {
      const res = await dataService.addNewPlayerToTeam({
        teamId, name: manual.name.trim(), mobile: manualNoMobile ? null : cleanMobile(mobile),
        player_role: manual.player_role, batting_style: manual.batting_style, bowling_style: manual.bowling_style
      });
      setMsg({ ok: true, text: res.matched_existing ? 'That mobile number already belonged to a player — they were added.' : `${manual.name.trim()} added to the squad.` });
      resetAdd(); await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const removePlayer = async (p) => {
    if (!window.confirm(`Remove ${p.display_name} from ${team.name}?`)) return;
    setBusy(true);
    try {
      await dataService.removePlayerFromTeam(teamId, p.id);
      setMsg({ ok: true, text: `${p.display_name} removed from the squad.` });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  const saveLeadership = async () => {
    if (lead.captain && lead.captain === lead.vice) { setMsg({ ok: false, text: 'Captain and vice-captain must be different players.' }); return; }
    setBusy(true);
    try {
      await dataService.setTeamLeadership({ teamId, captainId: lead.captain, viceCaptainId: lead.vice, iconId: lead.icon });
      setMsg({ ok: true, text: 'Captain, vice-captain and icon player saved.' });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  if (error) {
    return (
      <Card>
        <p style={{ color: '#b91c1c' }}>{error}</p>
        <Button variant="secondary" onClick={() => onNavigate && onNavigate('teams')}>Back to My Teams</Button>
      </Card>
    );
  }
  if (!team) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading team…</div>;

  const squad = team.squad || [];
  const playerSelect = (value, onChange) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={field}>
      <option value="">— None —</option>
      {squad.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
    </select>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <button onClick={() => onNavigate && onNavigate('teams')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', padding: 0 }}>
        <ArrowLeft size={15} /> My Teams
      </button>

      {/* Team header (#68) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem', backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#fff', flexWrap: 'wrap' }}>
        <span style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
          {(team.short_name || team.name).slice(0, 3).toUpperCase()}
        </span>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{team.name}</h2>
          <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{team.city ? `${team.city} · ` : ''}{squad.length} players</div>
        </div>
        <Badge variant={team.i_own ? 'success' : 'neutral'}>{team.i_own ? 'You own this team' : 'View only'}</Badge>
      </div>

      <Notice msg={msg} />

      {/* Squad (#71) */}
      <Card title={`Squad (${squad.length})`}>
        {squad.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>No players yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {squad.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.8rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#f8fafc', flexWrap: 'wrap' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#334155' }}>
                  {p.display_name.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: '160px' }}>
                  <strong style={{ color: '#0f172a' }}>{p.display_name}</strong>
                  {p.is_captain && <span title="Captain" style={{ marginLeft: '0.4rem', fontSize: '0.72rem', fontWeight: 800, color: '#b45309' }}>(C)</span>}
                  {p.is_vice_captain && <span title="Vice-captain" style={{ marginLeft: '0.4rem', fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8' }}>(VC)</span>}
                  {p.is_icon && <span title="Icon player" style={{ marginLeft: '0.4rem', fontSize: '0.72rem', fontWeight: 800, color: '#7c3aed' }}>★ Icon</span>}
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                    {[labelOf(ROLE_OPTIONS, p.player_role), labelOf(BATTING_OPTIONS, p.batting_style), labelOf(BOWLING_OPTIONS, p.bowling_style)].filter(Boolean).join(' · ') || 'Details not set'}
                  </span>
                </span>
                <Badge variant={p.is_registered ? 'success' : 'neutral'}>{p.is_registered ? 'Registered' : 'Not registered yet'}</Badge>
                {team.i_own && (
                  <Button variant="secondary" disabled={busy} onClick={() => removePlayer(p)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <UserMinus size={13} /> Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
          "Not registered yet" players can join later by signing up with the same mobile number — their team and stats become theirs automatically.
        </p>
      </Card>

      {team.i_own && (
        <>
          {/* Add player (#59, #71) */}
          <Card title="Add a player">
            <form onSubmit={searchMobile} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }}>
                <Phone size={14} style={{ color: '#94a3b8' }} />
                <input value={mobile} onChange={(e) => { setMobile(e.target.value); setLookup(null); }} inputMode="numeric" placeholder="Player's 10-digit mobile number" style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem' }} />
              </div>
              <Button type="submit" variant="primary" disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Search size={14} /> Find player</Button>
            </form>
            <button type="button" onClick={() => { setManualNoMobile(true); setLookup({ found: false }); }} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
              Player has no mobile number? Add by name only
            </button>

            {lookup?.found && (
              <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5', borderRadius: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  {lookup.display_name.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1 }}>
                  <strong>{lookup.display_name}</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#047857' }}>
                    {lookup.is_registered ? 'Registered on Local Cricket' : 'Added earlier by another team (not registered yet)'}
                    {lookup.player_role ? ` · ${labelOf(ROLE_OPTIONS, lookup.player_role)}` : ''}
                  </span>
                </span>
                <Button variant="primary" disabled={busy} onClick={addFound} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><UserPlus size={14} /> Add to team</Button>
              </div>
            )}

            {lookup && !lookup.found && (
              <form onSubmit={addManual} style={{ marginTop: '0.85rem', padding: '0.85rem', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {manualNoMobile
                    ? 'Add a player without a mobile number.'
                    : <>No player found with <strong>{cleanMobile(mobile)}</strong>. Add them now — they can claim this profile later by registering with this number.</>}
                </div>
                <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} maxLength={80} placeholder="Player's full name *" style={field} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                  <select value={manual.player_role} onChange={(e) => setManual({ ...manual, player_role: e.target.value })} style={field}>
                    <option value="">Role (optional)</option>
                    {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={manual.batting_style} onChange={(e) => setManual({ ...manual, batting_style: e.target.value })} style={field}>
                    <option value="">Batting (optional)</option>
                    {BATTING_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={manual.bowling_style} onChange={(e) => setManual({ ...manual, bowling_style: e.target.value })} style={field}>
                    <option value="">Bowling (optional)</option>
                    {BOWLING_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="submit" variant="primary" disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><UserPlus size={14} /> Add player</Button>
                  <Button type="button" variant="secondary" onClick={resetAdd}>Cancel</Button>
                </div>
              </form>
            )}
          </Card>

          {/* Leadership (#70) */}
          <Card title="Captain, vice-captain & icon player">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#475569' }}><Crown size={13} /> Captain
                {playerSelect(lead.captain, (v) => setLead({ ...lead, captain: v }))}
              </label>
              <label style={{ fontSize: '0.8rem', color: '#475569' }}><Shield size={13} /> Vice-captain
                {playerSelect(lead.vice, (v) => setLead({ ...lead, vice: v }))}
              </label>
              <label style={{ fontSize: '0.8rem', color: '#475569' }}><Star size={13} /> Icon player
                {playerSelect(lead.icon, (v) => setLead({ ...lead, icon: v }))}
              </label>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <Button variant="primary" disabled={busy || squad.length === 0} onClick={saveLeadership}>Save</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default TeamDetailView;
