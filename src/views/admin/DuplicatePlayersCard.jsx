import React, { useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';

/** #338 Admins look for players who were entered twice and merge them (everything moves to the player you keep). */
export function DuplicatePlayersCard({ onNavigate }) {
  const [pairs, setPairs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const find = async () => { setBusy(true); setMsg(null); try { setPairs(await dataService.findDuplicatePlayers()); } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const merge = async (keep, drop) => {
    if (!window.confirm(`Merge "${drop.name}" into "${keep.name}"?\n\nTheir teams, matches, balls, awards and history all move to "${keep.name}", and "${drop.name}" is removed. This is written to the audit log and cannot be undone from here.`)) return;
    setBusy(true); setMsg(null);
    try { await dataService.mergePlayers(keep.id, drop.id, 'Duplicate player'); setMsg({ ok: true, text: 'Merged.' }); setPairs(await dataService.findDuplicatePlayers()); }
    catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const side = (p) => (
    <div style={{ flex: '1 1 200px', fontSize: '0.82rem', color: '#334155' }}>
      <button onClick={() => onNavigate && onNavigate('player-profile', p.id)} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>{p.name}</button>
      <div style={{ color: '#64748b' }}>{p.code || ''}{p.mobile ? ` · ${p.mobile}` : ''}{p.dob ? ` · born ${p.dob}` : ''}</div>
      <div style={{ color: '#64748b' }}>{p.teams} team{p.teams === 1 ? '' : 's'} · {p.matches} match{p.matches === 1 ? '' : 'es'}{p.has_account ? ' · has an account' : ''}</div>
    </div>
  );
  return (
    <Card title="Duplicate players" subtitle="Same mobile number, or same name and date of birth.">
      <Button variant="secondary" disabled={busy} onClick={find}>{pairs ? 'Search again' : 'Look for duplicates'}</Button>
      {msg && <p style={{ margin: '0.5rem 0 0', fontSize: '0.83rem', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</p>}
      {pairs && pairs.length === 0 && <p style={{ margin: '0.6rem 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>No likely duplicates found.</p>}
      {pairs && pairs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
          {pairs.map((x) => (
            <div key={`${x.a.id}-${x.b.id}`} style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#fff' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', marginBottom: '0.3rem' }}>{x.reason}</div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{side(x.a)}{side(x.b)}</div>
              {x.can_merge ? (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => merge(x.a, x.b)}>Keep {x.a.name} ({x.a.code || 'first'})</Button>
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => merge(x.b, x.a)}>Keep {x.b.name} ({x.b.code || 'second'})</Button>
                </div>
              ) : <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#b91c1c' }}>Both players belong to different registered accounts, so they cannot be merged.</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
