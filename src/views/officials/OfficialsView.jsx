import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Flag, Search, UserCheck, CalendarDays, Star, CheckCircle, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

/**
 * Category F – umpires, scorers and officials.
 * #135 #137 registration (anyone can sign up – open platform), #136 #138 profiles, #140 availability,
 * #141 schedules, #145 payments (earnings), #146 performance history. Assignment (#139), feedback (#142)
 * and disputes (#143) happen on the match page.
 */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROLE = { umpire: 'Umpire', scorer: 'Scorer', third_umpire: 'Third umpire', match_referee: 'Match referee' };
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
const lbl = { fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' };
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date not set');
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function Stars({ value }) {
  if (value === null || value === undefined) return <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No ratings yet</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#ca8a04', fontWeight: 700, fontSize: '0.85rem' }}><Star size={14} fill="#facc15" /> {value}</span>;
}

function FindOfficials({ onNavigate }) {
  const [f, setF] = useState({ kind: '', city: '', date: '', query: '' });
  const [list, setList] = useState(null);
  const search = () => dataService.searchOfficials(f).then(setList).catch(() => setList([]));
  useEffect(() => { search(); }, []);
  return (
    <Card title="Find umpires & scorers">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
        <label style={lbl}>Looking for<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={inp}><option value="">Umpires and scorers</option><option value="umpire">Umpires</option><option value="scorer">Scorers</option></select></label>
        <label style={lbl}>City<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} style={inp} /></label>
        <label style={lbl}>Free on (optional)<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={inp} /></label>
        <label style={lbl}>Name<input value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} style={inp} /></label>
      </div>
      <Button variant="primary" onClick={search} style={{ marginTop: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Search size={14} /> Search</Button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.9rem' }}>
        {list === null ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading…</span> : list.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No officials found. Anyone can sign up from the “My official profile” tab.</span>
          : list.map((o) => (
            <button key={o.user_id} onClick={() => onNavigate && onNavigate('official-profile', o.user_id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{o.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {[o.is_umpire && 'Umpire', o.is_scorer && 'Scorer'].filter(Boolean).join(' & ')}{o.city ? ` · ${o.city}` : ''}{o.experience_years ? ` · ${o.experience_years} yrs` : ''} · {o.matches} match{o.matches === 1 ? '' : 'es'}{o.fee_note ? ` · ${o.fee_note}` : ''}
                </div>
              </div>
              {o.busy_that_day && <span style={{ fontSize: '0.7rem', color: '#b45309' }}>Has a match that day</span>}
              <Stars value={o.rating} />
            </button>
          ))}
      </div>
    </Card>
  );
}

function MyProfile({ profile, onSaved }) {
  const [f, setF] = useState(() => ({ is_umpire: true, is_scorer: true, city: '', experience_years: '', languages: '', fee_note: '', bio: '', available_days: [0, 1, 2, 3, 4, 5, 6], is_active: true, ...(profile || {}) }));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState({ day: '', note: '' });
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await dataService.saveOfficialProfile(f); setMsg({ ok: true, text: profile ? 'Profile saved.' : 'You are now listed as an official. Match owners can invite you.' }); onSaved(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const toggleDay = (d) => setF({ ...f, available_days: f.available_days.includes(d) ? f.available_days.filter((x) => x !== d) : [...f.available_days, d].sort() });
  const setUnavailable = async (day, unavailable, note) => {
    try { await dataService.setOfficialUnavailable(day, unavailable, note); setOff({ day: '', note: '' }); onSaved(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <>
      <Card title={profile ? 'My official profile' : 'Become an umpire or scorer'} subtitle="Open to everyone – no approval needed. A verified-official badge can be requested separately.">
        {msg && <div style={{ marginBottom: '0.6rem', fontSize: '0.84rem', color: msg.ok ? '#065f46' : '#b91c1c', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>{msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />} {msg.text}</div>}
        <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.6rem', fontSize: '0.88rem' }}>
          <label><input type="checkbox" checked={f.is_umpire} onChange={(e) => setF({ ...f, is_umpire: e.target.checked })} /> I umpire</label>
          <label><input type="checkbox" checked={f.is_scorer} onChange={(e) => setF({ ...f, is_scorer: e.target.checked })} /> I score</label>
          {profile && <label><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Show me in search</label>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.6rem' }}>
          <label style={lbl}>City<input value={f.city || ''} maxLength={80} onChange={(e) => setF({ ...f, city: e.target.value })} style={inp} /></label>
          <label style={lbl}>Years of experience<input type="number" min="0" max="60" value={f.experience_years ?? ''} onChange={(e) => setF({ ...f, experience_years: e.target.value })} style={inp} /></label>
          <label style={lbl}>Languages<input value={f.languages || ''} maxLength={120} onChange={(e) => setF({ ...f, languages: e.target.value })} style={inp} placeholder="e.g. Hindi, Telugu, English" /></label>
          <label style={lbl}>Fee (shown to organisers)<input value={f.fee_note || ''} maxLength={120} onChange={(e) => setF({ ...f, fee_note: e.target.value })} style={inp} placeholder="e.g. ₹500 per match" /></label>
        </div>
        <label style={{ ...lbl, marginTop: '0.6rem' }}>About me<textarea rows={3} maxLength={600} value={f.bio || ''} onChange={(e) => setF({ ...f, bio: e.target.value })} style={{ ...inp, resize: 'vertical' }} /></label>
        <div style={{ marginTop: '0.6rem' }}>
          <div style={lbl}>Usually available on</div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => toggleDay(i)} style={{ padding: '0.3rem 0.6rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.78rem',
                border: `1px solid ${f.available_days.includes(i) ? '#16a34a' : '#e2e8f0'}`, backgroundColor: f.available_days.includes(i) ? '#dcfce7' : '#fff' }}>{d}</button>
            ))}
          </div>
        </div>
        <Button variant="primary" disabled={busy || (!f.is_umpire && !f.is_scorer)} onClick={save} style={{ marginTop: '0.8rem' }}>{busy ? 'Saving…' : profile ? 'Save profile' : 'Sign up as an official'}</Button>
      </Card>

      {profile && (
        <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><CalendarDays size={16} /> Days I can’t make it</span>}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ ...lbl, width: 170 }}>Date<input type="date" value={off.day} onChange={(e) => setOff({ ...off, day: e.target.value })} style={inp} /></label>
            <label style={{ ...lbl, flex: 1, minWidth: 160 }}>Note (only you see it)<input value={off.note} maxLength={120} onChange={(e) => setOff({ ...off, note: e.target.value })} style={inp} /></label>
            <Button variant="secondary" disabled={!off.day} onClick={() => setUnavailable(off.day, true, off.note)}>Add</Button>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
            {(profile.unavailable || []).length === 0 ? <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No days blocked.</span> : profile.unavailable.map((u) => (
              <span key={u.day} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.6rem', borderRadius: '999px', backgroundColor: '#fef2f2', fontSize: '0.78rem' }}>
                {new Date(u.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{u.note ? ` – ${u.note}` : ''}
                <button onClick={() => setUnavailable(u.day, false)} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function MySchedule({ data, reload, onNavigate }) {
  const [msg, setMsg] = useState(null);
  const act = async (fn) => { try { await fn(); reload(); } catch (e) { setMsg(e.message); } };
  const list = data?.assignments || [];
  const upcoming = list.filter((a) => a.match_status === 'scheduled' || a.match_status === 'live');
  const past = list.filter((a) => !upcoming.includes(a));
  const row = (a) => (
    <div key={a.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.55rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', flexWrap: 'wrap',
                             backgroundColor: a.status === 'invited' ? '#fffbeb' : '#fff' }}>
      <div style={{ flex: 1, minWidth: 200, cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('match-centre', a.match_id)}>
        <div style={{ fontWeight: 700 }}>{a.teams}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ROLE[a.role]} · {when(a.scheduled_at)}{a.venue ? ` · ${a.venue}` : ''}{a.tournament ? ` · ${a.tournament}` : ''}</div>
        {a.result && <div style={{ fontSize: '0.75rem', color: '#065f46' }}>{a.result}</div>}
      </div>
      {a.fee != null && <span style={{ fontSize: '0.8rem', color: a.paid ? '#15803d' : '#b45309' }}>{money(a.fee)} {a.paid ? 'paid' : 'unpaid'}</span>}
      {a.status === 'invited' && <>
        <Button size="sm" variant="primary" onClick={() => act(() => dataService.respondOfficialInvite(a.id, true))}>Accept</Button>
        <Button size="sm" variant="secondary" onClick={() => act(() => dataService.respondOfficialInvite(a.id, false))}>Decline</Button>
      </>}
      {a.status === 'accepted' && a.match_status === 'scheduled' && <Button size="sm" variant="secondary" onClick={() => window.confirm('Withdraw from this match? The match owner will be told.') && act(() => dataService.cancelOfficial(a.id))}>Withdraw</Button>}
      {a.status === 'declined' && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Declined</span>}
    </div>
  );
  return (
    <>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{msg}</div>}
      <Card title="My schedule">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>{upcoming.length ? upcoming.map(row) : <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No upcoming matches.</span>}</div>
      </Card>
      <Card title="Earnings">
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
          <span>Paid <strong style={{ color: '#15803d' }}>{money(data?.earnings?.paid)}</strong></span>
          <span>Due <strong style={{ color: '#b45309' }}>{money(data?.earnings?.due)}</strong></span>
        </div>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Fees are recorded by the match owner. Payments happen outside the website.</p>
      </Card>
      {past.length > 0 && <Card title="Past matches"><div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>{past.map(row)}</div></Card>}
    </>
  );
}

export function OfficialsView({ currentUser, onNavigate }) {
  const [tab, setTab] = useState('find');
  const [mine, setMine] = useState(null);
  const load = () => (currentUser ? dataService.myOfficialSchedule().then(setMine).catch(() => setMine(null)) : setMine(null));
  useEffect(() => { load(); }, [currentUser?.id]);
  const invites = (mine?.assignments || []).filter((a) => a.status === 'invited' && a.match_status !== 'completed').length;
  const tabs = [['find', 'Find officials'], ...(currentUser ? [['profile', 'My official profile'], ['schedule', `My schedule${invites ? ` (${invites} new)` : ''}`]] : [])];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Flag size={22} /> Umpires & scorers</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Find officials for your matches, or sign up to umpire and score.</p>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {tabs.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: '0.5rem 0.9rem', border: 'none', borderBottom: `3px solid ${tab === v ? '#059669' : 'transparent'}`, background: 'none', cursor: 'pointer', fontWeight: 700, color: tab === v ? '#065f46' : '#64748b' }}>{l}</button>
        ))}
      </div>
      {!currentUser && <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>Sign in to sign up as an official or see your schedule.</p>}
      {tab === 'find' && <FindOfficials onNavigate={onNavigate} />}
      {tab === 'profile' && currentUser && <MyProfile key={mine?.profile ? 'p' : 'n'} profile={mine?.profile || null} onSaved={load} />}
      {tab === 'schedule' && currentUser && <MySchedule data={mine} reload={load} onNavigate={onNavigate} />}
    </div>
  );
}

/** #136 #138 #146 Public official profile with performance history. */
export function OfficialProfileView({ userId, onNavigate }) {
  const [p, setP] = useState(undefined);
  useEffect(() => { dataService.getOfficialProfile(userId).then(setP).catch(() => setP(null)); }, [userId]);
  const back = <button onClick={() => onNavigate && onNavigate('officials')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}><ArrowLeft size={15} /> Umpires & scorers</button>;
  if (p === undefined) return <div style={{ color: '#64748b' }}>Loading…</div>;
  if (!p) return <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{back}<Card><p style={{ margin: 0 }}>This person is not registered as an official.</p></Card></div>;
  const s = p.stats || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {back}
      <div style={{ padding: '1.4rem', backgroundColor: '#0f172a', borderRadius: '0.75rem', color: '#fff' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{p.name} {p.verified && <ShieldCheck size={20} style={{ color: '#4ade80' }} />}</h2>
        <div style={{ color: '#cbd5e1', fontSize: '0.88rem', marginTop: '0.25rem' }}>
          {[p.is_umpire && 'Umpire', p.is_scorer && 'Scorer'].filter(Boolean).join(' & ')}{p.city ? ` · ${p.city}` : ''}{p.experience_years ? ` · ${p.experience_years} years` : ''}{p.languages ? ` · ${p.languages}` : ''}
        </div>
        {p.fee_note && <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Fee: {p.fee_note}</div>}
        <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '0.3rem' }}>Usually available: {(p.available_days || []).map((d) => DAYS[d]).join(', ') || '—'}</div>
      </div>
      {p.bio && <Card title="About"><p style={{ margin: 0, fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{p.bio}</p></Card>}
      <Card title="Performance">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
          {[['Matches', s.matches], ['As umpire', s.as_umpire], ['As scorer', s.as_scorer], ['Upcoming', s.upcoming], ['Rating', s.rating != null ? `${s.rating} ★ (${s.ratings})` : '–'], ['Reports filed', s.decisions_logged], ['Disputes', s.disputes]].map(([k, v]) => (
            <div key={k} style={{ padding: '0.55rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>{k}</div><div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{v ?? 0}</div>
            </div>
          ))}
        </div>
        {(p.recent_feedback || []).length > 0 && (
          <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {p.recent_feedback.map((f, i) => <div key={i} style={{ fontSize: '0.84rem' }}><Stars value={f.rating} /> <span style={{ color: '#334155' }}>“{f.comment}”</span></div>)}
          </div>
        )}
      </Card>
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><UserCheck size={16} /> Match history</span>}>
        {(p.history || []).length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No matches yet.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {p.history.map((h) => (
              <button key={h.match_id + h.role} onClick={() => onNavigate && onNavigate('match-centre', h.match_id)} style={{ display: 'flex', gap: '0.6rem', padding: '0.45rem 0.6rem', border: '1px solid #f1f5f9', borderRadius: '0.45rem', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '0.84rem' }}>
                <span style={{ flex: 1 }}><strong>{h.teams}</strong> <span style={{ color: '#64748b' }}>· {ROLE[h.role]} · {h.date ? new Date(h.date).toLocaleDateString('en-IN') : ''}</span></span>
                {h.rating != null && <Stars value={h.rating} />}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default OfficialsView;
