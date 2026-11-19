import React, { useState } from 'react';
import { readAccess, saveAccess, applyAccess, describeAccess, connectionIsSlow } from './accessibility.js';

/** #396 Settings card: larger text, high contrast, less movement and low-data mode (kept on this device). */
export function AccessibilityCard() {
  const [a, setA] = useState(() => readAccess());
  const slow = connectionIsSlow();
  const set = (k, v) => { const n = { ...a, [k]: v, chosen: true }; setA(n); saveAccess(n); applyAccess(n); };
  const row = (k, label, help) => (
    <label key={k} style={{ display: 'block', margin: '0.5rem 0' }}>
      <input type="checkbox" checked={!!a[k]} onChange={(e) => set(k, e.target.checked)} /> <strong>{label}</strong>
      <span style={{ display: 'block', marginLeft: '1.6rem', color: '#64748b', fontSize: '0.85rem' }}>{help}</span>
    </label>
  );
  return (
    <section className="info-box" aria-labelledby="access-heading">
      <h2 id="access-heading">Accessibility and low data</h2>
      <p>These choices are kept on this phone or computer only.</p>
      {slow && !a.low_data && <p role="status">Your connection looks slow or Data Saver is on. Low data mode can help.</p>}
      {row('large_text', 'Larger text', 'Makes all writing bigger.')}
      {row('high_contrast', 'High contrast', 'Black on white, strong outlines, underlined links.')}
      {row('reduce_motion', 'Less movement', 'Turns off animations and smooth scrolling.')}
      {row('low_data', 'Low data mode', 'Pictures, videos and embedded players wait until you tap them, so pages load with much less data.')}
      <p role="status">{describeAccess(a)}</p>
    </section>
  );
}
