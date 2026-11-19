import React, { useEffect, useState, useCallback } from 'react';
import { dataService } from '../../services/dataService.js';
import { inp, lbl } from '../brand/brandShared.jsx';
import { recapStatusLabel, recapRejectProblem, recapEditProblem, recapIsChanged, pendingRecap, recapCredit } from './recapRules.js';
import { Sparkles, Check, X } from 'lucide-react';

/** #380 A recap is drafted from the real scorecard by fixed rules. Nothing is published until a match official approves it. */
export function MatchRecapPanel({ matchId, onPublished }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ title: '', summary: '', body: '' });
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    try {
      const l = await dataService.listMatchRecaps(matchId); setList(l);
      const p = pendingRecap(l); if (p) setF({ title: p.title, summary: p.summary || '', body: p.body });
    } catch (e) { setErr(e.message); setList([]); }
  }, [matchId]);
  useEffect(() => { load(); }, [load]);

  // Only people who run the match get a list back, so everyone else sees nothing.
  if (list === null) return null;
  const pending = pendingRecap(list);
  const past = list.filter((r) => r.status !== 'pending').slice(0, 3);

  const run = async (fn, after) => {
    setBusy(true); setErr(null);
    try { const r = await fn(); if (after) after(r); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const draft = () => run(() => dataService.draftMatchRecap(matchId));
  const save = () => {
    const p = recapEditProblem(f.title, f.body); if (p) { setErr(p); return; }
    return run(() => dataService.editMatchRecap(pending.id, f.title, f.summary, f.body));
  };
  const approve = async () => {
    const p = recapEditProblem(f.title, f.body); if (p) { setErr(p); return; }
    await run(async () => {
      if (recapIsChanged(pending, f.title, f.body) || f.summary !== (pending.summary || '')) await dataService.editMatchRecap(pending.id, f.title, f.summary, f.body);
      return dataService.approveMatchRecap(pending.id);
    }, (r) => { setDone(r); onPublished && onPublished(r); });
  };
  const reject = () => {
    const p = recapRejectProblem(reason); if (p) { setErr(p); return; }
    return run(() => dataService.rejectMatchRecap(pending.id, reason), () => { setRejecting(false); setReason(''); });
  };

  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Sparkles size={16} /><strong>Automatic match recap</strong>
        {!pending && <button className="btn" disabled={busy} onClick={draft} style={{ marginLeft: 'auto' }}>{busy ? 'Drafting…' : 'Draft recap from scorecard'}</button>}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '6px 0' }}>A first draft is written from the real scorecard. Check it, change anything, then approve. Nothing is published until you do.</p>
      {err && <p style={{ color: 'var(--danger, #b00020)', fontSize: 13 }}>{err}</p>}
      {done && <p style={{ fontSize: 13 }}>Published as the official match report. {recapCredit(done.edited)}</p>}
      {pending && (
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>{recapStatusLabel(pending)}</span>
          <label><span style={lbl}>Headline</span><input style={inp} value={f.title} maxLength={140} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label><span style={lbl}>Short summary</span><input style={inp} value={f.summary} maxLength={300} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
          <label><span style={lbl}>Report</span><textarea style={{ ...inp, minHeight: 240 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
          {rejecting ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Why is this draft not right?" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn" disabled={busy} onClick={reject}>Reject draft</button>
              <button className="btn" onClick={() => setRejecting(false)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={busy} onClick={approve}><Check size={14} /> Approve and publish</button>
              <button className="btn" disabled={busy} onClick={save}>Save changes</button>
              <button className="btn" disabled={busy} onClick={() => setRejecting(true)}><X size={14} /> Reject</button>
              <button className="btn" disabled={busy} onClick={draft}>Draft again</button>
            </div>
          )}
        </div>
      )}
      {past.length > 0 && (
        <ul className="muted" style={{ fontSize: 12, margin: '10px 0 0', paddingLeft: 18 }}>
          {past.map((r) => <li key={r.id}>{recapStatusLabel(r)}{r.reject_reason ? ` – ${r.reject_reason}` : ''} · {new Date(r.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>)}
        </ul>
      )}
    </div>
  );
}
