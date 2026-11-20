import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { fieldsFor, diffChanges, validateCorrection, previewChanges, REVISION_STATUS } from './ballCorrection.js';
import { previewLinesFromServer, previewNote } from './correctionPreview.js';

/**
 * #315 #316 Correct who batted / bowled a ball, #317 totals recomputed, #318 reason + approval,
 * #319 permanent correction history, #324 before → after preview.
 * Scorers ask; the match creator / tournament organiser approves (their own corrections apply at once).
 */
const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', maxWidth: '100%' };
const time = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const FIELD_LABEL = { striker_id: 'Batter facing', non_striker_id: 'Non-striker', bowler_id: 'Bowler', dismissed_id: 'Who was out', fielder_id: 'Fielder' };
const STATUS_COLOR = { pending: '#b45309', applied: '#065f46', rejected: '#b91c1c' };

export function CorrectionsPanel({ matchId, refreshKey = 0, onChanged }) {
  const [data, setData] = useState(null);
  const [revs, setRevs] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ballId, setBallId] = useState('');
  const [picks, setPicks] = useState({});
  const [reason, setReason] = useState('');
  const [note, setNote] = useState({});
  const [srv, setSrv] = useState(null);

  const load = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([dataService.fetchCorrectableBalls(matchId), dataService.fetchBallRevisions(matchId)]);
      setData(b); setRevs(r); setErr(null);
    } catch (e) {
      if (/Only the match scorers/i.test(e.message)) setHidden(true); else setErr(e.message);
    }
  }, [matchId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  // #324 ask the server what would move before anything is saved
  useEffect(() => {
    const b = data && data.balls.find((x) => String(x.id) === String(ballId));
    const ch = b ? diffChanges(b, picks) : {};
    if (!b || Object.keys(ch).length === 0) { setSrv(null); return undefined; }
    let live = true;
    dataService.previewBallCorrection(matchId, b.id, ch).then((p) => { if (live) setSrv(p); }).catch(() => { if (live) setSrv(null); });
    return () => { live = false; };
  }, [ballId, picks, data, matchId]);

  if (hidden) return null;
  if (err) return <Card><span style={{ color: '#b91c1c' }}>{err}</span></Card>;
  if (!data || !revs) return null;

  const ball = data.balls.find((b) => String(b.id) === String(ballId));
  const changes = ball ? diffChanges(ball, picks) : {};
  const problem = ball ? validateCorrection(ball, changes, reason) : null;
  const preview = ball ? previewChanges(ball, changes, data.players) : [];

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { const r = await fn(); if (r) setRevs(r); await load(); onChanged?.(); return true; }
    catch (e) { setErr(e.message); return false; }
    finally { setBusy(false); }
  };

  const submit = async () => {
    const ok = await run(() => dataService.proposeBallCorrection(matchId, ball.id, changes, reason));
    if (ok) { setBallId(''); setPicks({}); setReason(''); }
  };

  const pending = revs.items.filter((r) => r.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {pending.length > 0 && revs.can_decide && (
        <Card title={`Corrections waiting for you (${pending.length})`}>
          {pending.map((r) => (
            <div key={r.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '0.5rem 0', fontSize: '0.85rem' }}>
              <div><strong>Innings {r.innings_no}, over {r.over}</strong> · asked by {r.requested_by || 'a scorer'} · {time(r.created_at)}</div>
              {r.changes.map((c, i) => <div key={i} style={{ color: '#334155' }}>{FIELD_LABEL[c.field] || c.field}: {c.before || 'none'} → <strong>{c.after || 'none'}</strong></div>)}
              <div style={{ color: '#64748b' }}>Reason: {r.reason}</div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <input style={{ ...field, flex: 1, minWidth: 140 }} placeholder="Note (optional)" value={note[r.id] || ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => dataService.decideBallCorrection(r.id, true, note[r.id]))}>Approve</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.decideBallCorrection(r.id, false, note[r.id]))}>Reject</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card title="Correct who played a ball">
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#64748b' }}>
          Picked the wrong batter or bowler? Fix it here. Runs and wickets stay as they are; every total is recalculated. {revs.can_decide ? 'As the match manager your correction applies immediately.' : 'The match creator or organiser has to approve it.'}
        </p>
        <select style={{ ...field, width: '100%' }} value={ballId} onChange={(e) => { setBallId(e.target.value); setPicks({}); }}>
          <option value="">Choose a ball…</option>
          {data.balls.map((b) => (
            <option key={b.id} value={b.id}>
              Inn {b.innings_no} · {b.over_no}.{b.ball_in_over} · {b.bowler} to {b.striker}{b.is_wicket ? ' (wicket)' : ''}
            </option>
          ))}
        </select>
        {ball && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', marginTop: '0.7rem' }}>
            {fieldsFor(ball).map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', color: '#475569' }}>
                {f.label}
                <select style={field} value={f.key in picks ? picks[f.key] : (ball[f.key] || '')} onChange={(e) => setPicks({ ...picks, [f.key]: e.target.value })}>
                  {(f.key === 'fielder_id') && <option value="">None</option>}
                  {data.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
        {ball && (
          <div style={{ marginTop: '0.7rem' }}>
            <input style={{ ...field, width: '100%' }} placeholder="Reason (required) e.g. picked the wrong batter" value={reason} onChange={(e) => setReason(e.target.value)} />
            {preview.length > 0 && (
              <div style={{ marginTop: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.45rem', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}>
                <strong>Preview</strong>
                {(srv ? previewLinesFromServer(srv) : preview).map((l, i) => <div key={i}>{l}</div>)}
                {srv && previewNote(srv) && <div style={{ color: '#64748b', marginTop: '0.25rem' }}>{previewNote(srv)}</div>}
              </div>
            )}
            {problem && preview.length > 0 && <div style={{ color: '#b45309', fontSize: '0.8rem', marginTop: '0.3rem' }}>{problem}</div>}
            <div style={{ marginTop: '0.5rem' }}>
              <Button variant="primary" disabled={busy || !!problem} onClick={submit}>{revs.can_decide ? 'Apply correction' : 'Ask for approval'}</Button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Correction history">
        {revs.items.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No corrections yet. Every change is kept here permanently.</span> : revs.items.map((r) => (
          <div key={r.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '0.45rem 0', fontSize: '0.83rem' }}>
            <div>
              <strong>Inn {r.innings_no}, over {r.over}</strong> <span style={{ color: STATUS_COLOR[r.status], fontWeight: 700 }}>· {REVISION_STATUS[r.status]}</span>
              <span style={{ color: '#94a3b8' }}> · {time(r.created_at)} · {r.requested_by || 'a scorer'}</span>
            </div>
            {r.changes.map((c, i) => <div key={i} style={{ color: '#334155' }}>{FIELD_LABEL[c.field] || c.field}: {c.before || 'none'} → {c.after || 'none'}</div>)}
            <div style={{ color: '#64748b' }}>Reason: {r.reason}{r.decided_by ? ` · decided by ${r.decided_by}` : ''}{r.decision_note ? ` (“${r.decision_note}”)` : ''}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default CorrectionsPanel;
