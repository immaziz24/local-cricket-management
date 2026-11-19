import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  eventLine, simulationLines, validateMinutes, validateDispute, validateEvidence, validateDisputeDecision, lateTeamEvidenceCount,
  disputesSummary, localInputToIso, DISPUTE_STATUS, EVIDENCE_KIND, SIDE_LABEL
} from './latePenaltyExtras.js';

const inp = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.84rem', maxWidth: '100%' };
const stamp = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/** #399 Shows what a penalty would change, without changing anything. */
export function PenaltyPreview({ matchId, teams, penaltyId = null, lateTeamId = null, compact = false }) {
  const [team, setTeam] = useState(lateTeamId || teams?.[0]?.team_id || '');
  const [minutes, setMinutes] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const bad = penaltyId ? null : validateMinutes(minutes);
    if (bad) { setErr(bad); return; }
    setBusy(true); setErr(null);
    try { setRes(await dataService.simulateLatePenalty(matchId, team, minutes, penaltyId)); } catch (e) { setErr(e.message); setRes(null); }
    setBusy(false);
  };
  return (
    <div style={{ marginTop: compact ? '0.4rem' : 0 }}>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {!penaltyId && (
          <>
            <select value={team} onChange={(e) => setTeam(e.target.value)} style={inp}>{(teams || []).map((t) => <option key={t.team_id} value={t.team_id}>{t.name} (late)</option>)}</select>
            <input type="number" min="0" max="600" placeholder="Minutes late (blank = check-in)" value={minutes} onChange={(e) => setMinutes(e.target.value)} style={{ ...inp, width: 220 }} />
          </>
        )}
        <Button size="sm" variant="secondary" disabled={busy} onClick={go}>{busy ? 'Working…' : 'Preview the effect'}</Button>
      </div>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.3rem' }}>{err}</div>}
      {res && (
        <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem', color: '#334155' }}>
          {simulationLines(res).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </div>
  );
}

/** #400 The full trail of every change to the penalties of this match. */
export function PenaltyHistory({ matchId, refreshKey = 0 }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let off = false;
    dataService.listLatePenaltyEvents(matchId).then((d) => { if (!off) { setItems(d.items || []); setErr(null); } }).catch((e) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [matchId, refreshKey]);
  if (err || !items || items.length === 0) return null;
  return (
    <Card title="Penalty history" subtitle="Every proposal, decision, rollback and correction. This record cannot be edited.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {items.map((e) => (
          <div key={e.id} style={{ fontSize: '0.82rem', borderLeft: `3px solid ${e.action === 'rolled_back' ? '#64748b' : '#cbd5e1'}`, paddingLeft: '0.55rem' }}>
            <div><strong>{eventLine(e)}</strong> <span style={{ color: '#94a3b8' }}>{stamp(e.at)}</span></div>
            {e.note && <div style={{ color: '#475569' }}>{e.note}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function EvidenceForm({ onAdd }) {
  const [f, setF] = useState({ kind: 'photo_link', url: '', statement: '' });
  const [err, setErr] = useState(null);
  const add = async () => {
    const bad = validateEvidence(f);
    if (bad) { setErr(bad); return; }
    try { await onAdd(f); setF({ kind: 'photo_link', url: '', statement: '' }); setErr(null); } catch (e) { setErr(e.message); }
  };
  return (
    <div style={{ marginTop: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={inp}>{Object.entries(EVIDENCE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input placeholder="Link (https://…)" value={f.url} maxLength={500} onChange={(e) => setF({ ...f, url: e.target.value })} style={{ ...inp, flex: 1, minWidth: 180 }} />
      </div>
      <textarea rows={2} placeholder="What does it show? Or write your statement." maxLength={1000} value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} style={{ ...inp, width: '100%', marginTop: '0.4rem', resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem' }}>
        <Button size="sm" variant="secondary" onClick={add}>Add evidence</Button>
        {err && <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{err}</span>}
      </div>
    </div>
  );
}

/** #398 A team owner disputes the recorded arrival time, both sides add evidence, the organiser decides. */
export function ArrivalDisputes({ matchId, teams, arrivals, refreshKey = 0, onChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState(null);
  const load = useCallback(() => dataService.listArrivalDisputes(matchId).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  const act = async (fn) => { setErr(null); try { setD(await fn()); onChanged && onChanged(); } catch (e) { setErr(e.message); } };
  if (!d) return err ? <Card title="Arrival disputes"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.84rem' }}>{err}</p></Card> : null;
  const arrivalOf = (teamId) => (arrivals || []).find((a) => a.team_id === teamId);
  const openFor = (teamId) => d.items.some((x) => x.team_id === teamId && x.status === 'open');
  const canOpen = d.my_teams.filter((t) => arrivalOf(t.id) && !openFor(t.id));
  if (d.items.length === 0 && canOpen.length === 0) return null;
  const startForm = (t) => setForm({ teamId: t.id, claimed: '', reason: '' });
  const submit = async () => {
    const a = arrivalOf(form.teamId);
    const bad = validateDispute({ claimedAt: form.claimed, recordedAt: a?.arrived_at, reason: form.reason });
    if (bad) { setErr(bad); return; }
    await act(() => dataService.openArrivalDispute(matchId, form.teamId, localInputToIso(form.claimed), form.reason));
    setForm(null);
  };
  const decide = (x, accept) => {
    const note = window.prompt(accept ? 'Reason for accepting (required):' : 'Reason for rejecting (required):', '');
    if (note === null) return;
    const bad = validateDisputeDecision(note, accept, lateTeamEvidenceCount(x));
    if (bad) { setErr(bad); return; }
    act(() => dataService.decideArrivalDispute(x.id, accept, note));
  };
  return (
    <Card title="Arrival disputes" subtitle={disputesSummary(d.items)}>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.4rem' }}>{err}</div>}
      {canOpen.length > 0 && !form && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {canOpen.map((t) => <Button key={t.id} size="sm" variant="secondary" onClick={() => startForm(t)}>Dispute the arrival time of {t.name}</Button>)}
        </div>
      )}
      {form && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.6rem', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.3rem' }}>Recorded arrival: {stamp(arrivalOf(form.teamId)?.arrived_at)}</div>
          <label style={{ fontSize: '0.8rem', display: 'block' }}>When did you really arrive?
            <input type="datetime-local" value={form.claimed} onChange={(e) => setForm({ ...form, claimed: e.target.value })} style={{ ...inp, display: 'block', marginTop: 2 }} />
          </label>
          <textarea rows={2} maxLength={1000} placeholder="Why is the recorded time wrong?" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={{ ...inp, width: '100%', marginTop: '0.4rem', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
            <Button size="sm" variant="primary" onClick={submit}>Send dispute</Button>
            <Button size="sm" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
          </div>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>After sending, add evidence: a photo or video link, a chat message or a witness statement.</p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {d.items.map((x) => {
          const st = DISPUTE_STATUS[x.status] || { label: x.status, color: '#475569' };
          return (
            <div key={x.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong>{x.team}</strong><strong style={{ color: st.color }}>{st.label}</strong>
              </div>
              <div style={{ color: '#475569' }}>Recorded {stamp(x.recorded_arrival_at)} ({x.recorded_minutes_late} min late) · claims {stamp(x.claimed_arrival_at)}</div>
              <div style={{ marginTop: '0.2rem' }}>{x.reason} <span style={{ color: '#94a3b8' }}>– {x.by}</span></div>
              {x.evidence.length > 0 && (
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                  {x.evidence.map((e) => (
                    <li key={e.id}>
                      <strong>{EVIDENCE_KIND[e.kind] || e.kind}</strong> ({SIDE_LABEL[e.side] || e.side}, {e.by})
                      {e.url && <> – <a href={e.url} target="_blank" rel="noopener noreferrer">open link</a></>}
                      {e.statement && <> – {e.statement}</>}
                    </li>
                  ))}
                </ul>
              )}
              {x.decision_note && <div style={{ marginTop: '0.3rem', color: '#334155' }}>Decision{x.decided_by ? ` by ${x.decided_by}` : ''}: {x.decision_note}</div>}
              {x.can_add_evidence && <EvidenceForm onAdd={(f) => act(() => dataService.addArrivalEvidence(x.id, f.kind, f.url, f.statement))} />}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                {d.can_decide && x.status === 'open' && <Button size="sm" variant="primary" onClick={() => decide(x, true)}>Accept and correct the time</Button>}
                {d.can_decide && x.status === 'open' && <Button size="sm" variant="secondary" onClick={() => decide(x, false)}>Reject</Button>}
                {x.can_withdraw && <Button size="sm" variant="secondary" onClick={() => act(() => dataService.withdrawArrivalDispute(x.id))}>Withdraw</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
