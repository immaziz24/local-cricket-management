import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { slugify, SLUG_RE, COLOR_RE } from '../media/mediaExtras.js';
import { siteUrl } from './brandShared.jsx';

/** #376 Custom branded tournament microsite: own web name, brand colour, banner picture and footer. Organiser only. */
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
const note = { fontSize: '0.78rem', color: '#64748b' };

export function MicrositeSettings({ tournament, microsite, onSaved }) {
  const ms = microsite || {};
  const [f, setF] = useState({ slug: tournament.microsite_slug || '', brand_color: ms.brand_color || '', hero_url: ms.hero_url || '', footer: ms.footer || '', standalone: !!ms.standalone });
  const [check, setCheck] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const slug = f.slug.trim().toLowerCase();
  // Ask the server whether the web name is free, once the person stops typing.
  useEffect(() => {
    setCheck(null);
    if (!slug || slug === (tournament.microsite_slug || '')) return undefined;
    if (!SLUG_RE.test(slug)) { setCheck({ ok: false, reason: 'Use 3 to 40 letters, numbers or hyphens. It cannot start or end with a hyphen.' }); return undefined; }
    const t = setTimeout(() => { dataService.checkMicrositeSlug(tournament.id, slug).then(setCheck).catch(() => setCheck(null)); }, 450);
    return () => clearTimeout(t);
  }, [slug, tournament.id, tournament.microsite_slug]);
  const colourBad = f.brand_color && !COLOR_RE.test(f.brand_color);
  const save = async () => {
    setBusy(true); setMsg(null); setDone(false);
    try { await dataService.saveMicrosite(tournament.id, { ...f, slug: slug || null }); setDone(true); onSaved && onSaved(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const link = slug ? siteUrl(`t=${slug}`) : null;
  return (
    <Card title="Branded tournament website" subtitle="Give your tournament its own web name, colour, banner and footer">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <label style={note}>Web name
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input value={f.slug} maxLength={40} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={slugify(tournament.name) || 'my-cup-2026'} style={inp} />
            <Button size="sm" variant="secondary" onClick={() => setF({ ...f, slug: slugify(tournament.name) })}>Use name</Button>
          </div>
        </label>
        {check && <span style={{ fontSize: '0.8rem', color: check.ok ? '#059669' : '#b91c1c' }}>{check.ok ? 'This name is free.' : check.reason}</span>}
        {link && <span style={note}>Your link: <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>. The old code link keeps working.</span>}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <label style={{ ...note, flex: 1, minWidth: 180 }}>Brand colour
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="color" value={COLOR_RE.test(f.brand_color) ? f.brand_color : '#16a34a'} onChange={(e) => setF({ ...f, brand_color: e.target.value })} style={{ width: 42, height: 34, padding: 0, border: '1px solid #cbd5e1', borderRadius: 6 }} />
              <input value={f.brand_color} placeholder="#1a7f37" maxLength={7} onChange={(e) => setF({ ...f, brand_color: e.target.value })} style={inp} />
            </div>
          </label>
          <label style={{ ...note, flex: 2, minWidth: 220 }}>Banner picture link (https)
            <input value={f.hero_url} maxLength={300} placeholder="https://…/banner.jpg" onChange={(e) => setF({ ...f, hero_url: e.target.value })} style={inp} />
          </label>
        </div>
        {colourBad && <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>The colour must look like #1a7f37.</span>}
        <label style={note}>Footer line<input value={f.footer} maxLength={160} placeholder="e.g. Organised by Titahipara Sports Club · Contact 01XXXXXXXXX" onChange={(e) => setF({ ...f, footer: e.target.value })} style={inp} /></label>
        <label style={{ fontSize: '0.85rem', display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="checkbox" checked={f.standalone} onChange={(e) => setF({ ...f, standalone: e.target.checked })} style={{ marginTop: 3 }} /> Show only my name: leave “Cricnotch” out of the page title and footer</label>
        <span style={note}>The site still lives on Cricnotch. A fully separate web address (your own domain) is not part of this.</span>
        {msg && <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{msg}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button size="sm" variant="primary" disabled={busy || colourBad || (check && !check.ok)} onClick={save}>{busy ? 'Saving…' : 'Save website look'}</Button>
          {done && <span style={{ fontSize: '0.8rem', color: '#059669' }}>Saved</span>}
        </div>
      </div>
    </Card>
  );
}

export default MicrositeSettings;
