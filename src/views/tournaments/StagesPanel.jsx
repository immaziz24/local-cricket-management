import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { STAGE_STATUS, stageState, stageLine, freezeProblem, reopenProblem, stageNameProblem, wouldLoop, stageLayers, toggleDependency } from './stageRules.js';

/**
 * #325 Build the order of a tournament: which stage must finish before the next one can be played.
 * #330 Freeze a finished stage so nothing in it can change, and reopen it with a reason if a mistake turns up.
 * Organiser only for changes; everyone signed in can read the order.
 */
const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', maxWidth: '100%' };

export function StagesPanel({ tournament, matches = [], onMatchesChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [deps, setDeps] = useState([]);
  const [note, setNote] = useState({});

  const load = useCallback(() => dataService.fetchTournamentStages(tournament.id).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e.message)), [tournament.id]);
  useEffect(() => { load(); }, [load]);

  if (err && !d) return <Card title="Stages and order"><p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{err}</p></Card>;
  if (!d) return null;
  const stages = d.stages || [];
  if (!d.can_manage && stages.length === 0) return null;

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { setD(await fn()); onMatchesChanged?.(); return true; } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  };
  const nameProblem = stageNameProblem(name, stages);
  const add = async () => { if (await run(() => dataService.saveTournamentStage(tournament.id, { name: name.trim(), dependsOn: deps }))) { setName(''); setDeps([]); } };
  const stageOf = (matchId) => stages.find((s) => (s.match_ids || []).includes(matchId));
  const layers = stageLayers(stages);
  const label = (m) => `${m.team_a?.name || 'TBD'} vs ${m.team_b?.name || 'TBD'}`;

  return (
    <Card title="Stages and order" subtitle="Decide which stage must finish before the next one can be played">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{err}</div>}
      {stages.length === 0 && <p style={{ margin: '0 0 0.6rem', fontSize: '0.84rem', color: '#64748b' }}>No stages yet. Add stages such as Group, Super 8 and Final, then say which one waits for which.</p>}
      {layers.map((layer, i) => (
        <div key={i} style={{ marginBottom: '0.7rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Step {i + 1}{i === 0 ? ' – can start any time' : ''}</div>
          {layer.map((s) => {
            const st = stageState(s);
            const fp = freezeProblem(s);
            const rp = reopenProblem(s, stages, note[s.id]);
            const mine = matches.filter((m) => stageOf(m.id)?.id === s.id);
            return (
              <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', marginTop: '0.35rem', background: s.status === 'frozen' ? '#f8fafc' : '#fff' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.92rem' }}>{s.name}</strong>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: STAGE_STATUS[st].color }}>{STAGE_STATUS[st].label}</span>
                  {s.depends_on.length > 0 && <span style={{ fontSize: '0.74rem', color: '#64748b' }}>after {s.depends_on.map((id) => stages.find((x) => x.id === id)?.name).filter(Boolean).join(' + ')}</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.15rem' }}>{stageLine(s)}</div>
                {mine.length > 0 && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>{mine.map(label).join(' · ')}</div>}
                {d.can_manage && (
                  <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {s.status !== 'frozen' ? (<>
                      <input style={{ ...field, flex: 1, minWidth: 140 }} placeholder="Freeze note (optional)" value={note[s.id] || ''} onChange={(e) => setNote({ ...note, [s.id]: e.target.value })} />
                      <Button size="sm" variant="secondary" disabled={busy || !!fp} title={fp || ''} onClick={() => run(() => dataService.freezeTournamentStage(s.id, note[s.id] || ''))}>Freeze</Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => window.confirm(`Delete the stage "${s.name}"? Its matches stay, just without a stage.`) && run(() => dataService.deleteTournamentStage(s.id))}>Delete</Button>
                    </>) : (<>
                      <input style={{ ...field, flex: 1, minWidth: 140 }} placeholder="Why reopen? (required)" value={note[s.id] || ''} onChange={(e) => setNote({ ...note, [s.id]: e.target.value })} />
                      <Button size="sm" variant="secondary" disabled={busy || !!rp} title={rp || ''} onClick={() => run(() => dataService.reopenTournamentStage(s.id, note[s.id]))}>Reopen</Button>
                    </>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {d.can_manage && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.7rem', marginTop: '0.4rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>Add a stage</div>
          <input style={{ ...field, width: '100%' }} placeholder="Stage name, e.g. Super 8" value={name} onChange={(e) => setName(e.target.value)} />
          {stages.length > 0 && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#475569' }}>
              Must finish first:
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                {stages.map((s) => (
                  <label key={s.id} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={deps.includes(s.id)} onChange={() => setDeps(toggleDependency(deps, s.id))} /> {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {name && nameProblem && <div style={{ color: '#b45309', fontSize: '0.78rem', marginTop: '0.3rem' }}>{nameProblem}</div>}
          <div style={{ marginTop: '0.5rem' }}><Button variant="primary" disabled={busy || !!nameProblem} onClick={add}>Add stage</Button></div>
        </div>
      )}

      {d.can_manage && stages.length > 0 && matches.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.7rem', marginTop: '0.8rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>Which stage is each match in?</div>
          {matches.map((m) => {
            const cur = stageOf(m.id);
            return (
              <div key={m.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0', fontSize: '0.83rem', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 160 }}>{label(m)}</span>
                <select style={field} disabled={busy || cur?.status === 'frozen'} value={cur?.id || ''} onChange={(e) => run(() => dataService.assignMatchStage(m.id, e.target.value || null))}>
                  <option value="">No stage</option>
                  {stages.filter((s) => s.status !== 'frozen' || s.id === cur?.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default StagesPanel;
