import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { CheckCircle, XCircle, AlertCircle, Send, LogOut } from 'lucide-react';
import { Avatar } from '../teams/Avatar.jsx';

/**
 * #40 Team registration and #41 Team approval and rejection.
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

export function TeamRegistrationPanel({ tournament, onChanged }) {
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
  const registeredIds = new Set(data.teams.filter((t) => ['pending', 'approved'].includes(t.status)).map((t) => t.team_id));
  const canApply = myTeams.filter((t) => !registeredIds.has(t.id));
  const open = tournament.registration_open !== false && ['registration', 'upcoming'].includes(tournament.status);
  const pending = data.teams.filter((t) => t.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Notice msg={msg} />

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
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No teams have registered yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {data.teams.map((t) => (
              <div key={t.team_id} style={{ padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <Avatar url={t.logo_url} name={t.short_name || t.name} size={40} square dark />
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block' }}>{t.name}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.captain ? `Captain: ${t.captain}` : 'Captain not set'} · {t.squad_size} players</span>
                  <span style={{ display: 'block', marginTop: '0.3rem' }}><Badge variant={STATUS[t.status]?.variant}>{STATUS[t.status]?.label || t.status}</Badge></span>
                  {t.status === 'rejected' && t.note && <span style={{ display: 'block', fontSize: '0.72rem', color: '#b91c1c', marginTop: '0.2rem' }}>Reason: {t.note}</span>}
                </span>
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
