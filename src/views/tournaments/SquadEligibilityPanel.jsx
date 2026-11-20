import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { CHECK_STATE, eligibilitySummary, rejectProblem } from '../teams/squadRules.js';

/** #340 Squad eligibility: automatic checks per player, and the organiser can verify or reject a player for this tournament. */
const field = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem', maxWidth: '100%' };

export function SquadEligibilityPanel({ tournament, teams = [] }) {
  const options = teams.map((t) => ({ id: t.team_id || t.id, name: t.name }));
  const [teamId, setTeamId] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({});

  const load = useCallback(() => {
    if (!teamId) { setD(null); return Promise.resolve(); }
    return dataService.fetchSquadEligibility(tournament.id, teamId).then((x) => { setD(x); setErr(null); }).catch((e) => { setD(null); setErr(e.message); });
  }, [tournament.id, teamId]);
  useEffect(() => { load(); }, [load]);

  if (options.length === 0) return null;
  const set = async (playerId, status) => {
    setBusy(true); setErr(null);
    try { setD(await dataService.setSquadVerification(tournament.id, teamId, playerId, status, note[playerId])); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Card title="Squad eligibility" subtitle="Check a team's players before the matches start">
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={field}>
        <option value="">Choose a team…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: '0.5rem' }}>{err}</div>}
      {d && (
        <div style={{ marginTop: '0.6rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.4rem' }}>{eligibilitySummary(d)}{d.age_limit ? ` · age limit under ${d.age_limit}` : ''}</div>
          {d.players.map((p) => (
            <div key={p.player_id} style={{ borderBottom: '1px solid #f1f5f9', padding: '0.35rem 0' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.88rem' }}>{p.name}</strong>
                <span style={{ fontWeight: 700, fontSize: '0.74rem', color: CHECK_STATE[p.state].color }}>{CHECK_STATE[p.state].label}</span>
                {p.verification && <span style={{ fontSize: '0.74rem', color: p.verification.status === 'verified' ? '#15803d' : '#b91c1c' }}>{p.verification.status === 'verified' ? 'Verified by organiser' : 'Rejected'}{p.verification.note ? `: ${p.verification.note}` : ''}</span>}
              </div>
              {p.checks.map((c) => <div key={c.key} style={{ fontSize: '0.78rem', color: CHECK_STATE[c.state].color, paddingLeft: '0.5rem' }}>• {c.text}</div>)}
              {d.can_decide && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <input value={note[p.player_id] || ''} onChange={(e) => setNote({ ...note, [p.player_id]: e.target.value })} placeholder="Reason (needed to reject)" maxLength={200} style={{ ...field, flex: 1, minWidth: 140 }} />
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => set(p.player_id, 'verified')}>Verify</Button>
                  <Button size="sm" variant="secondary" disabled={busy || !!rejectProblem(note[p.player_id])} onClick={() => set(p.player_id, 'rejected')}>Reject</Button>
                  {p.verification && <Button size="sm" variant="secondary" disabled={busy} onClick={() => set(p.player_id, 'clear')}>Clear</Button>}
                </div>
              )}
            </div>
          ))}
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>A rejected player, or one already in another approved team of this tournament, cannot be picked in a lineup.</p>
        </div>
      )}
    </Card>
  );
}

export default SquadEligibilityPanel;
