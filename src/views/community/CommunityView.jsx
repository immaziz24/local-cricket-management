import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Users2, Store, Search, Megaphone, Mail, Plus, X, MapPin, Phone, Globe, Camera, Trash2, ExternalLink } from 'lucide-react';

/**
 * Category H – Cricket community and marketplace (#160–#176).
 * Directory (academies, coaching, shops, nets, clubs, commentators, organisers), marketplace (equipment, bats & balls,
 * kit rental), Find (grounds, umpires, scorers, teams, players, tournaments), community board and private enquiries.
 */
const KINDS = [
  ['academy', 'Academies'], ['coaching', 'Coaching centres'], ['shop', 'Cricket shops'],
  ['nets', 'Net practice'], ['club', 'Clubs'], ['commentator', 'Commentators']
];
const KIND_LABEL = Object.fromEntries(KINDS.map(([k, l]) => [k, l.replace(/s$/, '').replace('Coaching centre', 'Coaching centre')]));
const CATS = [['bat', 'Bat'], ['ball', 'Ball'], ['pads', 'Pads'], ['gloves', 'Gloves'], ['helmet', 'Helmet'], ['kit_bag', 'Kit bag'], ['shoes', 'Shoes'],
  ['clothing', 'Clothing'], ['stumps', 'Stumps'], ['full_kit', 'Full kit'], ['other', 'Other']];
const CAT_LABEL = Object.fromEntries(CATS);
const POST_KINDS = [['players_wanted', 'Players wanted'], ['team_wanted', 'Looking for a team'], ['match_wanted', 'Match wanted'],
  ['ground_wanted', 'Ground wanted'], ['officials_wanted', 'Umpire / scorer wanted'], ['other', 'Other']];
const POST_LABEL = Object.fromEntries(POST_KINDS);
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
const lbl = { fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.6rem' };
const money = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`);
const chip = (on) => ({ padding: '0.3rem 0.7rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${on ? '#16a34a' : '#e2e8f0'}`, backgroundColor: on ? '#dcfce7' : '#fff', fontWeight: on ? 700 : 500 });

