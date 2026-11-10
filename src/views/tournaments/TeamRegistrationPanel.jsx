import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { CheckCircle, XCircle, AlertCircle, Send, LogOut, Search, Plus, UserPlus, Trash2 } from 'lucide-react';
import { Avatar } from '../teams/Avatar.jsx';

/**
 * #40 Team registration and #41 Team approval and rejection.
 * - The organiser can also add teams directly: pick an existing team, or create a new one on the spot
 *   (like CricHeroes). The organiser owns teams they create and can add their players.
 * - Team owners pick one of their teams and apply.
 * - The tournament organiser approves or rejects (with a reason). Both sides get notified.
 */

const STATUS = {
  pending: { variant: 'warning', label: 'Waiting for approval' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Not accepted' },
  withdrawn: { variant: 'neutral', label: 'Withdrawn' }
};

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
      {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
    </div>
  );
}

const fieldS = { padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.85rem' };

export function TeamRegistrationPanel({ tournament, onChanged, onTournamentChanged, onNavigate }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', short_name: '', city: '' });
  const [maxTeams, setMaxTeams] = useState(tournament.teams_count);
  const [data, setData] = useState({ is_organiser: false, teams: [] });
  const [myTeams, setMyTeams] = useState([]);
  const [pick, setPick] = useState('');
  const [reasons, setReasons] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const regs = await dataService.fetchTournamentRegistrations(tournament.id);
      setData(regs || { is_organiser: false, teams: [] });
      onChanged && onChanged(regs);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
    try {
      setMyTeams(((await dataService.fetchMyTeams()) || []).filter((t) => t.i_own));
    } catch {
      setMyTeams([]);
    }
  };

  useEffect(() => { if (tournament?.id) load(); }, [tournament?.id]);

  const act = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: okText }); await load(); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  const approvedCount = data.teams.filter((t) => t.status === 'approved').length;
  const finished = ['completed', 'cancelled'].includes(tournament.status);
  const inIds = new Set(data.teams.filter((t) => t.status === 'approved').map((t) => t.team_id));
  const findTeams = async () => {
    setMsg(null);
    try { setFound(await dataService.searchTeams(query)); } catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  const saveMax = () => act(async () => {
    await dataService.updateTournament(tournament.id, { teams_count: Number(maxTeams) });
    onTournamentChanged && (await onTournamentChanged());
  }, `Number of teams set to ${maxTeams}.`);
  const registeredIds = new Set(data.teams.filter((t) => ['pending', 'approved'].includes(t.status)).map((t) => t.team_id));
  const canApply = myTeams.filter((t) => !registeredIds.has(t.id));
  const open = tournament.registration_open !== false && ['registration', 'upcoming'].includes(tournament.status);
  const pending = data.teams.filter((t) => t.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Notice msg={msg} />

      {/* Organiser adds teams directly */}
      {data.is_organiser && !finished && (
        <Card title={`Add teams (organiser) · ${approvedCount} / ${tournament.teams_count} added`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Add a team that is already on the website</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && query.trim().length >= 2 && findTeams()} placeholder="Team name (at least 2 letters)" style={{ ...fieldS, flex: 1, minWidth: 200 }} />
                <Button variant="secondary" disabled={query.trim().length < 2} onClick={findTeams} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Search size={14} /> Find</Button>
              </div>
              {found && (
                found.length === 0 ? (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>No team found. Create it below.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.45rem' }}>
                    {found.map((t) => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <Avatar url={t.logo_url} name={t.name} size={28} square dark />
                        <span style={{ flex: 1 }}>{t.name}{t.city ? <span style={{ color: '#64748b' }}> · {t.city}</span> : null}</span>
                        {inIds.has(t.id) ? <Badge variant="success">Added</Badge> : (
                          <Button variant="primary" size="sm" disabled={busy} onClick={() => act(() => dataService.organiserAddTeam(tournament.id, t.id), `${t.name} added. Its owner was told.`)}>
                            <Plus size={13} /> Add
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Or create a new team</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <input value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} placeholder="Team name" style={{ ...fieldS, flex: 2, minWidth: 180 }} />
                <input value={newTeam.short_name} onChange={(e) => setNewTeam({ ...newTeam, short_name: e.target.value.toUpperCase().slice(0, 6) })} placeholder="Short (e.g. TFC)" style={{ ...fieldS, width: 110 }} />
                <input value={newTeam.city} onChange={(e) => setNewTeam({ ...newTeam, city: e.target.value })} placeholder={tournament.city ? `City (${tournament.city})` : 'City'} style={{ ...fieldS, flex: 1, minWidth: 120 }} />
                <Button variant="primary" disabled={busy || newTeam.name.trim().length < 2}
                  onClick={() => act(() => dataService.organiserCreateTeam(tournament.id, newTeam), `${newTeam.name} created and added. Open it to add its players.`).then(() => setNewTeam({ name: '', short_name: '', city: '' }))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <UserPlus size={14} /> Create & add
                </Button>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>You become the owner of teams you create here, so you can add their players by mobile number.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: '#334155' }}>
              Most teams allowed:
              <input type="number" min={2} max={64} value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} style={{ ...fieldS, width: 80 }} />
              <Button variant="secondary" size="sm" disabled={busy || Number(maxTeams) === tournament.teams_count} onClick={saveMax}>Save</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Apply with my team (#40) */}
      <Card title="Register your team">
        {!open ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Registration is closed for this tournament.</p>
        ) : approvedCount >= tournament.teams_count ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>This tournament is full ({approvedCount}/{tournament.teams_count} teams).</p>
        ) : myTeams.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Sign in and create a team in <strong>My Teams</strong> to register for this tournament.</p>
        ) : canApply.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>All your teams have already applied.</p>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1, minWidth: '220px', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
              <option value="">Choose your team…</option>
              {canApply.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.squad_size || 0} players)</option>)}
            </select>
            <Button variant="primary" disabled={!pick || busy} onClick={() => act(() => dataService.registerTeamForTournament(tournament.id, pick), 'Registration sent. The organiser has been notified.').then(() => setPick(''))} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Send size={14} /> Apply
            </Button>
          </div>
        )}
        {tournament.entry_fee && <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>Entry fee: <strong>{tournament.entry_fee}</strong> — pay the organiser directly. Online payment comes later.</p>}
      </Card>

      {/* Organiser: approve / reject (#41) */}
      {data.is_organiser && (
        <Card title={`Team requests (organiser) · ${pending.length} waiting`}>
          {pending.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No requests waiting.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {pending.map((t) => (
                <div key={t.team_id} style={{ padding: '0.75rem', border: '1px solid #fde68a', backgroundColor: '#fffbeb', borderRadius: '0.5rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Avatar url={t.logo_url} name={t.short_name || t.name} size={38} square dark />
                  <span style={{ flex: 1, minWidth: '160px' }}>
                    <strong>{t.name}</strong>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{t.squad_size} players{t.captain ? ` · Captain: ${t.captain}` : ''}{t.city ? ` · ${t.city}` : ''}</span>
                  </span>
                  <input value={reasons[t.team_id] || ''} onChange={(e) => setReasons({ ...reasons, [t.team_id]: e.target.value })} placeholder="Reason (needed to reject)" style={{ minWidth: '180px', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem' }} />
                  <Button variant="primary" disabled={busy} onClick={() => act(() => dataService.decideTeamRegistration(tournament.id, t.team_id, true, reasons[t.team_id]), `${t.name} approved.`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                    <CheckCircle size={14} /> Approve
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => act(() => dataService.decideTeamRegistration(tournament.id, t.team_id, false, reasons[t.team_id]), `${t.name} rejected.`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                    <XCircle size={14} /> Reject
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* All registrations */}
      <Card title={`Teams · ${approvedCount} / ${tournament.teams_count} approved`}>
        {data.teams.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No teams yet.{data.is_organiser ? ' Add them above.' : ''}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {data.teams.map((t) => (
              <div key={t.team_id} style={{ padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <Avatar url={t.logo_url} name={t.short_name || t.name} size={40} square dark />
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block', cursor: onNavigate ? 'pointer' : 'default', color: onNavigate ? '#0f172a' : undefined }} onClick={() => onNavigate && onNavigate('team-details', t.team_id)}>{t.name}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.captain ? `Captain: ${t.captain}` : 'Captain not set'} · {t.squad_size} players</span>
                  <span style={{ display: 'block', marginTop: '0.3rem' }}><Badge variant={STATUS[t.status]?.variant}>{STATUS[t.status]?.label || t.status}</Badge></span>
                  {t.status === 'rejected' && t.note && <span style={{ display: 'block', fontSize: '0.72rem', color: '#b91c1c', marginTop: '0.2rem' }}>Reason: {t.note}</span>}
                </span>
                {data.is_organiser && !t.i_own && t.status === 'approved' && !finished && (
                  <Button variant="secondary" disabled={busy} title="Remove from tournament" onClick={() => window.confirm(`Remove ${t.name} from ${tournament.name}?`) && act(() => dataService.organiserRemoveTeam(tournament.id, t.team_id), `${t.name} removed.`)} style={{ padding: '0.3rem 0.5rem' }}>
                    <Trash2 size={14} />
                  </Button>
                )}
                {t.i_own && ['pending', 'approved'].includes(t.status) && (
                  <Button variant="secondary" disabled={busy} title="Withdraw" onClick={() => window.confirm(`Withdraw ${t.name} from ${tournament.name}?`) && act(() => dataService.withdrawTeamFromTournament(tournament.id, t.team_id), `${t.name} withdrawn.`)} style={{ padding: '0.3rem 0.5rem' }}>
                    <LogOut size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default TeamRegistrationPanel;
