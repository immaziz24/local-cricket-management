import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Search, AlertCircle } from 'lucide-react';

/**
 * #1 Create a new cricket match, #2 Select participating teams.
 * Any two teams on the website can play; the person who creates the match scores it.
 */

const OVERS_QUICK = [4, 5, 6, 8, 10, 12, 15, 20];
const PLAYERS_QUICK = [6, 7, 8, 9, 11];
const BALL_TYPES = ['Tennis', 'Tape ball', 'Leather (red)', 'Leather (white)', 'Rubber', 'Other'];
const field = { width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.88rem' };
const label = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' };

function chip(active) {
  return { padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: active ? 700 : 500,
           border: `1px solid ${active ? '#059669' : '#cbd5e1'}`, backgroundColor: active ? '#ecfdf5' : '#fff', color: active ? '#065f46' : '#334155' };
}

function TeamPicker({ title, value, onPick, myTeams, exclude }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const search = async () => { try { setFound(await dataService.searchTeams(q)); } catch { setFound([]); } };
  const options = [...myTeams, ...(found || []).filter((t) => !myTeams.some((m) => m.id === t.id))].filter((t) => t.id !== exclude);
  return (
    <div>
      <span style={label}>{title} *</span>
      {value ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.65rem', border: '1px solid #059669', borderRadius: '0.45rem', backgroundColor: '#ecfdf5' }}>
          <strong>{value.name}</strong>
          <button type="button" onClick={() => onPick(null)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem' }}>Change</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q.trim().length >= 2 && search()} placeholder="Search any team" style={field} />
            <Button variant="secondary" size="sm" disabled={q.trim().length < 2} onClick={search}><Search size={13} /></Button>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
            {options.map((t) => (
              <button key={t.id} type="button" onClick={() => onPick(t)} style={chip(false)}>{t.name}{t.i_own ? ' (yours)' : ''}</button>
            ))}
            {found && found.length === 0 && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>No team found. Create it in My Teams first.</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function NewMatchForm({ onCreated, onCancel }) {
  const [myTeams, setMyTeams] = useState([]);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [f, setF] = useState({ match_type: 'limited_overs', overs_per_innings: 10, players_per_side: 11, ball_type: 'Tennis', venue: '', city: '', at: '', title: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { dataService.fetchMyTeams().then((t) => setMyTeams(t || [])).catch(() => setMyTeams([])); }, []);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const create = async () => {
    setErr(null);
    if (!teamA || !teamB) { setErr('Choose both teams.'); return; }
    const ov = Number(f.overs_per_innings);
    if (f.match_type !== 'two_innings' && (!ov || ov < 1 || ov > 100)) { setErr('Overs must be between 1 and 100.'); return; }
    setBusy(true);
    try {
      const r = await dataService.createFriendlyMatch({
        team_a_id: teamA.id, team_b_id: teamB.id, match_type: f.match_type,
        overs_per_innings: f.match_type === 'two_innings' ? null : ov, players_per_side: Number(f.players_per_side),
        ball_type: f.ball_type, venue: f.venue, city: f.city, title: f.title,
        scheduled_at: f.at ? new Date(`${f.at}:00+05:30`).toISOString() : null
      });
      onCreated && onCreated(r.id);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Start a match">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <TeamPicker title="Team A" value={teamA} onPick={setTeamA} myTeams={myTeams} exclude={teamB?.id} />
          <TeamPicker title="Team B" value={teamB} onPick={setTeamB} myTeams={myTeams} exclude={teamA?.id} />
        </div>
        <div>
          <span style={label}>Match type</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[['limited_overs', 'Limited overs'], ['box_cricket', 'Box cricket'], ['two_innings', 'Two innings']].map(([v, l]) => (
              <button key={v} type="button" style={chip(f.match_type === v)} onClick={() => set('match_type', v)}>{l}</button>
            ))}
          </div>
        </div>
        {f.match_type !== 'two_innings' && (
          <div>
            <span style={label}>Overs per innings *</span>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {OVERS_QUICK.map((o) => <button key={o} type="button" style={chip(Number(f.overs_per_innings) === o)} onClick={() => set('overs_per_innings', o)}>{o}</button>)}
              <input type="number" min={1} max={100} value={f.overs_per_innings} onChange={(e) => set('overs_per_innings', e.target.value)} style={{ ...field, width: 80 }} aria-label="Overs" />
            </div>
          </div>
        )}
        <div>
          <span style={label}>Players a side</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {PLAYERS_QUICK.map((o) => <button key={o} type="button" style={chip(Number(f.players_per_side) === o)} onClick={() => set('players_per_side', o)}>{o}</button>)}
            <input type="number" min={2} max={15} value={f.players_per_side} onChange={(e) => set('players_per_side', e.target.value)} style={{ ...field, width: 80 }} aria-label="Players a side" />
          </div>
        </div>
        <div>
          <span style={label}>Ball</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {BALL_TYPES.map((b) => <button key={b} type="button" style={chip(f.ball_type === b)} onClick={() => set('ball_type', b)}>{b}</button>)}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <label><span style={label}>Ground</span><input style={field} value={f.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. School ground" /></label>
          <label><span style={label}>City / village</span><input style={field} value={f.city} onChange={(e) => set('city', e.target.value)} /></label>
          <label><span style={label}>Date & time</span><input type="datetime-local" style={field} value={f.at} onChange={(e) => set('at', e.target.value)} /></label>
          <label><span style={label}>Match name (optional)</span><input style={field} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Sunday friendly" /></label>
        </div>
        {err && <div style={{ color: '#b91c1c', fontSize: '0.85rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}><AlertCircle size={14} /> {err}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="primary" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create match'}</Button>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Leave the date empty to play now. You will pick the Playing XI and do the toss on the next screen.</span>
      </div>
    </Card>
  );
}

export default NewMatchForm;
