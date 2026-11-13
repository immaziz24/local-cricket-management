import { XiPoster } from '../tools/XiPoster.jsx';
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { CalendarDays, Wand2, Plus, Trash2, Clock, MapPin, AlertCircle, CheckCircle, Layers } from 'lucide-react';
import { roundRobin, knockoutFirstRound, scheduleFixtures, shuffle, interleave } from './fixtureGenerator.js';
import { MatchResultForm, scoreLine } from './MatchResultForm.jsx';
import { LineupPanel } from './LineupPanel.jsx';

/**
 * #42 Groups, #43–#47 formats, #48 automatic fixtures, #49 manual fixture,
 * #50 scheduling, #51 rescheduling, #52 tournament calendar.
 */

const STRUCTURES = [
  ['league', 'League (everyone plays everyone once)'],
  ['double_round_robin', 'Round-robin, home & away (twice)'],
  ['groups_knockout', 'Groups, then knockouts'],
  ['knockout', 'Knockout (lose and you are out)'],
  ['double_elimination', 'Double elimination (out after 2 defeats)'],
  ['custom', 'Custom (add matches by hand)']
];

const STAGE_LABEL = { league: 'League', group: 'Group', knockout: 'Knockout', quarter_final: 'Quarter-final', semi_final: 'Semi-final', final: 'Final', third_place: '3rd place' };
const BRACKET_LABEL = { winners: 'Winners bracket', losers: 'Losers bracket', grand_final: 'Grand final' };
const field = { padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.85rem' };

const dayKey = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : 'unscheduled');
const dayLabel = (key) => key === 'unscheduled' ? 'Date not set' : new Date(`${key}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 330 * 60000);
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(`${v}:00+05:30`).toISOString() : null);

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
      {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
    </div>
  );
}

export function FixturesPanel({ tournament, isOrganiser, onChanged, onNavigate }) {
  const [matches, setMatches] = useState([]);
  const [structure, setStructure] = useState({ groups: [], teams: [] });
  const [format, setFormat] = useState(tournament.structure || 'league');
  const [groupCount, setGroupCount] = useState(2);
  const [opts, setOpts] = useState({ startDate: tournament.start_date, firstTime: '09:00', perDay: 2, gapMinutes: 240 });
  const [manual, setManual] = useState({ teamA: '', teamB: '', at: '', venue: '', stage: 'league' });
  const [resched, setResched] = useState(null); // { id, at, venue, reason }
  const [resultFor, setResultFor] = useState(null); // match id with the result form open
  const [lineupFor, setLineupFor] = useState(null); // match id with the lineups open (#72–#74)
  const finished = tournament.status === 'completed' || tournament.status === 'cancelled';
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [m, st] = await Promise.all([dataService.fetchTournamentMatches(tournament.id), dataService.fetchTournamentStructure(tournament.id)]);
      setMatches(m || []);
      setStructure(st || { groups: [], teams: [] });
      onChanged && onChanged(m || []);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  useEffect(() => { load(); }, [tournament.id]);

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setMsg({ ok: true, text: typeof okText === 'function' ? okText(r) : okText }); await load(); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  const teams = structure.teams;
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'TBD';
  const played = matches.some((m) => m.status !== 'scheduled');

  const buildFixtures = () => {
    let list = [];
    if (format === 'knockout' || format === 'double_elimination') {
      const { fixtures, byes } = knockoutFirstRound(shuffle(teams.map((t) => t.id)));
      list = format === 'double_elimination' ? fixtures.map((f) => ({ ...f, bracket: 'winners' })) : fixtures;
      if (byes.length) setMsg({ ok: true, text: `${teamName(byes[0])} gets a bye into the next round.` });
    } else if (format === 'groups_knockout') {
      if (structure.groups.length === 0) throw new Error('Create groups first.');
      list = interleave(structure.groups.map((g) =>
        roundRobin(teams.filter((t) => t.group_id === g.id).map((t) => t.id)).map((f) => ({ ...f, stage: 'group', group_id: g.id }))));
      if (teams.some((t) => !t.group_id)) throw new Error('Every approved team must be in a group.');
    } else {
      list = roundRobin(teams.map((t) => t.id), format === 'double_round_robin').map((f) => ({ ...f, stage: 'league' }));
    }
    if (list.length === 0) throw new Error('At least 2 approved teams are needed.');
    return scheduleFixtures(list, { ...opts, perDay: Number(opts.perDay) || 1, gapMinutes: Number(opts.gapMinutes) || 180 });
  };

  const generate = () => {
    let fixtures;
    try { fixtures = buildFixtures(); } catch (err) { setMsg({ ok: false, text: err.message }); return; }
    const msgText = matches.length
      ? `Replace the ${matches.filter((m) => m.status === 'scheduled').length} unplayed matches with ${fixtures.length} new fixtures?`
      : `Create ${fixtures.length} fixtures?`;
    if (!window.confirm(msgText)) return;
    run(async () => {
      await dataService.setTournamentStructure(tournament.id, format);
      return dataService.saveGeneratedFixtures(tournament.id, fixtures, true);
    }, (r) => `${r.matches} fixtures created and scheduled.`);
  };

  // group matches by day for the calendar (#52)
  const byDay = matches.reduce((acc, m) => { const k = dayKey(m.scheduled_at); (acc[k] = acc[k] || []).push(m); return acc; }, {});
  const days = Object.keys(byDay).sort((a, b) => (a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Notice msg={msg} />
      {matches.length > 0 && (
        <details>
          <summary>Download tournament fixtures</summary>
          <XiPoster title="Tournament Fixtures" subtitle={matches.length + ' matches'} fileLabel="fixtures"
            lineup={{ team: tournament.name, xi: days.flatMap(day => byDay[day]).map(match => ({
              name: (match.team_a?.name || 'TBD') + ' vs ' + (match.team_b?.name || 'TBD'),
              detail: match.scheduled_at ? new Date(match.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Unscheduled'
            })), bench: [], notes: [] }} />
        </details>
      )}

      {isOrganiser && !finished && (
        <Card title="Organiser: format, groups & fixtures">
          {teams.length < 2 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Approve at least 2 teams in the <strong>Teams</strong> tab first ({teams.length} approved).</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Format */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>1. Format</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.4rem' }}>
                  {STRUCTURES.map(([v, l, tag]) => (
                    <label key={v} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.5rem 0.6rem', border: `1px solid ${format === v ? '#0f172a' : '#e2e8f0'}`, borderRadius: '0.45rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input type="radio" checked={format === v} onChange={() => setFormat(v)} /> {l} <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Groups (#42) */}
              {format === 'groups_knockout' && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>2. Groups</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))} style={field}>
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} groups</option>)}
                    </select>
                    <Button variant="secondary" disabled={busy || played} onClick={() => window.confirm('Create groups and spread the approved teams randomly? Existing groups will be replaced.') && run(() => dataService.createTournamentGroups(tournament.id, groupCount), (r) => `${r.groups} groups created with ${r.teams} teams.`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Layers size={14} /> Create groups (random draw)
                    </Button>
                  </div>
                  {structure.groups.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.6rem' }}>
                      {structure.groups.map((g) => (
                        <div key={g.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.6rem' }}>
                          <strong style={{ fontSize: '0.85rem' }}>{g.name}</strong>
                          {teams.filter((t) => t.group_id === g.id).map((t) => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginTop: '0.3rem', gap: '0.3rem' }}>
                              <span>{t.name}</span>
                              <select value={t.group_id || ''} disabled={busy || played} onChange={(e) => run(() => dataService.setTeamGroup(tournament.id, t.id, e.target.value), `${t.name} moved.`)} style={{ ...field, padding: '0.2rem', fontSize: '0.72rem' }}>
                                {structure.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Automatic fixtures (#48, #50) */}
              {format !== 'custom' && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>{format === 'groups_knockout' ? '3' : '2'}. Schedule & generate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>First match day
                      <input type="date" value={opts.startDate} min={tournament.start_date} max={tournament.end_date} onChange={(e) => setOpts({ ...opts, startDate: e.target.value })} style={{ ...field, width: '100%', boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>First match time
                      <input type="time" value={opts.firstTime} onChange={(e) => setOpts({ ...opts, firstTime: e.target.value })} style={{ ...field, width: '100%', boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Matches per day
                      <input type="number" min={1} max={8} value={opts.perDay} onChange={(e) => setOpts({ ...opts, perDay: e.target.value })} style={{ ...field, width: '100%', boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Hours between matches
                      <input type="number" min={1} max={12} step={0.5} value={opts.gapMinutes / 60} onChange={(e) => setOpts({ ...opts, gapMinutes: Math.round(Number(e.target.value) * 60) })} style={{ ...field, width: '100%', boxSizing: 'border-box' }} />
                    </label>
                  </div>
                  <div style={{ marginTop: '0.6rem' }}>
                    <Button variant="primary" disabled={busy || played} onClick={generate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Wand2 size={14} /> Generate fixtures automatically
                    </Button>
                    {played && <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: '#94a3b8' }}>Matches have started — add or reschedule matches individually.</span>}
                  </div>
                </div>
              )}

              {/* Manual match (#49) */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Add a match by hand</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
                  <select value={manual.teamA} onChange={(e) => setManual({ ...manual, teamA: e.target.value })} style={field}>
                    <option value="">Team A (or TBD)</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={manual.teamB} onChange={(e) => setManual({ ...manual, teamB: e.target.value })} style={field}>
                    <option value="">Team B (or TBD)</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={manual.stage} onChange={(e) => setManual({ ...manual, stage: e.target.value })} style={field}>
                    {Object.entries(STAGE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="datetime-local" value={manual.at} onChange={(e) => setManual({ ...manual, at: e.target.value })} style={field} />
                  <input value={manual.venue} onChange={(e) => setManual({ ...manual, venue: e.target.value })} placeholder={`Ground (default: ${tournament.venue})`} style={field} />
                  <Button variant="secondary" disabled={busy} onClick={() => run(() => dataService.createMatch({ tournamentId: tournament.id, teamA: manual.teamA, teamB: manual.teamB, scheduledAt: fromLocalInput(manual.at), venue: manual.venue, stage: manual.stage }), 'Match added.').then(() => setManual({ teamA: '', teamB: '', at: '', venue: '', stage: manual.stage }))} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Plus size={14} /> Add match
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Calendar (#52) */}
      <Card title={`Fixtures & calendar · ${matches.length} matches`}>
        {matches.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No fixtures yet{isOrganiser ? ' — generate them above.' : '. The organiser will publish the schedule soon.'}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {days.map((d) => (
              <div key={d}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  <CalendarDays size={15} /> {dayLabel(d)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {byDay[d].map((m) => (
                    <div key={m.id} style={{ padding: '0.65rem 0.8rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginRight: '0.4rem' }}>#{m.match_no}</span>
                          <strong>{m.team_a?.name || 'TBD'}</strong> <span style={{ color: '#94a3b8' }}>vs</span> <strong>{m.team_b?.name || 'TBD'}</strong>
                        </span>
                        <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                          {m.group?.name && <Badge variant="neutral">{m.group.name}</Badge>}
                          {m.bracket && <Badge variant="neutral">{BRACKET_LABEL[m.bracket]}</Badge>}
                          <Badge variant="primary">{STAGE_LABEL[m.stage] || m.stage}</Badge>
                          <Badge variant={m.status === 'completed' ? 'success' : m.status === 'live' ? 'danger' : 'warning'}>{m.status}</Badge>
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {m.scheduled_at && <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}><Clock size={12} /> {timeLabel(m.scheduled_at)}</span>}
                        {m.venue && <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}><MapPin size={12} /> {m.venue}</span>}
                        {m.notes && <span>Note: {m.notes}</span>}
                        {m.result_summary && <strong style={{ color: '#065f46' }}>{m.result_summary}</strong>}
                      </div>
                      {(m.team_a_runs !== null && m.team_a_runs !== undefined) && (
                        <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span>{m.team_a?.short_name || m.team_a?.name}: <strong>{scoreLine(m.team_a_runs, m.team_a_wickets, m.team_a_balls)}</strong></span>
                          <span>{m.team_b?.short_name || m.team_b?.name}: <strong>{scoreLine(m.team_b_runs, m.team_b_wickets, m.team_b_balls)}</strong></span>
                        </div>
                      )}

                      {m.team_a && m.team_b && onNavigate && (
                        <button onClick={() => onNavigate('match-centre', m.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', padding: 0, marginTop: '0.4rem', marginRight: '0.8rem', fontWeight: 700 }}>
                          {m.status === 'live' ? 'Open live match' : m.status === 'scheduled' ? 'Open match (toss & start)' : 'Open match'}
                        </button>
                      )}
                      {m.team_a && m.team_b && (
                        <button onClick={() => setLineupFor(lineupFor === m.id ? null : m.id)} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.78rem', padding: 0, marginTop: '0.4rem', fontWeight: 700 }}>
                          {lineupFor === m.id ? 'Hide Playing XI' : 'Playing XI'}
                        </button>
                      )}
                      {lineupFor === m.id && <LineupPanel match={m} />}

                      {isOrganiser && !finished && resultFor === m.id && (
                        <MatchResultForm match={m} oversLimit={tournament.overs_per_innings} busy={busy}
                          onCancel={() => setResultFor(null)}
                          onSave={(r) => run(() => dataService.recordMatchResult(m.id, r), (x) => `Result saved: ${x.result_summary}. Both teams were notified.`).then(() => setResultFor(null))} />
                      )}
                      {isOrganiser && !finished && resultFor !== m.id && m.team_a && m.team_b && (
                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.45rem' }}>
                          <button onClick={() => { setResched(null); setResultFor(m.id); }} style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: '0.78rem', padding: 0, fontWeight: 700 }}>
                            {m.status === 'scheduled' ? 'Enter result' : 'Edit result'}
                          </button>
                          {m.status !== 'scheduled' && (
                            <button onClick={() => window.confirm('Remove this result? The match goes back to "scheduled".') && run(() => dataService.clearMatchResult(m.id), 'Result removed.')} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>Undo result</button>
                          )}
                        </div>
                      )}

                      {isOrganiser && !finished && m.status === 'scheduled' && resultFor !== m.id && (
                        resched && resched.id === m.id ? (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            <input type="datetime-local" value={resched.at} onChange={(e) => setResched({ ...resched, at: e.target.value })} style={field} />
                            <input value={resched.venue} onChange={(e) => setResched({ ...resched, venue: e.target.value })} placeholder="Ground" style={field} />
                            <input value={resched.reason} onChange={(e) => setResched({ ...resched, reason: e.target.value })} placeholder="Reason (e.g. rain)" style={field} />
                            <Button variant="primary" disabled={busy || !resched.at} onClick={() => run(() => dataService.rescheduleMatch({ matchId: m.id, scheduledAt: fromLocalInput(resched.at), venue: resched.venue, reason: resched.reason }), 'Match rescheduled. Both teams were notified.').then(() => setResched(null))}>Save</Button>
                            <Button variant="secondary" onClick={() => setResched(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem' }}>
                            <button onClick={() => setResched({ id: m.id, at: toLocalInput(m.scheduled_at), venue: m.venue || '', reason: '' })} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>Reschedule</button>
                            <button onClick={() => window.confirm('Delete this match?') && run(() => dataService.deleteMatch(m.id), 'Match deleted.')} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.78rem', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Trash2 size={12} /> Delete</button>
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default FixturesPanel;
