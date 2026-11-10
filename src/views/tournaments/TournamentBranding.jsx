import React, { useRef, useState, useEffect } from 'react';
import { Trophy, ImagePlus, Trash2, Palette } from 'lucide-react';
import { dataService } from '../../services/dataService.js';

/**
 * #33 Tournament logo and banner.
 * BannerStrip: the wide banner image (or colour) at the top of the tournament page.
 * TournamentLogo: the square logo (falls back to a trophy in the banner colour).
 * BrandingControls: organiser-only buttons to upload / remove the logo and banner and pick the colour.
 */

export function TournamentLogo({ tournament, size = 64 }) {
  const color = tournament.banner_color || '#059669';
  if (tournament.logo_url) {
    return <img src={tournament.logo_url} alt={`${tournament.name} logo`} style={{ width: size, height: size, borderRadius: '0.75rem', objectFit: 'cover', border: '1px solid #e2e8f0', backgroundColor: '#fff', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '0.75rem', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Trophy size={Math.round(size * 0.5)} color="#fff" />
    </div>
  );
}

export function BannerStrip({ tournament }) {
  const color = tournament.banner_color || '#059669';
  return (
    <div style={{
      height: tournament.banner_url ? 170 : 70,
      borderRadius: '0.75rem',
      background: tournament.banner_url ? `center / cover no-repeat url("${tournament.banner_url}")` : `linear-gradient(135deg, ${color}, ${color}bb)`
    }} role="img" aria-label={`${tournament.name} banner`} />
  );
}

const linkBtn = { background: 'none', border: '1px solid #cbd5e1', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#334155', backgroundColor: '#fff' };

export function BrandingControls({ tournament, onChanged }) {
  const logoRef = useRef(null);
  const bannerRef = useRef(null);
  const colorRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); onChanged && (await onChanged()); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };
  // the native "change" event fires once when the colour picker closes
  useEffect(() => {
    const el = colorRef.current;
    if (!el) return undefined;
    const onCommit = () => {
      if (el.value.toLowerCase() !== (tournament.banner_color || '').toLowerCase()) {
        run(() => dataService.setTournamentColor(tournament.id, el.value), 'Colour updated.');
      }
    };
    el.addEventListener('change', onCommit);
    return () => el.removeEventListener('change', onCommit);
  }, [tournament.id, tournament.banner_color]);

  const pick = (kind) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) run(() => dataService.setTournamentImage(tournament.id, kind, file), kind === 'logo' ? 'Logo updated.' : 'Banner updated.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick('logo')} />
        <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick('banner')} />
        <button type="button" disabled={busy} onClick={() => logoRef.current?.click()} style={linkBtn}><ImagePlus size={13} /> {tournament.logo_url ? 'Change logo' : 'Add logo'}</button>
        {tournament.logo_url && <button type="button" disabled={busy} onClick={() => window.confirm('Remove the logo?') && run(() => dataService.removeTournamentImage(tournament.id, 'logo'), 'Logo removed.')} style={linkBtn}><Trash2 size={13} /> Logo</button>}
        <button type="button" disabled={busy} onClick={() => bannerRef.current?.click()} style={linkBtn}><ImagePlus size={13} /> {tournament.banner_url ? 'Change banner' : 'Add banner'}</button>
        {tournament.banner_url && <button type="button" disabled={busy} onClick={() => window.confirm('Remove the banner?') && run(() => dataService.removeTournamentImage(tournament.id, 'banner'), 'Banner removed.')} style={linkBtn}><Trash2 size={13} /> Banner</button>}
        <label style={{ ...linkBtn, cursor: busy ? 'default' : 'pointer' }}>
          <Palette size={13} /> Colour
          <input ref={colorRef} type="color" disabled={busy} defaultValue={tournament.banner_color || '#059669'}
            style={{ width: 22, height: 18, border: 'none', padding: 0, background: 'none' }} />
        </label>
      </div>
      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
        {busy ? 'Saving…' : 'JPG, PNG or WEBP up to 2 MB. Banner looks best wide (about 1200 × 300).'}
        {msg && <span style={{ marginLeft: '0.4rem', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</span>}
      </span>
    </div>
  );
}

export default BrandingControls;
