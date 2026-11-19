/**
 * Scoring integrity rules (#311-#314, #321-#323, #382): pure checks used before a scorer change is saved.
 * No database, no React. Local rules can loosen or tighten these - pass them in `rules`.
 */

/** Most overs one bowler may bowl in an innings: one fifth of the innings (20 -> 4, 50 -> 10, 6 -> 2). */
export function bowlerOverLimit(oversPerInnings, rules = {}) {
  if (rules.maxOversPerBowler) return Number(rules.maxOversPerBowler);
  const o = Number(oversPerInnings);
  if (!o || o < 1) return null; // no limit (two-innings or unlimited)
  return Math.ceil(o / 5);
}

/** Can this bowler start the next over? */
export function canBowlNextOver({ bowlerId, lastOverBowlerId, oversBowled = {}, oversPerInnings, barred = [], rules = {} }) {
  if (!bowlerId) return { ok: false, reason: 'Pick a bowler.' };
  if (barred.includes(bowlerId)) return { ok: false, reason: 'This bowler cannot bowl any more in this innings.' };
  if (bowlerId === lastOverBowlerId) return { ok: false, reason: 'The same bowler cannot bowl two overs in a row.' };
  const limit = bowlerOverLimit(oversPerInnings, rules);
  const done = Number(oversBowled[bowlerId] || 0);
  if (limit && done >= limit) return { ok: false, reason: `This bowler has already bowled the maximum of ${limit} over${limit === 1 ? '' : 's'}.` };
  return { ok: true };
}

/** Two different, not-yet-out batters at the crease. */
export function validateCrease({ strikerId, nonStrikerId, outIds = [], battingIds = null }) {
  if (!strikerId || !nonStrikerId) return { ok: false, reason: 'Pick both batters.' };
  if (strikerId === nonStrikerId) return { ok: false, reason: 'The same player cannot be at both ends.' };
  if (outIds.includes(strikerId) || outIds.includes(nonStrikerId)) return { ok: false, reason: 'A batter who is out cannot be at the crease.' };
  if (battingIds && (!battingIds.includes(strikerId) || !battingIds.includes(nonStrikerId))) return { ok: false, reason: 'Both batters must be in the batting side.' };
  return { ok: true };
}

/**
 * A bowler is hurt mid-over: another bowler finishes the over (#321-#323).
 * The balls already bowled stay with the first bowler; the replacement bowls the rest.
 * Afterwards the hurt bowler cannot bowl again in the innings and the replacement cannot bowl the next over.
 * @param legalBallsInOver legal balls already bowled in this over (0-5)
 */
export function replaceBowlerMidOver({ originalId, replacementId, legalBallsInOver, lastOverBowlerId = null, oversBowled = {}, oversPerInnings, barred = [], reason = '', rules = {} }) {
  const n = Number(legalBallsInOver);
  if (!originalId || !replacementId) return { ok: false, reason: 'Pick the replacement bowler.' };
  if (originalId === replacementId) return { ok: false, reason: 'The replacement must be a different player.' };
  if (!Number.isInteger(n) || n < 0 || n > 5) return { ok: false, reason: 'An over in progress has between 0 and 5 legal balls.' };
  if (!String(reason).trim()) return { ok: false, reason: 'Give a reason (injury, illness or suspension).' };
  if (barred.includes(replacementId)) return { ok: false, reason: 'This player cannot bowl any more in this innings.' };
  if (replacementId === lastOverBowlerId) return { ok: false, reason: 'The bowler of the previous over cannot finish this over.' };
  const limit = bowlerOverLimit(oversPerInnings, rules);
  const done = Number(oversBowled[replacementId] || 0);
  if (limit && done >= limit) return { ok: false, reason: `The replacement has already bowled the maximum of ${limit} overs.` };
  return {
    ok: true,
    ballsKeptByOriginal: n,
    ballsLeftForReplacement: 6 - n,
    barredFromInnings: [...barred, originalId],
    barredNextOver: replacementId,
    audit: { action: 'BOWLER_REPLACED_MID_OVER', originalId, replacementId, legalBallsInOver: n, reason: String(reason).trim() }
  };
}

/** Overs shown the cricket way: 75 balls -> "12.3". */
export const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
