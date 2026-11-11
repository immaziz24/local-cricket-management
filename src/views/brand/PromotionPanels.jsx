import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Globe, Handshake, Megaphone, Camera, Check, X, FileBarChart, Trash2, Plus, Search } from 'lucide-react';
import { TIERS, TIER_LABEL, CTA_LABEL, THEMES, inp, lbl, grid, chip, money, fmtDate, siteUrl, QrCard } from './brandShared.jsx';
import { SponsorReport } from './SponsorReport.jsx';

/* ---------- #189 tournament website + #190 QR ---------- */
const SECTIONS = [['fixtures', 'Fixtures'], ['results', 'Results'], ['points', 'Points table'], ['stats', 'Top players'], ['teams', 'Teams'], ['sponsors', 'Sponsors'], ['awards', 'Awards'], ['gallery', 'Photos'], ['merch', 'Merchandise']];

export function SiteSettingsCard({ tournament, isOrganiser, onNavigate }) {
  const [site, setSite] = useState(tournament.site || {});
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState(null);
  const url = siteUrl(`t=${tournament.code || tournament.id}`);
  const sections = site.sections || SECTIONS.map(([k]) => k);
  const save = async () => { setMsg(null); try { const s = await dataService.saveTournamentSite(tournament.id, site); setSite(s); setEdit(false); setMsg({ ok: true, text: 'Saved.' }); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const set = (k) => (e) => setSite({ ...site, [k]: e.target.value });
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Globe size={17} /> Tournament website & QR code</span>}
      subtitle="A page just for this tournament – fixtures, results, points table, sponsors and more. Share the link or print the QR code.">
      <QrCard url={url} title={tournament.name} subtitle="Scan for fixtures, live scores & results" />
      <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button size="sm" variant="primary" onClick={() => onNavigate && onNavigate('tournament-site', tournament.code || tournament.id)}>Open the tournament website</Button>
        {isOrganiser && !edit && <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Customise website</Button>}
      </div>
      {edit && (
        <div style={{ marginTop: '0.8rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.8rem' }}>
          <label style={lbl}>Tagline<input value={site.tagline || ''} maxLength={120} onChange={set('tagline')} placeholder="e.g. The biggest tennis-ball tournament in town" style={inp} /></label>
          <label style={{ ...lbl, marginTop: '0.5rem' }}>About the tournament<textarea rows={4} maxLength={3000} value={site.about || ''} onChange={set('about')} style={{ ...inp, resize: 'vertical' }} /></label>
          <div style={{ ...grid, marginTop: '0.5rem' }}>
            <label style={lbl}>Contact name<input value={site.contact_name || ''} maxLength={60} onChange={set('contact_name')} style={inp} /></label>
            <label style={lbl}>Contact phone<input value={site.contact_phone || ''} maxLength={20} onChange={set('contact_phone')} style={inp} /></label>
            <label style={lbl}>WhatsApp (with country code)<input value={site.whatsapp || ''} maxLength={15} onChange={set('whatsapp')} placeholder="919876543210" style={inp} /></label>
            <label style={lbl}>Email<input value={site.email || ''} maxLength={120} onChange={set('email')} style={inp} /></label>
            <label style={lbl}>Instagram<input value={site.instagram || ''} onChange={set('instagram')} placeholder="https://instagram.com/…" style={inp} /></label>
            <label style={lbl}>Facebook<input value={site.facebook || ''} onChange={set('facebook')} placeholder="https://facebook.com/…" style={inp} /></label>
            <label style={lbl}>YouTube<input value={site.youtube || ''} onChange={set('youtube')} placeholder="https://youtube.com/…" style={inp} /></label>
          </div>
          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#64748b' }}>Colour</div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
            {Object.entries(THEMES).map(([k, [a, b]]) => <button key={k} type="button" aria-label={k} onClick={() => setSite({ ...site, theme: k })} style={{ width: 30, height: 30, borderRadius: 15, cursor: 'pointer', border: (site.theme || 'green') === k ? '3px solid #0f172a' : '2px solid #fff', background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: '0 0 0 1px #cbd5e1' }} />)}
          </div>
          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#64748b' }}>Sections to show</div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {SECTIONS.map(([k, l]) => <button key={k} type="button" style={chip(sections.includes(k))} onClick={() => setSite({ ...site, sections: sections.includes(k) ? sections.filter((x) => x !== k) : [...sections, k] })}>{l}</button>)}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
            <Button size="sm" variant="primary" onClick={save}>Save website</Button>
            <Button size="sm" variant="secondary" onClick={() => { setSite(tournament.site || {}); setEdit(false); }}>Cancel</Button>
          </div>
        </div>
      )}
      {msg && <div style={{ fontSize: '0.82rem', marginTop: '0.4rem', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.text}</div>}
    </Card>
  );
}

/* ---------- #191–#193 sponsors of a tournament ---------- */
function SponsorPicker({ onPick, onCancel, mine = false, title }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const load = () => dataService.listSponsors({ query: q, mine }).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem', background: '#f8fafc' }}>
      <strong style={{ fontSize: '0.86rem' }}>{title}</strong>
      {!mine && (
        <div style={{ display: 'flex', gap: '0.4rem', margin: '0.4rem 0' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search registered sponsors" style={inp} />
          <Button size="sm" variant="secondary" onClick={load}><Search size={14} /></Button>
        </div>
      )}
      {list === null ? 'Loading…' : list.length === 0 ? <div style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.4rem 0' }}>{mine ? 'You have no sponsor profile yet – register one on the Sponsors page first.' : 'No sponsor found. Ask the business to register on the Sponsors page (it is free).'}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 220, overflowY: 'auto', margin: '0.4rem 0' }}>
          {list.map((s) => (
            <button key={s.id} type="button" onClick={() => onPick(s)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
              {s.logo_url ? <img src={s.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} /> : <span style={{ width: 28, height: 28, borderRadius: 6, background: '#059669', color: '#fff', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.name.charAt(0)}</span>}
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.name}</span><span style={{ fontSize: '0.76rem', color: '#64748b' }}>{s.city || ''}</span>
            </button>
          ))}
        </div>
      )}
      <Button size="sm" variant="secondary" onClick={onCancel}>Close</Button>
    </div>
  );
}

export function TournamentSponsorsPanel({ tournament, currentUser, onNavigate }) {
  const [d, setD] = useState(null);
  const [mode, setMode] = useState(null); // invite | apply
  const [pick, setPick] = useState(null);
  const [form, setForm] = useState({ tier: 'partner', amount: '', note: '' });
  const [msg, setMsg] = useState(null);
  const [report, setReport] = useState(null);
  const load = () => dataService.listTournamentSponsors(tournament.id).then(setD).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [tournament.id]);
  const run = async (fn, ok) => { setMsg(null); try { await fn(); setMsg(ok ? { ok: true, text: ok } : null); load(); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const send = () => run(async () => {
    if (mode === 'invite') await dataService.inviteSponsor(tournament.id, pick.id, form.tier, form.amount, form.note);
    else await dataService.applyToSponsor(tournament.id, pick.id, form.tier, form.note);
    setMode(null); setPick(null); setForm({ tier: 'partner', amount: '', note: '' });
  }, mode === 'invite' ? 'Sent. The sponsor sees the invitation on their sponsor page.' : 'Offer sent to the organiser.');
  const items = d?.items || [];
  const org = d?.is_organiser;
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Handshake size={17} /> Sponsors</span>}
      subtitle="Sponsor logos show on the tournament page, website and match pages; the title sponsor's banner shows at the top.">
      {d === null ? <span style={{ color: '#64748b', fontSize: '0.84rem' }}>Loading…</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.length === 0 && <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No sponsors yet.</span>}
          {items.map((s) => (
            <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.6rem 0.7rem', opacity: s.status === 'declined' || s.status === 'ended' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {s.sponsor.logo_url ? <img src={s.sponsor.logo_url} alt="" style={{ height: 36, maxWidth: 90, objectFit: 'contain' }} /> : <span style={{ width: 36, height: 36, borderRadius: 8, background: '#059669', color: '#fff', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.sponsor.name.charAt(0)}</span>}
                <button type="button" onClick={() => onNavigate && onNavigate('sponsor', s.sponsor.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 800 }}>{s.sponsor.name}</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{TIER_LABEL[s.tier]}{s.amount != null ? ` · ${money(s.amount)}` : ''}{s.status !== 'active' ? ` · ${s.status === 'invited' ? 'invitation sent' : s.status === 'applied' ? 'offer waiting for organiser' : s.status}` : ''}</div>
                </button>
                {org && s.status === 'applied' && <><Button size="sm" variant="primary" onClick={() => run(() => dataService.respondSponsorship(s.id, true), 'Sponsor added.')} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Check size={13} /> Accept</Button><Button size="sm" variant="secondary" onClick={() => run(() => dataService.respondSponsorship(s.id, false))}><X size={13} /></Button></>}
                {s.is_sponsor_owner && s.status === 'invited' && <><Button size="sm" variant="primary" onClick={() => run(() => dataService.respondSponsorship(s.id, true), 'You are now a sponsor.')}><Check size={13} /> Accept</Button><Button size="sm" variant="secondary" onClick={() => run(() => dataService.respondSponsorship(s.id, false))}><X size={13} /></Button></>}
                {org && s.status === 'active' && (
                  <select value={s.tier} onChange={(e) => run(() => dataService.updateSponsorship(s.id, { tier: e.target.value }))} style={{ ...inp, width: 'auto' }}>
                    {TIERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                )}
                {s.can_edit && (s.status === 'active' || s.status === 'ended') && (
                  <>
                    <label className="btn-mini" style={{ cursor: 'pointer' }} title="Wide banner, about 1200×300"><Camera size={13} /> Banner
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files[0]; if (file) run(() => dataService.setSponsorshipBanner({ sponsorshipId: s.id, file }), 'Banner uploaded.'); }} />
                    </label>
                    <button type="button" className="btn-mini" onClick={() => setReport(s.id)}><FileBarChart size={13} /> Report</button>
                  </>
                )}
                {org && s.status === 'active' && <button type="button" className="btn-mini" onClick={() => run(() => dataService.updateSponsorship(s.id, { status: 'ended' }))}>End</button>}
                {s.can_edit && <button type="button" className="btn-mini" title="Remove" onClick={() => window.confirm('Remove this sponsor from the tournament?') && run(() => dataService.removeSponsorship(s.id))} style={{ color: '#b91c1c' }}><Trash2 size={13} /></button>}
              </div>
              {s.banner_url && <img src={s.banner_url} alt="" style={{ width: '100%', maxHeight: 110, objectFit: 'cover', borderRadius: '0.5rem', marginTop: '0.5rem' }} />}
            </div>
          ))}

          {mode && !pick && <SponsorPicker mine={mode === 'apply'} title={mode === 'invite' ? 'Choose a sponsor to invite' : 'Choose your sponsor profile'} onPick={setPick} onCancel={() => setMode(null)} />}
          {mode && pick && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.88rem' }}>{mode === 'invite' ? `Invite ${pick.name}` : `Offer to sponsor as ${pick.name}`}</strong>
              <div style={grid}>
                <label style={lbl}>Level<select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} style={inp}>{TIERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                {mode === 'invite' && <label style={lbl}>Amount (₹, private)<input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inp} /></label>}
              </div>
              <label style={lbl}>{mode === 'invite' ? 'Note (private)' : 'Message to the organiser'}<input value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={mode === 'invite' ? 'e.g. ₹5,000 + 2 boxes of balls' : 'What you offer'} style={inp} /></label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <Button size="sm" variant="primary" onClick={send}>{mode === 'invite' ? 'Send invitation' : 'Send offer'}</Button>
                <Button size="sm" variant="secondary" onClick={() => { setPick(null); setMode(null); }}>Cancel</Button>
              </div>
            </div>
          )}
          {!mode && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {org && <Button size="sm" variant="primary" onClick={() => setMode('invite')} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Plus size={13} /> Add / invite a sponsor</Button>}
              {currentUser && !org && <Button size="sm" variant="primary" onClick={() => setMode('apply')} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Handshake size={13} /> Offer to sponsor</Button>}
              <Button size="sm" variant="secondary" onClick={() => onNavigate && onNavigate('sponsors')}>Sponsor directory</Button>
            </div>
          )}
          {msg && <div style={{ fontSize: '0.82rem', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.text}</div>}
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sponsorship money is paid directly to the organiser for now; online sponsorship payments come later.</span>
        </div>
      )}
      {report && <SponsorReport sponsorshipId={report} onClose={() => setReport(null)} />}
    </Card>
  );
}

