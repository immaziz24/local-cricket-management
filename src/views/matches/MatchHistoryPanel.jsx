import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';

/**
 * #30 Scoring history and audit trail: who scored, every undo, innings ended, pauses,
 * lineup changes and replacements — with time. Public, so both teams can trust the score.
 */

const LABEL = {
  MATCH_CREATED: () => 'Match created',
  MATCH_LINEUP_SET: () => 'Playing XI picked',
  MATCH_PLAYER_REPLACED: (d) => `Player replaced${d.reason ? ` (${d.reason})` : ''}`,
  MATCH_STARTED: (d) => `Toss done, match started (chose to ${d.decision || '?'})`,
  BALL_UNDONE: (d) => `Undid ball ${d.seq ?? ''} of innings ${d.innings ?? ''}${d.wicket ? ` (wicket: ${String(d.wicket).replace('_', ' ')})` : d.runs !== undefined ? ` (${d.runs} run${d.runs === 1 ? '' : 's'})` : ''}`,
  INNINGS_ENDED: (d) => `Innings ${d.innings ?? ''} ended by hand (${d.reason || 'closed'})`,
  MATCH_PAUSED: (d) => `Play stopped: ${d.reason || ''}`,
  MATCH_RESUMED: (d) => `Play resumed${d.paused_minutes ? ` after ${d.paused_minutes} min` : ''}`,
  MATCH_COMPLETED: (d) => `Match finished: ${d.result || ''}`,
  MATCH_ABANDONED: (d) => `Match abandoned: ${d.reason || ''}`,
  MATCH_RESULT_RECORDED: (d) => `Result entered by hand: ${d.result || ''}`,
  MATCH_RESULT_CLEARED: () => 'Hand-entered result removed',
  MATCH_RESCHEDULED: (d) => `Rescheduled${d.reason ? ` (${d.reason})` : ''}`
};
const time = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function MatchHistoryPanel({ matchId, refreshKey = 0 }) {
  const [h, setH] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    dataService.fetchMatchHistory(matchId).then((d) => { setH(d); setErr(null); }).catch((e) => setErr(e.message));
  }, [matchId, refreshKey]);

  if (err) return <Card><span style={{ color: '#b91c1c' }}>{err}</span></Card>;
  if (!h) return <div style={{ color: '#94a3b8' }}>Loading history…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title="Who scored">
        {h.scorers.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No balls scored yet.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            {h.scorers.map((s, i) => (
              <div key={i}><strong>{s.name}</strong> scored {s.balls} ball{s.balls === 1 ? '' : 's'} · {time(s.first)} – {time(s.last)}</div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Match log">
        {h.events.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nothing yet.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {h.events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.84rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#94a3b8', minWidth: 110 }}>{time(e.at)}</span>
                <span style={{ flex: 1 }}>{LABEL[e.action] ? LABEL[e.action](e.details || {}) : e.action.replace(/_/g, ' ').toLowerCase()}</span>
                <span style={{ color: '#64748b' }}>{e.by}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default MatchHistoryPanel;
