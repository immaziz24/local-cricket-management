/**
 * #289 Background synchronisation (Android app only).
 * While the scorer is offline the queued actions are also copied to the Android app. If the app is then closed, Android
 * uploads them when the internet returns (SyncJobService). The server already ignores a ball it has seen (client id), so a
 * ball can never be recorded twice. When the app is opened again, the actions Android already sent are removed from the queue.
 * Pure rules live here so they can be tested; the bridge object is passed in.
 */
const KINDS = ['ball', 'players'];

export const actionId = (a) => (a && (a.id || (a.payload && a.payload.client_id))) || null;

/** Text for the Android bridge, or '' when there is nothing to send (or an action cannot be tracked). */
export function buildPending(session, queue) {
  if (!Array.isArray(queue) || !queue.length) return '';
  if (!session || !session.url || !session.key || !session.token) return '';
  const actions = [];
  for (const a of queue) {
    const id = actionId(a);
    if (!id || !KINDS.includes(a.kind)) return ''; // an old queue without ids stays with the normal sync
    actions.push({ id, kind: a.kind, payload: a.payload || {} });
  }
  return JSON.stringify({ url: session.url, key: session.key, token: session.token, exp: Number(session.exp) || 0, actions });
}

/** Remove the actions Android has already uploaded. */
export function pruneQueue(queue, sentIds) {
  const sent = new Set(Array.isArray(sentIds) ? sentIds : []);
  if (!sent.size) return queue;
  return (queue || []).filter((a) => !sent.has(actionId(a)));
}

export function parseSent(text, matchId) {
  try { const o = JSON.parse(text || '{}'); return Array.isArray(o[matchId]) ? o[matchId] : []; } catch { return []; }
}

export const hasNativeSync = () => typeof window !== 'undefined' && !!window.CricnotchSync && typeof window.CricnotchSync.setPending === 'function';

/** Copy the queue to the app (or clear it when the queue is empty). */
export async function mirrorToNative(matchId, queue, getSession) {
  if (!hasNativeSync()) return;
  try {
    if (!queue.length) { window.CricnotchSync.setPending(matchId, ''); return; }
    window.CricnotchSync.setPending(matchId, buildPending(await getSession(), queue));
  } catch { /* the normal sync still works */ }
}

export function sentFromNative(matchId) {
  if (!hasNativeSync() || typeof window.CricnotchSync.takeSent !== 'function') return [];
  try { return parseSent(window.CricnotchSync.takeSent(), matchId); } catch { return []; }
}
