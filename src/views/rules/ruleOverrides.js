// Batch 11: helpers for #358 local-rule overrides, #359 who may bowl, #360 rule snapshots, #382 ball-order check.

/** The rules a team or official can ask to change for one match (keys match private.default_rules()). */
export const OVERRIDE_FIELDS = [
  { key: 'max_overs_per_bowler', label: 'Most overs per bowler', type: 'int', min: 1, max: 50, empty: 'No limit' },
  { key: 'powerplay_overs', label: 'Powerplay overs', type: 'int', min: 0, max: 50 },
  { key: 'wide_runs', label: 'Runs for a wide', type: 'int', min: 0, max: 5 },
  { key: 'no_ball_runs', label: 'Runs for a no-ball', type: 'int', min: 0, max: 5 },
  { key: 'free_hit', label: 'Free hit after a no-ball', type: 'bool' },
  { key: 'lbw', label: 'LBW allowed', type: 'bool' },
  { key: 'byes', label: 'Byes allowed', type: 'bool' },
  { key: 'leg_byes', label: 'Leg-byes allowed', type: 'bool' },
  { key: 'retire_at', label: 'Batter retires at (runs)', type: 'int', min: 1, max: 500, empty: 'Never' },
  { key: 'fielders_outside', label: 'Fielders outside the circle', type: 'int', min: 0, max: 9 },
  { key: 'boundary_size_m', label: 'Boundary size (metres)', type: 'int', min: 20, max: 120, empty: 'Not set' },
];

const FIELD = Object.fromEntries(OVERRIDE_FIELDS.map((f) => [f.key, f]));

export function formatRuleValue(key, value) {
  const f = FIELD[key];
  if (value === null || value === undefined || value === '') return f?.empty || 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** Work out only the rules that differ from the rules now in force. Returns { changes, errors }. */
export function buildOverrideChanges(current = {}, draft = {}) {
  const changes = {};
  const errors = [];
  for (const f of OVERRIDE_FIELDS) {
    if (!(f.key in draft)) continue;
    let v = draft[f.key];
    if (f.type === 'bool') v = v === true || v === 'true';
    else if (v === '' || v === null) v = f.empty ? null : undefined;
    else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < f.min || n > f.max) { errors.push(`${f.label} must be a whole number from ${f.min} to ${f.max}.`); continue; }
      v = n;
    }
    if (v === undefined) continue;
    const before = current[f.key] === undefined ? null : current[f.key];
    if (v !== before) changes[f.key] = v;
  }
  return { changes, errors };
}

export function validateOverrideRequest(changes, reason) {
  if (!changes || Object.keys(changes).length === 0) return 'Choose at least one rule to change.';
  if (String(reason || '').trim().length < 5) return 'Give a reason (at least 5 characters).';
  if (String(reason).trim().length > 300) return 'The reason can be at most 300 characters.';
  return null;
}

export function describeChanges(changes = {}, before = {}) {
  return Object.keys(changes).filter((k) => k !== 'notes').map((k) => ({
    key: k, label: FIELD[k]?.label || k.replace(/_/g, ' '),
    from: formatRuleValue(k, before[k]), to: formatRuleValue(k, changes[k]),
  }));
}

export const OVERRIDE_STATUS = {
  pending: { label: 'Waiting for the organiser', color: '#b45309' },
  approved: { label: 'Approved', color: '#065f46' },
  rejected: { label: 'Rejected', color: '#b91c1c' },
  expired: { label: 'Not decided before the match started', color: '#64748b' },
};

/** #359 Split a bowler list into who may start the next over and who may not (with the reason). */
export function splitBowlers(list = []) {
  const ok = []; const blocked = [];
  for (const b of list) (b.can_start_over ? ok : blocked).push(b);
  return { ok, blocked };
}

export const BALL_ISSUE_TITLE = {
  seq_gap: 'Missing ball', over_mismatch: 'Over count', illegal_flag: 'Legal / illegal delivery',
  same_batter_both_ends: 'Same batter at both ends', bowler_is_batter: 'Bowler also batting',
  bowler_changed_mid_over: 'Bowler changed mid-over', same_bowler_two_overs: 'Same bowler twice in a row',
  batter_after_out: 'Batted after being out', too_many_wickets: 'Too many wickets',
};

export function groupBallIssues(issues = []) {
  const by = new Map();
  for (const i of issues) {
    const k = i.innings_no ?? 0;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push({ ...i, title: BALL_ISSUE_TITLE[i.code] || i.code });
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([innings_no, items]) => ({ innings_no, items }));
}