/* ---------- #195 promotional campaigns ---------- */
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function CampaignsPanel({ tournament }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => dataService.listCampaigns(tournament.id).then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, [tournament.id]);
  const blank = () => ({ title: '', message: '', cta: tournament.registration_open ? 'register' : 'follow', link_url: '', city: tournament.city || '', starts_at: toLocal(new Date()), ends_at: toLocal(new Date(Date.now() + 14 * 864e5)) });
  const save = async () => {
    setMsg(null);
    try { await dataService.saveCampaign(form.id || null, { ...form, tournament_id: tournament.id, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() }); setForm(null); load(); }
    catch (e) { setMsg(e.message); }
  };
  const setStatus = async (c, status) => { try { await dataService.saveCampaign(c.id, { ...c, status }); load(); } catch (e) { setMsg(e.message); } };
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Megaphone size={17} /> Promotional campaigns</span>}
      subtitle="Short promotions shown in the “Promoted” area of the home page (people in your city see them first). Up to 3 at a time, up to 60 days each.">
      {list === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>{msg || 'Loading…'}</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {list.length === 0 && !form && <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No campaigns yet. Try “Team registration open – ₹2,000 entry, ₹25,000 prize”.</span>}
          {list.map((c) => {
            const live = c.status === 'active' && !c.is_hidden && new Date(c.starts_at) <= new Date() && new Date(c.ends_at) > new Date();
            return (
              <div key={c.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.55rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 800 }}>{c.title}</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{CTA_LABEL[c.cta]}{c.city ? ` · ${c.city}` : ''} · {fmtDate(c.starts_at)} – {fmtDate(c.ends_at)}</div>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, backgroundColor: live ? '#dcfce7' : '#f1f5f9', color: live ? '#065f46' : '#64748b' }}>{c.is_hidden ? 'hidden by admin' : live ? 'running' : c.status === 'active' ? (new Date(c.ends_at) <= new Date() ? 'finished' : 'scheduled') : c.status}</span>
                <span style={{ fontSize: '0.76rem', color: '#475569' }}>{c.views} views · {c.clicks} clicks</span>
                <button type="button" className="btn-mini" onClick={() => setForm({ ...c, starts_at: toLocal(c.starts_at), ends_at: toLocal(c.ends_at), message: c.message || '', link_url: c.link_url || '', city: c.city || '' })}>Edit</button>
                {c.status === 'active' ? <button type="button" className="btn-mini" onClick={() => setStatus(c, 'paused')}>Pause</button> : <button type="button" className="btn-mini" onClick={() => setStatus(c, 'active')}>Resume</button>}
              </div>
            );
          })}
          {form ? (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Headline, e.g. Registration open – 16 teams only" style={inp} />
              <textarea rows={2} maxLength={300} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Short message (optional)" style={{ ...inp, resize: 'vertical' }} />
              <div style={grid}>
                <label style={lbl}>Button<select value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} style={inp}>{Object.entries(CTA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                {form.cta === 'custom' && <label style={lbl}>Link<input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://" style={inp} /></label>}
                <label style={lbl}>Show first to people in<input value={form.city} maxLength={80} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City (optional)" style={inp} /></label>
                <label style={lbl}>Starts<input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} style={inp} /></label>
                <label style={lbl}>Ends<input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} style={inp} /></label>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <Button size="sm" variant="primary" disabled={form.title.trim().length < 3} onClick={save}>{form.id ? 'Save' : 'Start campaign'}</Button>
                <Button size="sm" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </div>
          ) : <div><Button size="sm" variant="primary" onClick={() => setForm(blank())} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Plus size={13} /> New campaign</Button></div>}
          {msg && <div style={{ fontSize: '0.82rem', color: '#b91c1c' }}>{msg}</div>}
        </div>
      )}
    </Card>
  );
}

