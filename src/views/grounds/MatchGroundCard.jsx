import React, { useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { MapPin } from 'lucide-react';

/** #159 Link a match to a registered ground (match creator / organiser), so it shows in the ground's match history. */
export function MatchGroundCard({ match, groundName, canManage, onNavigate, onChanged }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState(null);
  if (!match.ground_id && !canManage) return null;
  const search = () => dataService.listGrounds({ query: q }).then(setList).catch((e) => setMsg(e.message));
  const pick = async (id) => { try { await dataService.setMatchGround(match.id, id); setList(null); onChanged && onChanged(); } catch (e) { setMsg(e.message); } };
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={16} /> Ground</span>}>
      {match.ground_id ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate && onNavigate('ground', match.ground_id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, color: '#065f46', fontSize: '0.92rem' }}>{groundName || 'Open ground'}</button>
          {canManage && <Button size="sm" variant="secondary" onClick={() => setList([])}>Change</Button>}
          {canManage && <Button size="sm" variant="secondary" onClick={() => window.confirm('Remove the ground from this match?') && pick(null)}>Remove</Button>}
        </div>
      ) : canManage && list === null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.84rem', color: '#64748b' }}>
          {match.venue ? `Venue: ${match.venue}. ` : ''}Link a registered ground to show directions and add this match to its history.
          <Button size="sm" variant="secondary" onClick={() => { setList([]); search(); }}>Choose ground</Button>
        </div>
      )}
      {list !== null && (
        <div style={{ marginTop: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Ground name or area"
              style={{ flex: 1, padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }} />
            <Button size="sm" variant="secondary" onClick={search}>Search</Button>
            <Button size="sm" variant="secondary" onClick={() => setList(null)}>Close</Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
            {list.map((g) => (
              <button key={g.id} onClick={() => pick(g.id)} style={{ textAlign: 'left', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '0.4rem', background: '#fff', cursor: 'pointer', fontSize: '0.84rem' }}>
                <strong>{g.name}</strong> <span style={{ color: '#64748b' }}>{[g.address, g.city].filter(Boolean).join(', ')}</span>
              </button>
            ))}
            {list.length === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Search for a ground. Not listed? Register it on the Grounds page.</span>}
          </div>
        </div>
      )}
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.4rem' }}>{msg}</div>}
    </Card>
  );
}

export default MatchGroundCard;
