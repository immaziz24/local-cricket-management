// Batch 12: #365 ground conflict wording and #366 inspection checklist checks. Server rules are mirrored so mistakes show before sending.

const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');
export const formatSlot = (a, b) => `${stamp(a)} - ${b ? new Date(b).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : ''}`;

/** Turn a check_ground_conflicts / check_match_ground_conflict result into a level and short lines. */
export function summarizeConflicts(r) {
  if (!r) return { level: 'unknown', lines: [] };
  const lines = [];
  for (const h of r.hard || []) lines.push(`${h.label}: ${formatSlot(h.starts_at, h.ends_at)}`);
  if (r.outside_hours) lines.push(`Outside opening hours (${String(r.open_time || '').slice(0, 5)} to ${String(r.close_time || '').slice(0, 5)}).`);
  for (const s of r.soft || []) lines.push(`${s.label}: ${formatSlot(s.starts_at, s.ends_at)}`);
  const level = (r.hard || []).length || r.outside_hours ? 'blocked' : (r.soft || []).length ? 'warn' : 'ok';
  return { level, lines };
}

export const LEVEL_STYLE = {
  ok: { color: '#15803d', bg: '#f0fdf4', title: 'This time is free.' },
  warn: { color: '#b45309', bg: '#fffbeb', title: 'Free, but other requests are waiting for it.' },
  blocked: { color: '#b91c1c', bg: '#fef2f2', title: 'This time clashes.' },
  unknown: { color: '#64748b', bg: '#f8fafc', title: '' },
};

/** Two clashing items for the owner's list. */
export const conflictPairLine = (c) => `${c.a} and ${c.b} overlap (${formatSlot(c.b_starts, c.b_ends)}).`;

/** Convert a datetime-local value (India time) to an ISO string. */
export function localToIso(v) {
  if (!v) return null;
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const CHECKLIST_GROUPS = { pitch: 'Pitch', outfield: 'Outfield', facilities: 'Facilities', safety: 'Safety' };

export function groupChecklist(template = []) {
  const out = [];
  for (const key of Object.keys(CHECKLIST_GROUPS)) {
    const items = template.filter((t) => t.group === key);
    if (items.length) out.push({ key, label: CHECKLIST_GROUPS[key], items });
  }
  return out;
}

/** answers: { key: { ok: 'true' | 'false' | 'na', note } }. Same rules as the database. */
export function validateChecklist(template = [], answers = {}) {
  const errors = [];
  let answered = 0;
  const failedCritical = [];
  for (const t of template) {
    const a = answers[t.key];
    const ok = a && a.ok;
    if (!ok || ok === 'na') continue;
    answered += 1;
    if (a.note && String(a.note).length > 200) errors.push('Item notes can be at most 200 characters.');
    if (ok === 'false' && t.critical) {
      if (!a.note || String(a.note).trim().length < 3) errors.push(`Say what is wrong with: ${t.label}`);
      failedCritical.push(t.label);
    }
  }
  const need = Math.ceil(template.length * 0.6);
  if (answered < need) errors.push(`Answer at least ${need} of the ${template.length} checks.`);
  return { errors, answered, need, failedCritical, fit: failedCritical.length === 0 };
}

export function buildChecklistReport(answers, { notes, matchId, fit = true } = {}) {
  const checklist = {};
  for (const [k, a] of Object.entries(answers)) {
    if (!a || !a.ok) continue;
    checklist[k] = { ok: a.ok, note: a.note ? String(a.note).trim() : '' };
  }
  return { checklist, notes: notes || '', match_id: matchId || '', fit_for_play: fit };
}

export function checklistSummary(i) {
  if (!i || i.checklist_total == null) return null;
  const failed = i.critical_failed || [];
  return `${i.checklist_pass} of ${i.checklist_total} checks passed${failed.length ? `. Must fix: ${failed.join(', ')}` : ''}`;
}