function EnquiryBox({ targetType, targetId, label, signedIn }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ message: '', contact: '' });
  const [msg, setMsg] = useState(null);
  if (!signedIn) return <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Sign in to send an enquiry.</p>;
  if (!open) return <Button size="sm" variant="primary" onClick={() => { setOpen(true); setMsg(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Mail size={13} /> {label || 'Send enquiry'}</Button>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <textarea rows={3} maxLength={1000} placeholder="Your message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} style={{ ...inp, resize: 'vertical' }} />
      <input maxLength={60} placeholder="Your phone / WhatsApp (optional – only they will see it)" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} style={inp} />
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <Button size="sm" variant="primary" disabled={f.message.trim().length < 2} onClick={async () => {
          try { await dataService.sendEnquiry(targetType, targetId, f.message, f.contact); setMsg({ ok: true, text: 'Sent. You will be notified when they reply (see the Enquiries tab).' }); setOpen(false); setF({ message: '', contact: '' }); }
          catch (e) { setMsg({ ok: false, text: e.message }); }
        }}>Send</Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {msg && <div style={{ fontSize: '0.8rem', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.text}</div>}
    </div>
  );
}

/* ---------- Directory ---------- */
function ListingForm({ listing, onSaved, onCancel }) {
  const [f, setF] = useState(() => ({ kind: 'academy', name: '', city: '', address: '', phone: '', website: '', description: '', timings: '', fees: '', tags: [], latitude: '', longitude: '', is_active: true,
    ...Object.fromEntries(Object.entries(listing || {}).map(([k, v]) => [k, v ?? ''])) }));
  const [tagText, setTagText] = useState((listing?.tags || []).join(', '));
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async () => {
    setMsg(null);
    try { const r = await dataService.saveListing(listing?.id, { ...f, tags: tagText.split(',').map((t) => t.trim()).filter(Boolean) }); onSaved(r); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <Card title={listing ? 'Edit listing' : 'Add your academy, shop, nets, club…'} subtitle={listing ? null : 'Free and open to everyone. People contact you through enquiries (and your phone, if you add one).'}>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem', marginBottom: '0.5rem' }}>{msg}</div>}
      <div style={grid}>
        <label style={lbl}>Type<select value={f.kind} onChange={set('kind')} style={inp}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label style={lbl}>Name *<input value={f.name} maxLength={100} onChange={set('name')} style={inp} /></label>
        <label style={lbl}>City<input value={f.city} maxLength={80} onChange={set('city')} style={inp} /></label>
        <label style={lbl}>Address<input value={f.address} maxLength={250} onChange={set('address')} style={inp} /></label>
        <label style={lbl}>Phone (public)<input value={f.phone} maxLength={20} onChange={set('phone')} style={inp} /></label>
        <label style={lbl}>Website<input value={f.website} maxLength={200} placeholder="https://" onChange={set('website')} style={inp} /></label>
        <label style={lbl}>Timings<input value={f.timings} maxLength={200} placeholder="e.g. Mon–Sat 6–9 am" onChange={set('timings')} style={inp} /></label>
        <label style={lbl}>Fees / prices<input value={f.fees} maxLength={200} placeholder="e.g. ₹1500 / month" onChange={set('fees')} style={inp} /></label>
        <label style={lbl}>Latitude<input value={f.latitude} onChange={set('latitude')} style={inp} /></label>
        <label style={lbl}>Longitude<input value={f.longitude} onChange={set('longitude')} style={inp} /></label>
      </div>
      <label style={{ ...lbl, marginTop: '0.5rem' }}>Tags (comma separated)<input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="e.g. under-14, girls, turf nets, bowling machine" style={inp} /></label>
      <label style={{ ...lbl, marginTop: '0.5rem' }}>Description<textarea rows={3} maxLength={2000} value={f.description} onChange={set('description')} style={{ ...inp, resize: 'vertical' }} /></label>
      {listing && <label style={{ fontSize: '0.84rem', marginTop: '0.5rem', display: 'block' }}><input type="checkbox" checked={!!f.is_active} onChange={set('is_active')} /> Show in the directory</label>}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
        <Button variant="primary" disabled={f.name.trim().length < 2} onClick={save}>Save</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function ListingDetail({ id, signedIn, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { dataService.getListing(id).then(setD).catch((e) => setMsg(e.message)); }, [id]);
  if (!d) return <Card><p style={{ margin: 0, fontSize: '0.84rem', color: msg ? '#b91c1c' : '#64748b' }}>{msg || 'Loading…'}</p></Card>;
  const l = d.listing;
  if (edit) return <ListingForm listing={l} onCancel={() => setEdit(false)} onSaved={(r) => { setD(r); setEdit(false); onChanged(); }} />;
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>{KIND_LABEL[l.kind]}</div>
          <h3 style={{ margin: '0.1rem 0', fontSize: '1.25rem' }}>{l.name}</h3>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Listed by {d.owner_name || '—'}</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-start' }}><X size={18} /></button>
      </div>
      {l.cover_url && <img src={l.cover_url} alt={l.name} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: '0.5rem', marginTop: '0.6rem' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.86rem', marginTop: '0.6rem' }}>
        {(l.address || l.city) && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><MapPin size={14} /> {[l.address, l.city].filter(Boolean).join(', ')}
          {l.latitude != null && <a href={`https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', marginLeft: 6 }}>Directions</a>}</span>}
        {l.phone && <a href={`tel:${l.phone}`} style={{ color: '#2563eb', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Phone size={14} /> {l.phone}</a>}
        {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer nofollow" style={{ color: '#2563eb', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Globe size={14} /> {l.website}</a>}
        {l.timings && <span>Timings: <strong>{l.timings}</strong></span>}
        {l.fees && <span>Fees: <strong>{l.fees}</strong></span>}
        {d.ground && <span>Ground: <strong>{d.ground.name}</strong></span>}
        {(l.tags || []).length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{l.tags.map((t) => <span key={t} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 999, backgroundColor: '#f1f5f9' }}>{t}</span>)}</div>}
        {l.description && <p style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap' }}>{l.description}</p>}
      </div>
      {d.items.length > 0 && (
        <div style={{ marginTop: '0.7rem' }}>
          <strong style={{ fontSize: '0.84rem' }}>Items from this {l.kind === 'shop' ? 'shop' : 'listing'}</strong>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>{d.items.map((i) => <span key={i.id} style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: 6 }}>{i.title} · {i.price != null ? money(i.price) : `${money(i.rent_per_day)}/day`}</span>)}</div>
        </div>
      )}
      <div style={{ marginTop: '0.9rem' }}>
        {d.is_owner ? (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Edit</Button>
            <label style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Camera size={14} /> Photo
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; try { setD(await dataService.setListingPhoto({ listingId: l.id, file })); onChanged(); } catch (er) { setMsg(er.message); } }} />
            </label>
            <Button size="sm" variant="secondary" onClick={async () => { if (!window.confirm('Delete this listing?')) return; try { await dataService.deleteListing(l.id); onChanged(); onClose(); } catch (er) { setMsg(er.message); } }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b91c1c' }}><Trash2 size={13} /> Delete</Button>
          </div>
        ) : <EnquiryBox targetType="listing" targetId={l.id} signedIn={signedIn} />}
        {msg && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.3rem' }}>{msg}</div>}
      </div>
    </Card>
  );
}

function Organisers({ onNavigate }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const load = () => dataService.listOrganisers(q).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  return (
    <Card title="Tournament organisers" subtitle="Everyone who has run a tournament on this website">
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
        <input placeholder="Name or city" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} style={inp} />
        <Button variant="secondary" onClick={load}>Search</Button>
      </div>
      {list === null ? 'Loading…' : list.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No organisers found.</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {list.map((o) => (
            <div key={o.user_id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.45rem 0.6rem', border: '1px solid #f1f5f9', borderRadius: '0.45rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <strong style={{ flex: 1 }}>{o.name}</strong>
              <span style={{ color: '#64748b' }}>{o.tournaments} tournament{o.tournaments === 1 ? '' : 's'} · {o.completed} finished{o.cities ? ` · ${o.cities}` : ''}</span>
              {o.latest && <button onClick={() => onNavigate && onNavigate('tournament-details', o.latest.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem' }}>Latest: {o.latest.name}</button>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Directory({ signedIn, onNavigate }) {
  const [kind, setKind] = useState('academy');
  const [f, setF] = useState({ city: '', query: '', mine: false });
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = () => (kind === 'organisers' ? null : dataService.listListings({ ...f, kind: f.mine ? null : kind }).then(setList).catch(() => setList([])));
  useEffect(() => { setOpen(null); load(); }, [kind, f.mine]);
  return (
    <>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {[...KINDS, ['organisers', 'Tournament organisers']].map(([k, l]) => <button key={k} onClick={() => setKind(k)} style={chip(kind === k)}>{l}</button>)}
      </div>
      {kind === 'organisers' ? <Organisers onNavigate={onNavigate} /> : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Search name or tag" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 200 }} />
            <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 150 }} />
            <Button variant="secondary" onClick={load}>Search</Button>
            {signedIn && <label style={{ fontSize: '0.84rem' }}><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} /> My listings</label>}
            {signedIn && !adding && <Button variant="primary" onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Add listing</Button>}
          </div>
          {adding && <ListingForm onCancel={() => setAdding(false)} onSaved={(r) => { setAdding(false); setOpen(r.listing.id); load(); }} />}
          {open && <ListingDetail id={open} signedIn={signedIn} onClose={() => setOpen(null)} onChanged={load} />}
          {list === null ? <div style={{ color: '#64748b' }}>Loading…</div> : list.length === 0 ? <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.86rem' }}>Nothing listed here yet.{signedIn ? ' Be the first – add yours.' : ''}</p></Card> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.8rem' }}>
              {list.map((l) => (
                <button key={l.id} onClick={() => setOpen(l.id)} style={{ textAlign: 'left', padding: 0, border: '1px solid #e2e8f0', borderRadius: '0.7rem', overflow: 'hidden', background: '#fff', cursor: 'pointer' }}>
                  <div style={{ height: 90, background: l.cover_url ? `center/cover no-repeat url(${l.cover_url})` : 'linear-gradient(135deg,#0f766e,#5eead4)' }} />
                  <div style={{ padding: '0.65rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700 }}>{KIND_LABEL[l.kind]}{l.is_mine ? ' · YOURS' : ''}{!l.is_active ? ' · HIDDEN' : ''}</div>
                    <div style={{ fontWeight: 800 }}>{l.name}</div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{[l.address, l.city].filter(Boolean).join(', ')}</div>
                    {(l.fees || l.timings) && <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 3 }}>{[l.fees, l.timings].filter(Boolean).join(' · ')}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ---------- Marketplace ---------- */
function ItemForm({ item, onSaved, onCancel }) {
  const [f, setF] = useState(() => ({ title: '', category: 'bat', condition: 'used', mode: 'sale', price: '', rent_per_day: '', deposit: '', city: '', description: '', listing_id: '',
    ...Object.fromEntries(Object.entries(item || {}).map(([k, v]) => [k, v ?? ''])) }));
  const [shops, setShops] = useState([]);
  const [msg, setMsg] = useState(null);
  useEffect(() => { dataService.listListings({ mine: true }).then((l) => setShops((l || []).filter((x) => x.kind === 'shop'))).catch(() => {}); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title={item ? 'Edit item' : 'Sell or rent out equipment'}>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem', marginBottom: '0.5rem' }}>{msg}</div>}
      <div style={grid}>
        <label style={lbl}>Title *<input value={f.title} maxLength={100} onChange={set('title')} style={inp} placeholder="e.g. SS English willow bat, SH" /></label>
        <label style={lbl}>Category<select value={f.category} onChange={set('category')} style={inp}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label style={lbl}>Condition<select value={f.condition} onChange={set('condition')} style={inp}><option value="new">New</option><option value="like_new">Like new</option><option value="used">Used</option></select></label>
        <label style={lbl}>For<select value={f.mode} onChange={set('mode')} style={inp}><option value="sale">Sale</option><option value="rent">Rent</option><option value="both">Sale or rent</option></select></label>
        {f.mode !== 'rent' && <label style={lbl}>Price (₹) *<input type="number" min="0" value={f.price} onChange={set('price')} style={inp} /></label>}
        {f.mode !== 'sale' && <label style={lbl}>Rent per day (₹) *<input type="number" min="0" value={f.rent_per_day} onChange={set('rent_per_day')} style={inp} /></label>}
        {f.mode !== 'sale' && <label style={lbl}>Deposit (₹)<input type="number" min="0" value={f.deposit} onChange={set('deposit')} style={inp} /></label>}
        <label style={lbl}>City<input value={f.city} maxLength={80} onChange={set('city')} style={inp} /></label>
        {shops.length > 0 && <label style={lbl}>From my shop<select value={f.listing_id} onChange={set('listing_id')} style={inp}><option value="">—</option>{shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      </div>
      <label style={{ ...lbl, marginTop: '0.5rem' }}>Description<textarea rows={3} maxLength={1500} value={f.description} onChange={set('description')} style={{ ...inp, resize: 'vertical' }} /></label>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
        <Button variant="primary" disabled={f.title.trim().length < 3} onClick={async () => { setMsg(null); try { onSaved(await dataService.saveItem(item?.id, f)); } catch (e) { setMsg(e.message); } }}>Save</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function ItemDetail({ id, signedIn, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { dataService.getItem(id).then(setD).catch((e) => setMsg(e.message)); }, [id]);
  if (!d) return <Card><p style={{ margin: 0, fontSize: '0.84rem', color: msg ? '#b91c1c' : '#64748b' }}>{msg || 'Loading…'}</p></Card>;
  const i = d.item;
  if (edit) return <ItemForm item={i} onCancel={() => setEdit(false)} onSaved={(r) => { setD(r); setEdit(false); onChanged(); }} />;
  const setStatus = async (status) => { try { setD(await dataService.saveItem(i.id, { ...i, status })); onChanged(); } catch (e) { setMsg(e.message); } };
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>{CAT_LABEL[i.category]} · {i.condition.replace('_', ' ')}{i.status !== 'available' ? ` · ${i.status}` : ''}</div>
          <h3 style={{ margin: '0.1rem 0', fontSize: '1.2rem' }}>{i.title}</h3>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{d.shop ? `${d.shop.name} · ` : ''}{d.seller_name}{i.city ? ` · ${i.city}` : ''}</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-start' }}><X size={18} /></button>
      </div>
      {i.photo_url && <img src={i.photo_url} alt={i.title} style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: '0.5rem', marginTop: '0.6rem', backgroundColor: '#f8fafc' }} />}
      <div style={{ fontSize: '1rem', marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {i.price != null && <span>Price <strong>{money(i.price)}</strong></span>}
        {i.rent_per_day != null && <span>Rent <strong>{money(i.rent_per_day)}/day</strong>{i.deposit != null ? ` · deposit ${money(i.deposit)}` : ''}</span>}
      </div>
      {i.description && <p style={{ fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>{i.description}</p>}
      <div style={{ marginTop: '0.7rem' }}>
        {d.is_mine ? (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Edit</Button>
            <label style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Camera size={14} /> Photo
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; try { setD(await dataService.setItemPhoto({ itemId: i.id, file })); onChanged(); } catch (er) { setMsg(er.message); } }} />
            </label>
            <select value={i.status} onChange={(e) => setStatus(e.target.value)} style={{ ...inp, width: 'auto' }}>
              {['available', 'reserved', 'sold', 'rented', 'hidden'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button size="sm" variant="secondary" onClick={async () => { if (!window.confirm('Delete this item?')) return; try { await dataService.deleteItem(i.id); onChanged(); onClose(); } catch (er) { setMsg(er.message); } }} style={{ color: '#b91c1c' }}>Delete</Button>
          </div>
        ) : <EnquiryBox targetType="item" targetId={i.id} signedIn={signedIn} label={i.mode === 'rent' ? 'Ask to rent' : 'Contact seller'} />}
        {msg && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.3rem' }}>{msg}</div>}
      </div>
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Payment and handover happen directly between you – meet in a public place and check the item first.</p>
    </Card>
  );
}

function Marketplace({ signedIn }) {
  const [f, setF] = useState({ category: '', mode: '', city: '', query: '', max_price: '', mine: false });
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = () => dataService.listItems(f).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [f.category, f.mode, f.mine]);
  return (
    <>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {[['', 'All equipment'], ['bat_ball', 'Bats & balls'], ...CATS.filter(([k]) => !['bat', 'ball'].includes(k))].map(([k, l]) => <button key={k || 'all'} onClick={() => setF({ ...f, category: k })} style={chip(f.category === k)}>{l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} style={{ ...inp, width: 'auto' }}><option value="">Buy or rent</option><option value="sale">For sale</option><option value="rent">Kit for rent</option></select>
        <input placeholder="Search" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 160 }} />
        <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 130 }} />
        <input type="number" placeholder="Max ₹" value={f.max_price} onChange={(e) => setF({ ...f, max_price: e.target.value })} style={{ ...inp, width: 100 }} />
        <Button variant="secondary" onClick={load}>Search</Button>
        {signedIn && <label style={{ fontSize: '0.84rem' }}><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} /> My items</label>}
        {signedIn && !adding && <Button variant="primary" onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Sell / rent out</Button>}
      </div>
      {adding && <ItemForm onCancel={() => setAdding(false)} onSaved={(r) => { setAdding(false); setOpen(r.item.id); load(); }} />}
      {open && <ItemDetail id={open} signedIn={signedIn} onClose={() => setOpen(null)} onChanged={load} />}
      {list === null ? <div style={{ color: '#64748b' }}>Loading…</div> : list.length === 0 ? <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.86rem' }}>No items yet.</p></Card> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.8rem' }}>
          {list.map((i) => (
            <button key={i.id} onClick={() => setOpen(i.id)} style={{ textAlign: 'left', padding: 0, border: '1px solid #e2e8f0', borderRadius: '0.7rem', overflow: 'hidden', background: '#fff', cursor: 'pointer' }}>
              <div style={{ height: 120, background: i.photo_url ? `center/contain no-repeat url(${i.photo_url}) #f8fafc` : 'linear-gradient(135deg,#78350f,#fbbf24)' }} />
              <div style={{ padding: '0.6rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{i.title}</div>
                <div style={{ fontSize: '0.86rem', marginTop: 2 }}>{i.price != null && <strong>{money(i.price)}</strong>}{i.price != null && i.rent_per_day != null && ' · '}{i.rent_per_day != null && <strong>{money(i.rent_per_day)}/day</strong>}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{CAT_LABEL[i.category]} · {i.condition.replace('_', ' ')}{i.city ? ` · ${i.city}` : ''}{i.status !== 'available' ? ` · ${i.status}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Find (#169–#175) ---------- */
function Find({ onNavigate }) {
  const [kind, setKind] = useState('teams');
  const [f, setF] = useState({ query: '', city: '', role: '' });
  const [list, setList] = useState(null);
  const load = () => dataService.communitySearch({ ...f, kind }).then(setList).catch(() => setList([]));
  useEffect(() => { setList(null); if (['teams', 'players', 'tournaments'].includes(kind)) load(); }, [kind]);
  const LINKS = [['grounds', 'Grounds', 'grounds'], ['umpires', 'Umpires', 'officials'], ['scorers', 'Scorers', 'officials']];
  return (
    <>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {[['teams', 'Teams'], ['players', 'Players'], ['tournaments', 'Tournaments']].map(([k, l]) => <button key={k} onClick={() => { setKind(k); setF({ query: '', city: '', role: '' }); }} style={chip(kind === k)}>{l}</button>)}
        {LINKS.map(([k, l, route]) => <button key={k} onClick={() => onNavigate && onNavigate(route)} style={{ ...chip(false), display: 'inline-flex', alignItems: 'center', gap: 4 }}>{l} <ExternalLink size={11} /></button>)}
        <button onClick={() => setKind('commentators')} style={chip(kind === 'commentators')}>Commentators</button>
      </div>
      {kind === 'commentators' ? <Card><p style={{ margin: 0, fontSize: '0.86rem' }}>Commentators list themselves in the <strong>Directory → Commentators</strong> tab.</p></Card> : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input placeholder={kind === 'players' ? 'Name or player ID' : 'Name'} value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 200 }} />
            <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 150 }} />
            {kind === 'players' && <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} style={{ ...inp, width: 'auto' }}><option value="">Any role</option><option value="batter">Batter</option><option value="bowler">Bowler</option><option value="all_rounder">All-rounder</option><option value="wicket_keeper">Wicket-keeper</option></select>}
            {kind === 'tournaments' && <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} style={{ ...inp, width: 'auto' }}><option value="">Any</option><option value="open">Registration open</option><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select>}
            <Button variant="secondary" onClick={load}>Search</Button>
          </div>
          {list === null ? <div style={{ color: '#64748b' }}>Loading…</div> : list.length === 0 ? <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.86rem' }}>Nothing found.</p></Card> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {list.map((x) => (
                <button key={x.id} onClick={() => onNavigate && onNavigate(kind === 'teams' ? 'team-details' : kind === 'players' ? 'player-profile' : 'tournament-details', x.id)}
                  style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <strong style={{ flex: 1 }}>{x.name}{x.player_code ? <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {x.player_code}</span> : ''}</strong>
                  {kind === 'teams' && <span style={{ color: '#64748b' }}>{x.city || ''} · {x.players} players · {x.matches} matches</span>}
                  {kind === 'players' && <span style={{ color: '#64748b' }}>{(x.role || '').replace('_', ' ')}{x.teams ? ` · ${x.teams}` : ''}</span>}
                  {kind === 'tournaments' && <span style={{ color: '#64748b' }}>{[x.city, x.status, x.overs && `${x.overs} overs`, x.registration_open && 'registration open', x.entry_fee && `entry ₹${x.entry_fee}`].filter(Boolean).join(' · ')}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ---------- Board (#176) ---------- */
function Board({ signedIn }) {
  const [f, setF] = useState({ kind: '', city: '', mine: false });
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [reply, setReply] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => dataService.listPosts(f).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [f.kind, f.mine]);
  return (
    <>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {[['', 'All'], ...POST_KINDS].map(([k, l]) => <button key={k || 'all'} onClick={() => setF({ ...f, kind: k })} style={chip(f.kind === k)}>{l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...inp, width: 150 }} />
        <Button variant="secondary" onClick={load}>Search</Button>
        {signedIn && <label style={{ fontSize: '0.84rem' }}><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} /> My posts</label>}
        {signedIn && !form && <Button variant="primary" onClick={() => setForm({ kind: 'players_wanted', title: '', body: '', city: '', event_date: '' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> New post</Button>}
      </div>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{msg}</div>}
      {form && (
        <Card title="New post">
          <div style={grid}>
            <label style={lbl}>Type<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={inp}>{POST_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label style={lbl}>City<input value={form.city} maxLength={80} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inp} /></label>
            <label style={lbl}>Date (optional)<input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} style={inp} /></label>
          </div>
          <input placeholder="Title, e.g. Need 2 fast bowlers for Sunday morning" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...inp, marginTop: '0.5rem' }} />
          <textarea rows={3} maxLength={2000} placeholder="Details" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} style={{ ...inp, marginTop: '0.5rem', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
            <Button variant="primary" disabled={form.title.trim().length < 3} onClick={async () => { setMsg(null); try { await dataService.savePost(null, form); setForm(null); load(); } catch (e) { setMsg(e.message); } }}>Post</Button>
            <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Posts close automatically after 30 days. Replies come to you privately.</p>
        </Card>
      )}
      {list === null ? <div style={{ color: '#64748b' }}>Loading…</div> : list.length === 0 ? <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.86rem' }}>No posts yet.</p></Card> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {list.map((p) => (
            <Card key={p.id}>
              <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 700 }}>{POST_LABEL[p.kind]}{p.city ? ` · ${p.city}` : ''}{p.event_date ? ` · ${new Date(p.event_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}{p.status === 'closed' ? ' · CLOSED' : ''}</div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{p.title}</div>
              {p.body && <p style={{ margin: '0.3rem 0 0', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>{p.body}</p>}
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.3rem' }}>by {p.author}{p.team ? ` (${p.team.name})` : ''} · {new Date(p.created_at).toLocaleDateString('en-IN')}{p.is_mine ? ` · ${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}` : ''}</div>
              <div style={{ marginTop: '0.5rem' }}>
                {p.is_mine ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button size="sm" variant="secondary" onClick={async () => { try { await dataService.savePost(p.id, { ...p, team_id: p.team?.id || '', status: p.status === 'open' ? 'closed' : 'open' }); load(); } catch (e) { setMsg(e.message); } }}>{p.status === 'open' ? 'Close' : 'Re-open'}</Button>
                    <Button size="sm" variant="secondary" onClick={async () => { if (!window.confirm('Delete this post?')) return; try { await dataService.deletePost(p.id); load(); } catch (e) { setMsg(e.message); } }} style={{ color: '#b91c1c' }}>Delete</Button>
                  </div>
                ) : reply === p.id ? <EnquiryBox targetType="post" targetId={p.id} signedIn={signedIn} label="Reply privately" /> : <Button size="sm" variant="secondary" onClick={() => setReply(p.id)}>Reply</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Enquiries (#176) ---------- */
function Enquiries() {
  const [d, setD] = useState(null);
  const [text, setText] = useState({});
  const [msg, setMsg] = useState(null);
  const load = () => dataService.myEnquiries().then(setD).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  if (!d) return <div style={{ color: msg ? '#b91c1c' : '#64748b' }}>{msg || 'Loading…'}</div>;
  const TYPE = { listing: 'Listing', item: 'Item', post: 'Post' };
  return (
    <>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{msg}</div>}
      <Card title={`Received (${d.received.length})`}>
        {d.received.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No enquiries yet.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {d.received.map((e) => (
              <div key={e.id} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', backgroundColor: e.status === 'open' ? '#fffbeb' : '#fff' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{TYPE[e.target_type]}: <strong>{e.about || '(removed)'}</strong> · from {e.from} · {new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ fontSize: '0.88rem', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>{e.message}</div>
                {e.contact && <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Contact: <strong>{e.contact}</strong></div>}
                {e.reply && <div style={{ fontSize: '0.84rem', marginTop: '0.3rem', color: '#065f46' }}>You replied: {e.reply}</div>}
                {e.status !== 'closed' && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <input placeholder="Reply" maxLength={1000} value={text[e.id] || ''} onChange={(ev) => setText({ ...text, [e.id]: ev.target.value })} style={inp} />
                    <Button size="sm" variant="primary" disabled={!(text[e.id] || '').trim()} onClick={async () => { try { setD(await dataService.replyEnquiry(e.id, text[e.id])); setText({ ...text, [e.id]: '' }); } catch (er) { setMsg(er.message); } }}>Send</Button>
                    <Button size="sm" variant="secondary" onClick={async () => { try { setD(await dataService.replyEnquiry(e.id, null, true)); } catch (er) { setMsg(er.message); } }}>Close</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title={`Sent (${d.sent.length})`}>
        {d.sent.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>You have not sent any enquiries.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {d.sent.map((e) => (
              <div key={e.id} style={{ padding: '0.55rem 0.7rem', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{TYPE[e.target_type]}: <strong>{e.about || '(removed)'}</strong> · to {e.to}</div>
                <div style={{ fontSize: '0.86rem' }}>{e.message}</div>
                {e.reply ? <div style={{ fontSize: '0.86rem', marginTop: '0.25rem', color: '#065f46' }}><strong>Reply:</strong> {e.reply}</div> : <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Waiting for a reply</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export function CommunityView({ currentUser, onNavigate }) {
  const [tab, setTab] = useState('directory');
  const [unread, setUnread] = useState(0);
  useEffect(() => { if (currentUser) dataService.myEnquiries().then((d) => setUnread(d.unread || 0)).catch(() => {}); }, [currentUser?.id, tab]);
  const TABS = [['directory', 'Directory', Users2], ['market', 'Marketplace', Store], ['find', 'Find', Search], ['board', 'Community board', Megaphone],
    ...(currentUser ? [['enquiries', `Enquiries${unread ? ` (${unread})` : ''}`, Mail]] : [])];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users2 size={22} /> Cricket community</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Academies, coaching, shops, nets, clubs, equipment, and people looking for players, teams and matches.</p>
      </div>
      <div style={{ display: 'flex', gap: '0.3rem', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {TABS.map(([v, l, Icon]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: '0.5rem 0.85rem', border: 'none', borderBottom: `3px solid ${tab === v ? '#059669' : 'transparent'}`, background: 'none', cursor: 'pointer', fontWeight: 700, color: tab === v ? '#065f46' : '#64748b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>
      {tab === 'directory' && <Directory signedIn={!!currentUser} onNavigate={onNavigate} />}
      {tab === 'market' && <Marketplace signedIn={!!currentUser} />}
      {tab === 'find' && <Find onNavigate={onNavigate} />}
      {tab === 'board' && <Board signedIn={!!currentUser} />}
      {tab === 'enquiries' && currentUser && <Enquiries />}
    </div>
  );
}

export default CommunityView;
