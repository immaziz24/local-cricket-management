import React, { useState, useEffect, useCallback } from 'react';
import { dataService } from '../../services/dataService.js';
import { pitchChoices, pitchSummary, firstFreePitch } from './pitchRules.js';

/** #364 Pick which pitch of a multi-pitch ground a match is played on. Shown inside the Ground card. */
const field = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.84rem' };

export function MatchPitchPicker({ matchId, groundId, refreshKey = 0 }) {
  const [o, setO] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => dataService.fetchMatchPitchOptions(matchId).then((x) => { setO(x); setErr(null); }).catch((e) => setErr(e.message)), [matchId]);
  useEffect(() => { load(); }, [load, groundId, refreshKey]);
  if (!o || !o.ground_id || (o.pitch_count || 1) <= 1) return null;
  const choices = pitchChoices(o);
  const pick = async (v) => {
    setBusy(true); setErr(null);
    try { setO(await dataService.setMatchPitch(matchId, v === '' ? null : Number(v))); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const free = firstFreePitch(o);
  return (
    <div style={{ marginTop: '0.6rem', fontSize: '0.84rem' }}>
      <div style={{ color: '#475569' }}>{pitchSummary(o)}</div>
      {o.can_manage && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.3rem', flexWrap: 'wrap' }}>
          <select style={field} disabled={busy} value={o.pitch_no || ''} onChange={(e) => pick(e.target.value)}>
            <option value="">No pitch chosen</option>
            {choices.map((c) => <option key={c.pitch_no} value={c.pitch_no} disabled={!c.free && !c.selected}>{c.label}</option>)}
          </select>
          {!o.pitch_no && free && <button disabled={busy} onClick={() => pick(String(free))} style={{ ...field, cursor: 'pointer', background: '#f8fafc' }}>Use pitch {free}</button>}
        </div>
      )}
      {err && <div style={{ color: '#b91c1c', marginTop: '0.3rem' }}>{err}</div>}
    </div>
  );
}

export default MatchPitchPicker;
