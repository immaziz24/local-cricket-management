import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { AVAIL, availabilityLine, approvalState, decideProblem } from '../teams/squadRules.js';

/**
 * #342 Players say yes / maybe / no for an upcoming match; captains and the owner see who is available.
 * #343 The captain approves the lineup before the match (or asks for changes).
 */
const field = { padding: '0.3rem 0.45rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem', maxWidth: '100%' };

function AvailabilityBox({ matchId }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const load = useCallback(() => dataService.fetchMatchAvailability(matchId).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load]);
  if (err && !d) return null;
  if (!d || d.match_status !== 'scheduled') return null;
  const answer = async (status) => { setBusy(true); setErr(null); try { setD(await dataService.setMyAvailability(matchId, status, note)); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', marginBottom: '0.5rem' }}>
      <strong style={{ fontSize: '0.84rem' }}>Who can play?</strong>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.78rem' }}>{err}</div>}
      {d.my_team_id && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.35rem 0' }}>
          {Object.keys(AVAIL).map((k) => (
            <Button key={k} size="sm" variant={d.mine?.status === k ? 'primary' : 'secondary'} disabled={busy} onClick={() => answer(k)}>{AVAIL[k].label}</Button>
          ))}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={120} style={{ ...field, width: 150 }} />
        </div>
      )}
      {d.teams.map((t) => (
        <div key={t.team_id} style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
          <strong>{t.team}:</strong> <span style={{ color: '#475569' }}>{availabilityLine(t)}</span>
          {t.can_see_players && t.players.filter((p) => p.status).length > 0 && (
            <div style={{ color: '#64748b', paddingLeft: '0.6rem' }}>
              {t.players.filter((p) => p.status).map((p) => <span key={p.player_id} style={{ marginRight: '0.6rem', color: AVAIL[p.status].color }}>{p.name}: {AVAIL[p.status].label.toLowerCase()}{p.note ? ` (${p.note})` : ''}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ApprovalBox({ matchId, team, canAsk }) {
  const [a, setA] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const load = useCallback(() => dataService.fetchLineupApproval(matchId, team.team_id).then((x) => { setA(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId, team.team_id]);
  useEffect(() => { load(); }, [load, team.lineup?.length]);
  if (!a || !a.has_lineup) return null;
  const st = approvalState(a);
  const run = async (fn) => { setBusy(true); setErr(null); try { setA(await fn()); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const problem = decideProblem(false, note);
  return (
    <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
      <strong>{team.name}:</strong> <span style={{ fontWeight: 700, color: st.color }}>{st.label}</span>
      {a.captain && <span style={{ color: '#94a3b8' }}> (captain {a.captain})</span>}
      {a.status === 'changes_requested' && a.note && <span style={{ color: '#b91c1c' }}> – “{a.note}”</span>}
      {err && <div style={{ color: '#b91c1c' }}>{err}</div>}
      {a.can_request && canAsk && (st.key === 'unsent' || st.key === 'stale' || st.key === 'changes') && (
        <div style={{ marginTop: '0.25rem' }}><Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.requestLineupApproval(matchId, team.team_id))}>Send to captain for approval</Button></div>
      )}
      {a.can_decide && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => dataService.decideLineupApproval(matchId, team.team_id, true, null))}>Approve lineup</Button>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" maxLength={200} style={{ ...field, flex: 1, minWidth: 130 }} />
          <Button size="sm" variant="secondary" disabled={busy || !!problem} onClick={() => run(() => dataService.decideLineupApproval(matchId, team.team_id, false, note))}>Ask for changes</Button>
        </div>
      )}
    </div>
  );
}

export function MatchReadiness({ match, teams, ownedTeams = [] }) {
  if (match.status !== 'scheduled') return null;
  return (
    <div style={{ marginTop: '0.6rem' }}>
      <AvailabilityBox matchId={match.id} />
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.7rem' }}>
        <strong style={{ fontSize: '0.84rem' }}>Captain approval</strong>
        {teams.map((t) => <ApprovalBox key={t.team_id} matchId={match.id} team={t} canAsk={ownedTeams.includes(t.team_id)} />)}
      </div>
    </div>
  );
}

export default MatchReadiness;
