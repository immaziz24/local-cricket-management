import React, { useState } from 'react';
import { Button } from '../../components/common/Button.jsx';

/**
 * Manual result entry for a fixture (until ball-by-ball scoring arrives in Phase 3).
 * Feeds #53 points table, #54 NRR and #56 knockout brackets.
 */

const KO_STAGES = ['knockout', 'quarter_final', 'semi_final', 'final', 'third_place'];
const field = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' };

/** "18.3" -> 111 balls. Returns null for empty, NaN for invalid. */
export function oversToBalls(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (!/^\d{1,3}(\.\d)?$/.test(s)) return NaN;
  const [o, b = '0'] = s.split('.');
  if (Number(b) > 5) return NaN;
  return Number(o) * 6 + Number(b);
}

/** 111 -> "18.3" */
export function ballsToOvers(balls) {
  if (balls === null || balls === undefined) return '';
  return `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ''}`;
}

export function scoreLine(runs, wkts, balls) {
  if (runs === null || runs === undefined) return null;
  return `${runs}/${wkts ?? 0}${balls !== null && balls !== undefined ? ` (${ballsToOvers(balls)} ov)` : ''}`;
}

export function MatchResultForm({ match, oversLimit, busy, onSave, onCancel }) {
  const a = match.team_a; const b = match.team_b;
  const ko = KO_STAGES.includes(match.stage);
  const [f, setF] = useState({
    type: match.result_type || 'win',
    battingFirst: match.batting_first_team_id || a.id,
    aRuns: match.team_a_runs ?? '', aWkts: match.team_a_wickets ?? '', aOvers: ballsToOvers(match.team_a_balls),
    bRuns: match.team_b_runs ?? '', bWkts: match.team_b_wickets ?? '', bOvers: ballsToOvers(match.team_b_balls),
    winner: match.winner_team_id || '',
    notes: ''
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // For a normal win the winner follows the scores
  const autoWinner = f.type === 'win' && f.aRuns !== '' && f.bRuns !== '' && Number(f.aRuns) !== Number(f.bRuns)
    ? (Number(f.aRuns) > Number(f.bRuns) ? a.id : b.id) : null;
  const winner = f.type === 'win' ? autoWinner : f.winner;
  const needsScores = f.type === 'win' || f.type === 'tie';

  const save = () => {
    setErr(null);
    const ab = oversToBalls(f.aOvers); const bb = oversToBalls(f.bOvers);
    if (Number.isNaN(ab) || Number.isNaN(bb)) { setErr('Overs look wrong. Write them like 18.3 (18 overs and 3 balls).'); return; }
    if (oversLimit && ((ab ?? 0) > oversLimit * 6 || (bb ?? 0) > oversLimit * 6)) { setErr(`Overs cannot be more than ${oversLimit}.`); return; }
    if (f.type === 'win' && !autoWinner) { setErr('Enter both scores. For equal scores choose "Tie".'); return; }
    if ((f.type === 'walkover' || (ko && f.type !== 'win')) && !f.winner) { setErr(ko ? 'A knockout match needs a winner (super over, bowl-out or toss).' : 'Choose the team that gets the walkover.'); return; }
    const num = (v) => (v === '' || v === null ? null : Number(v));
    onSave({
      result_type: f.type,
      winner_team_id: winner || null,
      batting_first_team_id: needsScores ? f.battingFirst : null,
      team_a_runs: needsScores ? num(f.aRuns) : null, team_a_wickets: needsScores ? num(f.aWkts) : null, team_a_balls: needsScores ? ab : null,
      team_b_runs: needsScores ? num(f.bRuns) : null, team_b_wickets: needsScores ? num(f.bWkts) : null, team_b_balls: needsScores ? bb : null,
      notes: f.notes
    });
  };

  const teamRow = (team, p) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center' }}>
      <strong style={{ fontSize: '0.82rem' }}>{team.name}</strong>
      <input type="number" min={0} placeholder="Runs" value={f[`${p}Runs`]} onChange={set(`${p}Runs`)} style={field} />
      <input type="number" min={0} max={10} placeholder="Wkts" value={f[`${p}Wkts`]} onChange={set(`${p}Wkts`)} style={field} />
      <input placeholder={`Overs${oversLimit ? ` / ${oversLimit}` : ''}`} value={f[`${p}Overs`]} onChange={set(`${p}Overs`)} style={field} />
    </div>
  );

  return (
    <div style={{ marginTop: '0.6rem', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Result
          <select value={f.type} onChange={set('type')} style={field}>
            <option value="win">Normal win</option>
            <option value="tie">Tie</option>
            <option value="no_result">No result / abandoned</option>
            <option value="walkover">Walkover</option>
          </select>
        </label>
        {needsScores && (
          <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Batted first
            <select value={f.battingFirst} onChange={set('battingFirst')} style={field}>
              <option value={a.id}>{a.name}</option>
              <option value={b.id}>{b.name}</option>
            </select>
          </label>
        )}
        {(f.type === 'walkover' || (ko && (f.type === 'tie' || f.type === 'no_result'))) && (
          <label style={{ fontSize: '0.75rem', color: '#64748b' }}>{f.type === 'walkover' ? 'Walkover given to' : 'Goes through (super over / bowl-out / toss)'}
            <select value={f.winner} onChange={set('winner')} style={field}>
              <option value="">Choose team</option>
              <option value={a.id}>{a.name}</option>
              <option value={b.id}>{b.name}</option>
            </select>
          </label>
        )}
      </div>

      {needsScores && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {teamRow(a, 'a')}
          {teamRow(b, 'b')}
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Overs like 18.3 = 18 overs 3 balls. A team bowled out (10 wickets) counts the full {oversLimit || ''} overs for net run rate.</span>
        </div>
      )}

      <input placeholder="Note (optional, e.g. reduced to 15 overs because of rain)" value={f.notes} onChange={set('notes')} style={field} />
      {err && <span style={{ fontSize: '0.78rem', color: '#b91c1c' }}>{err}</span>}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <Button variant="primary" disabled={busy} onClick={save}>Save result</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default MatchResultForm;
