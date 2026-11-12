import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ScoreOverlay } from './views/media/ScoreOverlay.jsx';
import './index.css';

// #179 Live score overlay for streaming apps: ?overlay=<match id>[&style=box] shows only the score.
const q = new URLSearchParams(window.location.search);
const overlayId = q.get('overlay');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {overlayId && /^[0-9a-f-]{36}$/i.test(overlayId)
      ? <ScoreOverlay matchId={overlayId} style={q.get('style') === 'box' ? 'box' : 'bar'} />
      : <App />}
  </React.StrictMode>
)

// #26 Offline support: the published site keeps working without internet (not used while developing).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// New-version notice: when a newer website is published, an open page offers a one-tap refresh
// (otherwise a tab opened earlier keeps showing the old version until it is reloaded).
if (import.meta.env.PROD) {
  const mine = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).find((s) => /\/assets\/index-[^/]+\.js$/.test(s || ''));
  let shown = false;
  const check = async () => {
    if (shown || !mine || !navigator.onLine) return;
    try {
      const html = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
      const latest = (html.match(/\/assets\/index-[^"']+\.js/) || [])[0];
      if (!latest || mine.endsWith(latest)) return;
      shown = true;
      const bar = document.createElement('div');
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2000;background:#065f46;color:#fff;padding:10px 14px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center;font:600 14px system-ui,sans-serif;max-width:92vw';
      bar.innerHTML = '<span>A new version of Local Cricket is ready.</span>';
      const btn = document.createElement('button');
      btn.textContent = 'Refresh';
      btn.style.cssText = 'background:#fff;color:#065f46;border:0;border-radius:8px;padding:6px 12px;font-weight:800;cursor:pointer';
      btn.onclick = () => window.location.reload();
      bar.appendChild(btn);
      document.body.appendChild(bar);
    } catch { /* offline – try later */ }
  };
  setInterval(check, 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
