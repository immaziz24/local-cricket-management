import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  ROLE_OPTIONS, LEVELS, APPLICATION_STATUS, REPORT_REASONS, validateRecruitPost, slotsText, applicationSummary, applicationActions,
  validateApplication, validateReport, validateModeration, moderationLine
} from './recruitment.js';

const inp = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.84rem', maxWidth: '100%' };

/** #370 A small report form for any post or listing. */
export function ReportButton({ type, id }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ reason: 'spam', details: '' });
  const [msg, setMsg] = useState(null);
  const send = async () => {
    const bad = validateReport(f.reason, f.details);
    if (bad) { setMsg({ err: bad }); return; }
    try { await dataService.reportCommunityItem(type, id, f.reason, f.details); setMsg({ ok: 'Thanks. An admin will look at it.' }); setOpen(false); } catch (e) { setMsg({ err: e.message }); }
  };
  if (msg?.ok) return <span style={{ fontSize: '0.78rem', color: '#15803d' }}>{msg.ok}</span>;
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Report</Button>;
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.3rem' }}>
      <select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} style={inp}>{REPORT_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input placeholder="Details (optional)" maxLength={500} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} style={{ ...inp, width: 200 }} />
      <Button size="sm" variant="primary" onClick={send}>Send report</Button>
      <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      {msg?.err && <span style={{ color: '#b91c1c', fontSize: '0.78rem' }}>{msg.err}</span>}
    </div>
  );
}

function PostForm({ onSaved, onCancel }) {
  const [f, setF] = useState({ title: '', body: '', city: '', slots: 1, level: 'any', roles: [] });
  const [err, setErr] = useState(null);
  const toggle = (r) => setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });
  const save = async () => {
    const bad = validateRecruitPost(f);
    if (bad) { setErr(bad); return; }
    try { await dataService.saveRecruitmentPost(null, { ...f, slots: Number(f.slots) }); onSaved(); } catch (e) { setErr(e.message); }
  };
  return (
    <Card title="Recruit players">
      <input placeholder="Title, e.g. Need 2 fast bowlers for Sunday league" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
      <textarea rows={3} maxLength={2000} placeholder="Details: ground, timing, what you offer" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ ...inp, width: '100%', marginTop: '0.5rem', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <input placeholder="City" maxLength={80} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} style={{ ...inp, width: 140 }} />
        <label style={{ fontSize: '0.82rem' }}>Players needed <input type="number" min="1" max="30" value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })} style={{ ...inp, width: 70 }} /></label>
        <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} style={inp}>{LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {ROLE_OPTIONS.map((r) => <label key={r} style={{ fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: 999, padding: '0.15rem 0.55rem', background: f.roles.includes(r) ? '#d1fae5' : '#fff' }}><input type="checkbox" checked={f.roles.includes(r)} onChange={() => toggle(r)} style={{ marginRight: 4 }} />{r}</label>)}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center' }}>
        <Button variant="primary" onClick={save}>Post</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        {err && <span style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{err}</span>}
      </div>
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Posts close after 30 days or when all places are filled. Accepting a player does not add them to a squad. Do that from the team page.</p>
    </Card>
  );
}

