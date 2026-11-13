import React, { useEffect, useRef, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { X, Printer } from 'lucide-react';
import { TIER_LABEL, SLOT_LABEL, money, fmtDate } from './brandShared.jsx';

/** #199 Tournament report for a sponsor: the cricket played, and where and how often the sponsor was seen. */
const n = (v) => Number(v || 0).toLocaleString('en-IN');

export function SponsorReport({ sponsorshipId, onClose }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  const box = useRef(null);
  useEffect(() => { dataService.sponsorReport(sponsorshipId).then(setR).catch((e) => setErr(e.message)); }, [sponsorshipId]);
  const print = () => {
    const w = window.open('', '_blank'); if (!w || !box.current) return;
    w.document.write(`<title>Sponsor report – ${r.sponsorship.sponsor.name}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;margin:24px}
      h1{font-size:22px;margin:0}h2{font-size:15px;margin:18px 0 6px;color:#065f46;text-transform:uppercase;letter-spacing:.04em}table{border-collapse:collapse;width:100%;font-size:13px}
      td,th{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.stat{border:1px solid #e2e8f0;border-radius:8px;padding:8px}
      .stat b{display:block;font-size:20px}.stat span{font-size:11px;color:#64748b}.muted{color:#64748b;font-size:12px}button{display:none}</style>${box.current.innerHTML}`);
    w.document.close(); setTimeout(() => w.print(), 300);
  };
  const Stat = ({ v, l }) => <div className="stat" style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.6rem' }}><b style={{ display: 'block', fontSize: '1.3rem' }}>{v}</b><span style={{ fontSize: '0.72rem', color: '#64748b' }}>{l}</span></div>;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 0.8rem', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '0.9rem', maxWidth: 820, width: '100%', padding: '1.2rem 1.4rem', position: 'relative' }}>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
          {r && <button type="button" className="btn-mini" onClick={print}><Printer size={13} /> Print / save as PDF</button>}
          <button type="button" className="btn-mini" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>
        {err && <div style={{ color: '#b91c1c' }}>{err}</div>}
        {!r && !err && <div style={{ color: '#64748b' }}>Preparing the report…</div>}
        {r && (
          <div ref={box}>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
              {r.sponsorship.sponsor.logo_url && <img src={r.sponsorship.sponsor.logo_url} alt="" style={{ height: 54, maxWidth: 140, objectFit: 'contain' }} />}
              <div>
                <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Sponsor report – {r.sponsorship.sponsor.name}</h1>
                <div className="muted" style={{ fontSize: '0.84rem', color: '#64748b' }}>
                  {TIER_LABEL[r.sponsorship.tier]} of <strong>{r.tournament.name}</strong> · {fmtDate(r.tournament.start_date)}{r.tournament.end_date ? ` – ${fmtDate(r.tournament.end_date)}` : ''}{r.tournament.venue ? ` · ${r.tournament.venue}` : ''}
                </div>
                <div className="muted" style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Organised by {r.tournament.organizer_name || '—'} · report made {new Date(r.generated_at).toLocaleString('en-IN')}{r.sponsorship.amount != null ? ` · sponsorship ${money(r.sponsorship.amount)}` : ''}</div>
              </div>
            </div>
            <h2 style={{ fontSize: '0.86rem', margin: '1.1rem 0 0.4rem', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Where your brand was seen</h2>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
              <Stat v={n(r.exposure.tournament_page_views)} l="Tournament page views (all time)" />
              <Stat v={n(r.exposure.tournament_page_views_since_joined)} l="…since you joined" />
              <Stat v={n(r.exposure.ad_impressions)} l="Advert impressions" />
              <Stat v={n(r.exposure.ad_clicks)} l="Advert clicks" />
              <Stat v={n(r.exposure.sponsor_profile_views)} l="Your sponsor page views" />
              <Stat v={n(r.exposure.campaign_views)} l="Campaign views" />
              <Stat v={n(r.exposure.photos_videos)} l="Photos & videos posted" />
              <Stat v={n(r.exposure.certificates)} l="Certificates issued" />
            </div>
            {r.exposure.ads.length > 0 && (
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem', marginTop: '0.6rem' }}>
                <thead><tr>{['Advert', 'Where', 'Impressions', 'Clicks', 'Click rate'].map((h) => <th key={h} style={{ border: '1px solid #e2e8f0', padding: '0.35rem 0.5rem', textAlign: 'left', background: '#f8fafc' }}>{h}</th>)}</tr></thead>
                <tbody>{r.exposure.ads.map((a, i) => (
                  <tr key={i}>{[a.title, SLOT_LABEL[a.slot] || a.slot, n(a.impressions), n(a.clicks), a.impressions ? `${((a.clicks / a.impressions) * 100).toFixed(1)}%` : '–'].map((v, j) => <td key={j} style={{ border: '1px solid #e2e8f0', padding: '0.35rem 0.5rem' }}>{v}</td>)}</tr>
                ))}</tbody>
              </table>
            )}
            <h2 style={{ fontSize: '0.86rem', margin: '1.1rem 0 0.4rem', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>The cricket</h2>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
              <Stat v={n(r.cricket.teams)} l="Teams" />
              <Stat v={n(r.cricket.players)} l="Players" />
              <Stat v={`${n(r.cricket.matches_played)} / ${n(r.cricket.matches_total)}`} l="Matches played" />
              <Stat v={n(r.cricket.runs)} l="Runs scored" />
              <Stat v={n(r.cricket.fours)} l="Fours" />
              <Stat v={n(r.cricket.sixes)} l="Sixes" />
              <Stat v={n(r.cricket.wickets)} l="Wickets" />
            </div>
            {r.awards.length > 0 && (
              <>
                <h2 style={{ fontSize: '0.86rem', margin: '1.1rem 0 0.4rem', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Awards</h2>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.86rem' }}>{r.awards.map((a) => <li key={a.id}><strong>{a.label}</strong>: {a.player?.name || a.team?.name}</li>)}</ul>
              </>
            )}
            <p className="muted" style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '1rem' }}>Views and clicks are counted by the Cricnotch website (one view per page visit). Figures are live and keep growing until the tournament ends.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SponsorReport;
