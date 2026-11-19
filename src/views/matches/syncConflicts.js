// #392 Offline sync conflict resolution. When balls scored without internet are uploaded and the server says no,
// the scorer sees what happened and chooses: keep trying, save a copy of the unsent balls, or throw them away.
const MKEY = (matchId) => `lc_queue_mark_${matchId}`;

/** A small note of the server score at the moment the first offline action was saved. */
export function markOf(state) {
  const c = state && state.current;
  if (!c) return null;
  return { innings_no: c.innings_no ?? null, legal_balls: c.legal_balls ?? 0, runs: c.runs ?? 0, wickets: c.wickets ?? 0, status: state.status || null };
}

export function saveMark(matchId, mark, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { if (storage && mark) storage.setItem(MKEY(matchId), JSON.stringify(mark)); } catch { /* storage full or blocked */ }
}
export function loadMark(matchId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { const v = storage && storage.getItem(MKEY(matchId)); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function clearMark(matchId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage && storage.removeItem(MKEY(matchId)); } catch { /* storage blocked */ }
}

/** How the server score now compares with the note made when this device went offline. */
export function serverChange(mark, server) {
  if (!server) return 'unknown';
  if (server.status && server.status !== 'live' && server.status !== 'in_progress') return 'match_closed';
  const c = server.current;
  if (!mark || !c) return 'unknown';
  if ((c.innings_no ?? null) !== mark.innings_no) return 'innings_changed';
  if ((c.legal_balls ?? 0) > mark.legal_balls || (c.runs ?? 0) > mark.runs || (c.wickets ?? 0) > mark.wickets) return 'server_ahead';
  return 'same';
}

const WHY = {
  match_closed: 'This match has been completed or closed on the server, so these balls cannot be added.',
  innings_changed: 'The innings on the server is not the one you were scoring. Someone else moved the match on.',
  server_ahead: 'The server already has more balls than when you went offline. Another scorer probably scored the same balls.',
  same: 'The server score has not moved, so a rule stopped this ball (for example the wrong batter or bowler).',
  unknown: 'The server refused this ball.'
};
export const explainChange = (kind) => WHY[kind] || WHY.unknown;

/** What the scorer may do for each kind of problem. */
export function conflictOptions(kind) {
  const base = ['save_copy', 'discard'];
  return kind === 'same' || kind === 'unknown' ? ['retry', ...base] : base;
}

const EXTRA = { wide: 'wide', no_ball: 'no ball', bye: 'bye', leg_bye: 'leg bye' };
export function describeAction(a) {
  if (!a) return '';
  if (a.kind === 'players') return 'Batters or bowler chosen';
  const p = a.payload || {};
  const parts = [];
  if (p.extra) parts.push(EXTRA[p.extra] || p.extra);
  if (Number(p.runs) > 0 || !p.extra) parts.push(`${Number(p.runs || 0)} run${Number(p.runs) === 1 ? '' : 's'}`);
  if (p.wicket) parts.push(`wicket (${String(p.wicket).replace(/_/g, ' ')})`);
  return parts.join(', ') || 'Ball';
}

export function describeConflict(failed, errorMessage, mark, server, queue) {
  const kind = serverChange(mark, server);
  return { kind, why: explainChange(kind), failed: describeAction(failed), serverMessage: String(errorMessage || ''), heldCount: (queue || []).length, options: conflictOptions(kind) };
}

/** Plain text copy of the unsent balls, so nothing is lost when they are thrown away. */
export function queueCopyText(matchId, queue, when = new Date()) {
  const lines = [`Unsent scoring actions for match ${matchId}`, `Saved ${when.toISOString()}`, ''];
  (queue || []).forEach((a, i) => lines.push(`${i + 1}. ${describeAction(a)}`));
  lines.push('', '--- raw data (for support) ---', JSON.stringify(queue || []));
  return lines.join('\n');
}