function Applications({ post, onChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { dataService.listRecruitmentApplications(post.id).then(setD).catch((e) => setErr(e.message)); }, [post.id, post.filled]);
  if (err) return <div style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{err}</div>;
  if (!d) return null;
  const decide = async (a, action) => {
    let note = '';
    if (action === 'decline') { note = window.prompt('Note for the player (optional):', ''); if (note === null) return; }
    try { setD(await dataService.decideRecruitmentApplication(a.id, action, note)); onChanged(); } catch (e) { setErr(e.message); }
  };
  return (
    <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.3rem' }}>{applicationSummary(d.items)}</div>
      {d.items.map((a) => {
        const st = APPLICATION_STATUS[a.status] || { label: a.status, color: '#475569' };
        return (
          <div key={a.id} style={{ fontSize: '0.84rem', padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}><strong>{a.name}{a.player ? ` · ${a.player.role || 'player'}` : ''}</strong><strong style={{ color: st.color }}>{st.label}</strong></div>
            {a.message && <div style={{ color: '#475569' }}>{a.message}</div>}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
              {d.can_run && applicationActions(a, post).map((act) => <Button key={act} size="sm" variant={act === 'accept' ? 'primary' : 'secondary'} onClick={() => decide(a, act)}>{act === 'shortlist' ? 'Shortlist' : act === 'accept' ? 'Accept' : 'Decline'}</Button>)}
              {a.is_me && ['applied', 'shortlisted'].includes(a.status) && <Button size="sm" variant="secondary" onClick={async () => { try { setD(await dataService.withdrawRecruitmentApplication(a.id)); } catch (e) { setErr(e.message); } }}>Withdraw</Button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** #368 Players-wanted posts with open places, roles and level, applications and decisions. */
export function RecruitmentBoard({ signedIn }) {
  const [f, setF] = useState({ city: '', role: '', level: '', mine: false });
  const [list, setList] = useState(null);
  const [form, setForm] = useState(false);
  const [apply, setApply] = useState(null);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => dataService.listRecruitmentPosts(f).then(setList).catch((e) => { setList([]); setMsg(e.message); }), [f.city, f.role, f.level, f.mine]);
  useEffect(() => { load(); }, [f.role, f.level, f.mine]);
  const sendApply = async () => {
    const bad = validateApplication(apply.message);
    if (bad) { setMsg(bad); return; }
    try { await dataService.applyToRecruitment(apply.id, apply.message, null); setApply(null); setMsg(null); load(); } catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 130 }} />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} style={inp}><option value="">Any role</option>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} style={inp}><option value="">Any level</option>{LEVELS.slice(1).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <Button variant="secondary" onClick={load}>Search</Button>
        {signedIn && <label style={{ fontSize: '0.84rem' }}><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} /> My posts</label>}
        {signedIn && !form && <Button variant="primary" onClick={() => setForm(true)}>Recruit players</Button>}
      </div>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{msg}</div>}
      {form && <PostForm onSaved={() => { setForm(false); load(); }} onCancel={() => setForm(false)} />}
      {list === null ? <div style={{ color: '#64748b' }}>Loading…</div> : list.length === 0 ? <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.86rem' }}>No recruitment posts yet.</p></Card> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {list.map((p) => (
            <Card key={p.id}>
              <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700 }}>{slotsText(p)}{p.city ? ` · ${p.city}` : ''}{p.level && p.level !== 'any' ? ` · ${p.level}` : ''}{p.status === 'closed' ? ' · CLOSED' : ''}{p.hidden ? ' · HIDDEN BY ADMIN' : ''}</div>
              <div style={{ fontWeight: 800 }}>{p.title}</div>
              {p.roles?.length > 0 && <div style={{ fontSize: '0.78rem', color: '#475569' }}>Looking for: {p.roles.join(', ')}</div>}
              {p.body && <p style={{ margin: '0.3rem 0 0', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>{p.body}</p>}
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.3rem' }}>by {p.author}{p.team ? ` (${p.team.name})` : ''}{p.can_run ? ` · ${p.applications} application${p.applications === 1 ? '' : 's'}` : ''}</div>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {p.can_run ? <Button size="sm" variant="secondary" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide applications' : 'View applications'}</Button>
                  : p.my_application ? <strong style={{ fontSize: '0.8rem', color: (APPLICATION_STATUS[p.my_application.status] || {}).color }}>You: {(APPLICATION_STATUS[p.my_application.status] || {}).label}</strong>
                  : signedIn && p.status === 'open' && p.slots_left > 0 ? (apply?.id === p.id ? null : <Button size="sm" variant="primary" onClick={() => setApply({ id: p.id, message: '' })}>Apply</Button>) : null}
                {signedIn && !p.is_mine && <ReportButton type="post" id={p.id} />}
              </div>
              {apply?.id === p.id && (
                <div style={{ marginTop: '0.4rem' }}>
                  <textarea rows={2} maxLength={500} placeholder="Tell them about yourself: role, experience, availability" value={apply.message} onChange={(e) => setApply({ ...apply, message: e.target.value })} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}><Button size="sm" variant="primary" onClick={sendApply}>Send application</Button><Button size="sm" variant="secondary" onClick={() => setApply(null)}>Cancel</Button></div>
                </div>
              )}
              {open === p.id && <Applications post={p} onChanged={load} />}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/** #370 Admin queue of reported posts and listings. */
export function ModerationQueueCard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => dataService.listModerationQueue('open').then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const act = async (it, action) => {
    let note = '';
    if (action === 'hide') { note = window.prompt('Reason for hiding it (the owner will see this):', ''); if (note === null) return; }
    const bad = validateModeration(action, note);
    if (bad) { setErr(bad); return; }
    try { setD(await dataService.decideModeration(it.target_type, it.target_id, action, note)); setErr(null); } catch (e) { setErr(e.message); }
  };
  if (!d && !err) return null;
  return (
    <Card title="Reported posts and listings" subtitle={d ? (d.items.length ? `${d.items.length} waiting for review. An item is hidden automatically after 3 different people report it.` : 'Nothing waiting.') : ''}>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{err}</div>}
      {(d?.items || []).map((it) => (
        <div key={`${it.target_type}-${it.target_id}`} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', marginBottom: '0.5rem', fontSize: '0.84rem' }}>
          <div><strong>{it.title || '(removed)'}</strong> <span style={{ color: '#94a3b8' }}>· {it.target_type === 'post' ? 'board post' : 'directory listing'} · by {it.owner}</span></div>
          <div style={{ color: '#b45309' }}>{moderationLine(it)}</div>
          {it.preview && <div style={{ color: '#475569', marginTop: '0.2rem' }}>{it.preview}</div>}
          {(it.details || []).length > 0 && <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem', color: '#64748b' }}>{it.details.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
            {!it.hidden && <Button size="sm" variant="primary" onClick={() => act(it, 'hide')}>Hide</Button>}
            {it.hidden && <Button size="sm" variant="secondary" onClick={() => act(it, 'restore')}>Restore</Button>}
            <Button size="sm" variant="secondary" onClick={() => act(it, 'dismiss')}>Dismiss reports</Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
