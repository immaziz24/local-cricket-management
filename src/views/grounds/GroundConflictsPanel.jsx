import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { summarizeConflicts, LEVEL_STYLE, conflictPairLine, localToIso } from './groundConflicts.js';

const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem' };

/** Result box shared by the checker and the match alert. */
export function ConflictResult({ result }) {
  const s = summarizeConflicts(result);
  if (s.level === 'unknown') return null;
  const st = LEVEL_STYLE[s.level];
  return (
    <div style={{ background: st.bg, color: st.color, borderRadius: '0.45rem', padding: '0.5rem 0.7rem', fontSize: '0.84rem' }}>
      <strong>{st.title}</strong>
      {s.lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

/** #365 Is a time free? Anyone signed in can check. The owner also sees existing double-bookings. */
export function GroundConflictsPanel({ groundId, isOwner, signedIn }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [existing, setExisting] = useState(null);
  useEffect(() => { if (isOwner) dataService.fetchGroundConflicts(groundId).then((x) => setExisting(x.conflicts)).catch(() => setExisting(null)); }, [groundId, isOwner]);
  if (!signedIn && !isOwner) return null;
  const check = async () => {
    setErr(null); setRes(null);
    const a = localToIso(from); const b = localToIso(to);
    if (!a || !b || new Date(b) <= new Date(a)) { setErr('Choose a start and a later end time.'); return; }
    try { setRes(await dataService.checkGroundConflicts(groundId, a, b)); } catch (e) { setErr(e.message); }
  };
  return (
    <Card title="Is this time free?" subtitle="Checks bookings, blocked slots, other matches and opening hours">
      {isOwner && existing && (
        <div style={{ marginBottom: '0.7rem', fontSize: '0.84rem' }}>
          {existing.length === 0 ? <span style={{ color: '#15803d' }}>No double-bookings at this ground.</span> : (
            <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: '0.45rem', padding: '0.5rem 0.7rem' }}>
              <strong>{existing.length} clash{existing.length === 1 ? '' : 'es'} to sort out</strong>
              {existing.map((c, i) => <div key={i}>{conflictPairLine(c)}</div>)}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: '0.75rem', color: '#64748b' }}>From<br /><input type="datetime-local" style={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label style={{ fontSize: '0.75rem', color: '#64748b' }}>To<br /><input type="datetime-local" style={field} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <Button variant="secondary" onClick={check}>Check</Button>
      </div>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: '0.4rem' }}>{err}</div>}
      {res && <div style={{ marginTop: '0.5rem' }}><ConflictResult result={res} /></div>}
    </Card>
  );
}
export default GroundConflictsPanel;
