import './StandingsPanel.css';
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ChevronDown, Trophy, Medal, GitBranch, Settings2, AlertCircle, CheckCircle } from 'lucide-react';
import { LeaderboardsPanel } from '../stats/LeaderboardsPanel.jsx';
import { scheduleFixtures } from './fixtureGenerator.js';
import { scoreLine } from './MatchResultForm.jsx';
import { KO_STAGES, nextDoubleEliminationRound, nextKnockoutRound } from './bracketLogic.js';
import { qualificationStatus } from './qualification.js';

/**
 * #53 Points table, #54 Net Run Rate, #55 Qualification management,
 * #56 Knockout brackets, #46 Double elimination, #58 Tournament completion and winner declaration.
 */

const STAGE_LABEL = { knockout: 'Knockout', quarter_final: 'Quarter-finals', semi_final: 'Semi-finals', final: 'Final' };
const field = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.82rem' };
const th = { textAlign: 'center', padding: '0.45rem 0.35rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #e2e8f0' };
const td = { textAlign: 'center', padding: '0.5rem 0.35rem', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9' };

const fmtNrr = (v) => { const n = Number(v || 0); return `${n > 0 ? '+' : ''}${n.toFixed(3)}`; };

const BRACKET_LABEL = { winners: 'Winners bracket', losers: 'Losers bracket', grand_final: 'Grand final' };

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
      {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
    </div>
  );
}

