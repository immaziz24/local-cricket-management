import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Handshake, Plus, Camera, Globe, Phone, Mail, MapPin, ArrowLeft, Check, X, FileBarChart } from 'lucide-react';
import { SPONSOR_CATS, TIER_LABEL, inp, lbl, grid, chip, fmtDate, trackOnce } from './brandShared.jsx';
import { SponsorReport } from './SponsorReport.jsx';

/** #191 Sponsor registration: a directory of businesses that back local cricket, and each sponsor's page. */
const CAT_LABEL = Object.fromEntries(SPONSOR_CATS);

export function SponsorForm({ sponsor, onSaved, onCancel }) {
  const [f, setF] = useState(() => ({ name: '', category: 'business', city: '', website: '', phone: '', email: '', about: '', is_active: true,
    ...Object.fromEntries(Object.entries(sponsor || {}).map(([k, v]) => [k, v ?? ''])) }));
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <Card title={sponsor ? 'Edit sponsor' : 'Register as a sponsor'} subtitle={sponsor ? null : 'Free. Organisers can then invite you, or you can offer to sponsor a tournament.'}>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem', marginBottom: '0.5rem' }}>{msg}</div>}
      <div style={grid}>
        <label style={lbl}>Business / sponsor name *<input value={f.name} maxLength={100} onChange={set('name')} style={inp} /></label>
        <label style={lbl}>Type<select value={f.category} onChange={set('category')} style={inp}>{SPONSOR_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label style={lbl}>City<input value={f.city} maxLength={80} onChange={set('city')} style={inp} /></label>
        <label style={lbl}>Website<input value={f.website} placeholder="https://" maxLength={200} onChange={set('website')} style={inp} /></label>
        <label style={lbl}>Phone (public)<input value={f.phone} maxLength={20} onChange={set('phone')} style={inp} /></label>
        <label style={lbl}>Email (public)<input value={f.email} maxLength={120} onChange={set('email')} style={inp} /></label>
      </div>
      <label style={{ ...lbl, marginTop: '0.5rem' }}>About<textarea rows={3} maxLength={1500} value={f.about} onChange={set('about')} style={{ ...inp, resize: 'vertical' }} /></label>
      {sponsor && <label style={{ fontSize: '0.84rem', marginTop: '0.5rem', display: 'block' }}><input type="checkbox" checked={!!f.is_active} onChange={set('is_active')} /> Show in the sponsor directory</label>}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
        <Button variant="primary" disabled={f.name.trim().length < 2} onClick={async () => { setMsg(null); try { onSaved(await dataService.saveSponsor(sponsor?.id, f)); } catch (e) { setMsg(e.message); } }}>Save</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

export function SponsorProfileView({ sponsorId, onNavigate }) {
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState(null);
  const [report, setReport] = useState(null);
  const load = () => dataService.getSponsor(sponsorId).then((r) => { setD(r || false); }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); trackOnce('sponsor', sponsorId, () => dataService.recordView('sponsor', sponsorId)); }, [sponsorId]);
  if (d === null) return <div style={{ color: msg ? '#b91c1c' : '#64748b' }}>{msg || 'Loading…'}</div>;
  if (d === false) return <Card><p style={{ margin: 0 }}>This sponsor is not listed.</p></Card>;
  const s = d.sponsor;
  if (edit) return <SponsorForm sponsor={s} onCancel={() => setEdit(false)} onSaved={(r) => { setD(r); setEdit(false); }} />;
  const respond = async (id, yes) => { try { await dataService.respondSponsorship(id, yes); load(); } catch (e) { setMsg(e.message); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button type="button" onClick={() => onNavigate('sponsors')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center' }}><ArrowLeft size={15} /> All sponsors</button>
      <Card>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 96, height: 96, borderRadius: '0.8rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fff' }}>
            {s.logo_url ? <img src={s.logo_url} alt={s.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#059669' }}>{s.name.charAt(0)}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>{CAT_LABEL[s.category]}</div>
            <h2 style={{ margin: '0.1rem 0', fontSize: '1.5rem' }}>{s.name}</h2>
            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.86rem', color: '#475569' }}>
              {s.city && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><MapPin size={14} /> {s.city}</span>}
              {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer nofollow" style={{ color: '#2563eb', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Globe size={14} /> Website</a>}
              {s.phone && <a href={`tel:${s.phone}`} style={{ color: '#2563eb', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Phone size={14} /> {s.phone}</a>}
              {s.email && <a href={`mailto:${s.email}`} style={{ color: '#2563eb', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Mail size={14} /> {s.email}</a>}
            </div>
          </div>
          {d.is_owner && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Edit</Button>
              <label className="btn-mini" style={{ cursor: 'pointer' }}><Camera size={13} /> Logo
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; try { setD(await dataService.setSponsorLogo({ sponsorId: s.id, file })); } catch (er) { setMsg(er.message); } }} />
              </label>
            </div>
          )}
        </div>
        {s.about && <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', marginBottom: 0 }}>{s.about}</p>}
        {msg && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: '0.4rem' }}>{msg}</div>}
      </Card>
      <Card title="Tournaments sponsored" subtitle={d.is_owner ? 'Invitations and offers waiting for an answer are shown only to you.' : null}>
        {d.sponsorships.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>None yet.{d.is_owner ? ' Open any tournament → Sponsors & promotion → "Offer to sponsor".' : ''}</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {d.sponsorships.map((x) => (
              <div key={x.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0.7rem', border: '1px solid #f1f5f9', borderRadius: '0.5rem', fontSize: '0.86rem' }}>
                <button type="button" onClick={() => onNavigate('tournament-details', x.tournament.id)} style={{ background: 'none', border: 'none', color: '#0f172a', fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left', flex: 1 }}>{x.tournament.name}</button>
                <span style={{ color: '#64748b' }}>{TIER_LABEL[x.tier]} · {fmtDate(x.tournament.start_date)}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, backgroundColor: x.status === 'active' ? '#dcfce7' : x.status === 'invited' || x.status === 'applied' ? '#fef3c7' : '#f1f5f9' }}>{x.status === 'invited' ? 'invitation for you' : x.status === 'applied' ? 'offer sent' : x.status}</span>
                {d.is_owner && x.status === 'invited' && <><Button size="sm" variant="primary" onClick={() => respond(x.id, true)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Check size={13} /> Accept</Button><Button size="sm" variant="secondary" onClick={() => respond(x.id, false)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><X size={13} /> Decline</Button></>}
                {d.is_owner && (x.status === 'active' || x.status === 'ended') && <Button size="sm" variant="secondary" onClick={() => setReport(x.id)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><FileBarChart size={13} /> Report</Button>}
              </div>
            ))}
          </div>
        )}
      </Card>
      {report && <SponsorReport sponsorshipId={report} onClose={() => setReport(null)} />}
    </div>
  );
}

export function SponsorsView({ currentUser, onNavigate }) {
  const [f, setF] = useState({ query: '', city: '', mine: false });
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = () => dataService.listSponsors(f).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [f.mine]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Handshake size={22} /> Sponsors</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Local businesses that back local cricket. Organisers invite sponsors from here; businesses can offer to sponsor any tournament.</p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search name" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 200 }} />
        <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 150 }} />
        <Button variant="secondary" onClick={load}>Search</Button>
        {currentUser && <button type="button" style={chip(f.mine)} onClick={() => setF({ ...f, mine: !f.mine })}>My sponsors</button>}
        {currentUser && !adding && <Button variant="primary" onClick={() => setAdding(true)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Plus size={14} /> Register as a sponsor</Button>}
        {!currentUser && <Button variant="primary" onClick={() => onNavigate('register')}>Register to become a sponsor</Button>}
      </div>
      {adding && <SponsorForm onCancel={() => setAdding(false)} onSaved={(r) => { setAdding(false); onNavigate('sponsor', r.sponsor.id); }} />}
      {list === null ? <div style={{ color: '#64748b' }}>Loading…</div> : list.length === 0 ? <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.86rem' }}>No sponsors listed yet.</p></Card> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.8rem' }}>
          {list.map((s) => (
            <button key={s.id} type="button" onClick={() => onNavigate('sponsor', s.id)} style={{ textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '0.8rem', background: '#fff', cursor: 'pointer', padding: '0.9rem', display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '0.6rem', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {s.logo_url ? <img src={s.logo_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669' }}>{s.name.charAt(0)}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{s.name}</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{CAT_LABEL[s.category]}{s.city ? ` · ${s.city}` : ''}</div>
                <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>{s.active_count > 0 ? `${s.active_count} tournament${s.active_count > 1 ? 's' : ''} sponsored` : 'New sponsor'}{s.is_mine ? ' · yours' : ''}{!s.is_active ? ' · hidden' : ''}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SponsorsView;
