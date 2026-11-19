import React, { useState } from 'react';
import { Copy, Monitor } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { siteLink } from './mediaUtils.js';
import { overlayUrl, overlayJsonUrl } from './mediaExtras.js';

/** #371 OBS-compatible overlay: pick the look, copy the browser-source address or the JSON data address. */
const sel = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.84rem', backgroundColor: '#fff' };

export function OverlayLinks({ matchId }) {
  const [o, setO] = useState({ style: 'bar', pos: 'bottom', scale: 1, accent: '065f46' });
  const [copied, setCopied] = useState(null);
  const base = import.meta.env?.VITE_SUPABASE_URL || '';
  const page = overlayUrl(siteLink('').replace(/\?$/, ''), matchId, o);
  const data = overlayJsonUrl(base, matchId);
  const copy = async (key, text) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { window.prompt('Copy this link:', text); } };
  return (
    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.7rem' }}>
      <strong style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Monitor size={15} /> Live score overlay (OBS, Larix, Prism, StreamYard)</strong>
      <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.8rem', color: '#64748b' }}>In OBS add a <em>Browser source</em>, paste the page address, and set the width and height to your video size (for example 1920 by 1080). The background is see-through and the score updates by itself every few seconds.</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Style <select value={o.style} onChange={(e) => setO({ ...o, style: e.target.value })} style={sel}><option value="bar">Score bar</option><option value="box">Score box</option></select></label>
        <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Place <select value={o.pos} onChange={(e) => setO({ ...o, pos: e.target.value })} style={sel}><option value="bottom">Bottom</option><option value="top">Top</option></select></label>
        <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Size <select value={o.scale} onChange={(e) => setO({ ...o, scale: Number(e.target.value) })} style={sel}>{[0.8, 1, 1.25, 1.5, 2].map((n) => <option key={n} value={n}>{Math.round(n * 100)}%</option>)}</select></label>
        <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Colour <input type="color" value={`#${o.accent}`} onChange={(e) => setO({ ...o, accent: e.target.value.slice(1) })} style={{ width: 34, height: 28, padding: 0, border: '1px solid #cbd5e1', borderRadius: 6, verticalAlign: 'middle' }} /></label>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="sm" variant="secondary" onClick={() => copy('page', page)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Copy size={13} /> {copied === 'page' ? 'Copied!' : 'Copy page address'}</Button>
        <a href={page} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb' }}>preview</a>
        {data && <Button size="sm" variant="secondary" onClick={() => copy('data', data)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Copy size={13} /> {copied === 'data' ? 'Copied!' : 'Copy data address (JSON)'}</Button>}
      </div>
      {data && <p style={{ margin: '0.4rem 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>The data address gives the live score as plain data for tools that build their own graphics. Anyone with the match can read it, the same as the public match page.</p>}
    </div>
  );
}

export default OverlayLinks;
