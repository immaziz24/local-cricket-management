import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { validateMembershipDates, spellLabel } from './membershipHistory.js';

/** #341 Teams a player has been in, with the dates. Team owners and admins can correct the dates. */
const toInput = (iso) => (iso ? new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 10) : '');
const fromInput = (v, endOfDay) => (v ? new Date(`${v}T${endOfDay ? '23:59:00' : '00:00:00'}+05:30`).toISOString() : null);

export function TeamHistoryCard({ playerId, onNavigate }) {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { dataService.fetchPlayerTeamHistory(playerId).then(setRows).catch(() => setRows([])); }, [playerId]);
  if (!rows || rows.length === 0) return null;
  const save = async () => {
    const row = rows.find((r) => r.id === edit.id);
    const problem = validateMembershipDates({ joined: fromInput(edit.joined), left: fromInput(edit.left, true), isCurrent: row.is_current,
      others: rows.filter((r) => r.id !== row.id && r.team_id === row.team_id) });
    if (problem) { setErr(problem); return; }
    try { setRows(await dataService.setMembershipDates(edit.id, fromInput(edit.joined), fromInput(edit.left, true))); setEdit(null); setErr(null); }
    catch (e) { setErr(e.message); }
  };
  const inp = { padding: '0.35rem 0.45rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.84rem' };
  return (
    <Card title="Team history">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {rows.map((h) => (
          <div key={h.id} style={{ padding: '0.5rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => onNavigate && onNavigate('team-details', h.team_id)} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>{h.team_name}</button>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{spellLabel(h)}{h.is_current ? ' (current)' : ''}</span>
              <span style={{ flex: 1 }} />
              {h.can_edit && edit?.id !== h.id && <Button size="sm" variant="secondary" onClick={() => { setErr(null); setEdit({ id: h.id, joined: toInput(h.joined_at), left: toInput(h.left_at) }); }}>Correct dates</Button>}
            </div>
            {edit?.id === h.id && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem' }}>Joined <input type="date" value={edit.joined} onChange={(e) => setEdit({ ...edit, joined: e.target.value })} style={inp} /></label>
                {!h.is_current && <label style={{ fontSize: '0.8rem' }}>Left <input type="date" value={edit.left} onChange={(e) => setEdit({ ...edit, left: e.target.value })} style={inp} /></label>}
                <Button size="sm" variant="primary" onClick={save}>Save</Button>
                <Button size="sm" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {err && <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#b91c1c' }}>{err}</p>}
    </Card>
  );
}
