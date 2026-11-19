// Batch 8 (#315 #316 #318 #324): pure helpers for the "who played this ball" correction screen.
export const CORRECTION_FIELDS = [
  { key: 'striker_id', label: 'Batter facing', wicketOnly: false },
  { key: 'non_striker_id', label: 'Non-striker', wicketOnly: false },
  { key: 'bowler_id', label: 'Bowler', wicketOnly: false },
  { key: 'dismissed_id', label: 'Who was out', wicketOnly: true },
  { key: 'fielder_id', label: 'Fielder (catch / run-out / stumping)', wicketOnly: true }
];

export const fieldsFor = (ball) => CORRECTION_FIELDS.filter((f) => !f.wicketOnly || ball?.is_wicket);

/** Only the fields whose value really changed (empty string = unchanged for optional fielder is kept as change to none). */
export function diffChanges(ball, picks) {
  const out = {};
  for (const f of fieldsFor(ball)) {
    if (!(f.key in picks)) continue;
    const next = picks[f.key] === '' ? null : picks[f.key];
    if ((ball[f.key] ?? null) !== next) out[f.key] = next;
  }
  return out;
}

/** Client-side checks that mirror the database, so the user gets an instant message. */
export function validateCorrection(ball, changes, reason) {
  const keys = Object.keys(changes);
  if (keys.length === 0) return 'Nothing to change.';
  if (String(reason || '').trim().length < 5) return 'Please give a reason (at least 5 characters).';
  for (const k of ['striker_id', 'non_striker_id', 'bowler_id', 'dismissed_id']) {
    if (k in changes && !changes[k]) return 'That field cannot be empty.';
  }
  const striker = 'striker_id' in changes ? changes.striker_id : ball.striker_id;
  const non = 'non_striker_id' in changes ? changes.non_striker_id : ball.non_striker_id;
  if (striker && striker === non) return 'The striker and non-striker cannot be the same player.';
  const bowler = 'bowler_id' in changes ? changes.bowler_id : ball.bowler_id;
  if ('bowler_id' in changes && (bowler === striker || bowler === non)) return 'A bowler cannot also be one of the batters.';
  return null;
}

/** #324 preview line: "Batter facing: A → B". */
export function previewChanges(ball, changes, players) {
  const name = (id) => (id ? players.find((p) => p.id === id)?.name || '?' : 'none');
  const was = { striker_id: ball.striker, non_striker_id: ball.non_striker, bowler_id: ball.bowler, dismissed_id: ball.dismissed, fielder_id: ball.fielder };
  return Object.keys(changes).map((k) => {
    const label = CORRECTION_FIELDS.find((f) => f.key === k)?.label || k;
    return `${label}: ${was[k] || 'none'} → ${name(changes[k])}`;
  });
}

/** #320: text for the two-scorer warning. */
export function conflictMessage(others) {
  if (!others || others.length === 0) return null;
  const names = [...new Set(others.map((o) => (o.same_user ? 'you on another device' : o.name)))];
  return `${names.join(', ')} ${names.length === 1 && !names[0].startsWith('you') ? 'is' : 'are'} also scoring this match right now. Two scorers at once can create duplicate or out-of-order balls — agree on one scorer.`;
}

export const REVISION_STATUS = { pending: 'Waiting for approval', applied: 'Applied', rejected: 'Rejected' };
