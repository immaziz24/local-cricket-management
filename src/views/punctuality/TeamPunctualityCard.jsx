import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Clock, AlertTriangle } from 'lucide-react';

/** #308 #310 A team's punctuality record; the team owner also keeps player fines here. */
const METHOD_SHORT = { overs_deduction: 'overs cut', penalty_runs: 'runs to opponent', fielding_restriction: 'fielding restriction' };

export function TeamPunctualityCard({ teamId, squad = [], onNavigate }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => dataService.getTeamPunctuality(teamId).then(setD).catch(() => setD(null));
  useEffect(() => { load(); }, [teamId]);
  if (!d) return null;
  if (!d.is_owner && d.checked_in === 0 && d.penalties === 0) return null;
  const save = async () => {
    setMsg(null);
    try { setD(await dataService.addPlayerFine(teamId, f.player_id, f.amount, f.reason)); setF(null); } catch (e) { setMsg(e.message); }
  };
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={16} /> Punctuality</span>}>
      <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.86rem' }}>
        <span>Matches checked in <strong>{d.checked_in}</strong></span>
        <span>On time <strong>{d.on_time}</strong></span>
        {d.average_late != null && <span>Average delay when late <strong>{d.average_late} min</strong></span>}
        <span>Late penalties <strong style={{ color: d.penalties ? '#b91c1c' : undefined }}>{d.penalties}</strong></span>
      </div>
      {d.penalties_last_year >= 3 && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={14} /> Repeat late arrivals: {d.penalties_last_year} penalties in the last 12 months.</div>}
      {d.history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.6rem' }}>
          {d.history.slice(0, 8).map((h) => (
            <button key={h.match_id} onClick={() => onNavigate && onNavigate('match-centre', h.match_id)} style={{ display: 'flex', gap: '0.5rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', padding: '0.25rem 0', cursor: 'pointer', textAlign: 'left', fontSize: '0.82rem' }}>
              <span style={{ flex: 1 }}>vs {h.opponent} · {h.scheduled_at ? new Date(h.scheduled_at).toLocaleDateString('en-IN') : ''}</span>
              <span style={{ color: h.minutes_late > 5 ? '#b91c1c' : '#15803d' }}>{h.minutes_late > 5 ? `${h.minutes_late} min late` : 'on time'}</span>
              {h.penalty && <span style={{ color: '#64748b' }}>· {h.penalty.value} {METHOD_SHORT[h.penalty.method]} ({h.penalty.status}){h.penalty.fine != null ? ` · fine ₹${h.penalty.fine}${h.penalty.fine_paid ? ' paid' : ''}` : ''}</span>}
            </button>
          ))}
        </div>
      )}
      {d.is_owner && (
        <div style={{ marginTop: '0.9rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.85rem' }}>Player fines (only you see these)</strong>
            {!f && <Button size="sm" variant="secondary" onClick={() => setF({ player_id: squad[0]?.id || '', amount: '', reason: 'Late for the match' })} disabled={!squad.length}>Add fine</Button>}
          </div>
          {f && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <select value={f.player_id} onChange={(e) => setF({ ...f, player_id: e.target.value })} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }}>{squad.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select>
              <input type="number" min="1" placeholder="₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} style={{ width: 90, padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }} />
              <input maxLength={200} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} style={{ flex: 1, minWidth: 140, padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }} />
              <Button size="sm" variant="primary" disabled={!f.player_id || !f.amount} onClick={save}>Save</Button>
              <Button size="sm" variant="secondary" onClick={() => setF(null)}>Cancel</Button>
            </div>
          )}
          {msg && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.3rem' }}>{msg}</div>}
          {(d.fines || []).length === 0 ? <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.4rem' }}>No fines.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.4rem' }}>
              {d.fines.map((x) => (
                <div key={x.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ flex: 1 }}>{x.player} · ₹{Number(x.amount).toLocaleString('en-IN')} · {x.reason}</span>
                  <label style={{ fontSize: '0.78rem' }}><input type="checkbox" checked={x.paid} onChange={async (e) => { try { setD(await dataService.setPlayerFinePaid(x.id, e.target.checked)); } catch (er) { setMsg(er.message); } }} /> Paid</label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default TeamPunctualityCard;
