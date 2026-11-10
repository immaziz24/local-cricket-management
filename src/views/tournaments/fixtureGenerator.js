/**
 * #48 Automatic fixture generation (pure functions, no database).
 * - roundRobin: every team plays every other team (circle method); `double` = home and away.
 * - knockoutFirstRound: pairs teams; with an odd number the last team gets a bye.
 * - scheduleFixtures: gives each match a date/time (IST) from a start date, first-match time,
 *   matches per day and the gap between matches.
 */

export function roundRobin(teamIds, double = false) {
  const teams = [...teamIds];
  if (teams.length < 2) return [];
  if (teams.length % 2 === 1) teams.push(null); // bye
  const n = teams.length;
  const rounds = [];
  let arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]; // rotate all but the first
  }
  const fixtures = [];
  rounds.forEach((pairs, r) => pairs.forEach(([a, b]) => fixtures.push({ team_a_id: a, team_b_id: b, round_no: r + 1 })));
  if (double) {
    rounds.forEach((pairs, r) => pairs.forEach(([a, b]) => fixtures.push({ team_a_id: b, team_b_id: a, round_no: rounds.length + r + 1 })));
  }
  return fixtures;
}

export function knockoutFirstRound(teamIds) {
  const teams = [...teamIds];
  const fixtures = [];
  const byes = [];
  for (let i = 0; i + 1 < teams.length; i += 2) {
    fixtures.push({ team_a_id: teams[i], team_b_id: teams[i + 1], round_no: 1, stage: 'knockout' });
  }
  if (teams.length % 2 === 1) byes.push(teams[teams.length - 1]);
  return { fixtures, byes };
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Interleave fixtures from several groups so each day mixes groups fairly. */
export function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) lists.forEach((l) => { if (l[i]) out.push(l[i]); });
  return out;
}

/**
 * @param fixtures  array of fixtures (order kept)
 * @param opts      { startDate: 'YYYY-MM-DD', firstTime: 'HH:MM', perDay: number, gapMinutes: number }
 */
export function scheduleFixtures(fixtures, { startDate, firstTime = '09:00', perDay = 2, gapMinutes = 240 }) {
  const [h, m] = firstTime.split(':').map(Number);
  const base = new Date(`${startDate}T00:00:00+05:30`);
  return fixtures.map((f, i) => {
    const day = Math.floor(i / perDay);
    const slot = i % perDay;
    const minutes = h * 60 + m + slot * gapMinutes;
    const d = new Date(base.getTime() + day * 86400000 + minutes * 60000);
    return { ...f, scheduled_at: d.toISOString() };
  });
}
