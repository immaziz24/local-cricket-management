import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowRightLeft, Search, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * #75 Player transfers (team owner only).
 * Ask another team for one of its players; the other team's owner accepts or declines.
 * Requests for your own players arrive here too.
 */

const field = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.83rem' };
const STATUS_VARIANT = { pending: 'warning', accepted: 'success', rejected: 'danger', cancelled: 'neutral' };

export function TransfersPanel({ team, onChanged }) {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [fromTeam, setFromTeam] = useState(null); // { id, name, squad }
  const [pick, setPick] = useState({ playerId: '', note: '' });
  const [declineFor, setDeclineFor] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    try { setList(await dataService.fetchTeamTransfers(team.id)); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  useEffect(() => { load(); }, [team.id]);

  const run = async (fn, ok, refreshTeam) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load(); if (refreshTeam && onChanged) await onChanged(); return true; }
    catch (err) { setMsg({ ok: false, text: err.message }); return false; }
    finally { setBusy(false); }
  };

  const search = async () => {
    setMsg(null); setFromTeam(null);
    try { setFound((await dataService.searchTeams(query)).filter((t) => t.id !== team.id)); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  const openTeam = async (t) => {
    try {
      const full = await dataService.fetchTeam(t.id);
      const mine = new Set((team.squad || []).map((p) => p.id));
      setFromTeam({ id: t.id, name: t.name, squad: (full.squad || []).filter((p) => !mine.has(p.id)) });
      setPick({ playerId: '', note: '' });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
  };

  const incoming = list.filter((t) => t.direction === 'outgoing' && t.status === 'pending'); // asks for MY players
  const others = list.filter((t) => !(t.direction === 'outgoing' && t.status === 'pending'));

  return (
    <Card title="Player transfers">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {msg && (
          <div style={{ padding: '0.55rem 0.8rem', borderRadius: '0.45rem', fontSize: '0.82rem', display: 'flex', gap: '0.4rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c' }}>
            {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {msg.text}
          </div>
        )}

        {/* Requests for my players */}
        {incoming.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Other teams want your players</div>
            {incoming.map((t) => (
              <div key={t.id} style={{ padding: '0.55rem 0.7rem', border: '1px solid #fde68a', backgroundColor: '#fffbeb', borderRadius: '0.5rem', marginBottom: '0.35rem', fontSize: '0.83rem' }}>
                <strong>{t.to_team.name}</strong> wants <strong>{t.player.name}</strong>{t.note ? <span style={{ color: '#64748b' }}> — “{t.note}”</span> : null}
                {declineFor === t.id ? (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for declining" style={{ ...field, flex: 1, minWidth: 180 }} />
                    <Button variant="secondary" size="sm" disabled={busy || !reason.trim()} onClick={() => run(() => dataService.decidePlayerTransfer(t.id, false, reason), 'Request declined.').then((ok) => ok && setDeclineFor(null))}>Decline</Button>
                    <Button variant="secondary" size="sm" onClick={() => setDeclineFor(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <Button variant="primary" size="sm" disabled={busy} onClick={() => window.confirm(`Let ${t.player.name} move to ${t.to_team.name}? They will leave your squad.`) && run(() => dataService.decidePlayerTransfer(t.id, true), `${t.player.name} moved to ${t.to_team.name}.`, true)}>Accept</Button>
                    <Button variant="secondary" size="sm" onClick={() => { setDeclineFor(t.id); setReason(''); }}>Decline</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ask for a player */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Ask another team for a player</div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Team name (at least 2 letters)" style={{ ...field, flex: 1, minWidth: 200 }} />
            <Button variant="secondary" size="sm" disabled={query.trim().length < 2} onClick={search} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Search size={13} /> Find team</Button>
          </div>
          {found.length > 0 && !fromTeam && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
              {found.map((t) => (
                <button key={t.id} type="button" onClick={() => openTeam(t)} style={{ ...field, cursor: 'pointer', backgroundColor: '#f8fafc' }}>{t.name}{t.city ? ` · ${t.city}` : ''}</button>
              ))}
            </div>
          )}
          {fromTeam && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem' }}>From <strong>{fromTeam.name}</strong>:</span>
              <select value={pick.playerId} onChange={(e) => setPick({ ...pick, playerId: e.target.value })} style={field}>
                <option value="">Choose player ({fromTeam.squad.length})</option>
                {fromTeam.squad.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <input value={pick.note} onChange={(e) => setPick({ ...pick, note: e.target.value })} placeholder="Message (optional)" style={{ ...field, flex: 1, minWidth: 160 }} />
              <Button variant="primary" size="sm" disabled={busy || !pick.playerId}
                onClick={() => run(() => dataService.requestPlayerTransfer({ playerId: pick.playerId, fromTeamId: fromTeam.id, toTeamId: team.id, note: pick.note }), `Request sent to ${fromTeam.name}.`).then((ok) => ok && setFromTeam(null))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <ArrowRightLeft size={13} /> Send request
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFromTeam(null)}>Cancel</Button>
            </div>
          )}
        </div>

        {/* All requests */}
        {others.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Requests</div>
            {others.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                <span>
                  <strong>{t.player.name}</strong>: {t.from_team.name} → {t.to_team.name}
                  {t.decision_reason && <span style={{ color: '#64748b' }}> ({t.decision_reason})</span>}
                </span>
                <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                  <Badge variant={STATUS_VARIANT[t.status] || 'neutral'}>{t.status}</Badge>
                  {t.direction === 'incoming' && t.status === 'pending' && (
                    <button type="button" onClick={() => run(() => dataService.cancelPlayerTransfer(t.id), 'Request withdrawn.')} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>Withdraw</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default TransfersPanel;
