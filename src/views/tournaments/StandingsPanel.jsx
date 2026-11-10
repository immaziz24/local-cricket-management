import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Trophy, Medal, GitBranch, Settings2, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import { scheduleFixtures } from './fixtureGenerator.js';
import { scoreLine } from './MatchResultForm.jsx';

/**
 * #53 Points table, #54 Net Run Rate, #55 Qualification management,
 * #56 Knockout brackets, #58 Tournament completion and winner declaration.
 */

const KO_STAGES = ['knockout', 'quarter_final', 'semi_final', 'final'];
const STAGE_LABEL = { knockout: 'Knockout', quarter_final: 'Quarter-finals', semi_final: 'Semi-finals', final: 'Final' };
const field = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.82rem' };
const th = { textAlign: 'center', padding: '0.45rem 0.35rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #e2e8f0' };
const td = { textAlign: 'center', padding: '0.5rem 0.35rem', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9' };

const stageFor = (n) => (n <= 2 ? 'final' : n <= 4 ? 'semi_final' : n <= 8 ? 'quarter_final' : 'knockout');
const fmtNrr = (v) => { const n = Number(v || 0); return `${n > 0 ? '+' : ''}${n.toFixed(3)}`; };

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

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
      {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
    </div>
  );
}

export function StandingsPanel({ tournament, isOrganiser, onTournamentChanged }) {
  const [table, setTable] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState({});
  const [ko, setKo] = useState({ startDate: tournament.end_date, firstTime: '09:00', perDay: 2, gapMinutes: 240 });
  const [finish, setFinish] = useState({ winner: '', runnerUp: '' });
  const finished = tournament.status === 'completed';

  const load = async () => {
    try {
      const [t, m, st] = await Promise.all([
        dataService.fetchPointsTable(tournament.id),
        dataService.fetchTournamentMatches(tournament.id),
        dataService.fetchTournamentStructure(tournament.id)
      ]);
      setTable(t || []); setMatches(m || []); setTeams(st?.teams || []);
      const final = (m || []).find((x) => x.stage === 'final' && x.winner_team_id);
      if (final) setFinish({ winner: final.winner_team_id, runnerUp: final.winner_team_id === final.team_a_id ? final.team_b_id : final.team_a_id });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  useEffect(() => { load(); }, [tournament.id, tournament.status]);
  useEffect(() => {
    setRules({ overs_per_innings: tournament.overs_per_innings ?? '', points_win: tournament.points_win ?? 2, points_tie: tournament.points_tie ?? 1, points_no_result: tournament.points_no_result ?? 1, qualify_per_group: tournament.qualify_per_group ?? 2 });
  }, [tournament.id, tournament.overs_per_innings, tournament.points_win, tournament.points_tie, tournament.points_no_result, tournament.qualify_per_group]);

  const run = async (fn, okText, refreshTournament) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: true, text: typeof okText === 'function' ? okText(r) : okText });
      if (refreshTournament && onTournamentChanged) await onTournamentChanged();
      await load();
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  const nameOf = (id) => teams.find((t) => t.id === id)?.name || 'TBD';
  const structure = tournament.structure || 'league';
  const showTable = structure !== 'knockout';
  const groups = [...new Map(table.map((r) => [r.group_id || 'all', r.group_name || (structure === 'groups_knockout' ? 'Not in a group' : 'League table')])).entries()];
  const koMatches = matches.filter((m) => KO_STAGES.includes(m.stage) || m.stage === 'third_place');
  const rounds = [...new Set(koMatches.map((m) => m.round_no || 1))].sort((a, b) => a - b);

  const createNextRound = () => {
    let plan;
    try { plan = nextKnockoutRound({ structure, teamIds: teams.map((t) => t.id), table, matches }); }
    catch (err) { setMsg({ ok: false, text: err.message }); return; }
    if (plan.fixtures.length === 0) { setMsg({ ok: false, text: 'Nothing to create.' }); return; }
    const lines = plan.fixtures.map((f) => `${nameOf(f.team_a_id)} vs ${nameOf(f.team_b_id)}`).join('\n');
    if (!window.confirm(`Create ${STAGE_LABEL[plan.stage]}?\n\n${lines}${plan.bye ? `\n\n${nameOf(plan.bye)} gets a bye.` : ''}`)) return;
    const fixtures = scheduleFixtures(plan.fixtures, { ...ko, perDay: Number(ko.perDay) || 1, gapMinutes: Number(ko.gapMinutes) || 180 });
    run(() => dataService.saveGeneratedFixtures(tournament.id, fixtures, false), (r) => `${STAGE_LABEL[plan.stage]}: ${r.matches} match${r.matches === 1 ? '' : 'es'} created.${plan.bye ? ` ${nameOf(plan.bye)} gets a bye.` : ''}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Notice msg={msg} />

      {/* #58 Champion */}
      {finished && tournament.winner_team_id && (
        <div style={{ padding: '1.25rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #f59e0b', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Trophy size={40} color="#b45309" />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', letterSpacing: '0.05em' }}>CHAMPIONS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#78350f' }}>{nameOf(tournament.winner_team_id)}</div>
            {tournament.runner_up_team_id && <div style={{ fontSize: '0.85rem', color: '#92400e', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}><Medal size={14} /> Runner-up: {nameOf(tournament.runner_up_team_id)}</div>}
          </div>
        </div>
      )}

      {/* #53 #54 #55 Points table */}
      {showTable && groups.map(([gid, gname]) => {
        const rows = table.filter((r) => (r.group_id || 'all') === gid);
        return (
          <Card key={gid} title={gname} subtitle={`Top ${tournament.qualify_per_group ?? 2} qualify · Win ${tournament.points_win ?? 2} pts, tie ${tournament.points_tie ?? 1}, no result ${tournament.points_no_result ?? 1}`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={th}>#</th><th style={{ ...th, textAlign: 'left' }}>Team</th>
                    <th style={th}>P</th><th style={th}>W</th><th style={th}>L</th><th style={th}>T</th><th style={th}>NR</th>
                    <th style={th}>Pts</th><th style={th}>NRR</th><th style={th}>For</th><th style={th}>Against</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.team_id} style={{ backgroundColor: r.qualified ? '#f0fdf4' : 'transparent' }}>
                      <td style={td}>{r.rank_no}</td>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                        {r.team_name} {r.qualified && <Badge variant="success">Q</Badge>}
                      </td>
                      <td style={td}>{r.played}</td><td style={td}>{r.won}</td><td style={td}>{r.lost}</td><td style={td}>{r.tied}</td><td style={td}>{r.no_result}</td>
                      <td style={{ ...td, fontWeight: 800 }}>{r.points}</td>
                      <td style={{ ...td, color: Number(r.nrr) > 0 ? '#047857' : Number(r.nrr) < 0 ? '#b91c1c' : '#334155' }}>{fmtNrr(r.nrr)}</td>
                      <td style={{ ...td, fontSize: '0.75rem', color: '#64748b' }}>{scoreLine(r.runs_for, null, r.balls_faced)?.replace('/0', '') || '-'}</td>
                      <td style={{ ...td, fontSize: '0.75rem', color: '#64748b' }}>{scoreLine(r.runs_against, null, r.balls_bowled)?.replace('/0', '') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
              Order: points, then net run rate, then wins. NRR = runs scored per over minus runs given per over; a team bowled out counts its full overs. Walkovers and no-results are left out of NRR. Q = qualified.
            </p>
          </Card>
        );
      })}
      {showTable && table.length === 0 && (
        <Card title="Points table"><p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No approved teams yet.</p></Card>
      )}

      {/* #56 Knockout bracket */}
      {(koMatches.length > 0 || (isOrganiser && !finished)) && (
        <Card title="Knockout bracket">
          {koMatches.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No knockout matches yet.</p>
          ) : (
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {rounds.map((rn) => {
                const ms = koMatches.filter((m) => (m.round_no || 1) === rn);
                return (
                  <div key={rn} style={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'space-around' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'flex', gap: '0.3rem', alignItems: 'center' }}><GitBranch size={13} /> {STAGE_LABEL[ms[0]?.stage] || 'Round'} </div>
                    {ms.map((m) => (
                      <div key={m.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden', fontSize: '0.82rem' }}>
                        {[['a', m.team_a], ['b', m.team_b]].map(([side, t]) => (
                          <div key={side} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', backgroundColor: m.winner_team_id && t && m.winner_team_id === t.id ? '#ecfdf5' : '#fff', fontWeight: m.winner_team_id && t && m.winner_team_id === t.id ? 800 : 500, borderBottom: side === 'a' ? '1px solid #f1f5f9' : 'none' }}>
                            <span>{t?.name || 'TBD'}</span>
                            <span style={{ color: '#64748b' }}>{side === 'a' ? scoreLine(m.team_a_runs, m.team_a_wickets, null) : scoreLine(m.team_b_runs, m.team_b_wickets, null)}</span>
                          </div>
                        ))}
                        {m.result_summary && <div style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: '#065f46', backgroundColor: '#f8fafc' }}>{m.result_summary}</div>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {isOrganiser && !finished && (
            <div style={{ marginTop: '0.9rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Create the next knockout round</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
                <label style={{ fontSize: '0.72rem', color: '#64748b' }}>First day<br /><input type="date" value={ko.startDate} onChange={(e) => setKo({ ...ko, startDate: e.target.value })} style={field} /></label>
                <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Time<br /><input type="time" value={ko.firstTime} onChange={(e) => setKo({ ...ko, firstTime: e.target.value })} style={field} /></label>
                <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Per day<br /><input type="number" min={1} max={8} value={ko.perDay} onChange={(e) => setKo({ ...ko, perDay: e.target.value })} style={{ ...field, width: 70 }} /></label>
                <Button variant="primary" disabled={busy} onClick={createNextRound} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><GitBranch size={14} /> Create next round</Button>
              </div>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                {structure === 'knockout' ? 'Winners of the last round are paired automatically.' : 'The first round uses the qualified teams from the table (1st plays the lowest qualifier; with groups A1 v B2, B1 v A2). Later rounds pair the winners.'} An odd team out gets a bye.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Rules (#53 points, #55 qualification) */}
      {isOrganiser && !finished && (
        <Card title="Points & qualification rules">
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
            {[['overs_per_innings', 'Overs per innings'], ['points_win', 'Points for a win'], ['points_tie', 'Points for a tie'], ['points_no_result', 'Points for no result'], ['qualify_per_group', structure === 'groups_knockout' ? 'Teams qualifying per group' : 'Teams qualifying']].map(([k, l]) => (
              <label key={k} style={{ fontSize: '0.72rem', color: '#64748b' }}>{l}<br />
                <input type="number" min={k === 'qualify_per_group' || k === 'overs_per_innings' ? 1 : 0} value={rules[k] ?? ''} onChange={(e) => setRules({ ...rules, [k]: e.target.value })} style={{ ...field, width: 110 }} />
              </label>
            ))}
            <Button variant="secondary" disabled={busy} onClick={() => run(() => dataService.setTournamentRules(tournament.id, rules), 'Rules saved. The table is updated.', true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Settings2 size={14} /> Save rules</Button>
          </div>
        </Card>
      )}

      {/* #58 Finish tournament */}
      {isOrganiser && !finished && (
        <Card title="Finish tournament & declare the winner">
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Winner<br />
              <select value={finish.winner} onChange={(e) => setFinish({ ...finish, winner: e.target.value })} style={field}>
                <option value="">Choose team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Runner-up<br />
              <select value={finish.runnerUp} onChange={(e) => setFinish({ ...finish, runnerUp: e.target.value })} style={field}>
                <option value="">None</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <Button variant="primary" disabled={busy || !finish.winner}
              onClick={() => window.confirm(`Finish the tournament with ${nameOf(finish.winner)} as winner? Results can no longer be changed afterwards.`) &&
                run(() => dataService.completeTournament(tournament.id, finish.winner, finish.runnerUp), 'Tournament finished. All teams were notified.', true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Trophy size={14} /> Finish tournament
            </Button>
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Filled in from the final when it has a result. All matches must have a result (or be deleted) first.</p>
        </Card>
      )}

      {/* #57 needs player stats from ball-by-ball scoring */}
      <Card title="Leaderboards">
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <BarChart3 size={15} /> Top run-scorers and wicket-takers appear here once ball-by-ball scoring (Phase 3) is live.
        </p>
      </Card>
    </div>
  );
}

export default StandingsPanel;