export function StandingsPanel({ tournament, isOrganiser, onTournamentChanged, onNavigate }) {
  const [expandedTeam, setExpandedTeam] = useState(null);
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
      const fixtures = dataService.fetchTournamentMatches(tournament.id);
      const [t, m, st] = await Promise.all([
        dataService.fetchPointsTable(tournament.id, fixtures),
        fixtures,
        dataService.fetchTournamentStructure(tournament.id)
      ]);
      setTable(t || []); setMatches(m || []); setTeams(st?.teams || []);
      const final = (m || []).find((x) => x.stage === 'final' && x.winner_team_id);
      if (final) setFinish({ winner: final.winner_team_id, runnerUp: final.winner_team_id === final.team_a_id ? final.team_b_id : final.team_a_id });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  useEffect(() => { load(); }, [tournament.id, tournament.status]);
  useEffect(() => {
    setRules({ players_per_side: tournament.players_per_side ?? 11, max_substitutes: tournament.max_substitutes ?? 4, overs_per_innings: tournament.overs_per_innings ?? '', points_win: tournament.points_win ?? 2, points_tie: tournament.points_tie ?? 1, points_no_result: tournament.points_no_result ?? 1, qualify_per_group: tournament.qualify_per_group ?? 2 });
  }, [tournament.id, tournament.players_per_side, tournament.max_substitutes, tournament.overs_per_innings, tournament.points_win, tournament.points_tie, tournament.points_no_result, tournament.qualify_per_group]);

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
  const showTable = structure !== 'knockout' && structure !== 'double_elimination';
  const groups = [...new Map(table.map((r) => [r.group_id || 'all', r.group_name || (structure === 'groups_knockout' ? 'Not in a group' : 'League table')])).entries()];
  const koMatches = matches.filter((m) => KO_STAGES.includes(m.stage) || m.stage === 'third_place');

  const createNextRound = () => {
    if (structure === 'double_elimination') {
      let de;
      try { de = nextDoubleEliminationRound({ teamIds: teams.map((t) => t.id), matches }); }
      catch (err) { setMsg({ ok: false, text: err.message }); return; }
      const lines = de.fixtures.map((f) => `${BRACKET_LABEL[f.bracket]}: ${nameOf(f.team_a_id)} vs ${nameOf(f.team_b_id)}`).join('\n');
      const byeText = de.byes.length ? `\n\nBye: ${de.byes.map(nameOf).join(', ')}` : '';
      if (!window.confirm(`Create ${de.label}?\n\n${lines}${byeText}`)) return;
      const fx = scheduleFixtures(de.fixtures, { ...ko, perDay: Number(ko.perDay) || 1, gapMinutes: Number(ko.gapMinutes) || 180 });
      run(() => dataService.saveGeneratedFixtures(tournament.id, fx, false), (r) => `${de.label}: ${r.matches} match${r.matches === 1 ? '' : 'es'} created.${de.byes.length ? ` Bye: ${de.byes.map(nameOf).join(', ')}.` : ''}`);
      return;
    }
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
        // #328 Early qualification: Q / E only when the remaining results cannot change it.
        const rowIds = new Set(rows.map((r) => r.team_id));
        const leftToPlay = matches.filter((m) => (m.stage === 'league' || m.stage === 'group')
          && !['completed', 'abandoned', 'cancelled'].includes(m.status) && rowIds.has(m.team_a_id) && rowIds.has(m.team_b_id));
        const early = leftToPlay.length > 0 && !rows.some((r) => r.qualified)
          ? qualificationStatus({
            rows: rows.map((r) => ({ team_id: r.team_id, points: r.points })), remaining: leftToPlay, spots: tournament.qualify_per_group ?? 2,
            pointsWin: tournament.points_win ?? 2, pointsTie: tournament.points_tie ?? 1, pointsNoResult: tournament.points_no_result ?? 1
          })
          : null;
        return (
          <Card key={gid} title={gname} subtitle={`Top ${tournament.qualify_per_group ?? 2} qualify � Win ${tournament.points_win ?? 2} pts, tie ${tournament.points_tie ?? 1}, no result ${tournament.points_no_result ?? 1}`}>
            <div className='standings-table-container'>
              <table className='standings-table' role='table' aria-label={gname}>
                <thead role='rowgroup'>
                  <tr role='row'>
                    <th role='columnheader' scope='col' style={th}>#</th><th role='columnheader' scope='col' style={{ ...th, textAlign: 'left' }}>Team</th>
                    <th role='columnheader' scope='col' style={th}>P</th><th role='columnheader' scope='col' style={th}>W</th><th role='columnheader' scope='col' style={th}>L</th><th role='columnheader' scope='col' style={th}>T</th><th role='columnheader' scope='col' style={th}>NR</th>
                    <th role='columnheader' scope='col' style={th}>Pts</th><th role='columnheader' scope='col' style={th}>NRR</th><th scope='col' aria-label='Team matches' style={th} />
                  </tr>
                </thead>
                <tbody role='rowgroup'>
                  {rows.map((r) => {
                    const rowKey = `${tournament.id}-${r.team_id}`;
                    const expanded = expandedTeam === rowKey;
                    const teamMatches = expanded ? matches.filter((m) => m.team_a_id === r.team_id || m.team_b_id === r.team_id) : [];
                    return (
                    <React.Fragment key={r.team_id}>
                      <tr role='row' key={r.team_id} style={{ backgroundColor: r.qualified || early?.get(r.team_id) === 'qualified' ? '#f0fdf4' : 'transparent' }}>
                        <td role='cell' data-stat='Rank' style={td}>{r.rank_no}</td>
                        <td role='cell' data-stat='Team' style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                          <div className="standings-team">
                            <span className="standings-team-name" title={r.team_name}>{r.team_name}</span> {(r.qualified || early?.get(r.team_id) === 'qualified') && <Badge variant="success">Q</Badge>}{early?.get(r.team_id) === 'eliminated' && <Badge variant="neutral">E</Badge>}
                          </div>
                        </td>
                        <td role='cell' data-stat='P' style={td}>{r.played}</td><td role='cell' data-stat='W' style={td}>{r.won}</td><td role='cell' data-stat='L' style={td}>{r.lost}</td><td role='cell' data-stat='T' style={td}>{r.tied}</td><td role='cell' data-stat='NR' style={td}>{r.no_result}</td>
                        <td role='cell' data-stat='Pts' style={{ ...td, fontWeight: 800 }}>{r.points}</td>
                        <td role='cell' data-stat='NRR' style={{ ...td, color: Number(r.nrr) > 0 ? '#047857' : Number(r.nrr) < 0 ? '#b91c1c' : '#334155' }}>{fmtNrr(r.nrr)}</td>
                        <td style={td}>
                          <button type="button" className="standings-expand" aria-expanded={expanded}
                            aria-label={`${expanded ? 'Hide' : 'Show'} matches for ${r.team_name}`}
                            onClick={() => setExpandedTeam(expanded ? null : rowKey)}>
                            <ChevronDown size={16} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={10} className="standings-match-cell">
                            <ul aria-label={`Matches for ${r.team_name}`}>
                              {teamMatches.map((match) => {
                                const isHome = match.team_a_id === r.team_id;
                                const opponent = isHome ? match.team_b : match.team_a;
                                const opponentId = isHome ? match.team_b_id : match.team_a_id;
                                const liveScore = [
                                  scoreLine(match.team_a_runs, match.team_a_wickets, match.team_a_balls),
                                  scoreLine(match.team_b_runs, match.team_b_wickets, match.team_b_balls)
                                ].filter(Boolean).join(' vs ');
                                const status = match.result_summary || (
                                  match.status === 'live' ? `Live${liveScore ? ` � ${liveScore}` : ''}`
                                    : ({ completed: 'Completed', abandoned: 'Abandoned', cancelled: 'Cancelled' }[match.status] || 'Upcoming')
                                );
                                return (
                                  <li key={match.id}>
                                    <button type="button" onClick={() => onNavigate('match-centre', match.id)}>
                                      <span><strong>vs {opponent?.name || nameOf(opponentId)}</strong>
                                        {match.scheduled_at && <small>{new Date(match.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>}
                                      </span>
                                      <span>{status}</span>
                                    </button>
                                  </li>
                                );
                              })}
                              {teamMatches.length === 0 && <li>No fixtures yet.</li>}
                            </ul>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
              Order: points, then net run rate, then wins. NRR = runs scored per over minus runs given per over; a team bowled out counts its full overs. Walkovers and no-results are left out of NRR. Q = qualified (shown early only when no remaining result can change it). E = cannot qualify any more.
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
              {(structure === 'double_elimination' ? ['winners', 'losers', 'grand_final'] : [null]).flatMap((br) => {
                const inBracket = koMatches.filter((m) => (br ? m.bracket === br : true));
                const rs = [...new Set(inBracket.map((m) => m.round_no || 1))].sort((a, b) => a - b);
                return rs.map((rn) => ({ br, rn, ms: inBracket.filter((m) => (m.round_no || 1) === rn) }));
              }).map(({ br, rn, ms }) => {
                return (
                  <div key={`${br}-${rn}`} style={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'space-around' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'flex', gap: '0.3rem', alignItems: 'center' }}><GitBranch size={13} /> {br ? `${BRACKET_LABEL[br]}${br === 'grand_final' ? '' : ` � round ${rn}`}` : (STAGE_LABEL[ms[0]?.stage] || 'Round')} </div>
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
                {structure === 'double_elimination' ? 'Unbeaten teams play in the winners bracket, teams with one defeat in the losers bracket; a second defeat knocks a team out. The last unbeaten team meets the last one-defeat team in the grand final.'
                  : structure === 'knockout' ? 'Winners of the last round are paired automatically.' : 'The first round uses the qualified teams from the table (1st plays the lowest qualifier; with groups A1 v B2, B1 v A2). Later rounds pair the winners.'} An odd team out gets a bye.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Rules (#53 points, #55 qualification) */}
      {isOrganiser && !finished && (
        <Card title="Match & points rules">
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
            {[['players_per_side', 'Players a side'], ['max_substitutes', 'Substitutes allowed'], ['overs_per_innings', 'Overs per innings'], ['points_win', 'Points for a win'], ['points_tie', 'Points for a tie'], ['points_no_result', 'Points for no result'], ['qualify_per_group', structure === 'groups_knockout' ? 'Teams qualifying per group' : 'Teams qualifying']].map(([k, l]) => (
              <label key={k} style={{ fontSize: '0.72rem', color: '#64748b' }}>{l}<br />
                <input type="number" min={k === 'qualify_per_group' || k === 'overs_per_innings' ? 1 : k === 'players_per_side' ? 2 : 0} value={rules[k] ?? ''} onChange={(e) => setRules({ ...rules, [k]: e.target.value })} style={{ ...field, width: 110 }} />
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

      {/* #57 / #102 Tournament leaderboards */}
      <LeaderboardsPanel tournamentId={tournament.id} onNavigate={onNavigate} title="Leaderboards & tournament statistics" />
    </div>
  );
}

export default StandingsPanel;
