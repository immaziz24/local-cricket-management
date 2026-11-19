// #371 Turns the match's live state into a small, flat JSON for OBS and other streaming tools.
// Plain JavaScript with no imports so it runs in the edge function and in the node tests.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => UUID.test(String(v || ''));

export const overs = (balls) => `${Math.floor((balls || 0) / 6)}.${(balls || 0) % 6}`;

/** Short text for one ball, as shown in the over strip: 4, W, 2wd, 1nb, 1b, 1lb. */
export function ballText(b) {
  if (!b) return '';
  if (b.wicket) return 'W';
  if (b.extra === 'wide') return `${(b.extra_runs || 1) > 1 ? b.extra_runs : ''}wd`;
  if (b.extra === 'no_ball') return `${b.runs ? b.runs : ''}nb`;
  if (b.extra === 'bye' || b.extra === 'leg_bye') return `${b.extra_runs || 0}${b.extra === 'bye' ? 'b' : 'lb'}`;
  return String(b.runs ?? 0);
}

const teamName = (centre, id) => {
  const t = [centre?.team_a, centre?.team_b].find((x) => x?.id === id);
  return t ? (t.short_name || t.name || '') : '';
};

/** centre = get_match_centre result, live = get_live_state result. Returns null when either is missing. */
export function normalizeOverlay(centre, live, now = new Date()) {
  if (!centre || !live) return null;
  const cur = live.current || {};
  const list = live.innings || [];
  const inns = list.find((i) => i.id === cur.innings_id) || list[list.length - 1] || null;
  const runs = cur.runs ?? inns?.runs ?? 0;
  const wickets = cur.wickets ?? inns?.wickets ?? 0;
  const legal = cur.legal_balls ?? inns?.legal_balls ?? 0;
  const finished = live.status === 'completed' || centre.match?.status === 'completed';
  const batters = (inns?.batting || [])
    .filter((b) => b.at_crease || b.player_id === cur.striker_id || b.player_id === cur.non_striker_id)
    .slice(0, 2)
    .map((b) => ({ name: b.name, runs: b.runs ?? 0, balls: b.balls ?? 0, on_strike: !!b.on_strike }));
  const bw = (inns?.bowling || []).find((b) => b.player_id === cur.bowler_id) || (inns?.bowling || []).find((b) => b.player_id === cur.last_over_bowler_id) || null;
  const target = cur.target ?? null;
  const info = finished ? (live.result_summary || centre.match?.result_summary || 'Match finished')
    : target ? `Need ${cur.runs_needed ?? Math.max(0, target - runs)} from ${cur.balls_left ?? '?'} balls`
    : live.overs_limit ? `${inns?.is_super_over ? 'Super Over' : `Innings ${cur.innings_no || inns?.innings_no || 1}`} · ${live.overs_limit} overs`
    : live.status === 'paused' ? 'Play paused' : '';
  return {
    match_id: live.match_id || centre.match?.id || null,
    status: live.status || centre.match?.status || null,
    finished,
    innings_no: cur.innings_no || inns?.innings_no || null,
    is_super_over: !!(inns?.is_super_over),
    batting_team: teamName(centre, cur.batting_team_id || inns?.batting_team?.id),
    bowling_team: teamName(centre, cur.bowling_team_id || inns?.bowling_team?.id),
    team_a: { name: centre.team_a?.name || '', short: centre.team_a?.short_name || null, logo_url: centre.team_a?.logo_url || null },
    team_b: { name: centre.team_b?.name || '', short: centre.team_b?.short_name || null, logo_url: centre.team_b?.logo_url || null },
    runs, wickets, overs: overs(legal), legal_balls: legal,
    score_text: `${runs}/${wickets}`,
    run_rate: legal ? Number((runs / (legal / 6)).toFixed(2)) : 0,
    overs_limit: live.overs_limit ?? null,
    target, runs_needed: cur.runs_needed ?? null, balls_left: cur.balls_left ?? null,
    batters,
    bowler: bw ? { name: bw.name, wickets: bw.wickets ?? 0, runs: bw.runs ?? 0, overs: overs(bw.legal_balls) } : null,
    this_over: (cur.this_over || []).slice(-8).map((b) => ({ text: ballText(b), runs: b.runs ?? 0, wicket: !!b.wicket, extra: b.extra || null })),
    info,
    result: finished ? (live.result_summary || centre.match?.result_summary || null) : null,
    updated_at: now.toISOString()
  };
}

/** Which match was asked for: ?match=<uuid>. Returns { match } or { error }. */
export function parseOverlayRequest(url) {
  let u;
  try { u = new URL(url); } catch { return { error: 'Bad address.' }; }
  const match = u.searchParams.get('match') || u.searchParams.get('overlay') || '';
  if (!isUuid(match)) return { error: 'Add ?match=<match id> to the address.' };
  return { match: match.toLowerCase() };
}
