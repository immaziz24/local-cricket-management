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


// #105–#132 match rules asked at creation: the main ones are always shown, the rest are optional.
const PRESETS = {
  gully: { label: 'Gully / tennis ball', r: { wide_runs: 1, no_ball_runs: 1, free_hit: true, lbw: false, byes: true, leg_byes: false, powerplay_overs: 0, retire_at: null } },
  local: { label: 'Local leather ball', r: { wide_runs: 1, no_ball_runs: 1, free_hit: true, lbw: true, byes: true, leg_byes: true, powerplay_overs: null, retire_at: null } },
  icc: { label: 'ICC T20 style', r: { wide_runs: 1, no_ball_runs: 1, free_hit: true, lbw: true, byes: true, leg_byes: true, powerplay_overs: null, retire_at: null } }
};
const defaultRules = (overs) => ({ preset: 'gully', max_overs_per_bowler: overs ? Math.max(1, Math.ceil(Number(overs) / 5)) : null, ...PRESETS.gully.r, fielders_outside: null, boundary_size_m: null, local_rules: '' });

function RulesStep({ rules, setRules, overs, matchType }) {
  const [more, setMore] = useState(false);
  const set = (k, v) => setRules((r) => ({ ...r, [k]: v }));
  const num = (k, ph, max = 999) => <input type="number" min={0} max={max} value={rules[k] ?? ''} placeholder={ph} onChange={(e) => set(k, e.target.value === '' ? null : Math.min(max, Number(e.target.value)))} style={{ ...field, width: 90 }} />;
  const yes = (k, text) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!rules[k]} onChange={(e) => set(k, e.target.checked)} /> {text}
    </label>
  );
  const pick = (k) => setRules((r) => ({ ...r, preset: k, ...PRESETS[k].r, powerplay_overs: k === 'icc' && overs ? Math.max(1, Math.round(Number(overs) * 0.3)) : PRESETS[k].r.powerplay_overs }));
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', backgroundColor: '#f8fafc' }}>
      <div>
        <span style={label}>Match rules</span>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {Object.entries(PRESETS).map(([k, p]) => <button key={k} type="button" style={chip(rules.preset === k)} onClick={() => pick(k)}>{p.label}</button>)}
        </div>
        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Pick the closest style, then change anything below. The scorer's screen follows these rules.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem', alignItems: 'end' }}>
        {matchType !== 'two_innings' && <label><span style={label}>Max overs per bowler *</span>{num('max_overs_per_bowler', 'No limit', 50)}</label>}
        <label><span style={label}>Runs for a wide *</span>{num('wide_runs', '1', 5)}</label>
        <label><span style={label}>Runs for a no-ball *</span>{num('no_ball_runs', '1', 5)}</label>
        <div style={{ paddingBottom: 6 }}>{yes('free_hit', 'Free hit after a no-ball')}</div>
      </div>
      <button type="button" onClick={() => setMore((v) => !v)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}>
        {more ? 'Hide optional rules' : 'More rules (optional): LBW, byes, powerplay, retire, boundary, local rules'}
      </button>
      {more && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
            {yes('lbw', 'LBW is used')}{yes('byes', 'Byes count')}{yes('leg_byes', 'Leg-byes count')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem' }}>
            {matchType !== 'two_innings' && <label><span style={label}>Powerplay overs</span>{num('powerplay_overs', 'None', 20)}</label>}
            <label><span style={label}>Batter retires at (runs)</span>{num('retire_at', 'No rule', 500)}</label>
            <label><span style={label}>Max fielders outside circle</span>{num('fielders_outside', 'Default', 9)}</label>
            <label><span style={label}>Boundary size (m)</span>{num('boundary_size_m', 'Not set', 120)}</label>
          </div>
          <label><span style={label}>Other local rules</span>
            <textarea rows={2} value={rules.local_rules} onChange={(e) => set('local_rules', e.target.value)} maxLength={1000} placeholder="e.g. One-tip-one-hand catch, no running on the last ball, last man can bat alone" style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
        </div>
      )}
    </div>
  );
}

export function NewMatchForm({ onCreated, onCancel }) {
  const [myTeams, setMyTeams] = useState([]);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [f, setF] = useState({ match_type: 'limited_overs', overs_per_innings: 10, players_per_side: 11, ball_type: 'Tennis', venue: '', city: '', at: '', title: '' });
  const [rules, setRules] = useState(() => defaultRules(10));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { dataService.fetchMyTeams().then((t) => setMyTeams(t || [])).catch(() => setMyTeams([])); }, []);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); if (k === 'overs_per_innings') setRules((r) => ({ ...r, max_overs_per_bowler: v ? Math.max(1, Math.ceil(Number(v) / 5)) : r.max_overs_per_bowler })); };

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
      // Save the rules chosen above as this match's playing conditions.
      try {
        const pc = await dataService.fetchPlayingConditions(null, r.id);
        const { preset, local_rules, ...chosen } = rules;
        const merged = { ...pc.rules, ...Object.fromEntries(Object.entries(chosen).filter(([, v]) => v !== null && v !== undefined)),
          ...(chosen.powerplay_overs === 0 ? { powerplay_overs: null } : {}), ...(chosen.retire_at === null ? { retire_at: null } : {}),
          notes: { ...(pc.rules.notes || {}), ...(local_rules.trim() ? { general: local_rules.trim() } : {}) } };
        await dataService.savePlayingConditions(null, r.id, merged, `Set when the match was created (${PRESETS[preset]?.label || 'custom'})`);
      } catch (e) { /* the match exists; rules can still be set on its Rules tab */ }
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
        <RulesStep rules={rules} setRules={setRules} overs={f.overs_per_innings} matchType={f.match_type} />
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
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Leave the date empty to play now. You will pick the Playing XI and do the toss on the next screen. Rules can be changed later on the match's Rules tab until the first ball.</span>
      </div>
    </Card>
  );
}

export default NewMatchForm;
