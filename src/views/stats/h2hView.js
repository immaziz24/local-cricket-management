/** #353 Batter versus bowler helpers. */

export const strikeRate = (runs, balls) => (balls > 0 ? ((runs * 100) / balls).toFixed(1) : '-');

export const DISMISSAL_LABEL = { bowled: 'bowled', caught: 'caught', lbw: 'lbw', stumped: 'stumped', hit_wicket: 'hit wicket', caught_and_bowled: 'caught and bowled' };

export function dismissalText(types) {
  const parts = Object.entries(types || {}).map(([k, v]) => `${v} ${DISMISSAL_LABEL[k] || k}`);
  return parts.length ? parts.join(', ') : 'never dismissed';
}

export function h2hHeadline(d) {
  if (!d) return '';
  if (!d.balls && !d.dismissals) return `${d.batter} has not faced ${d.bowler} in a recorded match.`;
  const avg = d.dismissals > 0 ? (d.runs / d.dismissals).toFixed(1) : null;
  return `${d.batter} has scored ${d.runs} off ${d.balls} balls against ${d.bowler} (strike rate ${strikeRate(d.runs, d.balls)}), ${d.dismissals > 0 ? `dismissed ${d.dismissals} time${d.dismissals === 1 ? '' : 's'}${avg ? `, average ${avg}` : ''}` : 'not dismissed'}.`;
}

/** Who is on top? Returns 'batter', 'bowler' or 'even' (needs at least 6 balls to say). */
export function edge(d) {
  if (!d || d.balls < 6) return 'even';
  if (d.dismissals > 0 && d.runs / d.dismissals < 25) return 'bowler';
  if (d.dismissals === 0 && Number(strikeRate(d.runs, d.balls)) >= 120) return 'batter';
  if (d.dismissals === 0 && d.balls >= 12 && Number(strikeRate(d.runs, d.balls)) >= 90) return 'batter';
  return 'even';
}
