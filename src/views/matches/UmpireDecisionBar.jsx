import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { DECISION_PRESETS, buildDecisionReport, timeWastingStatus, describeReport } from './decisionPresets.js';

/**
 * #115 dead ball, #116 overthrow, #117 short run, #124 time-wasting, #125 umpire decisions, #126 decision log.
 * One tap writes the decision into the match's public decision log with the innings and over.
 */
const field = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem' };

export function UmpireDecisionBar({ matchId, teams = [], onLogged }) {
  const [reports, setReports] = useState([]);
  const [key, setKey] = useState('');
  const [teamId, setTeamId] = useState('');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(null);

  const load = useCallback(() => dataService.fetchMatchReports(matchId).then((d) => setReports(d?.reports || [])).catch(() => {}), [matchId]);
  useEffect(() => { load(); }, [load]);

  const preset = DECISION_PRESETS.find((p) => p.key === key);
  const teamName = teams.find((t) => t.id === teamId)?.name;
  const tw = preset?.key === 'time_wasting' && teamName ? timeWastingStatus(reports, teamName) : null;
  const recent = reports.filter((r) => r.kind === 'decision' || r.title === 'Time-wasting warning').slice(0, 4);

  const submit = async () => {
    const built = buildDecisionReport(preset, { teamId: teamId || null, note, customTitle: title });
    if (built.error) { setErr(built.error); return; }
    setBusy(true); setErr(null);
    try {
      await dataService.addMatchReport(matchId, built.report);
      setSaved(`${built.report.title} recorded.`);
      setKey(''); setNote(''); setTitle(''); setTeamId('');
      await load(); onLogged?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <details style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.6rem 0.8rem', backgroundColor: '#fff' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Umpire decision (dead ball, short run, overthrow, time-wasting…)</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.7rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {DECISION_PRESETS.map((p) => (
            <button type="button" key={p.key} aria-pressed={key === p.key} onClick={() => { setKey(p.key); setErr(null); setSaved(null); }}
              style={{ padding: '0.3rem 0.7rem', borderRadius: 999, fontSize: '0.78rem', cursor: 'pointer', border: `1px solid ${key === p.key ? '#16a34a' : '#cbd5e1'}`, backgroundColor: key === p.key ? '#dcfce7' : '#fff', fontWeight: key === p.key ? 700 : 500 }}>
              {p.label}
            </button>
          ))}
        </div>
        {preset && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {preset.help && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{preset.help}</div>}
            {preset.custom && <input style={field} maxLength={120} placeholder="Title of the decision" value={title} onChange={(e) => setTitle(e.target.value)} />}
            {preset.needsTeam && (
              <select style={field} value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team">
                <option value="">Which team?</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {tw && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: tw.count >= 2 ? '#b91c1c' : '#b45309' }}>Warnings so far: {tw.count}. {tw.next}</div>}
            <input style={field} maxLength={2000} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div><Button size="sm" variant="primary" disabled={busy} onClick={submit}>Record decision</Button></div>
          </div>
        )}
        {err && <div style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{err}</div>}
        {saved && <div style={{ color: '#15803d', fontSize: '0.8rem' }}>{saved}</div>}
        {recent.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#475569' }}>
            <strong>Recent:</strong>
            {recent.map((r) => <div key={r.id}>{describeReport(r)}</div>)}
          </div>
        )}
      </div>
    </details>
  );
}

export default UmpireDecisionBar;
