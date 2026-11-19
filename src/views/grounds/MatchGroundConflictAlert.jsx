import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { summarizeConflicts } from './groundConflicts.js';
import { ConflictResult } from './GroundConflictsPanel.jsx';

/** #365 Warns the organiser when the ground chosen for a match clashes with a booking, a blocked slot, another match or the opening hours. */
export function MatchGroundConflictAlert({ matchId, groundId, scheduledAt }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!groundId || !scheduledAt) { setR(null); return; }
    dataService.checkMatchGroundConflict(matchId).then(setR).catch(() => setR(null));
  }, [matchId, groundId, scheduledAt]);
  if (!r || !r.has_ground || !r.has_time) return null;
  const s = summarizeConflicts(r);
  return (
    <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {s.level !== 'ok' && <ConflictResult result={r} />}
      {s.level === 'ok' && !r.has_confirmed_booking && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No clash found. This match has no confirmed booking at the ground yet.</div>}
      {s.level === 'ok' && r.has_confirmed_booking && <div style={{ fontSize: '0.8rem', color: '#15803d' }}>No clash. The ground is booked for this match.</div>}
    </div>
  );
}
export default MatchGroundConflictAlert;
