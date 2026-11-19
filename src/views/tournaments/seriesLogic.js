/**
 * Series lifecycle (#333-#337): wins, early clinch and dead rubbers for a two-team "best of N" series.
 * Pure functions - no database, no React - so they can be tested.
 *
 * A series is decided as soon as the lead is bigger than the number of matches still to play
 * (e.g. 2-0 in a 3-match series, 3-0 in a 5-match series), even if the remaining matches are not played.
 */

const FINISHED = ['completed', 'abandoned', 'cancelled'];

/**
 * @param teams   [{ id, name }] - exactly two teams
 * @param matches [{ status, winner_team_id }]
 * @param planned number of matches planned for the series (series_match_count); never less than matches.length
 */
export function seriesStatus({ teams, matches = [], planned = 0 }) {
  if (!Array.isArray(teams) || teams.length !== 2) return null;
  const total = Math.max(Number(planned) || 0, matches.length);
  const wins = teams.map((t) => matches.filter((m) => m.status === 'completed' && m.winner_team_id === t.id).length);
  const finished = matches.filter((m) => FINISHED.includes(m.status)).length;
  const live = matches.some((m) => m.status === 'live');
  const remaining = Math.max(total - finished, 0);
  const lead = Math.abs(wins[0] - wins[1]);
  const leaderIdx = wins[0] > wins[1] ? 0 : wins[1] > wins[0] ? 1 : -1;
  const clinched = leaderIdx >= 0 && lead > remaining;
  const decided = total > 0 && (clinched || remaining === 0);
  const winnerIdx = decided && leaderIdx >= 0 ? leaderIdx : -1;
  const drawn = decided && leaderIdx < 0;
  const deadRubbers = decided ? remaining : 0;
  const hi = Math.max(wins[0], wins[1]);
  const lo = Math.min(wins[0], wins[1]);
  const score = `${hi}-${lo}`;

  let text;
  if (total === 0) text = 'No matches yet';
  else if (winnerIdx >= 0) text = `${teams[winnerIdx].name} won the series ${score}`;
  else if (drawn) text = `Series drawn ${score}`;
  else if (leaderIdx >= 0) text = `${teams[leaderIdx].name} lead the series ${score}`;
  else text = hi === 0 && finished === 0 ? 'Series not started' : `Series level ${score}`;

  return {
    wins: { [teams[0].id]: wins[0], [teams[1].id]: wins[1] },
    total, finished, remaining, live, lead,
    leaderId: leaderIdx >= 0 ? teams[leaderIdx].id : null,
    clinched, decided, drawn, deadRubbers,
    winnerId: winnerIdx >= 0 ? teams[winnerIdx].id : null,
    score, text,
    note: decided && deadRubbers > 0
      ? `Series decided with ${deadRubbers} match${deadRubbers === 1 ? '' : 'es'} still to play.`
      : null
  };
}

/**
 * #335 #336 Closing a series once it is decided (e.g. 2-0 in a 3-match series).
 * Returns what to do: who won, who lost, and which unplayed matches are no longer needed. null if not closable.
 */
export function seriesCloseOut(info, matches = []) {
  if (!info || !info.decided || !info.winnerId) return null;
  const loserId = Object.keys(info.wins).find((id) => id !== info.winnerId) || null;
  const unneeded = matches.filter((m) => m.status === 'scheduled').map((m) => m.id);
  return { winnerId: info.winnerId, runnerUpId: loserId, unneededMatchIds: unneeded };
}
