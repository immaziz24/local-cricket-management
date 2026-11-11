import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Shirt, Plus, Camera, Trash2, Phone } from 'lucide-react';
import { inp, lbl, grid, money, chip } from './brandShared.jsx';

/**
 * #198 Tournament merchandise: jerseys, caps, T-shirts… Fans and players order here; the organiser confirms and collects
 * payment directly (cash / UPI) until online payments arrive with Category O.
 */
const STATUS = ['requested', 'confirmed', 'paid', 'ready', 'delivered', 'cancelled'];
const STATUS_LABEL = { requested: 'Requested', confirmed: 'Confirmed', paid: 'Paid', ready: 'Ready to collect', delivered: 'Delivered', cancelled: 'Cancelled' };
const STATUS_COLOR = { requested: '#fef3c7', confirmed: '#dbeafe', paid: '#dcfce7', ready: '#e0e7ff', delivered: '#f1f5f9', cancelled: '#fee2e2' };

function ItemForm({ tournament, item, onDone }) {
  const [f, setF] = useState(() => ({ name: item?.name || '', price: item?.price ?? '', description: item?.description || '', sizes: (item?.sizes || []).join(', '), stock: item?.stock ?? '', is_active: item?.is_active ?? true }));
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const save = async () => {
    setMsg(null);
    try {
      const saved = await dataService.saveMerchItem(item?.id || null, { ...f, tournament_id: tournament.id, sizes: f.sizes.split(',').map((s) => s.trim()).filter(Boolean) });
      if (file) await dataService.setMerchPhoto({ itemId: saved.id, file });
      onDone();
    } catch (e) { setMsg(e.message); }
  };
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={grid}>
        <label style={lbl}>Item *<input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Official jersey" style={inp} /></label>
        <label style={lbl}>Price (₹) *<input type="number" min="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} style={inp} /></label>
        <label style={lbl}>Sizes (comma separated)<input value={f.sizes} onChange={(e) => setF({ ...f, sizes: e.target.value })} placeholder="S, M, L, XL" style={inp} /></label>
        <label style={lbl}>Stock (optional)<input type="number" min="0" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} placeholder="unlimited" style={inp} /></label>
      </div>
      <label style={lbl}>Description<textarea rows={2} maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ ...inp, resize: 'vertical' }} /></label>
      <label style={lbl}>Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
      {item && <label style={{ fontSize: '0.82rem' }}><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> On sale</label>}
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <Button size="sm" variant="primary" disabled={f.name.trim().length < 2 || f.price === ''} onClick={save}>Save</Button>
        <Button size="sm" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function OrderForm({ item, currentUser, onDone }) {
  const [f, setF] = useState({ size: item.sizes?.[0] || '', qty: 1, name: currentUser?.full_name || '', phone: currentUser?.mobile_number || '', note: '' });
  const [msg, setMsg] = useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
      {item.sizes?.length > 0 && <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>{item.sizes.map((s) => <button key={s} type="button" style={chip(f.size === s)} onClick={() => setF({ ...f, size: s })}>{s}</button>)}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '0.4rem' }}>
        <input type="number" min="1" max="20" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} style={inp} aria-label="Quantity" />
        <input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Your name" style={inp} />
      </div>
      <input value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone (only the organiser sees it)" style={inp} />
      <input value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Name / number to print on the jersey (optional)" style={inp} />
      <div style={{ fontSize: '0.8rem', color: '#475569' }}>Total {money(Number(item.price) * Number(f.qty || 0))} · pay the organiser when they confirm</div>
      {msg && <div style={{ color: msg.ok ? '#065f46' : '#b91c1c', fontSize: '0.8rem' }}>{msg.text}</div>}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <Button size="sm" variant="primary" onClick={async () => { setMsg(null); try { await dataService.orderMerch(item.id, f); setMsg({ ok: true, text: 'Order sent. The organiser will call you.' }); setTimeout(onDone, 1200); } catch (e) { setMsg({ ok: false, text: e.message }); } }}>Place order</Button>
        <Button size="sm" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

