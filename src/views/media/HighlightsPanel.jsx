import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { MediaGallery } from './MediaGallery.jsx';

/**
 * #180 Match highlights: key moments picked automatically from ball-by-ball scoring (wickets, sixes, fours,
 * fifties, hundreds, 3- and 5-wicket hauls) plus highlight clips people add with the over they happened in.
 */
export function keyMoments(commentary) {
  const out = [];
  (commentary || []).forEach((inn) => {
    const team = typeof inn.batting_team === 'object' ? (inn.batting_team?.short_name || inn.batting_team?.name) : inn.batting_team;
    const batRuns = {}; const bowlW = {};
    (inn.balls || []).forEach((b) => {
      const over = `${b.over_no}.${b.ball_in_over}`;
      const base = { innings: inn.innings_no, team, over, score: `${b.score}/${b.wkts}`, seq: b.seq };
      const offBat = b.extra === 'wide' || b.extra === 'bye' || b.extra === 'leg_bye' ? 0 : (b.runs || 0);
      if (b.batter) {
        const before = batRuns[b.batter] || 0; const after = before + offBat; batRuns[b.batter] = after;
        if (before < 100 && after >= 100) out.push({ ...base, type: 'hundred', text: `💯 ${b.batter} reaches 100!` });
        else if (before < 50 && after >= 50) out.push({ ...base, type: 'fifty', text: `⭐ ${b.batter} reaches 50` });
      }
      if (b.is_wicket || b.wicket) {
        const bowlerWicket = b.bowler && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket', 'caught_and_bowled'].includes(b.wicket);
        if (bowlerWicket) bowlW[b.bowler] = (bowlW[b.bowler] || 0) + 1;
        out.push({ ...base, type: 'wicket', text: `☝️ WICKET – ${b.out_name || b.batter || 'batter'} ${String(b.wicket || 'out').replace(/_/g, ' ')}${b.fielder ? ` (${b.fielder})` : ''}${bowlerWicket ? `, bowler ${b.bowler}` : ''}` });
        if (bowlerWicket && (bowlW[b.bowler] === 3 || bowlW[b.bowler] === 5)) out.push({ ...base, type: 'haul', text: `🔥 ${b.bowler} takes ${bowlW[b.bowler]} wickets` });
      } else if (offBat === 6) out.push({ ...base, type: 'six', text: `🚀 SIX by ${b.batter}${b.extra === 'no_ball' ? ' (off a no-ball)' : ''}` });
      else if (offBat === 4) out.push({ ...base, type: 'four', text: `🏏 FOUR by ${b.batter}` });
    });
  });
  return out;
}

const FILTERS = [['all', 'All'], ['wicket', 'Wickets'], ['six', 'Sixes'], ['four', 'Fours'], ['milestone', 'Milestones']];

export function HighlightsPanel({ matchId, refreshKey }) {
  const [moments, setMoments] = useState(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => { dataService.fetchCommentary(matchId).then((c) => setMoments(keyMoments(c))).catch(() => setMoments([])); }, [matchId, refreshKey]);
  const shown = (moments || []).filter((m) => filter === 'all' || m.type === filter || (filter === 'milestone' && ['fifty', 'hundred', 'haul'].includes(m.type)));
  return (
    <>
      <Card title="Match highlights" subtitle="Key moments picked out automatically from the ball-by-ball score">
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          {FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} style={{ padding: '0.25rem 0.65rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.78rem', border: `1px solid ${filter === k ? '#16a34a' : '#e2e8f0'}`, backgroundColor: filter === k ? '#dcfce7' : '#fff', fontWeight: filter === k ? 700 : 500 }}>{l}</button>)}
        </div>
        {moments === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : shown.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No moments yet.</span> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 360, overflowY: 'auto' }}>
            {shown.map((m, i) => (
              <div key={`${m.seq}-${m.type}-${i}`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', backgroundColor: m.type === 'wicket' ? '#fef2f2' : m.type === 'six' ? '#f5f3ff' : ['fifty', 'hundred', 'haul'].includes(m.type) ? '#fffbeb' : '#f8fafc', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 800, color: '#475569', minWidth: 44 }}>{m.over}</span>
                <span style={{ flex: 1 }}>{m.text}</span>
                <span style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap' }}>{m.team ? `${m.team} ` : ''}{m.score}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <MediaGallery scope="match" scopeId={matchId} kinds={['highlight']} title="Highlight clips" subtitle="Short videos of the best moments – add the over so viewers know when it happened" refreshKey={refreshKey} />
    </>
  );
}

export default HighlightsPanel;
