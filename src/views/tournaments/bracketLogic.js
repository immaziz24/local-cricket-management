/**
 * Knockout and double-elimination round builders (#46, #56). Pure functions - no database, no React.
 * Moved out of StandingsPanel.jsx so they can be tested.
 */

export const KO_STAGES = ['knockout', 'quarter_final', 'semi_final', 'final'];

const stageFor = (n) => (n <= 2 ? 'final' : n <= 4 ? 'semi_final' : n <= 8 ? 'quarter_final' : 'knockout');

function pairUp(list) {
  const out = [];
  const rest = [...list];
  const bye = rest.length % 2 === 1 ? rest.pop() : null;
  for (let i = 0; i + 1 < rest.length; i += 2) out.push([rest[i], rest[i + 1]]);
  return { pairs: out, bye };
}

/**
 * #46 Double elimination: a team is out after its second defeat.
 * Unbeaten teams play each other (winners bracket), one-defeat teams play each other (losers bracket);
 * the last unbeaten team meets the last one-defeat team in the grand final.
 */
export function nextDoubleEliminationRound({ teamIds, matches }) {
  const de = matches.filter((m) => m.bracket);
  if (de.some((m) => m.status === 'scheduled' || m.status === 'live')) throw new Error('Finish the current round first (enter all results).');
  if (de.some((m) => m.bracket === 'grand_final' && m.winner_team_id)) throw new Error('The grand final is played. Declare the winner below.');
  const losses = new Map(teamIds.map((id) => [id, 0]));
  const lastPlayed = new Map();
  de.forEach((m) => {
    if (m.winner_team_id) {
      const loser = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
      losses.set(loser, (losses.get(loser) || 0) + 1);
    }
    [m.team_a_id, m.team_b_id].forEach((id) => lastPlayed.set(id, Math.max(lastPlayed.get(id) || 0, m.match_no || 0)));
  });
  const order = (ids) => [...ids].sort((a, b) => (lastPlayed.get(a) || 0) - (lastPlayed.get(b) || 0));
  const wb = order(teamIds.filter((id) => (losses.get(id) || 0) === 0));
  const lb = order(teamIds.filter((id) => (losses.get(id) || 0) === 1));
  const round = Math.max(0, ...de.map((m) => m.round_no || 0)) + 1;

  if (wb.length === 1 && lb.length === 1) {
    return { fixtures: [{ team_a_id: wb[0], team_b_id: lb[0], stage: 'final', bracket: 'grand_final', round_no: round }], byes: [], label: 'Grand final', round };
  }
  if (wb.length + lb.length < 2) throw new Error('Only one team is left. Declare the winner below.');
  const fixtures = [];
  const byes = [];
  if (wb.length >= 2) {
    const { pairs, bye } = pairUp(wb);
    pairs.forEach(([a, b]) => fixtures.push({ team_a_id: a, team_b_id: b, stage: 'knockout', bracket: 'winners', round_no: round }));
    if (bye) byes.push(bye);
  }
  if (lb.length >= 2) {
    const { pairs, bye } = pairUp(lb);
    pairs.forEach(([a, b]) => fixtures.push({ team_a_id: a, team_b_id: b, stage: 'knockout', bracket: 'losers', round_no: round }));
    if (bye) byes.push(bye);
  }
  if (fixtures.length === 0) throw new Error('No matches possible yet.');
  return { fixtures, byes, label: `Round ${round}`, round };
}

/** Works out the next knockout round (#56). Returns { fixtures, bye, stage, round }. */
export function nextKnockoutRound({ structure, teamIds, table, matches }) {
  const ko = matches.filter((m) => KO_STAGES.includes(m.stage));
  if (ko.some((m) => m.status === 'scheduled' || m.status === 'live')) throw new Error('Finish the current knockout round first (enter all results).');
  if (structure !== 'knockout' && structure !== 'custom') {
    const league = matches.filter((m) => m.stage === 'league' || m.stage === 'group');
    if (league.length === 0) throw new Error('There are no league or group matches yet.');
    if (league.some((m) => m.status === 'scheduled' || m.status === 'live')) throw new Error('Finish all league / group matches first.');
  }

  // Who enters the knockouts
  let seeds;
  if (structure === 'knockout' || structure === 'custom') {
    seeds = [...teamIds];
  } else {
    const q = table.filter((r) => r.qualified);
    const maxRank = Math.max(0, ...q.map((r) => r.rank_no));
    seeds = [];
    for (let rank = 1; rank <= maxRank; rank++) q.filter((r) => r.rank_no === rank).forEach((r) => seeds.push(r.team_id));
  }
  if (seeds.length < 2) throw new Error('At least 2 qualified teams are needed for knockouts.');

  const losers = new Set();
  [...ko].sort((a, b) => (a.round_no || 0) - (b.round_no || 0) || (a.match_no || 0) - (b.match_no || 0)).forEach((m) => {
    if (!m.winner_team_id) return;
    losers.add(m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id);
  });
  const alive = seeds.filter((id) => !losers.has(id));
  if (alive.length < 2) throw new Error('The knockouts are finished. Declare the winner below.');

  const round = Math.max(0, ...ko.map((m) => m.round_no || 0)) + 1;
  const fixtures = [];
  let bye = null;
  if (ko.length === 0 && structure !== 'knockout' && structure !== 'custom') {
    // First knockout round from the table: best seed meets the lowest (1 v 4, 2 v 3; A1 v B2, B1 v A2)
    const list = [...alive];
    if (list.length % 2 === 1) bye = list.shift();
    for (let i = 0; i < list.length / 2; i++) fixtures.push([list[i], list[list.length - 1 - i]]);
  } else {
    // Later rounds: winners in bracket order, teams that had a bye go last
    const last = round - 1;
    const lastWinners = ko.filter((m) => (m.round_no || 0) === last && m.winner_team_id)
      .sort((a, b) => (a.match_no || 0) - (b.match_no || 0)).map((m) => m.winner_team_id).filter((id) => alive.includes(id));
    const list = [...lastWinners, ...alive.filter((id) => !lastWinners.includes(id))];
    if (list.length % 2 === 1) bye = list.pop();
    for (let i = 0; i + 1 < list.length; i += 2) fixtures.push([list[i], list[i + 1]]);
  }
  const stage = stageFor(alive.length);
  return { fixtures: fixtures.map(([a, b]) => ({ team_a_id: a, team_b_id: b, stage, round_no: round })), bye, stage, round };
}