/** Home page / tournaments list: “Promoted” cards (#195). */
export function PromotedCampaigns({ onNavigate, city, limit = 3 }) {
  const [list, setList] = useState([]);
  useEffect(() => { dataService.activeCampaigns({ city, limit }).then((l) => setList(l || [])).catch(() => setList([])); }, [city, limit]);
  useEffect(() => { list.forEach((c) => { const k = `campaign:${c.id}`; if (!window.__lcSeen) window.__lcSeen = new Set(); if (!window.__lcSeen.has(k)) { window.__lcSeen.add(k); dataService.recordCampaignEvent(c.id, 'view').catch(() => {}); } }); }, [list]);
  if (!list.length) return null;
  const open = (c) => {
    dataService.recordCampaignEvent(c.id, 'click').catch(() => {});
    if (c.cta === 'custom' && c.link_url) window.open(c.link_url, '_blank', 'noopener,noreferrer');
    else onNavigate(c.cta === 'register' || c.cta === 'buy' ? 'tournament-site' : 'tournament-details', c.cta === 'register' || c.cta === 'buy' ? (c.tournament.code || c.tournament.id) : c.tournament.id);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.8rem' }}>
      {list.map((c) => (
        <button key={c.id} type="button" onClick={() => open(c)} style={{ textAlign: 'left', border: 'none', borderRadius: '0.9rem', padding: '1rem', cursor: 'pointer', color: '#fff', background: `linear-gradient(135deg, ${c.tournament.banner_color || '#064e3b'}, #10b981)`, display: 'flex', flexDirection: 'column', gap: '0.35rem', minHeight: 150 }}>
          <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.06em', opacity: 0.85 }}>PROMOTED · {c.tournament.name}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, lineHeight: 1.2 }}>{c.title}</span>
          {c.message && <span style={{ fontSize: '0.82rem', opacity: 0.92 }}>{c.message}</span>}
          <span style={{ marginTop: 'auto', alignSelf: 'flex-start', fontSize: '0.8rem', fontWeight: 800, background: 'rgba(255,255,255,0.18)', padding: '0.3rem 0.7rem', borderRadius: 999 }}>{CTA_LABEL[c.cta]} →</span>
        </button>
      ))}
    </div>
  );
}
