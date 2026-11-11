import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { MonitorSmartphone, Plus, Trash2 } from 'lucide-react';
import { SLOT_LABEL, inp, lbl, grid, fmtDate } from './brandShared.jsx';

/**
 * #194 Advertising placements. scope="tournament": the organiser's adverts on the tournament page, its website and its
 * match pages. scope="site": admins' adverts across the website (home page, matches page, every match page, footer).
 * Payments for adverts come later (Category O); for now this manages placement, dates and counts views and clicks.
 */
const SLOTS = { tournament: ['tournament_page', 'tournament_site', 'match_page'], site: ['home_top', 'home_mid', 'matches', 'match_page', 'tournament_page', 'footer'] };

export function AdsPanel({ scope = 'tournament', tournament = null }) {
  const [list, setList] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => dataService.listAds(scope === 'tournament' ? { tournament_id: tournament.id } : {}).then(setList).catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
    (scope === 'tournament'
      ? dataService.listTournamentSponsors(tournament.id).then((r) => (r?.items || []).filter((s) => s.status === 'active').map((s) => s.sponsor))
      : dataService.listSponsors({})).then(setSponsors).catch(() => {});
  }, [scope, tournament?.id]);
  const blank = { title: '', slot: SLOTS[scope][0], link_url: '', sponsor_id: '', starts_on: new Date().toISOString().slice(0, 10), ends_on: '', is_active: true };
  const save = async () => {
    setMsg(null); setBusy(true);
    try {
      const ad = await dataService.saveAd(form.id || null, { ...form, scope, tournament_id: tournament?.id });
      if (file) await dataService.setAdImage({ adId: ad.id, file });
      else if (!form.id) setMsg('Saved. Add a picture – adverts show only once they have one.');
      setForm(null); setFile(null); load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const act = async (fn) => { setMsg(null); try { await fn(); load(); } catch (e) { setMsg(e.message); } };
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><MonitorSmartphone size={17} /> {scope === 'site' ? 'Website adverts' : 'Adverts on this tournament'}</span>}
      subtitle={scope === 'site' ? 'Banners on the home page, matches page, match pages and footer. Wide pictures (about 1200×300) look best.' : 'Banners for your sponsors on the tournament page, tournament website and this tournament\'s match pages.'}>
      {list === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>{msg || 'Loading…'}</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {list.length === 0 && !form && <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No adverts yet.</span>}
          {list.map((a) => {
            const running = a.is_active && a.image_url && a.starts_on <= new Date().toISOString().slice(0, 10) && (!a.ends_on || a.ends_on >= new Date().toISOString().slice(0, 10));
            return (
              <div key={a.id} style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                {a.image_url ? <img src={a.image_url} alt="" style={{ width: 120, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ width: 120, height: 40, borderRadius: 6, background: '#f1f5f9', fontSize: '0.7rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>no picture</span>}
                <div style={{ flex: 1, minWidth: 160, fontSize: '0.84rem' }}>
                  <div style={{ fontWeight: 800 }}>{a.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{SLOT_LABEL[a.slot]}{a.sponsor_name ? ` · ${a.sponsor_name}` : ''} · {fmtDate(a.starts_on)}{a.ends_on ? ` – ${fmtDate(a.ends_on)}` : ' onwards'}</div>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, backgroundColor: running ? '#dcfce7' : '#f1f5f9', color: running ? '#065f46' : '#64748b' }}>{running ? 'showing' : !a.image_url ? 'needs picture' : a.is_active ? 'not in dates' : 'paused'}</span>
                <span style={{ fontSize: '0.76rem', color: '#475569' }}>{a.impressions} views · {a.clicks} clicks</span>
                <label className="btn-mini" style={{ cursor: 'pointer' }}>Picture<input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; if (f) act(() => dataService.setAdImage({ adId: a.id, file: f })); }} /></label>
                <button type="button" className="btn-mini" onClick={() => setForm({ ...a, link_url: a.link_url || '', sponsor_id: a.sponsor_id || '', ends_on: a.ends_on || '' })}>Edit</button>
                <button type="button" className="btn-mini" onClick={() => act(() => dataService.saveAd(a.id, { ...a, is_active: !a.is_active }))}>{a.is_active ? 'Pause' : 'Resume'}</button>
                <button type="button" className="btn-mini" style={{ color: '#b91c1c' }} onClick={() => window.confirm('Delete this advert?') && act(() => dataService.deleteAd(a.id))}><Trash2 size={13} /></button>
              </div>
            );
          })}
          {form ? (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={grid}>
                <label style={lbl}>Title *<input value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Raju Sports – 20% off bats" style={inp} /></label>
                <label style={lbl}>Where<select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} style={inp}>{SLOTS[scope].map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select></label>
                <label style={lbl}>Sponsor<select value={form.sponsor_id} onChange={(e) => setForm({ ...form, sponsor_id: e.target.value })} style={inp}><option value="">—</option>{sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label style={lbl}>Link when tapped<input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://" style={inp} /></label>
                <label style={lbl}>From<input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} style={inp} /></label>
                <label style={lbl}>Until (optional)<input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} style={inp} /></label>
              </div>
              <label style={lbl}>Picture (JPG / PNG / WEBP, under 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <Button size="sm" variant="primary" disabled={busy || form.title.trim().length < 2} onClick={save}>{busy ? 'Saving…' : 'Save advert'}</Button>
                <Button size="sm" variant="secondary" onClick={() => { setForm(null); setFile(null); }}>Cancel</Button>
              </div>
            </div>
          ) : <div><Button size="sm" variant="primary" onClick={() => setForm(blank)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Plus size={13} /> New advert</Button></div>}
          {msg && <div style={{ fontSize: '0.82rem', color: msg.startsWith('Saved') ? '#065f46' : '#b91c1c' }}>{msg}</div>}
        </div>
      )}
    </Card>
  );
}

export default AdsPanel;
