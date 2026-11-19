// Batch 9: pure data helpers for #345 Manhattan, #346 worm comparison, #347 wagon-wheel zones, #354 career form.

/** #345 One bar per over for each innings (missing overs are 0). innings: get_match_analysis().innings */
export function manhattanData(innings) {
  const list = (innings || []).filter((i) => (i.overs || []).length > 0);
  const maxOver = Math.max(0, ...list.flatMap((i) => i.overs.map((o) => o.over)));
  const series = list.map((i) => {
    const byOver = new Map(i.overs.map((o) => [o.over, o]));
    const bars = [];
    for (let n = 1; n <= maxOver; n += 1) {
      const o = byOver.get(n);
      bars.push({ over: n, runs: o ? o.runs : 0, wickets: o ? o.wickets : 0, played: !!o });
    }
    return { innings_no: i.innings_no, team: i.team, bars, best: bars.reduce((m, b) => (b.runs > m.runs ? b : m), { runs: -1, over: 0 }) };
  });
  return { maxOver, maxRuns: Math.max(1, ...series.flatMap((s) => s.bars.map((b) => b.runs))), series };
}

/** #346 Cumulative runs / wickets per over for each innings, plus a target line for the chase. */
export function wormComparison(innings) {
  const list = (innings || []).filter((i) => (i.overs || []).length > 0);
  const series = list.map((i) => {
    let wk = 0;
    const points = [{ over: 0, total: 0, wickets: 0 }];
    for (const o of i.overs) { wk += o.wickets || 0; points.push({ over: o.over, total: o.total, wickets: wk }); }
    return { innings_no: i.innings_no, team: i.team, runs: i.runs, wickets: i.wickets, points };
  });
  const first = series[0]; const second = series[1];
  const target = first && second ? first.runs + 1 : null;
  const at = (s, over) => {
    if (!s) return null;
    let last = s.points[0];
    for (const p of s.points) { if (p.over <= over) last = p; else break; }
    return { total: last.total, wickets: last.wickets, over: Math.min(over, s.points[s.points.length - 1].over) };
  };
  const maxOver = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.over)));
  const maxRuns = Math.max(1, target || 0, ...series.flatMap((s) => s.points.map((p) => p.total)));
  /** What the scoreboard looked like after `over` overs in both innings. */
  const readout = (over) => {
    const a = at(first, over); const b = at(second, over);
    if (!a || !b) return a ? `${first.team}: ${a.total}/${a.wickets} after ${over} overs` : '';
    const diff = b.total - a.total;
    const lead = diff === 0 ? 'Level' : diff > 0 ? `${second.team} ahead by ${diff}` : `${first.team} ahead by ${-diff}`;
    return `After ${over} overs: ${first.team} ${a.total}/${a.wickets}, ${second.team} ${b.total}/${b.wickets}. ${lead}.`;
  };
  return { series, target, maxOver, maxRuns, readout };
}

/** #347 Break a set of shots into eight 45° sectors. 0° = straight, clockwise; the right of the picture is the off side for a right-hander. */
const RH_LABELS = ['Straight', 'Cover / mid-off', 'Point side', 'Third man / slips', 'Behind the wicket', 'Fine leg side', 'Square leg side', 'Midwicket / mid-on'];
export function wagonZones(shots, leftHanded = false) {
  const zones = RH_LABELS.map((_, i) => ({ label: RH_LABELS[leftHanded ? (8 - i) % 8 : i], centre: i * 45, shots: 0, runs: 0, boundaries: 0 }));
  const off = { shots: 0, runs: 0 }; const leg = { shots: 0, runs: 0 };
  for (const s of shots || []) {
    if (s.angle == null) continue;
    const a = ((s.angle % 360) + 360) % 360;
    const z = zones[Math.round(a / 45) % 8];
    z.shots += 1; z.runs += s.runs || 0; if (s.runs === 4 || s.runs === 6) z.boundaries += 1;
    if (a !== 0 && a !== 180) {
      const rightSide = a > 0 && a < 180;
      const side = (leftHanded ? !rightSide : rightSide) ? off : leg;
      side.shots += 1; side.runs += s.runs || 0;
    }
  }
  const total = zones.reduce((t, z) => t + z.shots, 0);
  const withShare = zones.map((z) => ({ ...z, share: total ? Math.round((z.shots * 100) / total) : 0 }));
  const fav = withShare.reduce((m, z) => (z.runs > m.runs ? z : m), { runs: 0, label: null });
  return { zones: withShare, total, offSide: off, legSide: leg, favourite: fav.label };
}

/** #354 Career form: filter matches, then rolling batting average and bowling trend. */
export function formOptions(matches) {
  const names = [...new Set((matches || []).map((m) => m.tournament).filter(Boolean))].sort();
  const hasFriendly = (matches || []).some((m) => !m.tournament);
  return { tournaments: names, hasFriendly };
}

export function careerForm(matches, { tournament = 'all', lastN = 0, window = 5 } = {}) {
  let rows = [...(matches || [])].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  if (tournament === '__friendly__') rows = rows.filter((m) => !m.tournament);
  else if (tournament !== 'all') rows = rows.filter((m) => m.tournament === tournament);
  if (lastN > 0) rows = rows.slice(-lastN);
  const bat = rows.filter((m) => m.batted);
  const bowl = rows.filter((m) => m.bowl_balls > 0);
  const avgOf = (arr) => {
    const runs = arr.reduce((t, m) => t + (m.runs || 0), 0); const outs = arr.filter((m) => m.out).length;
    return outs > 0 ? Math.round((runs / outs) * 100) / 100 : arr.length ? runs : null;
  };
  const rolling = bat.map((m, i) => {
    const w = bat.slice(Math.max(0, i - window + 1), i + 1);
    return { match_id: m.match_id, date: m.date, runs: m.runs, out: m.out, value: avgOf(w) };
  });
  const runs = bat.reduce((t, m) => t + (m.runs || 0), 0); const balls = bat.reduce((t, m) => t + (m.balls || 0), 0);
  const wk = bowl.reduce((t, m) => t + (m.wickets || 0), 0); const conc = bowl.reduce((t, m) => t + (m.runs_conceded || 0), 0);
  const bb = bowl.reduce((t, m) => t + (m.bowl_balls || 0), 0);
  const half = Math.floor(bat.length / 2);
  let trend = 'steady';
  if (bat.length >= 4) {
    const early = avgOf(bat.slice(0, half)); const late = avgOf(bat.slice(half));
    if (early != null && late != null) { if (late > early * 1.15) trend = 'up'; else if (late < early * 0.85) trend = 'down'; }
  }
  return {
    matches: rows.length, rows, rolling, trend,
    batting: { innings: bat.length, runs, balls, average: avgOf(bat), strike_rate: balls ? Math.round((runs * 10000) / balls) / 100 : null },
    bowling: { innings: bowl.length, wickets: wk, runs: conc, balls: bb, economy: bb ? Math.round((conc * 600) / bb) / 100 : null,
               average: wk ? Math.round((conc / wk) * 100) / 100 : null }
  };
}
