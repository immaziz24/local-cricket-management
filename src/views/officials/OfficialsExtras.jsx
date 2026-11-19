import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ACCEPTANCE_STATUS, HANDOVER_STATUS, acceptanceSummary, conflictLine, formatStamp, validateHandoverRequest, handoverNextStep } from './officialsExtra.js';

const ROLE = { umpire: 'Umpire', scorer: 'Scorer', third_umpire: 'Third umpire', match_referee: 'Match referee' };
const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', maxWidth: '100%' };

/** #361 For the organiser: who has accepted (with their written confirmation), who has not answered, and who has a clash. */
export function OfficialAcceptancesCard({ matchId, refreshKey = 0 }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => dataService.fetchOfficialAcceptances(matchId).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (err) return <Card title="Who has accepted"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{err}</p></Card>;
  if (!d || !d.can_manage || d.items.length === 0) return null;
  const remind = async (id) => { try { setD(await dataService.remindOfficial(id)); } catch (e) { setErr(e.message); } };
  return (
    <Card title="Who has accepted" subtitle={acceptanceSummary(d.items)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {d.items.map((o) => {
          const st = ACCEPTANCE_STATUS[o.status] || { label: o.status, color: '#475569' };
          return (
            <div key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span><strong>{o.name}</strong> · {ROLE[o.role] || o.role}</span>
                <strong style={{ color: st.color }}>{st.label}</strong>
              </div>
              {o.status === 'accepted' && o.acceptance_text && <div style={{ color: '#475569', marginTop: '0.2rem' }}>{o.acceptance_text} <span style={{ color: '#94a3b8' }}>({formatStamp(o.accepted_at)})</span></div>}
              {o.status === 'declined' && <div style={{ color: '#64748b', marginTop: '0.2rem' }}>{o.decline_reason ? `Reason: ${o.decline_reason}` : 'No reason given.'}</div>}
              {(o.conflicts || []).length > 0 && <div style={{ color: '#b45309', marginTop: '0.2rem' }}>Also accepted: {o.conflicts.map(conflictLine).join('; ')}</div>}
              {o.status === 'invited' && (
                <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8' }}>Invited {formatStamp(o.invited_at)}</span>
                  <Button size="sm" variant="secondary" disabled={!o.can_remind} onClick={() => remind(o.id)}>{o.can_remind ? 'Send reminder' : 'Reminded recently'}</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** #363 Hand scoring to another registered scorer. The organiser approves and the new scorer accepts before anything changes. */
export function ScorerHandoverPanel({ matchId, matchStatus, refreshKey = 0 }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ toUser: '', toName: '', reason: '', fromUser: '' });
  const [notes, setNotes] = useState({});
  const load = useCallback(() => dataService.fetchScorerHandovers(matchId).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (err && !d) return null;
  if (!d) return null;
  const over = ['completed', 'abandoned', 'cancelled'].includes(matchStatus);
  const me = (d.current_scorers || []).find((s) => s.is_me);
  const canAsk = !over && (d.can_manage ? (d.current_scorers || []).length > 0 : !!me) && !(d.items || []).some((h) => ['requested', 'authorised'].includes(h.status));
  const items = d.items || [];
  if (!canAsk && items.length === 0) return null;
  const run = async (fn, after) => { setBusy(true); setErr(null); try { setD(await fn()); after && after(); } catch (e) { setErr(e.message); } setBusy(false); };
  const search = () => dataService.searchOfficials({ kind: 'scorer', query: q, city: '' }).then(setList).catch((e) => setErr(e.message));
  const problem = validateHandoverRequest(form);
  const send = () => run(() => dataService.requestScorerHandover(matchId, form.toUser, form.reason.trim(), form.fromUser || null), () => { setOpen(false); setForm({ toUser: '', toName: '', reason: '', fromUser: '' }); });
  return (
    <Card title="Scorer handover" subtitle="Hand scoring to another scorer. The organiser approves, then the new scorer accepts.">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{err}</div>}
      {canAsk && (open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.8rem' }}>
          {d.can_manage && (d.current_scorers || []).length > 1 && (
            <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Who is handing over?<br />
              <select style={field} value={form.fromUser} onChange={(e) => setForm({ ...form, fromUser: e.target.value })}>
                <option value="">Choose</option>{d.current_scorers.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <input style={{ ...field, flex: 1, minWidth: 160 }} placeholder="Search scorers by name or city" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
            <Button size="sm" variant="secondary" onClick={search}>Search</Button>
          </div>
          {form.toUser && <div style={{ fontSize: '0.84rem' }}>New scorer: <strong>{form.toName}</strong></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {list.filter((o) => o.user_id !== me?.user_id).slice(0, 8).map((o) => (
              <button key={o.user_id} type="button" onClick={() => setForm({ ...form, toUser: o.user_id, toName: o.name })}
                style={{ textAlign: 'left', padding: '0.35rem 0.55rem', border: `1px solid ${form.toUser === o.user_id ? '#059669' : '#e2e8f0'}`, borderRadius: '0.4rem', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                <strong>{o.name}</strong> <span style={{ color: '#64748b' }}>{o.city || ''}</span>
              </button>
            ))}
          </div>
          <input style={{ ...field, width: '100%' }} maxLength={300} placeholder="Reason (for example: I must leave at 5 pm)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          {form.reason && problem && <div style={{ color: '#b45309', fontSize: '0.8rem' }}>{problem}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" disabled={busy || !!problem} onClick={send}>{d.can_manage ? 'Approve and send' : 'Ask the organiser'}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : <div style={{ marginBottom: '0.8rem' }}><Button variant="outline" onClick={() => setOpen(true)}>Hand over scoring</Button></div>)}
      {items.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No handovers yet.</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {items.map((h) => {
            const st = HANDOVER_STATUS[h.status] || { label: h.status, color: '#475569' };
            const step = handoverNextStep(h);
            return (
              <div key={h.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span><strong>{h.from_name}</strong> → <strong>{h.to_name}</strong></span>
                  <strong style={{ color: st.color }}>{st.label}</strong>
                </div>
                <div style={{ color: '#475569' }}>Reason: {h.reason}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  Asked by {h.requested_by_name} · {formatStamp(h.created_at)}{h.authorised_by_name ? ` · approved by ${h.authorised_by_name}` : ''}{h.decision_note ? ` · ${h.decision_note}` : ''}
                </div>
                {step && <div style={{ color: '#065f46', marginTop: '0.2rem' }}>{step}</div>}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {h.can_decide && <>
                    <input style={{ ...field, flex: 1, minWidth: 140 }} maxLength={300} placeholder="Note (optional)" value={notes[h.id] || ''} onChange={(e) => setNotes({ ...notes, [h.id]: e.target.value })} />
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => dataService.decideScorerHandover(h.id, true, notes[h.id]))}>Approve</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.decideScorerHandover(h.id, false, notes[h.id]))}>Reject</Button>
                  </>}
                  {h.can_respond && <>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => dataService.respondScorerHandover(h.id, true))}>Accept and take over</Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.respondScorerHandover(h.id, false))}>Decline</Button>
                  </>}
                  {h.can_cancel && <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.cancelScorerHandover(h.id))}>Cancel</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
