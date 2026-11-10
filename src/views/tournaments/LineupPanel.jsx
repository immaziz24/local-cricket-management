import React, { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowUp, ArrowDown, Repeat, Users, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * #72 Playing XI, #73 Substitutes, #74 Player replacements — per match, per team.
 * Everyone can see the lineups; the team owner (or the tournament organiser) can pick and replace.
 */

const field = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem' };
const iconBtn = { background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.3rem', padding: '0.1rem 0.2rem', cursor: 'pointer', display: 'inline-flex' };
const REASONS = ['Injury', 'Concussion', 'Illness', 'Other'];

function TeamLineup({ match, team, perSide, maxSubs, onSaved }) {
  const lineup = team.lineup || [];
  const hasReplacement = lineup.some((p) => p.role === 'replaced');
  const open = match.status === 'scheduled' || match.status === 'live';
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState([]);
  const [subs, setSubs] = useState([]);
  const [captain, setCaptain] = useState('');
  const [keeper, setKeeper] = useState('');
  const [rep, setRep] = useState({ out: '', in: '', reason: 'Injury', other: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const startEdit = () => {
    setPlaying(lineup.filter((p) => p.role === 'playing').sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99)).map((p) => p.player_id));
    setSubs(lineup.filter((p) => p.role === 'substitute').map((p) => p.player_id));
    setCaptain(lineup.find((p) => p.is_captain)?.player_id || team.squad.find((p) => p.is_captain)?.player_id || '');
    setKeeper(lineup.find((p) => p.is_wicket_keeper)?.player_id || '');
    setMsg(null); setEditing(true);
  };

  const nameOf = (id) => team.squad.find((p) => p.player_id === id)?.name || lineup.find((p) => p.player_id === id)?.name || '?';
  const setRole = (id, role) => {
    setPlaying((l) => l.filter((x) => x !== id).concat(role === 'playing' ? [id] : []));
    setSubs((l) => l.filter((x) => x !== id).concat(role === 'sub' ? [id] : []));
  };
  const move = (i, d) => setPlaying((l) => { const a = [...l]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); setEditing(false); await onSaved(); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  const save = () => {
    if (playing.length > perSide) { setMsg({ ok: false, text: `Pick at most ${perSide} playing players.` }); return; }
    if (subs.length > maxSubs) { setMsg({ ok: false, text: `At most ${maxSubs} substitutes.` }); return; }
    run(() => dataService.setMatchLineup(match.id, team.team_id, {
      playing, substitutes: subs,
      captain: playing.includes(captain) ? captain : null,
      wicket_keeper: playing.includes(keeper) ? keeper : null
    }), 'Lineup saved.');
  };

  const replace = () => {
    const reason = rep.reason === 'Other' ? rep.other.trim() : rep.reason;
    if (!rep.out || !rep.in || !reason) { setMsg({ ok: false, text: 'Choose who goes out, who comes in and the reason.' }); return; }
    run(() => dataService.replaceMatchPlayer({ matchId: match.id, teamId: team.team_id, outId: rep.out, inId: rep.in, reason }), 'Replacement made. The other team was notified.')
      .then(() => setRep({ out: '', in: '', reason: 'Injury', other: '' }));
  };

  const playingNow = lineup.filter((p) => p.role === 'playing').sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99));
  const subsNow = lineup.filter((p) => p.role === 'substitute');
  const replacedNow = lineup.filter((p) => p.role === 'replaced');
  const usedIds = new Set(lineup.filter((p) => p.role !== 'substitute').map((p) => p.player_id));
  const canComeIn = team.squad.filter((p) => !usedIds.has(p.player_id));

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 260, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.92rem' }}>{team.name}</strong>
        {team.can_edit && open && !editing && !hasReplacement && (
          <Button variant="secondary" size="sm" onClick={startEdit}>{playingNow.length ? 'Change lineup' : 'Pick Playing XI'}</Button>
        )}
      </div>
      {msg && (
        <div style={{ fontSize: '0.78rem', display: 'flex', gap: '0.3rem', alignItems: 'center', color: msg.ok ? '#166534' : '#b91c1c' }}>
          {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />} {msg.text}
        </div>
      )}

      {editing ? (
        <>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Playing <strong>{playing.length}/{perSide}</strong> · Substitutes <strong>{subs.length}/{maxSubs}</strong> · Squad {team.squad.length}
          </div>
          {team.squad.length === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>This team has no players yet. Add them on the team page.</span>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 320, overflowY: 'auto' }}>
            {team.squad.map((p) => {
              const role = playing.includes(p.player_id) ? 'playing' : subs.includes(p.player_id) ? 'sub' : '';
              return (
                <div key={p.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', gap: '0.4rem' }}>
                  <span>{p.name}{p.player_role ? <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> · {p.player_role.replace('_', ' ')}</span> : null}</span>
                  <select value={role} onChange={(e) => setRole(p.player_id, e.target.value)} style={field}>
                    <option value="">Not picked</option>
                    <option value="playing">Playing</option>
                    <option value="sub">Substitute</option>
                  </select>
                </div>
              );
            })}
          </div>
          {playing.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', margin: '0.3rem 0' }}>Batting order</div>
              {playing.map((id, i) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.1rem 0' }}>
                  <span style={{ width: 18, color: '#94a3b8' }}>{i + 1}.</span>
                  <span style={{ flex: 1 }}>{nameOf(id)}</span>
                  <button type="button" style={iconBtn} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={12} /></button>
                  <button type="button" style={iconBtn} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={12} /></button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Captain<br />
                  <select value={captain} onChange={(e) => setCaptain(e.target.value)} style={field}>
                    <option value="">None</option>
                    {playing.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Wicket-keeper<br />
                  <select value={keeper} onChange={(e) => setKeeper(e.target.value)} style={field}>
                    <option value="">None</option>
                    {playing.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <Button variant="primary" size="sm" disabled={busy || playing.length < 2} onClick={save}>Save lineup</Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          {playingNow.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Playing XI not announced yet.</span>
          ) : (
            <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {playingNow.map((p) => (
                <li key={p.player_id}>
                  {p.name} {p.is_captain && <Badge variant="primary">C</Badge>} {p.is_wicket_keeper && <Badge variant="neutral">WK</Badge>}
                  {p.replaces_player_id && <span style={{ fontSize: '0.72rem', color: '#b45309' }}> (replaced {nameOf(p.replaces_player_id)} – {p.replacement_reason})</span>}
                </li>
              ))}
            </ol>
          )}
          {subsNow.length > 0 && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Substitutes: {subsNow.map((p) => p.name).join(', ')}</div>}
          {replacedNow.length > 0 && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Replaced: {replacedNow.map((p) => p.name).join(', ')}</div>}

          {/* #74 replacement */}
          {team.can_edit && open && playingNow.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', gap: '0.3rem', alignItems: 'center' }}><Repeat size={13} /> Replace a player</div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <select value={rep.out} onChange={(e) => setRep({ ...rep, out: e.target.value })} style={field}>
                  <option value="">Going out</option>
                  {playingNow.map((p) => <option key={p.player_id} value={p.player_id}>{p.name}</option>)}
                </select>
                <select value={rep.in} onChange={(e) => setRep({ ...rep, in: e.target.value })} style={field}>
                  <option value="">Coming in</option>
                  {canComeIn.map((p) => <option key={p.player_id} value={p.player_id}>{p.name}{subsNow.some((s) => s.player_id === p.player_id) ? ' (sub)' : ''}</option>)}
                </select>
                <select value={rep.reason} onChange={(e) => setRep({ ...rep, reason: e.target.value })} style={field}>
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {rep.reason === 'Other' && <input value={rep.other} onChange={(e) => setRep({ ...rep, other: e.target.value })} placeholder="Reason" style={field} />}
                <Button variant="secondary" size="sm" disabled={busy} onClick={replace}>Replace</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LineupPanel({ match }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = async () => {
    try { setData(await dataService.fetchMatchLineups(match.id)); setErr(null); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [match.id]);

  if (err) return <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '0.5rem' }}>{err}</div>;
  if (!data) return <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>Loading lineups…</div>;
  return (
    <div style={{ marginTop: '0.6rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
        <Users size={13} /> {data.players_per_side} players a side, up to {data.max_substitutes} substitutes
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {data.teams.map((t) => (
          <TeamLineup key={t.team_id} match={match} team={t} perSide={data.players_per_side} maxSubs={data.max_substitutes} onSaved={load} />
        ))}
      </div>
    </div>
  );
}

export default LineupPanel;
