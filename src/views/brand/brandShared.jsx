import React, { useEffect, useRef, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { Download, Printer, Copy, Share2, ExternalLink } from 'lucide-react';
import { qrSvg, drawQr } from './qr.js';
import { loadImage, roundRect, fitText, wrapText, downloadBlob } from '../media/mediaUtils.js';

// Shared pieces for Category J (#189–#199).
export const TIERS = [['title', 'Title sponsor'], ['powered_by', 'Powered by'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze'], ['partner', 'Partner']];
export const TIER_LABEL = Object.fromEntries(TIERS);
export const SPONSOR_CATS = [['business', 'Business'], ['shop', 'Shop'], ['restaurant', 'Restaurant / café'], ['academy', 'Academy'], ['brand', 'Brand'], ['media', 'Media'], ['individual', 'Individual'], ['other', 'Other']];
export const SLOT_LABEL = { home_top: 'Home page – top', home_mid: 'Home page – middle', matches: 'Matches page', match_page: 'Match pages', tournament_page: 'Tournament page', tournament_site: 'Tournament website', footer: 'Bottom of every page' };
export const CTA_LABEL = { register: 'Register your team', follow: 'Follow the tournament', watch: 'Watch live', buy: 'Buy merchandise', custom: 'Find out more' };
export const THEMES = { green: ['#064e3b', '#10b981'], blue: ['#1e3a8a', '#3b82f6'], red: ['#7f1d1d', '#ef4444'], purple: ['#3b0764', '#a855f7'], orange: ['#7c2d12', '#f97316'], dark: ['#020617', '#334155'] };
export const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
export const lbl = { fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' };
export const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' };
export const money = (n) => (n == null || n === '' ? '' : `₹${Number(n).toLocaleString('en-IN')}`);
export const chip = (on) => ({ padding: '0.3rem 0.7rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${on ? '#16a34a' : '#e2e8f0'}`, backgroundColor: on ? '#dcfce7' : '#fff', fontWeight: on ? 700 : 500 });
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const siteUrl = (q) => `${window.location.origin}${window.location.pathname}?${q}`;

const seen = new Set(); // count an advert / campaign once per page load
export function trackOnce(kind, id, fn) { const k = `${kind}:${id}`; if (seen.has(k)) return; seen.add(k); fn().catch(() => {}); }

/** #194 An advert slot. Renders nothing when no advert is running. */
export function AdSlot({ slot, tournamentId = null, style, className }) {
  const [ads, setAds] = useState([]);
  useEffect(() => { dataService.getAds(slot, tournamentId).then((a) => setAds(a || [])).catch(() => setAds([])); }, [slot, tournamentId]);
  useEffect(() => { ads.forEach((a) => trackOnce('ad', a.id, () => dataService.recordAdEvent(a.id, 'view'))); }, [ads]);
  if (!ads.length) return null;
  const a = ads[0];
  const open = () => { dataService.recordAdEvent(a.id, 'click').catch(() => {}); if (a.link_url) window.open(a.link_url, '_blank', 'noopener,noreferrer'); };
  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <button type="button" onClick={open} title={a.title} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: a.link_url ? 'pointer' : 'default' }}>
        <img src={a.image_url} alt={a.title} loading="lazy" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '0.7rem', display: 'block' }} />
      </button>
      <span style={{ position: 'absolute', top: className ? 'calc(2.5rem + 6px)' : 6, right: className ? 'calc(1.5rem + 8px)' : 8, fontSize: '0.62rem', fontWeight: 700, color: '#fff', backgroundColor: 'rgba(15,23,42,0.55)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
        {a.sponsor ? `Sponsored · ${a.sponsor}` : 'Advertisement'}
      </span>
    </div>
  );
}

/** #192/#193 Sponsor logos (and the title sponsor's banner) for a tournament. */
export function SponsorStrip({ tournamentId, dark = false, showBanner = true, onNavigate }) {
  const [items, setItems] = useState([]);
  useEffect(() => { if (tournamentId) dataService.listTournamentSponsors(tournamentId).then((r) => setItems((r?.items || []).filter((s) => s.status === 'active'))).catch(() => setItems([])); }, [tournamentId]);
  if (!items.length) return null;
  const banner = showBanner && items.find((s) => s.banner_url);
  const color = dark ? '#e2e8f0' : '#334155';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {banner && (
        <a href={banner.link_url || undefined} target="_blank" rel="noopener noreferrer nofollow" style={{ display: 'block' }}>
          <img src={banner.banner_url} alt={`${banner.sponsor.name} banner`} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: '0.7rem', display: 'block' }} />
        </a>
      )}
      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {items.map((s) => (
          <button key={s.id} type="button" onClick={() => onNavigate ? onNavigate('sponsor', s.sponsor.id) : s.link_url && window.open(s.link_url, '_blank', 'noopener')}
            title={`${s.sponsor.name} – ${TIER_LABEL[s.tier]}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.6rem', borderRadius: '0.6rem', border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : '#e2e8f0'}`, background: dark ? 'rgba(255,255,255,0.06)' : '#fff', cursor: 'pointer', color }}>
            {s.sponsor.logo_url ? <img src={s.sponsor.logo_url} alt="" style={{ height: s.tier === 'title' ? 40 : 28, maxWidth: 120, objectFit: 'contain' }} />
              : <span style={{ width: 28, height: 28, borderRadius: 6, background: '#059669', color: '#fff', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.sponsor.name.charAt(0)}</span>}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 700, opacity: 0.75 }}>{TIER_LABEL[s.tier]}</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>{s.sponsor.name}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** #190 QR code with download and print. */
export function QrCard({ url, title, subtitle, size = 180 }) {
  const [copied, setCopied] = useState(false);
  const svg = qrSvg(url, { margin: 3 });
  const png = async () => {
    const W = 1000; const H = 1250; const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#064e3b'; ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; fitText(ctx, title || 'Scan to open', W - 100, 64); ctx.fillText(title || 'Scan to open', W / 2, 110);
    drawQr(ctx, url, 150, 230, 700, { margin: 2 });
    ctx.fillStyle = '#0f172a'; ctx.font = '700 40px system-ui, sans-serif'; ctx.fillText(subtitle || 'Scan with your phone camera', W / 2, 1010);
    ctx.fillStyle = '#475569'; ctx.font = '500 28px system-ui, sans-serif'; wrapText(ctx, url.replace(/^https?:\/\//, ''), W / 2, 1070, W - 120, 36, 2);
    ctx.fillStyle = '#059669'; ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText('Cricnotch', W / 2, 1190);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  };
  const download = async () => downloadBlob(await png(), `qr-${(title || 'code').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
  const print = async () => {
    const url2 = URL.createObjectURL(await png()); const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<title>${title || 'QR code'}</title><body style="margin:0;display:flex;justify-content:center"><img src="${url2}" style="max-width:100%;max-height:100vh" onload="setTimeout(()=>window.print(),300)"></body>`);
    w.document.close();
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt('Copy this link:', url); } };
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: size, height: size, borderRadius: '0.6rem', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
        <code style={{ fontSize: '0.78rem', color: '#334155', wordBreak: 'break-all' }}>{url}</code>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-mini" onClick={copy}><Copy size={13} /> {copied ? 'Copied!' : 'Copy link'}</button>
          <button type="button" className="btn-mini" onClick={download}><Download size={13} /> Download QR</button>
          <button type="button" className="btn-mini" onClick={print}><Printer size={13} /> Print</button>
          {navigator.share && <button type="button" className="btn-mini" onClick={() => navigator.share({ title, url }).catch(() => {})}><Share2 size={13} /> Share</button>}
          <a className="btn-mini" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Open</a>
        </div>
        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Print it on banners, posters and entry passes – anyone can scan it with a phone camera.</span>
      </div>
    </div>
  );
}

/* ---------- #196 certificate drawing ---------- */
const KIND_HEAD = { participation: 'Certificate of Participation', winner: 'Champions Certificate', runner_up: 'Runners-up Certificate', player_of_match: 'Player of the Match',
  award: 'Certificate of Excellence', achievement: 'Certificate of Achievement', custom: 'Certificate' };

export async function drawCertificate(cert) {
  const W = 1600; const H = 1131; const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
  const [a, b] = THEMES.green;
  ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = a; ctx.lineWidth = 18; ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 4; ctx.strokeRect(62, 62, W - 124, H - 124);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(62, 62, W - 124, 150);
  const logo = await loadImage(cert.tournament?.logo_url);
  if (logo) { const s = 110 / Math.max(logo.width, logo.height); ctx.drawImage(logo, 110, 82, logo.width * s, logo.height * s); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  const head = cert.tournament?.name || cert.match?.title || 'Cricnotch';
  fitText(ctx, head, W - 500, 54, 800); ctx.fillText(head, W / 2, 150);
  ctx.font = '600 24px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const when = cert.tournament ? [fmtDate(cert.tournament.start_date), cert.tournament.end_date && cert.tournament.end_date !== cert.tournament.start_date ? fmtDate(cert.tournament.end_date) : null].filter(Boolean).join(' – ') : fmtDate(cert.match?.date);
  ctx.fillText([when, cert.tournament?.venue || cert.match?.venue].filter(Boolean).join('  ·  '), W / 2, 190);
  ctx.fillStyle = '#92400e'; ctx.font = 'italic 700 64px Georgia, "Times New Roman", serif';
  ctx.fillText(KIND_HEAD[cert.kind] || 'Certificate', W / 2, 330);
  ctx.fillStyle = '#475569'; ctx.font = '500 30px Georgia, serif'; ctx.fillText('This is proudly presented to', W / 2, 410);
  ctx.fillStyle = '#0f172a'; fitText(ctx, cert.player?.name || '', W - 400, 92, 800, 'Georgia, serif'); ctx.fillText(cert.player?.name || '', W / 2, 520);
  ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - 380, 550); ctx.lineTo(W / 2 + 380, 550); ctx.stroke();
  if (cert.player?.player_code) { ctx.fillStyle = '#64748b'; ctx.font = '500 24px system-ui, sans-serif'; ctx.fillText(`Player ID ${cert.player.player_code}`, W / 2, 590); }
  ctx.fillStyle = '#065f46'; ctx.font = '700 40px system-ui, sans-serif'; wrapText(ctx, cert.title, W / 2, 670, W - 360, 50, 2);
  if (cert.detail) { ctx.fillStyle = '#334155'; ctx.font = '500 28px system-ui, sans-serif'; wrapText(ctx, cert.detail, W / 2, 780, W - 400, 38, 2); }
  // signature + date + verify
  ctx.textAlign = 'center'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(180, 930); ctx.lineTo(560, 930); ctx.stroke();
  ctx.fillStyle = '#0f172a'; ctx.font = '700 26px system-ui, sans-serif'; ctx.fillText(cert.tournament?.organizer_name || cert.issuer || 'Organiser', 370, 970);
  ctx.fillStyle = '#64748b'; ctx.font = '500 22px system-ui, sans-serif'; ctx.fillText('Organiser', 370, 1004);
  ctx.beginPath(); ctx.moveTo(620, 930); ctx.lineTo(980, 930); ctx.stroke();
  ctx.fillStyle = '#0f172a'; ctx.font = '700 26px system-ui, sans-serif'; ctx.fillText(fmtDate(cert.issued_at), 800, 970);
  ctx.fillStyle = '#64748b'; ctx.font = '500 22px system-ui, sans-serif'; ctx.fillText('Date of issue', 800, 1004);
  const verify = siteUrl(`verify=${cert.code}`);
  drawQr(ctx, verify, 1230, 800, 220, { margin: 2 });
  ctx.fillStyle = '#334155'; ctx.font = '700 22px ui-monospace, monospace'; ctx.fillText(cert.code, 1340, 1046);
  ctx.fillStyle = '#64748b'; ctx.font = '500 18px system-ui, sans-serif'; ctx.fillText('Scan to verify', 1340, 1072);
  if (cert.revoked_at) { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.35); ctx.fillStyle = 'rgba(220,38,38,0.35)'; ctx.font = '900 180px system-ui, sans-serif'; ctx.fillText('WITHDRAWN', 0, 60); ctx.restore(); }
  ctx.textAlign = 'left';
  return c;
}

export async function downloadCertificate(cert) {
  const c = await drawCertificate(cert);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  downloadBlob(blob, `certificate-${cert.code}.png`);
}

export async function printCertificate(cert) {
  const c = await drawCertificate(cert);
  const url = c.toDataURL('image/png'); const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<title>${cert.code}</title><style>@page{size:A4 landscape;margin:0}body{margin:0}</style><img src="${url}" style="width:100%" onload="setTimeout(()=>window.print(),300)">`);
  w.document.close();
}

export function CertificatePreview({ cert, width = 360 }) {
  const ref = useRef(null);
  useEffect(() => { let alive = true; drawCertificate(cert).then((c) => { if (alive && ref.current) { ref.current.innerHTML = ''; c.style.width = '100%'; c.style.height = 'auto'; c.style.borderRadius = '0.5rem'; c.style.boxShadow = '0 2px 10px rgba(0,0,0,0.12)'; ref.current.appendChild(c); } }); return () => { alive = false; }; }, [cert]);
  return <div ref={ref} style={{ width: '100%', maxWidth: width }} />;
}

export function roundRectPath(ctx, x, y, w, h, r) { roundRect(ctx, x, y, w, h, r); }
