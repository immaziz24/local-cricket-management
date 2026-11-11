import React, { useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { LocateFixed } from 'lucide-react';

export const FACILITIES = [
  ['floodlights', 'Floodlights'], ['changing_rooms', 'Changing rooms'], ['toilets', 'Toilets'], ['drinking_water', 'Drinking water'],
  ['parking', 'Parking'], ['scoreboard', 'Scoreboard'], ['sight_screens', 'Sight screens'], ['practice_nets', 'Practice nets'],
  ['canteen', 'Canteen'], ['seating', 'Seating'], ['first_aid', 'First aid'], ['covers', 'Pitch covers'], ['wifi', 'Wi-Fi'], ['power_backup', 'Power backup']
];
export const PITCH_TYPES = [['turf', 'Turf'], ['matting', 'Matting'], ['cement', 'Cement'], ['astroturf', 'Astroturf'], ['mud', 'Mud / clay'], ['mixed', 'Mixed']];
export const money = (n) => (n === null || n === undefined ? '–' : `₹${Number(n).toLocaleString('en-IN')}`);
export function slotTime(s, e) {
  const a = new Date(s); const b = new Date(e);
  return `${a.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${a.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}–${b.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}
export const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
export const lbl = { fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.6rem' };

/** #147 register / edit a ground – #150 location, #151 pitch, #152 boundary, #153 facilities, #156 rates. */
export function GroundForm({ ground, onSaved, onCancel }) {
  const t = (v) => (v ? String(v).slice(0, 5) : '');
  const [f, setF] = useState(() => ({
    name: '', city: '', address: '', latitude: '', longitude: '', description: '', contact_phone: '', pitch_type: '', pitch_count: '', pitch_notes: '',
    boundary_straight_m: '', boundary_square_m: '', boundary_notes: '', facilities: [], open_time: '', close_time: '',
    hourly_rate: '', half_day_rate: '', full_day_rate: '', night_extra: '', rental_notes: '', booking_open: true, is_active: true,
    ...Object.fromEntries(Object.entries(ground || {}).map(([k, v]) => [k, v ?? ''])),
    open_time: t(ground?.open_time), close_time: t(ground?.close_time)
  }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const field = (k, label, props = {}) => <label style={lbl}>{label}<input value={f[k] ?? ''} onChange={set(k)} style={inp} {...props} /></label>;
  const locate = () => {
    if (!navigator.geolocation) { setMsg('Location is not available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setF((x) => ({ ...x, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
      () => setMsg('Could not get your location – allow location access, or type the numbers from Google Maps.'));
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const g = await dataService.saveGround(ground?.id || null, f); onSaved && onSaved(g); }
    catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Card title={ground ? 'Edit ground' : 'Register a ground'} subtitle={ground ? null : 'Anyone can list a ground. You will manage its bookings.'}>
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.84rem', marginBottom: '0.6rem' }}>{msg}</div>}
      <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>About & location</h4>
      <div style={grid}>
        {field('name', 'Ground name *', { maxLength: 100 })}
        {field('city', 'City', { maxLength: 80 })}
        {field('address', 'Address / area', { maxLength: 250 })}
        {field('contact_phone', 'Contact phone', { maxLength: 20 })}
        {field('latitude', 'Latitude', { placeholder: 'e.g. 17.385' })}
        {field('longitude', 'Longitude', { placeholder: 'e.g. 78.486' })}
      </div>
      <button type="button" onClick={locate} style={{ marginTop: '0.4rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
        <LocateFixed size={13} /> Use my current location (stand at the ground)
      </button>
      <label style={{ ...lbl, marginTop: '0.5rem' }}>Description<textarea rows={2} maxLength={1500} value={f.description} onChange={set('description')} style={{ ...inp, resize: 'vertical' }} /></label>

      <h4 style={{ margin: '0.9rem 0 0.4rem', fontSize: '0.85rem' }}>Pitch & boundary</h4>
      <div style={grid}>
        <label style={lbl}>Pitch type<select value={f.pitch_type} onChange={set('pitch_type')} style={inp}><option value="">—</option>{PITCH_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {field('pitch_count', 'Number of pitches', { type: 'number', min: 1, max: 20 })}
        {field('boundary_straight_m', 'Straight boundary (m)', { type: 'number', min: 15, max: 120 })}
        {field('boundary_square_m', 'Square boundary (m)', { type: 'number', min: 15, max: 120 })}
      </div>
      <div style={{ ...grid, marginTop: '0.5rem' }}>
        <label style={lbl}>Pitch notes<textarea rows={2} maxLength={500} value={f.pitch_notes} onChange={set('pitch_notes')} style={{ ...inp, resize: 'vertical' }} placeholder="e.g. good bounce, slow after lunch" /></label>
        <label style={lbl}>Boundary notes<textarea rows={2} maxLength={500} value={f.boundary_notes} onChange={set('boundary_notes')} style={{ ...inp, resize: 'vertical' }} placeholder="e.g. short on the road side" /></label>
      </div>

      <h4 style={{ margin: '0.9rem 0 0.4rem', fontSize: '0.85rem' }}>Facilities</h4>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {FACILITIES.map(([k, l]) => {
          const on = f.facilities.includes(k);
          return <button key={k} type="button" onClick={() => setF({ ...f, facilities: on ? f.facilities.filter((x) => x !== k) : [...f.facilities, k] })}
            style={{ padding: '0.3rem 0.65rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.78rem', border: `1px solid ${on ? '#16a34a' : '#e2e8f0'}`, backgroundColor: on ? '#dcfce7' : '#fff' }}>{l}</button>;
        })}
      </div>

      <h4 style={{ margin: '0.9rem 0 0.4rem', fontSize: '0.85rem' }}>Opening hours & charges</h4>
      <div style={grid}>
        {field('open_time', 'Opens', { type: 'time' })}
        {field('close_time', 'Closes', { type: 'time' })}
        {field('hourly_rate', 'Per hour (₹)', { type: 'number', min: 0 })}
        {field('half_day_rate', 'Half day, 4+ hrs (₹)', { type: 'number', min: 0 })}
        {field('full_day_rate', 'Full day, 8+ hrs (₹)', { type: 'number', min: 0 })}
        {field('night_extra', 'Lights / evening extra (₹)', { type: 'number', min: 0 })}
      </div>
      <label style={{ ...lbl, marginTop: '0.5rem' }}>Rental notes<input value={f.rental_notes} maxLength={500} onChange={set('rental_notes')} style={inp} placeholder="e.g. balls not included, 50% advance" /></label>
      <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.6rem', fontSize: '0.86rem' }}>
        <label><input type="checkbox" checked={!!f.booking_open} onChange={set('booking_open')} /> Taking bookings</label>
        {ground && <label><input type="checkbox" checked={!!f.is_active} onChange={set('is_active')} /> Show in search</label>}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
        <Button variant="primary" disabled={busy || f.name.trim().length < 2} onClick={save}>{busy ? 'Saving…' : ground ? 'Save' : 'Register ground'}</Button>
        {onCancel && <Button variant="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>}
      </div>
    </Card>
  );
}
