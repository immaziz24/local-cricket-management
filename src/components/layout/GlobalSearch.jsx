import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, X, Loader2, Trophy, Users, User, Activity, Landmark, Store, Flag, LocateFixed } from 'lucide-react';
import { dataService } from '../../services/dataService.js';

/**
 * Header search: players, teams, matches, tournaments, grounds, places and umpires/scorers.
 * "Near me" asks the browser for location ONLY when tapped, then keeps results within 30 km.
 */
const GROUPS = [
  ['matches', 'Matches', Activity],
  ['tournaments', 'Tournaments', Trophy],
  ['teams', 'Teams', Users],
  ['players', 'Players', User],
  ['grounds', 'Grounds', Landmark],
  ['places', 'Academies, shops & nets', Store],
  ['officials', 'Umpires & scorers', Flag]
];
const RADIUS = 30;
const NEAR_KEY = 'lc_near_me';

async function cityFromPosition(lat, lng) {
  // Free, key-less reverse lookup made for browsers; if it fails, the database still uses nearby grounds' cities.
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!r.ok) return null;
    const j = await r.json();
    return j.city || j.locality || null;
  } catch { return null; }
}

export function GlobalSearch({ onNavigate, compact = false, autoFocus = false, onDone }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [near, setNear] = useState(() => { try { return JSON.parse(sessionStorage.getItem(NEAR_KEY) || 'null'); } catch { return null; } });
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState(null);
  const [active, setActive] = useState(0);
  const box = useRef(null);
  const input = useRef(null);
  const seq = useRef(0);

  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const slash = (e) => { if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); input.current?.focus(); } };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', slash);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', slash); };
  }, []);

  // Debounced search; with nothing typed it shows live / upcoming (or everything near you).
  useEffect(() => {
    if (!open) return undefined;
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await dataService.globalSearch({ q: q.trim(), radius_km: RADIUS, ...(near ? { lat: near.lat, lng: near.lng, city: near.city } : {}) });
        if (my === seq.current) { setRes(r); setActive(0); }
      } catch (e) { if (my === seq.current) setRes({ error: e.message }); }
      finally { if (my === seq.current) setBusy(false); }
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, near, open]);

  const askLocation = () => {
    setNote(null);
    if (near) { setNear(null); sessionStorage.removeItem(NEAR_KEY); return; }
    if (!('geolocation' in navigator)) { setNote('Your browser cannot share location. Showing all results.'); return; }
    setLocating(true); setOpen(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = +pos.coords.latitude.toFixed(4); const lng = +pos.coords.longitude.toFixed(4);
      const city = await cityFromPosition(lat, lng);
      const v = { lat, lng, city };
      setNear(v); try { sessionStorage.setItem(NEAR_KEY, JSON.stringify(v)); } catch { /* private mode */ }
      setLocating(false);
    }, (err) => {
      setLocating(false);
      setNote(err.code === 1 ? 'Location is blocked. Allow location for this site in your browser settings to see results near you. Showing all results.'
        : 'Could not find your location (is GPS on?). Showing all results.');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  };

  const flat = res && !res.error ? GROUPS.flatMap(([k]) => (res[k] || []).map((i) => i)) : [];
  const go = (item) => {
    if (!item) return;
    setOpen(false); setQ('');
    onNavigate && onNavigate(item.route, item.route === 'community' ? null : item.id);
    onDone && onDone();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[active]); }
  };
  let idx = -1;

  return (
    <div ref={box} className="gs-root" style={{ position: 'relative', width: '100%', maxWidth: compact ? 'none' : 520 }}>
      <div className={`gs-box${open ? ' gs-focus' : ''}`}>
        <Search size={17} color="#64748b" style={{ flexShrink: 0 }} />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder="Search players, teams, matches…" aria-label="Search the website" maxLength={60} />
        {q && <button type="button" className="gs-icon" aria-label="Clear" onClick={() => { setQ(''); input.current?.focus(); }}><X size={15} /></button>}
        <button type="button" onClick={askLocation} className={`gs-near${near ? ' on' : ''}`} title={near ? `Near me is on (${RADIUS} km) – tap to turn off` : `Show results within ${RADIUS} km of me`}>
          {locating ? <Loader2 size={14} className="gs-spin" /> : near ? <LocateFixed size={14} /> : <MapPin size={14} />}
          <span className="gs-near-label">{near ? `${near.city || 'Near me'} · ${RADIUS} km` : 'Near me'}</span>
        </button>
        {!compact && !q && !open && <kbd className="gs-kbd">/</kbd>}
      </div>

      {open && (
        <div className="gs-panel" role="listbox">
          {note && <div className="gs-note">{note}</div>}
          {near && <div className="gs-near-bar"><LocateFixed size={13} /> Showing results within {RADIUS} km{near.city ? ` of ${near.city}` : ''}<button type="button" onClick={askLocation}>Turn off</button></div>}
          {busy && !res && <div className="gs-empty"><Loader2 size={16} className="gs-spin" /> Searching…</div>}
          {res?.error && <div className="gs-empty" style={{ color: '#b91c1c' }}>{res.error}</div>}
          {res && !res.error && flat.length === 0 && !busy && (
            <div className="gs-empty">{q ? <>No results for “{q}”{near ? ` within ${RADIUS} km` : ''}.</> : near ? `Nothing listed within ${RADIUS} km yet.` : 'Type a name, team, city or player ID.'}</div>
          )}
          {res && !res.error && GROUPS.map(([k, label, Icon]) => (res[k] || []).length > 0 && (
            <div key={k} className="gs-group">
              <div className="gs-group-title">{!q && k === 'matches' && !near ? 'Live & upcoming matches' : !q && k === 'tournaments' && !near ? 'Open tournaments' : label}</div>
              {res[k].map((item) => {
                idx += 1; const me = idx;
                return (
                  <button type="button" key={`${k}-${item.id}`} className={`gs-item${me === active ? ' active' : ''}`} onMouseEnter={() => setActive(me)} onClick={() => go(item)}>
                    <span className={`gs-ico${item.status === 'live' ? ' live' : ''}`}>
                      {item.logo_url || item.photo_url ? <img src={item.logo_url || item.photo_url} alt="" /> : <Icon size={15} />}
                    </span>
                    <span className="gs-text">
                      <span className="gs-title">{item.status === 'live' && <span className="gs-live-dot" />}{item.title}</span>
                      {item.subtitle && <span className="gs-sub">{item.subtitle}</span>}
                    </span>
                    {item.distance_km != null && <span className="gs-dist">{item.distance_km} km</span>}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="gs-foot"><span>↑↓ to move · Enter to open · Esc to close</span></div>
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
