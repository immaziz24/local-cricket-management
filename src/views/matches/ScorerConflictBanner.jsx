import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { dataService } from '../../services/dataService.js';
import { conflictMessage } from './ballCorrection.js';

/** #320 Warns when another scorer (or the same scorer on another device) is scoring this match. */
const DEVICE_KEY = 'cricnotch:scorer-device';
function deviceId() {
  try {
    let d = sessionStorage.getItem(DEVICE_KEY);
    if (!d) { d = `d-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; sessionStorage.setItem(DEVICE_KEY, d); }
    return d;
  } catch { return 'd-fallback'; }
}

export function ScorerConflictBanner({ matchId }) {
  const [others, setOthers] = useState([]);
  useEffect(() => {
    let stop = false;
    const beat = () => dataService.scoringHeartbeat(matchId, deviceId()).then((r) => { if (!stop) setOthers(r?.others || []); }).catch(() => {});
    beat();
    const t = setInterval(beat, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [matchId]);
  const msg = conflictMessage(others);
  if (!msg) return null;
  return (
    <div role="alert" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: '0.5rem', padding: '0.55rem 0.75rem', fontSize: '0.84rem' }}>
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{msg}</span>
    </div>
  );
}

export default ScorerConflictBanner;
