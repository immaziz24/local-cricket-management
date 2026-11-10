import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ClipboardList, AlertTriangle, ShieldAlert, Gavel, CheckCircle, RotateCcw } from 'lucide-react';

/**
 * #126 Match decision log, #127 incident reports, #128 disciplinary reports (+ #124 time-wasting warnings).
 * Decisions are public. Incidents and disciplinary reports are seen by the match officials, the organiser,
 * admins and the two team owners. Penalty runs and Super Overs are logged here automatically.
 */
const KINDS = {
  decision: { label: 'Decision', icon: Gavel, color: '#2563eb', bg: '#eff6ff' },
  incident: { label: 'Incident', icon: AlertTriangle, color: '#b45309', bg: '#fffbeb' },
  disciplinary: { label: 'Disciplinary', icon: ShieldAlert, color: '#b91c1c', bg: '#fef2f2' }
};
const ACTIONS = { none: 'No action', warning: 'Warning', penalty_runs: 'Penalty runs', suspension: 'Suspension', referred: 'Referred to organiser' };
const QUICK = {
  decision: ['Umpire decision changed', 'Dead ball called', 'Short run – run not counted', 'Overthrow runs added', 'Bad light / rain stoppage'],
  incident: ['Time-wasting', 'Ground / pitch problem', 'Injury', 'Equipment problem', 'Crowd trouble'],
  disciplinary: ['Abusive language', 'Dissent at umpire decision', 'Time-wasting (repeated)', 'Physical contact', 'Damage to equipment']
};
const field = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', backgroundColor: '#fff' };

export function MatchReportsPanel({ matchId, refreshKey }) {
  const [d, setD] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => dataService.fetchMatchReports(matchId).then(setD).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [matchId, refreshKey]);
  useEffect(() => {
    dataService.fetchMatchLineups(matchId).then((l) => {
      const ts = l?.teams || [];
      setTeams(ts.map((t) => ({ id: t.team_id, name: t.name })));
      setPlayers(ts.flatMap((t) => (t.lineup || []).map((p) => ({ id: p.player_id, name: `${p.name} (${t.short_name || t.name})` }))));
    }).catch(() => {});
  }, [matchId]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await dataService.addMatchReport(matchId, form);
      setForm(null); await load(); setMsg({ ok: true, text: 'Saved.' });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const toggle = async (r) => {
    const note = r.status === 'open' ? window.prompt('Closing note (optional):', '') : null;
    if (note === null && r.status === 'open') return;
    try { await dataService.closeMatchReport(r.id, note); await load(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  if (!d) return <Card><p style={{ margin: 0, fontSize: '0.85rem', color: msg ? '#b91c1c' : '#64748b' }}>{msg ? msg.text : 'Loading…'}</p></Card>;
  const list = d.reports.filter((r) => filter === 'all' || r.kind === filter);

  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardList size={17} /> Match reports</span>}
      subtitle={d.can_see_private ? 'Decisions, incidents and disciplinary reports' : 'Umpire and scorer decisions (incident and disciplinary reports are private)'}
      action={d.can_add && !form ? <Button size="sm" variant="primary" onClick={() => { setForm({ kind: 'decision', title: '', details: '', action: 'none', player_id: '', team_id: '' }); setMsg(null); }}>Add report</Button> : null}>
      {msg && <div style={{ marginBottom: '0.6rem', fontSize: '0.83rem', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.text}</div>}

      {form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.6rem', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {Object.entries(KINDS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, kind: k, action: k === 'decision' ? 'none' : form.action })}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                         border: `1px solid ${form.kind === k ? v.color : '#e2e8f0'}`, backgroundColor: form.kind === k ? v.bg : '#fff', color: form.kind === k ? v.color : '#475569' }}>
                {v.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {QUICK[form.kind].map((q) => (
              <button key={q} type="button" onClick={() => setForm({ ...form, title: q })}
                style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', border: '1px dashed #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.72rem', color: '#475569' }}>{q}</button>
            ))}
          </div>
          <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={field} />
          <textarea rows={3} maxLength={2000} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="What happened? (optional)" style={{ ...field, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <select value={form.player_id} onChange={(e) => setForm({ ...form, player_id: e.target.value })} style={field}>
              <option value="">Player (optional)</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} style={field}>
              <option value="">Team (optional)</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {form.kind !== 'decision' && (
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} style={field}>
                {['none', 'warning', 'suspension', 'referred'].map((a) => <option key={a} value={a}>{ACTIONS[a]}</option>)}
              </select>
            )}
            {form.action === 'suspension' && (
              <input type="number" min="1" max="50" value={form.suspension_matches || ''} onChange={(e) => setForm({ ...form, suspension_matches: e.target.value })} placeholder="Matches" style={{ ...field, width: 100 }} />
            )}
          </div>
          {form.kind !== 'decision' && <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>The team owner, the organiser and the player (if registered) are notified of disciplinary reports, warnings and suspensions. Penalty runs are given from the Live tab (More options).</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" disabled={busy || form.title.trim().length < 2} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        {['all', 'decision', ...(d.can_see_private ? ['incident', 'disciplinary'] : [])].map((k) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', cursor: 'pointer',
            border: '1px solid ' + (filter === k ? '#16a34a' : '#e2e8f0'), backgroundColor: filter === k ? '#dcfce7' : '#fff' }}>
            {k === 'all' ? 'All' : KINDS[k].label}
          </button>
        ))}
      </div>

      {list.length === 0 ? <p style={{ margin: 0, fontSize: '0.83rem', color: '#94a3b8' }}>Nothing recorded.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {list.map((r) => {
            const K = KINDS[r.kind]; const Icon = K.icon;
            return (
              <div key={r.id} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', backgroundColor: K.bg, borderLeft: `4px solid ${K.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.88rem' }}>
                    <Icon size={15} style={{ color: K.color }} /> {r.title}
                    {r.kind !== 'decision' && <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: '999px', backgroundColor: r.status === 'open' ? '#fde68a' : '#d1fae5' }}>{r.status}</span>}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {r.innings_no ? `Inns ${r.innings_no}${r.over ? ` · ${r.over} ov` : ''} · ` : ''}{new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.2rem' }}>
                  {[r.player, r.team, r.action !== 'none' && (r.action === 'suspension' ? `Suspension: ${r.suspension_matches} match(es)` : r.action === 'penalty_runs' ? `${r.penalty_runs} penalty runs` : ACTIONS[r.action])].filter(Boolean).join(' · ')}
                </div>
                {r.details && <div style={{ fontSize: '0.82rem', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{r.details}</div>}
                {r.closing_note && <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: '#065f46' }}>Closed: {r.closing_note}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.by ? `by ${r.by}` : ''}</span>
                  {d.can_add && r.kind !== 'decision' && (
                    <button onClick={() => toggle(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      {r.status === 'open' ? <><CheckCircle size={13} /> Close</> : <><RotateCcw size={13} /> Re-open</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default MatchReportsPanel;
