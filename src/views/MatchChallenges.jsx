import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Button } from '../components/common/Button.jsx';
import { dataService } from '../services/dataService.js';
import { CHALLENGE_STATUS, challengeProblem } from './teams/squadRules.js';

/** #367 Challenge another team to a friendly. If they accept, the match is created and the sender can score it. */
const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', maxWidth: '100%' };
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function MatchChallenges({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [mine, setMine] = useState([]);
  const [others, setOthers] = useState([]);
  const [form, setForm] = useState({ from: '', to: '', at: '', venue: '', overs: '20', pps: '11', message: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [reply, setReply] = useState({});
  const [teamQuery, setTeamQuery] = useState('');

  const load = useCallback(() => dataService.fetchMyChallenges().then((d) => setItems(d.items || [])).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    dataService.fetchMyTeams().then((t) => setMine(t.filter((x) => x.i_own))).catch(() => setMine([]));
  }, []);
  useEffect(() => {
    const q = teamQuery.trim();
    if (q.length < 2) { setOthers([]); return undefined; }
    let live = true;
    const t = setTimeout(() => { dataService.searchTeams(q).then((r) => { if (live) setOthers(r || []); }).catch(() => { if (live) setOthers([]); }); }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [teamQuery]);
  if (mine.length === 0 && items.length === 0) return null;

  const problem = challengeProblem({ fromTeamId: form.from, toTeamId: form.to, proposedAt: form.at, overs: form.overs, playersPerSide: form.pps });
  const run = async (fn) => { setBusy(true); setErr(null); try { const d = await fn(); setItems(d.items || []); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); } };
  const send = async () => {
    const ok = await run(() => dataService.sendMatchChallenge({ from_team_id: form.from, to_team_id: form.to, proposed_at: new Date(form.at).toISOString(), venue: form.venue, overs: Number(form.overs), players_per_side: Number(form.pps), message: form.message }));
    if (ok) { setShow(false); setForm({ ...form, to: '', at: '', venue: '', message: '' }); }
  };
  const targets = others.filter((t) => t.id !== form.from && !mine.some((m) => m.id === t.id));

  return (
    <Card title="Friendly challenges" subtitle="Challenge another team; the match is created when they accept">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{err}</div>}
      {mine.length > 0 && !show && <Button variant="secondary" onClick={() => setShow(true)}>Challenge a team</Button>}
      {show && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
          <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} style={field}><option value="">My team…</option>{mine.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} placeholder="Search the team to challenge" style={field} />
          <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} style={field}><option value="">{targets.length ? 'Choose the team…' : 'Type 2+ letters to search'}</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.name}{t.city ? ` (${t.city})` : ''}</option>)}</select>
          <input type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} style={field} />
          <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Venue" maxLength={120} style={field} />
          <input value={form.overs} onChange={(e) => setForm({ ...form, overs: e.target.value })} placeholder="Overs" inputMode="numeric" style={field} />
          <input value={form.pps} onChange={(e) => setForm({ ...form, pps: e.target.value })} placeholder="Players a side" inputMode="numeric" style={field} />
          <input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message (optional)" maxLength={300} style={{ ...field, gridColumn: '1 / -1' }} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" disabled={busy || !!problem} onClick={send}>Send challenge</Button>
            <Button variant="secondary" onClick={() => setShow(false)}>Close</Button>
            {problem && form.from && form.to && <span style={{ fontSize: '0.78rem', color: '#b45309' }}>{problem}</span>}
          </div>
        </div>
      )}
      {items.map((c) => {
        const st = CHALLENGE_STATUS[c.status] || CHALLENGE_STATUS.pending;
        return (
          <div key={c.id} style={{ borderTop: '1px solid #f1f5f9', marginTop: '0.6rem', paddingTop: '0.5rem', fontSize: '0.86rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{c.from_team} vs {c.to_team}</strong>
              <span style={{ fontWeight: 700, fontSize: '0.74rem', color: st.color }}>{st.label}</span>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{c.direction === 'sent' ? 'You sent this' : 'Sent to you'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>{when(c.proposed_at)}{c.venue ? ` · ${c.venue}` : ''} · {c.overs} overs · {c.players_per_side} a side</div>
            {c.message && <div style={{ fontSize: '0.8rem', color: '#475569' }}>“{c.message}”</div>}
            {c.response_note && <div style={{ fontSize: '0.8rem', color: '#475569' }}>Reply: “{c.response_note}”</div>}
            {c.can_respond && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                <input value={reply[c.id] || ''} onChange={(e) => setReply({ ...reply, [c.id]: e.target.value })} placeholder="Reply note (optional)" maxLength={200} style={{ ...field, flex: 1, minWidth: 140 }} />
                <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => dataService.respondMatchChallenge(c.id, true, reply[c.id]))}>Accept</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.respondMatchChallenge(c.id, false, reply[c.id]))}>Decline</Button>
              </div>
            )}
            {c.can_cancel && <div style={{ marginTop: '0.3rem' }}><Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.cancelMatchChallenge(c.id))}>Cancel challenge</Button></div>}
            {c.status === 'accepted' && c.match_id && <div style={{ marginTop: '0.3rem' }}><Button size="sm" variant="secondary" onClick={() => onNavigate?.('match-centre', c.match_id)}>Open match</Button></div>}
          </div>
        );
      })}
    </Card>
  );
}

export default MatchChallenges;