export function MerchPanel({ tournament, currentUser, onNavigate, compact = false }) {
  const [d, setD] = useState(null);
  const [orders, setOrders] = useState([]);
  const [mine, setMine] = useState([]);
  const [edit, setEdit] = useState(null); // item or 'new'
  const [buying, setBuying] = useState(null);
  const [filter, setFilter] = useState('open');
  const [msg, setMsg] = useState(null);
  const load = () => {
    dataService.listMerch(tournament.id).then((r) => {
      setD(r);
      if (r.is_organiser) dataService.listMerchOrders(tournament.id).then(setOrders).catch(() => {});
    }).catch((e) => setMsg(e.message));
    if (currentUser) dataService.myMerchOrders().then((o) => setMine((o || []).filter((x) => x.tournament?.id === tournament.id))).catch(() => {});
  };
  useEffect(() => { load(); }, [tournament.id, currentUser?.id]);
  if (d === null) return compact ? null : <Card><span style={{ color: '#64748b', fontSize: '0.84rem' }}>{msg || 'Loading…'}</span></Card>;
  const org = d.is_organiser;
  if (compact && d.items.length === 0) return null;
  const shown = orders.filter((o) => filter === 'all' || (filter === 'open' ? ['requested', 'confirmed', 'paid', 'ready'].includes(o.status) : o.status === filter));
  const setStatus = async (o, s) => { try { await dataService.updateMerchOrder(o.id, s); load(); } catch (e) { setMsg(e.message); } };
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Shirt size={17} /> Merchandise</span>} subtitle={org ? 'Sell jerseys, caps and T-shirts. You confirm each order and collect payment directly.' : 'Official tournament merchandise – order here, pay the organiser on confirmation.'}>
      {d.items.length === 0 && !edit && <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>Nothing on sale yet.</span>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.8rem' }}>
        {d.items.map((it) => (
          <div key={it.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.7rem', overflow: 'hidden', opacity: it.is_active ? 1 : 0.55, background: '#fff' }}>
            <div style={{ height: 150, background: it.photo_url ? `center/cover no-repeat url(${it.photo_url})` : 'linear-gradient(135deg,#065f46,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{!it.photo_url && <Shirt size={40} />}</div>
            <div style={{ padding: '0.6rem 0.7rem' }}>
              <div style={{ fontWeight: 800 }}>{it.name}</div>
              <div style={{ fontWeight: 800, color: '#065f46' }}>{money(it.price)}</div>
              {it.description && <div style={{ fontSize: '0.78rem', color: '#475569' }}>{it.description}</div>}
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{it.sizes?.length ? `Sizes ${it.sizes.join(' · ')}` : ''}{it.stock != null ? `${it.sizes?.length ? ' · ' : ''}${it.stock} left` : ''}{org ? ` · ${it.orders || 0} orders, ${it.sold || 0} sold` : ''}{!it.is_active ? ' · not on sale' : ''}</div>
              {org ? (
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem' }}>
                  <button type="button" className="btn-mini" onClick={() => setEdit(it)}>Edit</button>
                  <label className="btn-mini" style={{ cursor: 'pointer' }}><Camera size={13} /><input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files[0]; if (!f) return; try { await dataService.setMerchPhoto({ itemId: it.id, file: f }); load(); } catch (er) { setMsg(er.message); } }} /></label>
                  <button type="button" className="btn-mini" style={{ color: '#b91c1c' }} onClick={async () => { if (!window.confirm('Remove this item? Items with orders are hidden instead.')) return; try { await dataService.deleteMerchItem(it.id); load(); } catch (er) { setMsg(er.message); } }}><Trash2 size={13} /></button>
                </div>
              ) : it.is_active && (it.stock == null || it.stock > 0) && (
                buying === it.id ? <OrderForm item={it} currentUser={currentUser} onDone={() => { setBuying(null); load(); }} />
                  : <Button size="sm" variant="primary" style={{ marginTop: '0.4rem' }} onClick={() => currentUser ? setBuying(it.id) : onNavigate && onNavigate('login')}>{currentUser ? 'Order' : 'Log in to order'}</Button>
              )}
              {!org && it.stock === 0 && <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '0.3rem' }}>Sold out</div>}
            </div>
          </div>
        ))}
      </div>
      {org && (edit ? <div style={{ marginTop: '0.8rem' }}><ItemForm tournament={tournament} item={edit === 'new' ? null : edit} onDone={() => { setEdit(null); load(); }} /></div>
        : <div style={{ marginTop: '0.8rem' }}><Button size="sm" variant="primary" onClick={() => setEdit('new')} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Plus size={13} /> Add item</Button></div>)}

      {mine.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <strong style={{ fontSize: '0.88rem' }}>My orders</strong>
          {mine.map((o) => (
            <div key={o.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.84rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ flex: 1 }}>{o.qty} × {o.item_name}{o.size ? ` (${o.size})` : ''} · {money(o.amount)}</span>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, background: STATUS_COLOR[o.status] }}>{STATUS_LABEL[o.status]}</span>
              {o.status === 'requested' && <button type="button" className="btn-mini" onClick={() => setStatus(o, 'cancelled')}>Cancel</button>}
            </div>
          ))}
        </div>
      )}

      {org && orders.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.88rem', marginRight: '0.4rem' }}>Orders</strong>
            {[['open', 'Open'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([k, l]) => <button key={k} type="button" style={chip(filter === k)} onClick={() => setFilter(k)}>{l}</button>)}
            <span style={{ fontSize: '0.78rem', color: '#475569', marginLeft: 'auto' }}>Collected: {money(orders.filter((o) => ['paid', 'ready', 'delivered'].includes(o.status)).reduce((a, o) => a + Number(o.amount), 0))}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
            {shown.map((o) => (
              <div key={o.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.6rem', border: '1px solid #f1f5f9', borderRadius: '0.5rem', fontSize: '0.84rem' }}>
                <span style={{ flex: 1, minWidth: 180 }}><strong>{o.buyer_name}</strong> – {o.qty} × {o.item_name}{o.size ? ` (${o.size})` : ''} · {money(o.amount)}{o.note ? <span style={{ color: '#64748b' }}> · “{o.note}”</span> : ''}</span>
                <a href={`tel:${o.phone}`} style={{ color: '#2563eb', display: 'inline-flex', gap: 3, alignItems: 'center', fontSize: '0.8rem' }}><Phone size={13} /> {o.phone}</a>
                <select value={o.status} onChange={(e) => setStatus(o, e.target.value)} style={{ ...inp, width: 'auto', background: STATUS_COLOR[o.status] }}>{STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
              </div>
            ))}
            {shown.length === 0 && <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No orders here.</span>}
          </div>
        </div>
      )}
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: '0.5rem' }}>{msg}</div>}
    </Card>
  );
}

export default MerchPanel;
