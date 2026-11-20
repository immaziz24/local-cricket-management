import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { MapPin } from 'lucide-react';
import { GEO_STATUS, CONSENT_TEXT, geoLine, geoPayload, geoErrorText } from './arrivalLocation.js';

/** #397 Check in with the phone's location, only if the person agrees. Shows the result to those allowed to see it. */
export function ArrivalLocation({ matchId, team, canCheckIn, over, onChanged }) {
  const [geo, setGeo] = useState(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => dataService.fetchArrivalGeo(matchId).then((d) => setGeo((d.items || []).find((x) => x.team_id === team.team_id) || null)).catch(() => setGeo(null)), [matchId, team.team_id]);
  useEffect(() => { load(); }, [load, team.arrival?.arrived_at]);

  const go = () => {
    setMsg(null);
    if (!navigator.geolocation) { setMsg('This device cannot share its location. You can still check in without it.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const g = geoPayload(pos);
        if (!g) throw new Error('Your location could not be found. You can still check in without it.');
        await dataService.checkInTeamGeo(matchId, team.team_id, g, team.arrival?.players_present ?? null, team.arrival?.note || null);
        await load(); onChanged?.();
      } catch (e) { setMsg(e.message); } finally { setBusy(false); }
    }, (err) => { setBusy(false); setMsg(geoErrorText(err.code)); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const clear = async () => { setBusy(true); try { await dataService.clearArrivalGeo(matchId, team.team_id); await load(); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };

  return (
    <div style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
      {geo && geo.status && (
        <div style={{ color: GEO_STATUS[geo.status].color, display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <MapPin size={13} /> {geoLine(geo)}
          {geo.can_clear && <button type="button" disabled={busy} onClick={clear} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.74rem' }}>Remove location</button>}
        </div>
      )}
      {canCheckIn && !over && (
        <div style={{ marginTop: '0.3rem' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} /> {CONSENT_TEXT}
          </label>
          <Button size="sm" variant="secondary" disabled={!agree || busy} onClick={go}>{busy ? 'Finding location…' : 'Arrived now, with my location'}</Button>
        </div>
      )}
      {msg && <div style={{ color: '#b91c1c', marginTop: '0.2rem' }}>{msg}</div>}
    </div>
  );
}

export default ArrivalLocation;
