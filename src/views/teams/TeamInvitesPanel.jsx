import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { INVITE_STATUS, inviteMessageProblem } from './squadRules.js';

/** #339 Team owner: invite a registered player by mobile number and see who has answered. */
const field = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', maxWidth: '100%' };

export function TeamInvitesPanel({ team, onChanged }) {
  const [items, setItems] = useState([]);
  const [mobile, setMobile] = useState('');
  const [message, setMessage] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(() => dataService.fetchTeamInvitations(team.id).then((d) => { setItems(d.items || []); setErr(null); }).catch((e) => setErr(e.message)), [team.id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => { setBusy(true); setErr(null); try { await fn(); await load(); onChanged?.(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const lookup = async () => {
    setBusy(true); setErr(null); setFound(null);
    try { const r = await dataService.findPlayerByMobile(mobile.trim()); setFound(r && r.found ? r : { found: false }); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const msgProblem = inviteMessageProblem(message);

  return (
    <Card title="Invite players" subtitle="A player with an account gets the invitation and joins the squad only when they accept">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={mobile} onChange={(e) => { setMobile(e.target.value); setFound(null); }} placeholder="Player's mobile number" style={field} inputMode="tel" />
        <Button variant="secondary" disabled={busy || mobile.trim().length < 6} onClick={lookup}>Find player</Button>
      </div>
      {found && found.found === false && <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.5rem 0 0' }}>No player with this number. Ask them to register, or add them to the squad directly.</p>}
      {found && found.found && found.is_registered === false && <p style={{ fontSize: '0.82rem', color: '#b45309', margin: '0.5rem 0 0' }}>{found.display_name} has no account yet, so cannot accept an invitation. Add them to the squad directly.</p>}
      {found && found.found && found.is_registered !== false && (
        <div style={{ marginTop: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.6rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>{found.name || found.display_name}</strong>
          <div style={{ marginTop: '0.4rem' }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optional)" maxLength={300} style={{ ...field, width: '100%', boxSizing: 'border-box' }} />
            {msgProblem && <div style={{ color: '#b91c1c', fontSize: '0.76rem' }}>{msgProblem}</div>}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <Button variant="primary" disabled={busy || !!msgProblem} onClick={() => run(async () => { await dataService.inviteToTeam(team.id, found.id, message); setFound(null); setMobile(''); setMessage(''); })}>Send invitation</Button>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div style={{ marginTop: '0.8rem' }}>
          {items.map((i) => (
            <div key={i.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.84rem', padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <strong>{i.name}</strong>
              <span style={{ fontWeight: 700, fontSize: '0.74rem', color: INVITE_STATUS[i.status].color }}>{INVITE_STATUS[i.status].label}</span>
              <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>{new Date(i.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              {i.status === 'pending' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.cancelTeamInvitation(i.id))}>Cancel</Button>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default TeamInvitesPanel;
