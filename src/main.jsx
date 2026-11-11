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
