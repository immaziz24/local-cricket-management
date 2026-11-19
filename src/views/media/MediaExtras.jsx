import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { Flag, ShieldCheck, Link2, Play, Scissors, Trash2, Wand2, X } from 'lucide-react';
import {
  fmtClock, parseClock, toLocalInput, fromLocalInput, timeLink, KIND_ICON, linkLabel, POLICY_WHO, LICENCE, PEOPLE, rightsError, ctrText, seriesBars, SNAPSHOT_LABEL
} from './mediaExtras.js';

/** Batch 14: #375 rights and upload rules, #374 video-to-score links, #373 clip suggestions, #378 placement numbers, #379 saved sponsor reports. */
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
const pill = (on) => ({ padding: '0.3rem 0.7rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${on ? '#16a34a' : '#e2e8f0'}`, backgroundColor: on ? '#dcfce7' : '#fff', fontWeight: on ? 700 : 500 });
const note = { fontSize: '0.78rem', color: '#64748b' };
const errStyle = { color: '#b91c1c', fontSize: '0.82rem' };

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3rem 1rem', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '0.9rem', maxWidth: 520, width: '100%', padding: '1.1rem 1.2rem', position: 'relative' }}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        <h3 style={{ margin: '0 0 0.7rem', fontSize: '1.05rem' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ---------- #375 rights ---------- */
export function RightsDialog({ item, onDone, onClose }) {
  const [f, setF] = useState({ holder: '', licence: 'own_work', people: 'none', allow_reuse: false, confirmed: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { dataService.getMediaRights(item.id).then((r) => { if (r) setF((p) => ({ ...p, holder: r.holder, licence: r.licence, people: r.people || 'none', allow_reuse: !!r.allow_reuse })); }).catch(() => {}); }, [item.id]);
  const save = async () => {
    const e = rightsError(f); if (e) { setMsg(e); return; }
    setBusy(true); setMsg(null);
    try { const r = await dataService.declareMediaRights(item.id, f); onDone(r); } catch (x) { setMsg(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Who owns this photo or video?" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <label style={note}>Owner (a person, team or studio)<input value={f.holder} maxLength={120} onChange={(e) => setF({ ...f, holder: e.target.value })} style={inp} placeholder="e.g. Rahim Studio" /></label>
        <label style={note}>How may it be used?
          <select value={f.licence} onChange={(e) => setF({ ...f, licence: e.target.value })} style={inp}>{LICENCE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label style={note}>People in it
          <select value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} style={inp}>{PEOPLE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label style={{ ...note, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.allow_reuse} onChange={(e) => setF({ ...f, allow_reuse: e.target.checked })} /> The organiser may reuse it in posters and reports</label>
        <label style={{ fontSize: '0.84rem', display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="checkbox" checked={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.checked })} style={{ marginTop: 3 }} /> I confirm that what I wrote above is true.</label>
        {f.people === 'unsure' && <span style={note}>If you are not sure, it stays hidden until you can say people have agreed or nobody can be recognised.</span>}
        {msg && <div style={errStyle}>{msg}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}><Button size="sm" variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button><Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button></div>
      </div>
    </Modal>
  );
}

export function TakedownDialog({ item, onDone, onClose }) {
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const send = async () => {
    setBusy(true); setMsg(null);
    try { await dataService.requestMediaTakedown(item.id, why); onDone(); } catch (x) { setMsg(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Ask for this to be removed" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <span style={note}>The organiser and the person who added it will be told. Say clearly what is wrong, for example that it shows you or your child and you did not agree.</span>
        <textarea value={why} maxLength={1000} rows={4} onChange={(e) => setWhy(e.target.value)} style={{ ...inp, fontFamily: 'inherit' }} placeholder="Why should it be removed? (at least 10 characters)" />
        {msg && <div style={errStyle}>{msg}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}><Button size="sm" variant="primary" disabled={busy || why.trim().length < 10} onClick={send}>{busy ? 'Sending…' : 'Send request'}</Button><Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button></div>
      </div>
    </Modal>
  );
}

/** Shown on a card: waiting-for-rights note for the owner, or a report button for everybody else. */
export function RightsActions({ item, onChanged }) {
  const [dlg, setDlg] = useState(null);
  const [sent, setSent] = useState(false);
  if (item.status === 'pending_rights') {
    return (
      <div style={{ marginTop: '0.35rem', padding: '0.4rem 0.55rem', borderRadius: '0.4rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.78rem' }}>
        Hidden until the owner details are given. {item.can_edit && <button type="button" onClick={() => setDlg('rights')} style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Add owner details</button>}
        {dlg === 'rights' && <RightsDialog item={item} onClose={() => setDlg(null)} onDone={() => { setDlg(null); onChanged(); }} />}
      </div>
    );
  }
  if (item.is_mine || item.status !== 'visible') {
    return item.can_edit && item.status === 'visible' ? (
      <>
        <button type="button" onClick={() => setDlg('rights')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', padding: 0, display: 'inline-flex', gap: 3, alignItems: 'center' }}><ShieldCheck size={12} /> Owner details</button>
        {dlg === 'rights' && <RightsDialog item={item} onClose={() => setDlg(null)} onDone={() => { setDlg(null); onChanged(); }} />}
      </>
    ) : null;
  }
  return (
    <>
      {sent ? <span style={{ fontSize: '0.72rem', color: '#059669' }}>Request sent</span>
        : <button type="button" onClick={() => setDlg('takedown')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer', padding: 0, display: 'inline-flex', gap: 3, alignItems: 'center' }}><Flag size={12} /> Ask to remove</button>}
      {dlg === 'takedown' && <TakedownDialog item={item} onClose={() => setDlg(null)} onDone={() => { setDlg(null); setSent(true); }} />}
    </>
  );
}

/** Organiser: who may upload, and whether owner details are needed first. */
export function MediaPolicyCard({ tournamentId }) {
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { dataService.getMediaPolicy(tournamentId).then(setP).catch((e) => setMsg(e.message)); }, [tournamentId]);
  const save = async () => {
    setMsg(null); setSaved(false);
    try { setP(await dataService.setMediaPolicy(tournamentId, p)); setSaved(true); } catch (e) { setMsg(e.message); }
  };
  if (!p) return <span style={note}>{msg || 'Loading…'}</span>;
  return (
    <Card title="Photo and video rules" subtitle="Applies to this tournament and its matches">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={note}>Who may add photos and videos
          <select value={p.upload_who} onChange={(e) => { setSaved(false); setP({ ...p, upload_who: e.target.value }); }} style={inp}>{POLICY_WHO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label style={{ fontSize: '0.85rem', display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="checkbox" checked={!!p.require_rights} onChange={(e) => { setSaved(false); setP({ ...p, require_rights: e.target.checked }); }} style={{ marginTop: 3 }} /> New photos and videos stay hidden until the uploader says who owns them and whether the people in them agreed</label>
        <span style={note}>Live streams are not affected. Items already published stay as they are.</span>
        {msg && <div style={errStyle}>{msg}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Button size="sm" variant="primary" onClick={save}>Save rules</Button>{saved && <span style={{ fontSize: '0.8rem', color: '#059669' }}>Saved</span>}</div>
      </div>
    </Card>
  );
}

/** Organiser: removal requests for this tournament's photos and videos. */
export function TakedownQueue({ scope = 'tournament', scopeId }) {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const [note2, setNote2] = useState({});
  const load = () => dataService.listMediaTakedowns(scope, scopeId, status).then((r) => setRows(r.items)).catch((e) => { setMsg(e.message); setRows([]); });
  useEffect(() => { setRows(null); load(); }, [scope, scopeId, status]);
  const decide = async (id, remove) => {
    setMsg(null);
    try { await dataService.decideMediaTakedown(id, remove, note2[id] || ''); load(); } catch (e) { setMsg(e.message); }
  };
  return (
    <Card title="Removal requests" subtitle="People can ask for a photo or video to be taken down">
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>{[['open', 'Waiting'], ['removed', 'Removed'], ['kept', 'Kept']].map(([k, l]) => <button key={k} type="button" onClick={() => setStatus(k)} style={pill(status === k)}>{l}</button>)}</div>
      {msg && <div style={errStyle}>{msg}</div>}
      {rows === null ? <span style={note}>Loading…</span> : rows.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>Nothing here.</span> : rows.map((r) => (
        <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.6rem', marginBottom: '0.5rem', display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          {r.kind === 'photo' && r.url && <img src={r.url} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6 }} />}
          <div style={{ flex: 1, minWidth: 200, fontSize: '0.85rem' }}>
            <strong>{r.title || (r.kind === 'photo' ? 'Photo' : 'Video')}</strong> <span style={note}>added by {r.uploader || '—'}</span>
            {r.kind !== 'photo' && r.url && <div><a href={r.url} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: '0.78rem' }}>Open</a></div>}
            <div style={{ marginTop: 3 }}>“{r.reason}” <span style={note}>– {r.by || 'someone'}</span></div>
            {r.status !== 'open' && <div style={{ ...note, marginTop: 3 }}>Decision: {r.decision_note}</div>}
            {r.status === 'open' && (
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <input placeholder="Your reason (shown to both people)" value={note2[r.id] || ''} maxLength={1000} onChange={(e) => setNote2({ ...note2, [r.id]: e.target.value })} style={{ ...inp, flex: 1, minWidth: 180 }} />
                <Button size="sm" variant="danger" disabled={(note2[r.id] || '').trim().length < 5} onClick={() => decide(r.id, true)}>Remove it</Button>
                <Button size="sm" variant="secondary" disabled={(note2[r.id] || '').trim().length < 5} onClick={() => decide(r.id, false)}>Keep it</Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------- #374 video-to-score links ---------- */
/** Under a match video: set when the video started, link it to the score, jump to a moment. */
export function VideoLinks({ item, onSeek }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(null);
  const [start, setStart] = useState('');
  const [delay, setDelay] = useState(0);
  const [busy, setBusy] = useState(false);
  const load = () => dataService.listMediaEventLinks(item.id).then((r) => { setD(r); setStart(toLocalInput(r.started_at)); setDelay(r.link_delay_s || 0); }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, [item.id]);
  if (!d) return null;
  const items = d.items || [];
  if (!d.can_edit && items.length === 0) return null;
  const run = async (fn) => { setBusy(true); setMsg(null); try { await fn(); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };
  const saveTiming = () => run(() => dataService.setMediaTiming(item.id, fromLocalInput(start), Number(delay) || 0));
  return (
    <div style={{ marginTop: '0.4rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem' }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', color: '#0f766e', display: 'inline-flex', gap: 4, alignItems: 'center', padding: 0 }}><Link2 size={13} /> Jump to moments{items.length ? ` (${items.length})` : ''}</button>
      {open && (
        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {d.can_edit && (
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={note}>When did the video start? (date and time of its first second)<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={inp} /></label>
              <label style={note}>Scorer delay in seconds (how late the scorer taps the ball, usually 5 to 15)<input type="number" min={-120} max={600} value={delay} onChange={(e) => setDelay(e.target.value)} style={inp} /></label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Button size="sm" variant="secondary" disabled={busy || !start} onClick={saveTiming}>Save start time</Button>
                <Button size="sm" variant="primary" disabled={busy || !d.started_at} onClick={() => run(() => dataService.autoLinkMedia(item.id))} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Wand2 size={13} /> Link wickets, sixes, fours and milestones</Button>
              </div>
              <span style={note}>Times come from when each ball was scored, so they can be a few seconds off. Remove or fix any link below.</span>
            </div>
          )}
          {msg && <div style={errStyle}>{msg}</div>}
          {items.length === 0 ? <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No links yet.</span> : items.map((l) => (
            <div key={l.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem' }}>
              <button type="button" onClick={() => onSeek && onSeek(l.clip_start_s ?? l.offset_s)} style={{ flex: 1, textAlign: 'left', background: l.kind === 'clip' ? '#ecfdf5' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Play size={12} /> {l.kind === 'clip' && <Scissors size={12} />} <span>{linkLabel(l)}</span>
              </button>
              {timeLink(item, l.clip_start_s ?? l.offset_s) && <a href={timeLink(item, l.clip_start_s ?? l.offset_s)} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: '0.72rem' }}>Open</a>}
              {d.can_edit && <button type="button" title="Remove link" disabled={busy} onClick={() => run(() => dataService.unlinkMediaEvent(l.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A video that can jump to a second: YouTube reloads with a start time; uploaded files seek. */
export function useSeek() {
  const [seek, setSeek] = useState(null);
  const ref = useRef(null);
  const jump = (s) => {
    setSeek({ s, n: Date.now() });
    if (ref.current) { try { ref.current.currentTime = s; ref.current.play(); } catch { /* the browser may block autoplay */ } }
  };
  return { seek, jump, ref };
}

/* ---------- #373 suggested highlight clips ---------- */
export function ClipSuggestions({ matchId, refreshKey }) {
  const [videos, setVideos] = useState([]);
  const [mid, setMid] = useState('');
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    dataService.listMedia('match', matchId).then((r) => {
      const v = (r.items || []).filter((i) => ['video', 'highlight', 'stream'].includes(i.kind) && i.status === 'visible' && i.can_edit);
      setVideos(v); setMid((cur) => cur || v.find((x) => x.started_at)?.id || v[0]?.id || '');
    }).catch(() => {});
  }, [matchId, refreshKey]);
  const load = () => dataService.suggestHighlightClips(matchId, mid || null, 8).then((r) => { setD(r); setAllowed(true); }).catch((e) => { setAllowed(false); setMsg(e.message); });
  useEffect(() => { setD(null); setMsg(null); load(); }, [matchId, mid, refreshKey]);
  if (!allowed) return null;
  const video = videos.find((v) => v.id === mid);
  const save = async (s) => {
    setBusy(s.ball_id); setMsg(null);
    try { await dataService.acceptClipSuggestion(mid, s.ball_id, s.start_s, s.end_s, s.label); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };
  const items = d?.items || [];
  if (d && items.length === 0) return null;
  return (
    <Card title="Suggested highlight clips" subtitle="The best moments of the match, worked out from the score. Pick the match video to see where in it each one happens.">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }}>
        {videos.length > 0 ? (
          <select value={mid} onChange={(e) => setMid(e.target.value)} style={{ ...inp, width: 'auto', maxWidth: '100%' }}>{videos.map((v) => <option key={v.id} value={v.id}>{v.title || 'Match video'}{v.started_at ? '' : ' (start time not set)'}</option>)}</select>
        ) : <span style={note}>Add a match video (link or upload) to get clip times.</span>}
      </div>
      {video && !video.started_at && <div style={{ ...note, marginBottom: '0.5rem' }}>Set when this video started (under “Jump to moments” on the video) and times will appear here.</div>}
      {msg && <div style={errStyle}>{msg}</div>}
      {d === null ? <span style={note}>Loading…</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {items.map((s) => (
            <div key={s.ball_id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', backgroundColor: '#f8fafc', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: '#475569', minWidth: 54 }}>{s.innings_no ? `${s.innings_no}· ` : ''}{s.over}</span>
              <span style={{ flex: 1, minWidth: 160 }}>{KIND_ICON[s.kind] || '🏏'} {s.label}</span>
              {s.start_s != null ? <span style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 700 }}>{fmtClock(s.start_s)}–{fmtClock(s.end_s)}</span> : <span style={note}>no time yet</span>}
              {s.start_s != null && (s.already ? <span style={{ fontSize: '0.75rem', color: '#059669' }}>Saved</span> : <Button size="sm" variant="secondary" disabled={busy === s.ball_id} onClick={() => save(s)}>Save clip</Button>)}
            </div>
          ))}
        </div>
      )}
      <div style={{ ...note, marginTop: '0.5rem' }}>Saved clips appear under “Jump to moments” on the video. The video itself is not cut.</div>
    </Card>
  );
}

/* ---------- #378 placement numbers ---------- */
export function PlacementAnalyticsCard({ tournamentId, sponsorId, title = 'Advert views and clicks' }) {
  const [days, setDays] = useState(14);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    setD(null); setMsg(null);
    dataService.placementAnalytics({ tournament_id: tournamentId || null, sponsor_id: sponsorId || null, days }).then(setD).catch((e) => setMsg(e.message));
  }, [tournamentId, sponsorId, days]);
  if (msg) return <Card title={title}><span style={errStyle}>{msg}</span></Card>;
  if (!d) return <Card title={title}><span style={note}>Loading…</span></Card>;
  const bars = seriesBars(d.series, 320, 64);
  return (
    <Card title={title} subtitle="Every time an advert is shown or tapped on the website">
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>{[7, 14, 30, 90].map((n) => <button key={n} type="button" onClick={() => setDays(n)} style={pill(days === n)}>{n} days</button>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '0.6rem' }}>
        {[['Shown', d.totals.impressions], ['Tapped', d.totals.clicks], ['Tap rate', `${d.totals.ctr}%`], ['Adverts', d.totals.placements]].map(([l, v]) => (
          <div key={l} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.45rem 0.6rem' }}><b style={{ display: 'block', fontSize: '1.2rem' }}>{Number(v).toLocaleString?.('en-IN') ?? v}</b><span style={{ fontSize: '0.72rem', color: '#64748b' }}>{l}</span></div>
        ))}
      </div>
      <svg viewBox="0 0 320 64" width="100%" height="64" role="img" aria-label="Views per day" style={{ display: 'block', backgroundColor: '#f8fafc', borderRadius: 6 }}>
        {bars.map((b) => <rect key={b.day} x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 1)} fill="#16a34a" rx="1"><title>{`${b.day}: ${b.impressions} shown, ${b.clicks} tapped`}</title></rect>)}
      </svg>
      <div style={{ ...note, marginTop: 4 }}>Daily numbers began on {d.tracked_from || 'the first view after this feature went live'}.{d.untracked > 0 ? ` ${Number(d.untracked).toLocaleString('en-IN')} earlier views are in the totals but have no day.` : ''}</div>
      {d.placements.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem', marginTop: '0.6rem' }}>
          <thead><tr>{['Advert', 'Place', 'Shown', 'Tapped', 'Rate', 'Last 7 days'].map((h) => <th key={h} style={{ border: '1px solid #e2e8f0', padding: '0.3rem 0.45rem', textAlign: 'left', backgroundColor: '#f8fafc' }}>{h}</th>)}</tr></thead>
          <tbody>{d.placements.map((a) => (
            <tr key={a.id}>{[`${a.title}${a.is_active ? '' : ' (off)'}`, a.slot.replace(/_/g, ' '), a.impressions, a.clicks, ctrText(a.impressions, a.clicks), a.last_7_impressions].map((v, j) => <td key={j} style={{ border: '1px solid #e2e8f0', padding: '0.3rem 0.45rem' }}>{v}</td>)}</tr>
          ))}</tbody>
        </table>
      )}
    </Card>
  );
}

/* ---------- #379 sponsor reports kept as dated copies ---------- */
export function SponsorSnapshots({ sponsorshipId, onOpen }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => dataService.listSponsorSnapshots(sponsorshipId).then((r) => setRows(r.items)).catch((e) => { setMsg(e.message); setRows([]); });
  useEffect(() => { setRows(null); load(); }, [sponsorshipId]);
  const save = async () => { setBusy(true); setMsg(null); try { const r = await dataService.takeSponsorSnapshot(sponsorshipId); setRows(r.items); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };
  return (
    <div style={{ marginTop: '1.2rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.9rem' }}>Saved reports</strong>
        <span style={{ ...note, flex: 1 }}>A new copy is saved about once a week while the sponsorship is active, and a final one when the tournament ends. Saved copies never change.</span>
        <Button size="sm" variant="secondary" disabled={busy} onClick={save}>Save one now</Button>
      </div>
      {msg && <div style={errStyle}>{msg}</div>}
      {rows === null ? <span style={note}>Loading…</span> : rows.length === 0 ? <div style={{ ...note, marginTop: 4 }}>No saved reports yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => onOpen(r.id)} style={{ textAlign: 'left', display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.45rem', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.83rem' }}>
              <strong style={{ minWidth: 110 }}>{SNAPSHOT_LABEL[r.kind] || r.kind}</strong>
              <span>{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span style={{ color: '#64748b' }}>{r.impressions.toLocaleString('en-IN')} shown · {r.clicks.toLocaleString('en-IN')} tapped · {r.page_views.toLocaleString('en-IN')} page views · {r.matches_played} matches played</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
