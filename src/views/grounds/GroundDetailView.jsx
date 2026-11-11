import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowLeft, MapPin, Phone, Pencil, Camera, Trash2, Star, ChevronLeft, ChevronRight, ClipboardCheck, Sprout, History, ExternalLink } from 'lucide-react';
import { GroundForm, FACILITIES, PITCH_TYPES, money, slotTime, inp, lbl } from './groundShared.jsx';

/**
 * Category G ground profile: #148 profile, #149 photos, #150 map, #151 pitch, #152 boundary, #153 facilities,
 * #154 booking, #155 availability calendar, #156 charges, #157 pitch preparation, #158 inspections, #159 match history.
 */
const WORK = [['rolled', 'Rolled'], ['watered', 'Watered'], ['mowed', 'Mowed'], ['covered', 'Covered'], ['marked', 'Lines marked'], ['repaired', 'Repaired'], ['rested', 'Rested'], ['dried', 'Dried']];
const ymd = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ist = (date, time) => new Date(`${date}T${time}:00+05:30`).toISOString();

function Calendar({ groundId, isOwner, signedIn, ground, onChanged }) {
  const [start, setStart] = useState(() => new Date());
  const [cal, setCal] = useState(null);
  const [form, setForm] = useState({ date: ymd(new Date()), from: '09:00', to: '12:00', title: '', note: '', block: false });
  const [msg, setMsg] = useState(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const load = () => dataService.getGroundCalendar(groundId, ymd(days[0]), ymd(days[6])).then(setCal).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [groundId, ymd(start)]);
  const book = async () => {
    setMsg(null);
    try {
      const r = await dataService.requestGroundBooking(groundId, { starts_at: ist(form.date, form.from), ends_at: ist(form.date, form.to), title: form.title, note: form.note, block: form.block });
      setMsg({ ok: true, text: r.status === 'confirmed' ? (form.block ? 'Slot blocked.' : 'Booked.') : 'Request sent – the ground owner will confirm it.' });
      setForm({ ...form, title: '', note: '' }); load(); onChanged && onChanged();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const act = async (id, action) => {
    const note = action === 'reject' ? window.prompt('Reason (optional):', '') : '';
    if (note === null) return;
    try { await dataService.decideGroundBooking(id, action, note); load(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const hours = (() => {
    const [a, b] = [form.from, form.to].map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; });
    return b > a ? Math.ceil((b - a) / 30) / 2 : 0;
  })();
  const estimate = (() => {
    let amt = ground.hourly_rate != null ? hours * Number(ground.hourly_rate) : null;
    if (hours >= 8 && ground.full_day_rate != null) amt = Math.min(amt ?? Infinity, Number(ground.full_day_rate));
    else if (hours >= 4 && ground.half_day_rate != null) amt = Math.min(amt ?? Infinity, Number(ground.half_day_rate));
    if (amt != null && ground.night_extra != null && form.to > '18:30') amt += Number(ground.night_extra);
    return amt;
  })();
  return (
    <Card title="Availability & booking (#154, #155)" subtitle={cal && cal.open_time ? `Open ${String(cal.open_time).slice(0, 5)}–${String(cal.close_time || '').slice(0, 5)}` : null}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <button onClick={() => setStart(addDays(start, -7))} aria-label="Previous week" style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}><ChevronLeft size={16} /></button>
        <strong style={{ fontSize: '0.86rem' }}>{days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>
        <button onClick={() => setStart(addDays(start, 7))} aria-label="Next week" style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '0.4rem' }}>
        {days.map((d) => {
          const key = ymd(d);
          const slots = (cal?.slots || []).filter((s) => ymd(new Date(s.starts_at)) === key);
          return (
            <div key={key} onClick={() => setForm({ ...form, date: key })} style={{ border: `1px solid ${form.date === key ? '#16a34a' : '#e2e8f0'}`, borderRadius: '0.5rem', padding: '0.4rem', minHeight: 80, cursor: 'pointer' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</div>
              {slots.length === 0 ? <div style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: 4 }}>Free</div> : slots.map((s) => (
                <div key={s.id} title={[s.booked_by, s.note].filter(Boolean).join(' – ')} style={{ marginTop: 4, fontSize: '0.68rem', padding: '0.2rem 0.3rem', borderRadius: 4,
                  backgroundColor: s.status === 'requested' ? '#fef3c7' : s.kind === 'blocked' ? '#e2e8f0' : s.mine ? '#dbeafe' : '#fee2e2' }}>
                  {new Date(s.starts_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}–{new Date(s.ends_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  <div style={{ fontWeight: 700 }}>{s.status === 'requested' ? 'Waiting · ' : ''}{s.title || 'Booked'}</div>
                  {isOwner && s.status === 'requested' && <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    <button onClick={(e) => { e.stopPropagation(); act(s.id, 'confirm'); }} style={{ fontSize: '0.65rem', cursor: 'pointer' }}>✓</button>
                    <button onClick={(e) => { e.stopPropagation(); act(s.id, 'reject'); }} style={{ fontSize: '0.65rem', cursor: 'pointer' }}>✕</button>
                  </div>}
                  {isOwner && s.status === 'confirmed' && s.kind === 'booking' && (
                    <button onClick={(e) => { e.stopPropagation(); act(s.id, s.paid ? 'unpaid' : 'paid'); }} style={{ fontSize: '0.62rem', cursor: 'pointer', marginTop: 2 }}>{s.paid ? 'Paid ✓' : 'Mark paid'}</button>
                  )}
                  {(isOwner || s.mine) && s.status === 'confirmed' && <button onClick={(e) => { e.stopPropagation(); window.confirm('Cancel this slot?') && act(s.id, 'cancel'); }} style={{ fontSize: '0.62rem', cursor: 'pointer', marginLeft: 4 }}>Cancel</button>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {signedIn ? (ground.booking_open || isOwner ? (
        <div style={{ marginTop: '0.9rem', padding: '0.7rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
            <label style={lbl}>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inp} /></label>
            <label style={lbl}>From<input type="time" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} style={inp} /></label>
            <label style={lbl}>To<input type="time" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} style={inp} /></label>
            <label style={lbl}>What for<input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inp} placeholder="e.g. League match" /></label>
          </div>
          <label style={{ ...lbl, marginTop: '0.5rem' }}>Message to the owner<input value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inp} /></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
            <Button variant="primary" disabled={!hours} onClick={book}>{isOwner ? (form.block ? 'Block slot' : 'Add booking') : 'Request booking'}</Button>
            {isOwner && <label style={{ fontSize: '0.82rem' }}><input type="checkbox" checked={form.block} onChange={(e) => setForm({ ...form, block: e.target.checked })} /> Block (maintenance / not available)</label>}
            {!form.block && <span style={{ fontSize: '0.84rem', color: '#475569' }}>{hours} hr{hours === 1 ? '' : 's'}{estimate != null ? ` · about ${money(estimate)}` : ''}</span>}
          </div>
          {msg && <div style={{ marginTop: '0.5rem', fontSize: '0.84rem', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.text}</div>}
        </div>
      ) : <p style={{ margin: '0.8rem 0 0', fontSize: '0.84rem', color: '#64748b' }}>This ground is not taking bookings right now.</p>)
        : <p style={{ margin: '0.8rem 0 0', fontSize: '0.84rem', color: '#64748b' }}>Sign in to book a slot.</p>}
    </Card>
  );
}

function Rating({ label, value }) {
  return <span style={{ fontSize: '0.8rem' }}>{label} {value ? <strong>{value}★</strong> : '–'}</span>;
}

export function GroundDetailView({ groundId, currentUser, onNavigate }) {
  const [d, setD] = useState(undefined);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [photo, setPhoto] = useState({ file: null, caption: '' });
  const [log, setLog] = useState(null);
  const [insp, setInsp] = useState(null);
  const load = () => dataService.getGround(groundId).then(setD).catch((e) => { setD(null); setMsg(e.message); });
  useEffect(() => { load(); }, [groundId]);
  const run = async (fn, after) => { setMsg(null); try { const r = await fn(); if (r && r.ground) setD(r); else load(); after && after(); } catch (e) { setMsg(e.message); } };
  const back = <button onClick={() => onNavigate && onNavigate('grounds')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}><ArrowLeft size={15} /> Grounds</button>;
  if (d === undefined) return <div style={{ color: '#64748b' }}>Loading…</div>;
  if (!d) return <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{back}<Card><p style={{ margin: 0 }}>{msg || 'Ground not found.'}</p></Card></div>;
  const g = d.ground; const own = d.is_owner; const s = d.stats || {};
  const hasMap = g.latitude != null && g.longitude != null;
  const lat = Number(g.latitude); const lng = Number(g.longitude);

  if (editing) return <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{back}<GroundForm ground={g} onCancel={() => setEditing(false)} onSaved={(x) => { setD(x); setEditing(false); }} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {back}
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{msg}</div>}
      <div style={{ borderRadius: '0.9rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ height: 180, background: g.cover_url ? `center/cover no-repeat url(${g.cover_url})` : 'linear-gradient(135deg,#166534,#4ade80)' }} />
        <div style={{ padding: '1rem 1.2rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', backgroundColor: '#fff' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{g.name}</h2>
            <div style={{ color: '#64748b', fontSize: '0.86rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {[g.address, g.city].filter(Boolean).join(', ') || 'Address not added'}</span>
              {g.contact_phone && <a href={`tel:${g.contact_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563eb' }}><Phone size={14} /> {g.contact_phone}</a>}
              <span>Listed by {d.owner_name || '—'}</span>
            </div>
          </div>
          {own && <Button variant="secondary" onClick={() => setEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-start' }}><Pencil size={14} /> Edit ground</Button>}
        </div>
      </div>

      {g.description && <Card><p style={{ margin: 0, fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{g.description}</p></Card>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <Card title="Pitch & boundary (#151, #152)">
          <div style={{ fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span>Pitch: <strong>{(PITCH_TYPES.find((p) => p[0] === g.pitch_type) || [null, 'Not set'])[1]}</strong>{g.pitch_count ? ` · ${g.pitch_count} pitch${g.pitch_count > 1 ? 'es' : ''}` : ''}</span>
            {g.pitch_notes && <span style={{ color: '#475569' }}>{g.pitch_notes}</span>}
            <span>Boundary: <strong>{g.boundary_straight_m ? `${g.boundary_straight_m} m straight` : '—'}{g.boundary_square_m ? ` · ${g.boundary_square_m} m square` : ''}</strong></span>
            {g.boundary_notes && <span style={{ color: '#475569' }}>{g.boundary_notes}</span>}
          </div>
        </Card>
        <Card title="Facilities (#153)">
          {(g.facilities || []).length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>Not listed.</span> : (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>{g.facilities.map((x) => <span key={x} style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', backgroundColor: '#f0fdf4', fontSize: '0.78rem' }}>{(FACILITIES.find((f) => f[0] === x) || [x, x])[1]}</span>)}</div>
          )}
        </Card>
        <Card title="Charges (#156)">
          <div style={{ fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span>Per hour: <strong>{money(g.hourly_rate)}</strong></span>
            <span>Half day (4+ hrs): <strong>{money(g.half_day_rate)}</strong> · Full day (8+ hrs): <strong>{money(g.full_day_rate)}</strong></span>
            {g.night_extra != null && <span>Evening / lights extra: <strong>{money(g.night_extra)}</strong></span>}
            {g.rental_notes && <span style={{ color: '#475569' }}>{g.rental_notes}</span>}
            {g.hourly_rate == null && g.full_day_rate == null && <span style={{ color: '#94a3b8' }}>Ask the owner for prices.</span>}
          </div>
        </Card>
      </div>

      {/* #150 map */}
      <Card title="Location (#150)">
        {hasMap ? (
          <>
            <iframe title="Ground map" loading="lazy" style={{ width: '100%', height: 260, border: 0, borderRadius: '0.5rem' }}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.005}%2C${lng + 0.008}%2C${lat + 0.005}&layer=mapnik&marker=${lat}%2C${lng}`} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.82rem' }}>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={13} /> Directions in Google Maps</a>
              <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`} target="_blank" rel="noopener noreferrer" style={{ color: '#64748b' }}>Bigger map</a>
            </div>
          </>
        ) : <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>{own ? 'Add the latitude and longitude (Edit ground → Use my current location) to show a map.' : 'No map location added yet.'}</span>}
      </Card>

      {/* #149 photos */}
      <Card title="Photos (#149)">
        {d.photos.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No photos yet.</span> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {d.photos.map((p) => (
              <figure key={p.id} style={{ margin: 0, position: 'relative' }}>
                <a href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt={p.caption || g.name} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: '0.45rem', display: 'block' }} /></a>
                {p.caption && <figcaption style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.caption}</figcaption>}
                {own && (
                  <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                    {g.cover_url !== p.url && <button title="Use as cover" onClick={() => run(() => dataService.removeGroundPhoto(p.id, true))} style={{ background: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 3 }}><Star size={13} /></button>}
                    <button title="Delete" onClick={() => window.confirm('Delete this photo?') && run(() => dataService.removeGroundPhoto(p.id, false))} style={{ background: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 3, color: '#b91c1c' }}><Trash2 size={13} /></button>
                  </div>
                )}
              </figure>
            ))}
          </div>
        )}
        {own && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.7rem', flexWrap: 'wrap' }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto({ ...photo, file: e.target.files[0] || null })} style={{ fontSize: '0.8rem' }} />
            <input placeholder="Caption (optional)" maxLength={120} value={photo.caption} onChange={(e) => setPhoto({ ...photo, caption: e.target.value })} style={{ ...inp, width: 200 }} />
            <Button size="sm" variant="primary" disabled={!photo.file} onClick={() => run(() => dataService.addGroundPhoto({ groundId: g.id, file: photo.file, caption: photo.caption }), () => setPhoto({ file: null, caption: '' }))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Camera size={13} /> Upload</Button>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>JPG/PNG/WEBP up to 2 MB · up to 20 photos</span>
          </div>
        )}
      </Card>

      <Calendar groundId={g.id} isOwner={own} signedIn={!!currentUser} ground={g} onChanged={load} />

      {/* #157 pitch preparation */}
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Sprout size={16} /> Pitch preparation (#157)</span>}
        action={own && !log ? <Button size="sm" variant="secondary" onClick={() => setLog({ prepared_on: ymd(new Date()), pitch_label: '', work: [], condition: 'good', notes: '' })}>Add record</Button> : null}>
        {log && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.8rem', padding: '0.6rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
              <label style={lbl}>Date<input type="date" value={log.prepared_on} onChange={(e) => setLog({ ...log, prepared_on: e.target.value })} style={inp} /></label>
              <label style={lbl}>Pitch<input value={log.pitch_label} maxLength={40} placeholder="e.g. Pitch 2" onChange={(e) => setLog({ ...log, pitch_label: e.target.value })} style={inp} /></label>
              <label style={lbl}>Condition<select value={log.condition} onChange={(e) => setLog({ ...log, condition: e.target.value })} style={inp}>{['excellent', 'good', 'fair', 'poor'].map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {WORK.map(([k, l]) => { const on = log.work.includes(k); return <button key={k} type="button" onClick={() => setLog({ ...log, work: on ? log.work.filter((x) => x !== k) : [...log.work, k] })} style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.76rem', border: `1px solid ${on ? '#16a34a' : '#e2e8f0'}`, backgroundColor: on ? '#dcfce7' : '#fff' }}>{l}</button>; })}
            </div>
            <input placeholder="Notes" maxLength={1000} value={log.notes} onChange={(e) => setLog({ ...log, notes: e.target.value })} style={inp} />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <Button size="sm" variant="primary" onClick={() => run(() => dataService.addPitchLog(g.id, log), () => setLog(null))}>Save</Button>
              <Button size="sm" variant="secondary" onClick={() => setLog(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {d.pitch_logs.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No records yet.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {d.pitch_logs.map((l) => (
              <div key={l.id} style={{ fontSize: '0.84rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.3rem' }}>
                <strong>{new Date(l.prepared_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>{l.pitch_label ? ` · ${l.pitch_label}` : ''} · {(l.work || []).map((w) => (WORK.find((x) => x[0] === w) || [w, w])[1]).join(', ') || '—'}
                {l.condition && <span style={{ color: l.condition === 'poor' ? '#b91c1c' : '#15803d' }}> · {l.condition}</span>}
                {l.notes && <div style={{ color: '#475569' }}>{l.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* #158 inspections */}
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardCheck size={16} /> Inspection reports (#158)</span>}
        subtitle="Filed by the ground owner, or by the organiser / officials of a match played here"
        action={currentUser && !insp ? <Button size="sm" variant="secondary" onClick={() => setInsp({ pitch_rating: 4, outfield_rating: 4, facilities_rating: 4, safety_rating: 4, fit_for_play: true, notes: '', match_id: '' })}>File a report</Button> : null}>
        {insp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.8rem', padding: '0.6rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {[['pitch_rating', 'Pitch'], ['outfield_rating', 'Outfield'], ['facilities_rating', 'Facilities'], ['safety_rating', 'Safety']].map(([k, l]) => (
                <label key={k} style={lbl}>{l} (1–5)<select value={insp[k]} onChange={(e) => setInsp({ ...insp, [k]: Number(e.target.value) })} style={inp}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              ))}
            </div>
            {!own && (
              <label style={lbl}>Match played here (needed if you are not the owner)
                <select value={insp.match_id} onChange={(e) => setInsp({ ...insp, match_id: e.target.value })} style={inp}>
                  <option value="">Choose…</option>{d.history.map((h) => <option key={h.match_id} value={h.match_id}>{h.teams} · {h.date ? new Date(h.date).toLocaleDateString('en-IN') : ''}</option>)}
                </select>
              </label>
            )}
            <label style={{ fontSize: '0.84rem' }}><input type="checkbox" checked={insp.fit_for_play} onChange={(e) => setInsp({ ...insp, fit_for_play: e.target.checked })} /> Fit for play</label>
            <textarea rows={2} placeholder="Notes" maxLength={1500} value={insp.notes} onChange={(e) => setInsp({ ...insp, notes: e.target.value })} style={{ ...inp, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <Button size="sm" variant="primary" onClick={() => run(() => dataService.addGroundInspection(g.id, insp), () => setInsp(null))}>Submit</Button>
              <Button size="sm" variant="secondary" onClick={() => setInsp(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {d.inspections.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No inspections yet.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {d.inspections.map((i) => (
              <div key={i.id} style={{ fontSize: '0.84rem', padding: '0.45rem 0.6rem', borderRadius: '0.45rem', backgroundColor: i.fit_for_play ? '#f0fdf4' : '#fef2f2' }}>
                <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                  <strong>{new Date(i.inspected_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  <Rating label="Pitch" value={i.pitch} /><Rating label="Outfield" value={i.outfield} /><Rating label="Facilities" value={i.facilities} /><Rating label="Safety" value={i.safety} />
                  <span style={{ fontWeight: 700, color: i.fit_for_play ? '#15803d' : '#b91c1c' }}>{i.fit_for_play ? 'Fit for play' : 'Unfit'}</span>
                </div>
                {i.notes && <div style={{ color: '#475569' }}>{i.notes}</div>}
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>by {i.by || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* #159 match history */}
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><History size={16} /> Match history (#159)</span>}>
        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.84rem', marginBottom: '0.6rem' }}>
          <span>Matches <strong>{s.matches}</strong></span>
          <span>Avg 1st-innings score <strong>{s.average_first_innings ?? '–'}</strong></span>
          <span>Highest total <strong>{s.highest_total ?? '–'}</strong></span>
          <span>Won batting first <strong>{s.won_batting_first}</strong> · chasing <strong>{s.won_chasing}</strong></span>
        </div>
        {d.history.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No matches linked to this ground yet. Match owners choose the ground on the match page.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {d.history.map((h) => (
              <button key={h.match_id} onClick={() => onNavigate && onNavigate('match-centre', h.match_id)} style={{ textAlign: 'left', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '0.45rem', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.84rem' }}>
                <strong>{h.teams}</strong> <span style={{ color: '#64748b' }}>· {h.date ? new Date(h.date).toLocaleDateString('en-IN') : ''}{h.tournament ? ` · ${h.tournament}` : ''}</span>
                <div style={{ fontSize: '0.76rem', color: h.status === 'live' ? '#dc2626' : '#065f46' }}>{h.status === 'live' ? 'Live now' : h.result || h.status}</div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default GroundDetailView;
