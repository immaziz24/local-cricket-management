// Batch 17: helpers for #325 stage dependency builder and #330 stage freeze / reopen.

export const STAGE_STATUS = {
  frozen: { label: 'Frozen', color: '#475569' },
  waiting: { label: 'Waiting', color: '#b45309' },
  done: { label: 'Finished', color: '#065f46' },
  ready: { label: 'In play', color: '#1d4ed8' },
  empty: { label: 'No matches yet', color: '#64748b' },
};

/** The one word that describes where a stage stands right now. */
export function stageState(s) {
  if (!s) return 'empty';
  if (s.status === 'frozen') return 'frozen';
  if ((s.blocked_by || []).length > 0) return 'waiting';
  if (s.match_count === 0) return 'empty';
  if (s.done) return 'done';
  return 'ready';
}

export function stageLine(s) {
  if (!s) return '';
  const st = stageState(s);
  if (st === 'frozen') return `Frozen – scores, times and grounds are locked${s.freeze_reason ? ` (${s.freeze_reason})` : ''}`;
  if (st === 'waiting') return `Waiting for: ${s.blocked_by.join(', ')}`;
  if (st === 'empty') return 'No matches added to this stage yet';
  const left = s.open_count || 0;
  return left === 0 ? `All ${s.match_count} match${s.match_count === 1 ? '' : 'es'} finished` : `${left} of ${s.match_count} match${s.match_count === 1 ? '' : 'es'} still to play`;
}

/** Why the Freeze button is not available, or null when it is. */
export function freezeProblem(s) {
  if (!s) return 'Choose a stage.';
  if (s.status === 'frozen') return 'Already frozen.';
  if ((s.live_count || 0) > 0) return 'A match in this stage is live. Finish it first.';
  return null;
}

/** Reopen needs a real reason, and the later frozen stages must be reopened first. */
export function reopenProblem(s, all = [], reason = '') {
  if (!s || s.status !== 'frozen') return 'This stage is not frozen.';
  const later = all.filter((x) => x.status === 'frozen' && (x.depends_on || []).includes(s.id));
  if (later.length) return `Reopen ${later.map((x) => x.name).join(', ')} first.`;
  const t = String(reason || '').trim();
  if (t.length < 5) return 'Give a reason (at least 5 characters).';
  if (t.length > 200) return 'Keep the reason under 200 characters.';
  return null;
}

export function stageNameProblem(name, all = [], selfId = null) {
  const t = String(name || '').trim();
  if (t.length < 2 || t.length > 60) return 'Give the stage a name of 2 to 60 characters.';
  if (all.some((s) => s.id !== selfId && s.name.toLowerCase() === t.toLowerCase())) return 'This tournament already has a stage with that name.';
  return null;
}

/** true when making `stageId` wait for `depId` would create a loop. */
export function wouldLoop(all, stageId, depId) {
  if (stageId === depId) return true;
  const by = Object.fromEntries(all.map((s) => [s.id, s]));
  const seen = new Set();
  const stack = [depId];
  while (stack.length) {
    const id = stack.pop();
    if (id === stageId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const d of (by[id]?.depends_on || [])) stack.push(d);
  }
  return false;
}

/** Group stages into steps: step 1 waits for nothing, step 2 waits only for step 1, and so on. */
export function stageLayers(all = []) {
  const by = Object.fromEntries(all.map((s) => [s.id, s]));
  const depth = {};
  const level = (id, guard = new Set()) => {
    if (depth[id] != null) return depth[id];
    if (guard.has(id)) return 0;
    guard.add(id);
    const ds = (by[id]?.depends_on || []).filter((d) => by[d]);
    depth[id] = ds.length ? 1 + Math.max(...ds.map((d) => level(d, guard))) : 0;
    return depth[id];
  };
  all.forEach((s) => level(s.id));
  const layers = [];
  all.forEach((s) => { (layers[depth[s.id]] = layers[depth[s.id]] || []).push(s); });
  return layers.filter(Boolean);
}

export function toggleDependency(list = [], id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
