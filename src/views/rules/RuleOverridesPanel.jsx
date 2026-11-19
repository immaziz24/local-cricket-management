import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { OVERRIDE_FIELDS, buildOverrideChanges, validateOverrideRequest, describeChanges, OVERRIDE_STATUS, formatRuleValue } from './ruleOverrides.js';

/**
 * #358 Ask for a local rule change for one tournament match; the organiser approves or rejects it.
 * #360 Rules are frozen when the match starts, so a request can only be decided before the toss.
 */
const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', maxWidth: '100%' };
const time = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');

export function RuleOverridesPanel({ matchId, refreshKey = 0 }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState({});
  const [open, setOpen] = useState(false);

  const load = useCallback(() => dataService.fetchRuleOverrides(matchId).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (err) return <Card title="Local rule changes"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{err}</p></Card>;
  if (!d || !d.tournament_match) return null;
  const eff = d.effective || {};
  const items = d.items || [];
  if (d.locked && items.length === 0) return null;

  const run = async (fn) => { setBusy(true); setErr(null); try { setD(await fn()); } catch (e) { setErr(e.message); } setBusy(false); };
  const { changes, errors } = buildOverrideChanges(eff, draft);
  const problem = errors[0] || validateOverrideRequest(changes, reason);
  const send = () => run(async () => { const r = await dataService.requestRuleOverride(matchId, changes, reason.trim()); setDraft({}); setReason(''); setOpen(false); return r; });

  return (
    <Card title="Local rule changes" subtitle={d.locked ? 'Rules are fixed now that the match has started' : 'Ask the organiser to change a rule for this match only'}>
      {d.can_request && !d.locked && (open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.55rem' }}>
            {OVERRIDE_FIELDS.map((f) => (
              <label key={f.key} style={{ fontSize: '0.75rem', color: '#64748b' }}>{f.label} <span style={{ color: '#94a3b8' }}>(now {formatRuleValue(f.key, eff[f.key])})</span><br />
                {f.type === 'bool' ? (
                  <select style={field} value={f.key in draft ? String(draft[f.key]) : String(!!eff[f.key])} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value === 'true' })}>
                    <option value="true">Yes</option><option value="false">No</option>
                  </select>
                ) : (
                  <input style={{ ...field, width: '100%' }} inputMode="numeric" placeholder={f.empty || ''} value={f.key in draft ? draft[f.key] : (eff[f.key] ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                )}
              </label>
            ))}
          </div>
          <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Why is this needed?<br />
            <input style={{ ...field, width: '100%' }} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Short boundary, 3 overs per bowler" />
          </label>
          {changes && Object.keys(changes).length > 0 && (
            <div style={{ fontSize: '0.82rem' }}>{describeChanges(changes, eff).map((c) => <div key={c.key}><strong>{c.label}</strong>: {c.from} → {c.to}</div>)}</div>
          )}
          {(errors.length > 0 || (problem && (reason || Object.keys(changes).length))) && <div style={{ color: '#b45309', fontSize: '0.8rem' }}>{problem}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" disabled={busy || !!problem} onClick={send}>Send for approval</Button>
            <Button variant="outline" onClick={() => { setOpen(false); setDraft({}); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '0.8rem' }}><Button variant="outline" onClick={() => setOpen(true)}>Ask for a rule change</Button></div>
      ))}
      {items.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No rule changes asked for.</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map((o) => {
            const st = OVERRIDE_STATUS[o.status] || { label: o.status, color: '#475569' };
            return (
              <div key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: st.color }}>{st.label}</strong>
                  <span style={{ color: '#94a3b8' }}>{o.requested_by || 'Someone'} · {time(o.created_at)}</span>
                </div>
                <div style={{ margin: '0.25rem 0' }}>{describeChanges(o.changes, eff).map((c) => <div key={c.key}>{c.label}: <strong>{c.to}</strong></div>)}</div>
                <div style={{ color: '#475569' }}>Reason: {o.reason}</div>
                {o.decided_at && <div style={{ color: '#64748b' }}>Decided by {o.decided_by || 'organiser'} · {time(o.decided_at)}{o.decision_note ? ` · ${o.decision_note}` : ''}</div>}
                {o.status === 'pending' && d.can_decide && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                    <input style={{ ...field, flex: 1, minWidth: 140 }} maxLength={300} placeholder="Note (optional)" value={notes[o.id] || ''} onChange={(e) => setNotes({ ...notes, [o.id]: e.target.value })} />
                    <Button variant="primary" disabled={busy} onClick={() => run(() => dataService.decideRuleOverride(o.id, true, notes[o.id]))}>Approve</Button>
                    <Button variant="outline" disabled={busy} onClick={() => run(() => dataService.decideRuleOverride(o.id, false, notes[o.id]))}>Reject</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
export default RuleOverridesPanel;
