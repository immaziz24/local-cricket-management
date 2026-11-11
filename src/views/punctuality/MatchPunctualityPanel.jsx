import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Clock, CheckCircle, Circle, AlertTriangle, UserCheck, Gavel } from 'lucide-react';

/**
 * Category Q on the match page: #299 check-in, #300 attendance, #301 readiness, #302 delay,
 * #303–#307 penalty (one method, approval), #308 repeat offenders and fines, #309 appeals and exemptions.
 */
export const METHOD = {
  none: 'No late-arrival penalty',
  overs_deduction: 'Overs cut for the late team',
  penalty_runs: 'Penalty runs to the opponent',
  fielding_restriction: 'Fielding restriction for the late team'
};
export function penaltyText(p, maxOutside) {
  if (p.method === 'overs_deduction') return `${p.value} over${p.value === 1 ? '' : 's'} cut from ${p.late_team}'s innings`;
  if (p.method === 'penalty_runs') return `${p.value} penalty runs to ${p.beneficiary}`;
  return `${p.late_team}: only ${maxOutside ?? 2} fielders outside the circle for the first ${p.value} over${p.value === 1 ? '' : 's'} they bowl`;
}
export function rateText(r) {
  if (!r || r.method === 'none' || !r.method) return 'No late-arrival penalty for this match.';
  const grace = r.grace ? ` after ${r.grace} min grace` : '';
  if (r.method === 'overs_deduction') return `${r.overs_per_step} over${r.overs_per_step > 1 ? 's' : ''} cut per ${r.step} minutes late${grace}.`;
  if (r.method === 'penalty_runs') return `${r.runs_per_step} runs to the opponent per ${r.step} minutes late${grace}.`;
  return `1 over with max ${r.field_max_outside} fielders outside the circle per ${r.field_step} minutes late${grace}.`;
}
const STATUS = { proposed: ['Waiting for approval', '#b45309'], approved: ['Approved', '#b91c1c'], rejected: ['Rejected', '#64748b'], appealed: ['Appealed', '#7c3aed'], waived: ['Waived', '#15803d'] };
const inp = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.84rem' };
const hhmm = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export function MatchPunctualityPanel({ matchId, refreshKey }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ci, setCi] = useState(null); // { teamId, time, players, note }
  const [att, setAtt] = useState(null); // team id whose attendance list is open
  const [manual, setManual] = useState(null);
  const [fine, setFine] = useState(null);
  const load = () => dataService.getMatchReadiness(matchId).then(setD).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, [matchId, refreshKey]);
  const run = async (fn, after) => { setMsg(null); try { const r = await fn(); if (r && r.teams) setD(r); else load(); after && after(); } catch (e) { setMsg(e.message); } };
  if (!d) return <Card title="Match day"><p style={{ margin: 0, fontSize: '0.84rem', color: msg ? '#b91c1c' : '#64748b' }}>{msg || 'Loading…'}</p></Card>;
  const over = ['completed', 'abandoned'].includes(d.match_status);
  const maxOut = d.rules?.field_max_outside;
  const decide = (p, action) => {
    let note = '';
    if (action === 'waive') { note = window.prompt('Reason for the exemption (required):', ''); if (!note) return; }
    if (action === 'reject' || action === 'uphold') { note = window.prompt('Note (optional):', ''); if (note === null) return; }
    run(() => dataService.decideLatePenalty(p.id, action, note));
  };

  return (
    <>
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><UserCheck size={16} /> Match day – arrival & readiness</span>}
        subtitle={d.scheduled_at ? `Scheduled start ${new Date(d.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'No start time set – delays cannot be worked out'}>
        {msg && <div style={{ marginBottom: '0.6rem', fontSize: '0.83rem', color: '#b91c1c' }}>{msg}</div>}
        {/* #301 readiness */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.3rem 0.8rem', marginBottom: '0.9rem' }}>
          {d.checklist.map((c) => (
            <span key={c.item} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: c.ok ? '#15803d' : c.optional ? '#94a3b8' : '#b45309' }}>
              {c.ok ? <CheckCircle size={14} /> : <Circle size={14} />} {c.item}{c.optional && !c.ok ? ' (optional)' : ''}
            </span>
          ))}
        </div>

        {/* #299 #302 per team */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.7rem' }}>
          {d.teams.map((t) => {
            const a = t.arrival;
            return (
              <div key={t.team_id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                  <strong>{t.name}</strong>
                  {t.offences >= 2 && <span title="Late-arrival penalties in the last 12 months" style={{ fontSize: '0.68rem', color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: 2 }}><AlertTriangle size={12} /> {t.offences} late penalties this year</span>}
                </div>
                {a ? (
                  <div style={{ fontSize: '0.84rem', marginTop: '0.3rem' }}>
                    Arrived {hhmm(a.arrived_at)} ·{' '}
                    <strong style={{ color: a.minutes_late > 0 ? '#b91c1c' : '#15803d' }}>{a.minutes_late > 0 ? `${a.minutes_late} min late` : 'on time'}</strong>
                    {a.players_present != null && ` · ${a.players_present} players`}
                    {a.note && <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{a.note}</div>}
                  </div>
                ) : <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '0.3rem' }}>Not checked in yet</div>}
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.2rem' }}>Playing XI: {t.lineup} · present: {t.present}</div>
                {t.can_check_in && !over && (
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <Button size="sm" variant="primary" onClick={() => run(() => dataService.checkInTeam(matchId, t.team_id))}>{a ? 'Check in again (now)' : 'Arrived now'}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setCi({ teamId: t.team_id, time: '', players: a?.players_present ?? '', note: a?.note || '' })}>Other time…</Button>
                    <Button size="sm" variant="secondary" onClick={() => setAtt(att === t.team_id ? null : t.team_id)}>Attendance</Button>
                  </div>
                )}
                {ci?.teamId === t.team_id && (
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input type="time" value={ci.time} onChange={(e) => setCi({ ...ci, time: e.target.value })} style={inp} />
                    <input type="number" min="0" max="30" placeholder="Players" value={ci.players} onChange={(e) => setCi({ ...ci, players: e.target.value })} style={{ ...inp, width: 80 }} />
                    <input placeholder="Note" maxLength={300} value={ci.note} onChange={(e) => setCi({ ...ci, note: e.target.value })} style={{ ...inp, flex: 1, minWidth: 100 }} />
                    <Button size="sm" variant="primary" disabled={!ci.time} onClick={() => {
                      const base = d.scheduled_at ? new Date(d.scheduled_at) : new Date();
                      const day = base.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                      run(() => dataService.checkInTeam(matchId, t.team_id, new Date(`${day}T${ci.time}:00+05:30`).toISOString(), ci.players, ci.note), () => setCi(null));
                    }}>Save</Button>
                  </div>
                )}
                {/* #300 attendance */}
                {att === t.team_id && (
                  <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 280, overflowY: 'auto' }}>
                    {t.players.length === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No players in the squad.</span>}
                    {t.players.map((p) => (
                      <div key={p.player_id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                        <span style={{ flex: 1 }}>{p.name}{p.in_xi && <span style={{ color: '#94a3b8' }}> · XI</span>}</span>
                        {[['present', 'Here', '#16a34a'], ['late', 'Late', '#d97706'], ['absent', 'Absent', '#dc2626']].map(([s, l, c]) => (
                          <button key={s} onClick={() => run(() => dataService.setAttendance(matchId, p.player_id, p.status === s ? null : s))}
                            style={{ padding: '0.15rem 0.45rem', borderRadius: 999, fontSize: '0.7rem', cursor: 'pointer', border: `1px solid ${p.status === s ? c : '#e2e8f0'}`, backgroundColor: p.status === s ? c : '#fff', color: p.status === s ? '#fff' : '#475569' }}>{l}</button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* #303–#309 penalty */}
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={16} /> Late-arrival penalty</span>}
        subtitle={!d.rules?.method || d.rules.method === 'none' ? rateText(d.rules) : `${METHOD[d.rules.method]}: ${rateText(d.rules)} Approved by ${d.rules.approver === 'umpire' ? 'the organiser or an umpire' : 'the organiser'}. Local tournament rule – not an ICC sanction.`}
        action={d.rules?.method !== 'none' && (d.can_manage || d.can_approve) && !over && !manual ? <Button size="sm" variant="secondary" onClick={() => setManual({ team: d.teams[0]?.team_id, minutes: '' })}>Propose a penalty</Button> : null}>
        {manual && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.7rem', alignItems: 'center' }}>
            <select value={manual.team} onChange={(e) => setManual({ ...manual, team: e.target.value })} style={inp}>{d.teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name} (late)</option>)}</select>
            <input type="number" min="0" max="600" placeholder="Minutes late (blank = from check-in)" value={manual.minutes} onChange={(e) => setManual({ ...manual, minutes: e.target.value })} style={{ ...inp, width: 230 }} />
            <Button size="sm" variant="primary" onClick={() => run(() => dataService.proposeLatePenalty(matchId, manual.team, manual.minutes), () => setManual(null))}>Propose</Button>
            <Button size="sm" variant="secondary" onClick={() => setManual(null)}>Cancel</Button>
          </div>
        )}
        {d.penalties.length === 0 ? <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>{d.rules?.method === 'none' ? 'Set a late-arrival method in the Rules tab (playing conditions) before the match.' : 'No penalty. A penalty is proposed automatically when a team checks in late.'}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {d.penalties.map((p) => {
              const [sl, sc] = STATUS[p.status];
              return (
                <div key={p.id} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', backgroundColor: ['approved', 'appealed'].includes(p.status) ? '#fef2f2' : p.status === 'proposed' ? '#fffbeb' : '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{penaltyText(p, maxOut)}</strong>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: sc }}>{sl}</span>
                  </div>
                  <div style={{ fontSize: '0.77rem', color: '#64748b' }}>
                    {p.late_team} {p.minutes_late} min late{p.auto_created ? ' · proposed automatically at check-in' : ''}{p.approved_by ? ` · decided by ${p.approved_by}` : ''}
                    {p.repeat_offender && <span style={{ color: '#b91c1c', fontWeight: 700 }}> · repeat offender</span>}
                  </div>
                  {p.appeal_reason && <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}><Gavel size={12} /> Appeal: {p.appeal_reason}</div>}
                  {p.decision_note && <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: '#334155' }}>Note: {p.decision_note}</div>}
                  {p.fine_amount != null && <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Fine ₹{Number(p.fine_amount).toLocaleString('en-IN')} · {p.fine_paid ? 'paid' : 'unpaid'}</div>}
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                    {d.can_approve && p.status === 'proposed' && !over && <Button size="sm" variant="primary" onClick={() => window.confirm(`Approve: ${penaltyText(p, maxOut)}?`) && decide(p, 'approve')}>Approve</Button>}
                    {d.can_approve && p.status === 'proposed' && <Button size="sm" variant="secondary" onClick={() => decide(p, 'reject')}>Reject</Button>}
                    {d.can_approve && ['proposed', 'approved', 'appealed'].includes(p.status) && <Button size="sm" variant="secondary" onClick={() => decide(p, 'waive')}>{p.status === 'appealed' ? 'Accept appeal (waive)' : 'Exempt / waive'}</Button>}
                    {d.can_approve && p.status === 'appealed' && <Button size="sm" variant="secondary" onClick={() => decide(p, 'uphold')}>Turn down appeal</Button>}
                    {p.can_appeal && <Button size="sm" variant="secondary" onClick={() => { const r = window.prompt('Why should this penalty be removed?', ''); if (r) run(() => dataService.appealLatePenalty(p.id, r)); }}>Appeal</Button>}
                    {d.can_manage && ['approved', 'appealed'].includes(p.status) && (fine?.id === p.id ? (
                      <>
                        <input type="number" min="0" placeholder="Fine ₹" value={fine.amount} onChange={(e) => setFine({ ...fine, amount: e.target.value })} style={{ ...inp, width: 90 }} />
                        <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={fine.paid} onChange={(e) => setFine({ ...fine, paid: e.target.checked })} /> Paid</label>
                        <Button size="sm" variant="primary" onClick={() => run(() => dataService.setLateFine(p.id, fine.amount, fine.paid), () => setFine(null))}>Save fine</Button>
                      </>
                    ) : <Button size="sm" variant="secondary" onClick={() => setFine({ id: p.id, amount: p.fine_amount ?? '', paid: !!p.fine_paid })}>{p.fine_amount != null ? 'Edit fine' : 'Add fine'}</Button>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

export default MatchPunctualityPanel;
