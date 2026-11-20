import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { clubNameProblem, levelLabel, playersByTeam } from './squadRules.js';

/** #344 Club with several teams in order (1st team, 2nd team, juniors). The club owner can move players between them. */
const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', maxWidth: '100%' };

export function ClubsCard({ myTeams = [], onNavigate, onChanged }) {
  const [clubs, setClubs] = useState([]);
  const [open, setOpen] = useState(null);
  const [club, setClub] = useState(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [pickTeam, setPickTeam] = useState('');
  const [pickLevel, setPickLevel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(() => dataService.fetchMyClubs().then((d) => setClubs(d.items || [])).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!open) { setClub(null); return; } dataService.fetchClub(open).then(setClub).catch((e) => setErr(e.message)); }, [open]);

  const run = async (fn) => { setBusy(true); setErr(null); try { await fn(); await load(); if (open) setClub(await dataService.fetchClub(open)); onChanged?.(); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); } };
  const nameProblem = name ? clubNameProblem(name) : null;
  const ownedFree = myTeams.filter((t) => t.i_own && !(club?.teams || []).some((x) => x.id === t.id));
  const groups = playersByTeam(club);

  if (clubs.length === 0 && myTeams.filter((t) => t.i_own).length === 0) return null;
  return (
    <Card title="My clubs" subtitle="Group your teams under one club and move players between them">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New club name" maxLength={60} style={field} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" maxLength={60} style={field} />
        <Button variant="primary" disabled={busy || !name.trim() || !!nameProblem} onClick={async () => { if (await run(async () => { const c = await dataService.saveClub(null, name.trim(), city.trim()); setOpen(c.id); })) { setName(''); setCity(''); } }}>Create club</Button>
      </div>
      {nameProblem && <div style={{ color: '#b91c1c', fontSize: '0.76rem' }}>{nameProblem}</div>}
      {clubs.map((c) => (
        <div key={c.id} style={{ marginTop: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.7rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{c.name}</strong>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{c.city ? `${c.city} · ` : ''}{c.team_count} team{c.team_count === 1 ? '' : 's'}</span>
            <Button size="sm" variant="secondary" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Close' : 'Open'}</Button>
          </div>
          {open === c.id && club && (
            <div style={{ marginTop: '0.6rem' }}>
              {groups.length === 0 && <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>No teams in this club yet.</p>}
              {groups.map((t) => (
                <div key={t.id} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{levelLabel(t.level)}: {t.name}</strong>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{t.members} players</span>
                    <button type="button" onClick={() => onNavigate?.('team-details', t.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.76rem' }}>View</button>
                    {club.can_manage && <button type="button" disabled={busy} onClick={() => run(() => dataService.setTeamClub(t.id, null, null))} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.76rem' }}>Remove from club</button>}
                  </div>
                  {t.players.map((p) => (
                    <div key={p.player_id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.82rem', padding: '0.15rem 0 0.15rem 0.8rem' }}>
                      <span style={{ flex: 1, minWidth: 120 }}>{p.name}</span>
                      {club.can_manage && groups.length > 1 && (
                        <select defaultValue="" disabled={busy} style={{ ...field, fontSize: '0.76rem', padding: '0.2rem' }}
                          onChange={(e) => { const to = e.target.value; e.target.value = ''; if (to) run(() => dataService.moveClubPlayer(club.id, p.player_id, t.id, to)); }}>
                          <option value="">Move to…</option>
                          {groups.filter((g) => g.id !== t.id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {club.can_manage && ownedFree.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.4rem' }}>
                  <select value={pickTeam} onChange={(e) => setPickTeam(e.target.value)} style={field}>
                    <option value="">Add one of my teams…</option>
                    {ownedFree.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={pickLevel} onChange={(e) => setPickLevel(e.target.value)} style={field}>
                    <option value="">Level</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{levelLabel(n)}</option>)}
                  </select>
                  <Button size="sm" variant="primary" disabled={busy || !pickTeam} onClick={async () => { if (await run(() => dataService.setTeamClub(pickTeam, club.id, pickLevel ? Number(pickLevel) : null))) { setPickTeam(''); setPickLevel(''); } }}>Add team</Button>
                </div>
              )}
              {club.can_manage && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Delete this club? Its teams are kept.')) run(async () => { await dataService.deleteClub(club.id); setOpen(null); }); }} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.78rem' }}>Delete club</button>}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

export default ClubsCard;
