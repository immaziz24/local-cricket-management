import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { MapPin, Plus, Search, CalendarClock, CheckCircle, XCircle } from 'lucide-react';
import { GroundForm, FACILITIES, money, slotTime } from './groundShared.jsx';

/** Category G – grounds list (#147 registration, search) plus my bookings and requests waiting at my grounds (#154). */
export function GroundsView({ currentUser, onNavigate }) {
  const [f, setF] = useState({ query: '', city: '', facility: '', mine: false });
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);
  const [bk, setBk] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => dataService.listGrounds(f).then(setList).catch((e) => { setList([]); setMsg(e.message); });
  const loadBk = () => (currentUser ? dataService.myGroundBookings().then(setBk).catch(() => setBk(null)) : setBk(null));
  useEffect(() => { load(); }, [f.mine, f.facility]);
  useEffect(() => { loadBk(); }, [currentUser?.id]);
  const decide = async (id, action) => {
    const note = action === 'reject' ? window.prompt('Reason (optional):', '') : '';
    if (note === null) return;
    try { await dataService.decideGroundBooking(id, action, note); loadBk(); } catch (e) { setMsg(e.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={22} /> Grounds</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Find a ground and book a slot, or list your own ground.</p>
        </div>
        {currentUser && !adding && <Button variant="primary" onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Plus size={15} /> Register a ground</Button>}
      </div>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{msg}</div>}

      {adding && <GroundForm onCancel={() => setAdding(false)} onSaved={(g) => { setAdding(false); onNavigate && onNavigate('ground', g.ground.id); }} />}

      {bk && bk.waiting.length > 0 && (
        <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><CalendarClock size={16} /> Booking requests at your grounds ({bk.waiting.length})</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {bk.waiting.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0.7rem', borderRadius: '0.5rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{b.ground} · {slotTime(b.starts_at, b.ends_at)}</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{b.booked_by}{b.title ? ` – ${b.title}` : ''}{b.amount != null ? ` · ${money(b.amount)}` : ''}{b.note ? ` · “${b.note}”` : ''}</div>
                </div>
                <Button size="sm" variant="primary" onClick={() => decide(b.id, 'confirm')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={13} /> Confirm</Button>
                <Button size="sm" variant="secondary" onClick={() => decide(b.id, 'reject')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={13} /> Reject</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input placeholder="Ground name or area" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ flex: 2, minWidth: 160, padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }} />
          <input placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ flex: 1, minWidth: 120, padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }} />
          <select value={f.facility} onChange={(e) => setF({ ...f, facility: e.target.value })} style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }}>
            <option value="">Any facility</option>{FACILITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {currentUser && <label style={{ fontSize: '0.84rem' }}><input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} /> My grounds</label>}
          <Button variant="secondary" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Search size={14} /> Search</Button>
        </div>
      </Card>

      {list === null ? <div style={{ color: '#64748b' }}>Loading…</div> : list.length === 0 ? (
        <Card><p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>No grounds found.{currentUser ? ' Register your ground so teams can find and book it.' : ''}</p></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {list.map((g) => (
            <button key={g.id} onClick={() => onNavigate && onNavigate('ground', g.id)}
              style={{ textAlign: 'left', padding: 0, border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden', background: '#fff', cursor: 'pointer' }}>
              <div style={{ height: 120, background: g.cover_url ? `center/cover no-repeat url(${g.cover_url})` : 'linear-gradient(135deg,#166534,#4ade80)' }} />
              <div style={{ padding: '0.75rem' }}>
                <div style={{ fontWeight: 800 }}>{g.name}{g.is_mine && <span style={{ fontSize: '0.68rem', color: '#059669', marginLeft: 6 }}>YOURS</span>}{!g.is_active && <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: 6 }}>HIDDEN</span>}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{[g.address, g.city].filter(Boolean).join(', ') || '—'}</div>
                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.35rem' }}>
                  {g.pitch_type ? `${g.pitch_type} pitch · ` : ''}{g.hourly_rate != null ? `${money(g.hourly_rate)}/hr` : g.full_day_rate != null ? `${money(g.full_day_rate)}/day` : 'Ask for price'} · {g.matches} matches{g.rating ? ` · ${g.rating}★` : ''}
                </div>
                {(g.facilities || []).length > 0 && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>{g.facilities.map((x) => (FACILITIES.find((f2) => f2[0] === x) || [x, x])[1]).join(' · ')}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {bk && bk.mine.length > 0 && (
        <Card title="My bookings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {bk.mine.map((b) => (
              <div key={b.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.84rem', padding: '0.4rem 0.6rem', border: '1px solid #f1f5f9', borderRadius: '0.45rem' }}>
                <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('ground', b.ground_id)}><strong>{b.ground}</strong> · {slotTime(b.starts_at, b.ends_at)}{b.title ? ` · ${b.title}` : ''}</span>
                {b.amount != null && <span>{money(b.amount)}{b.paid ? ' paid' : ''}</span>}
                <span style={{ fontWeight: 700, color: b.status === 'confirmed' ? '#15803d' : b.status === 'requested' ? '#b45309' : '#94a3b8' }}>{b.status === 'requested' ? 'Waiting' : b.status}</span>
                {['requested', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date() && (
                  <Button size="sm" variant="secondary" onClick={() => window.confirm('Cancel this booking?') && decide(b.id, 'cancel')}>Cancel</Button>
                )}
                {b.owner_note && <div style={{ width: '100%', fontSize: '0.76rem', color: '#64748b' }}>Owner: {b.owner_note}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default GroundsView;
