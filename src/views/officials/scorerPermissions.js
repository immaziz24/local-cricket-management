/** #383 Granular scorer permissions by match. Pure helpers shared by the officials panel and tests. */
export const SCORER_PERMISSIONS = [
  ['score', 'Record balls', 'Score each ball and choose the batters and bowler'],
  ['undo', 'Undo the last ball', ''],
  ['edit_ball', 'Edit earlier balls', ''],
  ['end_innings', 'End an innings', ''],
  ['replace_bowler', 'Replace the bowler mid-over', ''],
  ['penalty', 'Award penalty runs', ''],
  ['manage_match', 'Pause, resume, abandon, super over, player of the match', '']
];
const KEYS = SCORER_PERMISSIONS.map((p) => p[0]);

/** What a scorer may do, given the saved permissions (null or a missing key = allowed). */
export function effectivePermissions(saved) {
  const out = {};
  KEYS.forEach((k) => { out[k] = saved?.[k] !== false; });
  return out;
}

/** Only the restrictions are saved: nothing restricted -> null (full scoring). */
export function toSaved(effective) {
  const out = {};
  KEYS.forEach((k) => { if (effective?.[k] === false) out[k] = false; });
  return Object.keys(out).length ? out : null;
}

export function permissionSummary(saved) {
  const off = SCORER_PERMISSIONS.filter(([k]) => saved?.[k] === false).map((p) => p[1]);
  return off.length ? `Not allowed: ${off.join(', ')}` : 'Full scoring';
}
