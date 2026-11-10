import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Wrench, Copy, Plus, Trash2, Coins, Users, Shuffle, CalendarDays, Table2, Wallet, Trophy, Gavel, Ruler, Gauge, Target, Activity } from 'lucide-react';
import * as M from './cricketMath.js';
import { roundRobin, knockoutFirstRound, scheduleFixtures } from '../tournaments/fixtureGenerator.js';
import { DlsHelper } from '../rules/LawsView.jsx';

/** Category L – cricket calculators and tools (#216–#232). Everything runs in the browser; nothing is saved. */

const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
const lbl = { fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' };
const th = { textAlign: 'left', padding: '0.35rem 0.4rem', fontSize: '0.7rem', color: '#64748b', borderBottom: '1px solid #e2e8f0' };
const td = { padding: '0.35rem 0.4rem', fontSize: '0.84rem', borderBottom: '1px solid #f1f5f9' };
const fmtMoney = (n) => (n === null || n === undefined ? '–' : `₹${Number(n).toLocaleString('en-IN')}`);

function Field({ label, value, onChange, type = 'text', placeholder, min, step }) {
  return <label style={lbl}>{label}<input type={type} value={value} min={min} step={step} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inp} /></label>;
}
function Result({ children, hint }) {
  return (
    <div style={{ marginTop: '0.8rem', padding: '0.7rem 0.85rem', borderRadius: '0.5rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
      <div style={{ fontSize: '1rem' }}>{children}</div>
      {hint && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>{hint}</div>}
    </div>
  );
}
const OVERS_HINT = 'Overs like 12.3 mean 12 overs and 3 balls.';
const copy = (text) => { try { navigator.clipboard.writeText(text); } catch { /* clipboard not allowed */ } };

/* #216 – #221 rate calculators */
function RateTools() {
  const [s, setS] = useState({ runs: '', overs: '', target: '', score: '', done: '', total: '', bRuns: '', bBalls: '', bOuts: '', wRuns: '', wOvers: '', wWkts: '' });
  const set = (k) => (v) => setS({ ...s, [k]: v });
  const rr = M.runRate(s.runs, s.overs);
  const req = M.requiredRate(s.target, s.score, s.done || '0', s.total);
  const bw = M.bowlingAverage(s.wRuns, s.wWkts, s.wOvers);
  return (
    <>
      <Card title="Run rate (#216)">
        <div style={grid}><Field label="Runs" type="number" value={s.runs} onChange={set('runs')} /><Field label="Overs" value={s.overs} onChange={set('overs')} placeholder="e.g. 8.4" /></div>
        <Result hint={OVERS_HINT}>{rr !== null ? <>Run rate: <strong>{rr}</strong> per over</> : 'Enter runs and overs.'}</Result>
      </Card>
      <Card title="Required run rate (#217)">
        <div style={grid}>
          <Field label="Target" type="number" value={s.target} onChange={set('target')} />
          <Field label="Current score" type="number" value={s.score} onChange={set('score')} />
          <Field label="Overs bowled" value={s.done} onChange={set('done')} placeholder="e.g. 6.2" />
          <Field label="Total overs" value={s.total} onChange={set('total')} placeholder="e.g. 10" />
        </div>
        <Result hint={OVERS_HINT}>{!req ? 'Enter the target, score and overs.' : req.won ? 'Target reached!' : req.ballsLeft === 0 ? `Innings over – fell short by ${req.need - 1 >= 0 ? req.need - 1 : 0} run(s).`
          : <>Need <strong>{req.need}</strong> from <strong>{req.ballsLeft}</strong> balls · required rate <strong>{req.rrr}</strong></>}</Result>
      </Card>
      <Card title="Batting strike rate & average (#218, #219)">
        <div style={grid}>
          <Field label="Runs" type="number" value={s.bRuns} onChange={set('bRuns')} />
          <Field label="Balls faced" type="number" value={s.bBalls} onChange={set('bBalls')} />
          <Field label="Times out" type="number" value={s.bOuts} onChange={set('bOuts')} />
        </div>
        <Result hint="Strike rate = runs per 100 balls. Average = runs ÷ times out (not-outs don’t count as outs).">
          Strike rate <strong>{M.strikeRate(s.bRuns, s.bBalls) ?? '–'}</strong> · Average <strong>{M.battingAverage(s.bRuns, s.bOuts) ?? (s.bRuns && s.bOuts === '0' ? 'not out every time' : '–')}</strong>
        </Result>
      </Card>
      <Card title="Bowling economy, average & strike rate (#220, #221)">
        <div style={grid}>
          <Field label="Runs conceded" type="number" value={s.wRuns} onChange={set('wRuns')} />
          <Field label="Overs bowled" value={s.wOvers} onChange={set('wOvers')} />
          <Field label="Wickets" type="number" value={s.wWkts} onChange={set('wWkts')} />
        </div>
        <Result hint="Economy = runs per over. Average = runs per wicket. Strike rate = balls per wicket.">
          Economy <strong>{M.economy(s.wRuns, s.wOvers) ?? '–'}</strong> · Average <strong>{bw.average ?? '–'}</strong> · Strike rate <strong>{bw.strikeRate ?? '–'}</strong>
        </Result>
      </Card>
    </>
  );
}

/* #222 Net Run Rate */
function NrrTool() {
  const blank = { runsFor: '', oversFaced: '', allOutFor: false, runsAgainst: '', oversBowled: '', allOutAgainst: false };
  const [quota, setQuota] = useState('10');
  const [rows, setRows] = useState([{ ...blank }]);
  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const res = M.netRunRate(rows.map((r) => ({ ...r, quota })));
  return (
    <Card title="Net Run Rate (#222)" subtitle="One row per match for your team">
      <div style={{ maxWidth: 180 }}><Field label="Overs per innings" value={quota} onChange={setQuota} /></div>
      <div style={{ overflowX: 'auto', marginTop: '0.6rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr><th style={th}>#</th><th style={th}>Runs scored</th><th style={th}>Overs faced</th><th style={th}>All out?</th><th style={th}>Runs conceded</th><th style={th}>Overs bowled</th><th style={th}>Opp. all out?</th><th style={th}></th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={td}><input type="number" value={r.runsFor} onChange={(e) => upd(i, 'runsFor', e.target.value)} style={inp} /></td>
              <td style={td}><input value={r.oversFaced} onChange={(e) => upd(i, 'oversFaced', e.target.value)} style={inp} /></td>
              <td style={td}><input type="checkbox" checked={r.allOutFor} onChange={(e) => upd(i, 'allOutFor', e.target.checked)} /></td>
              <td style={td}><input type="number" value={r.runsAgainst} onChange={(e) => upd(i, 'runsAgainst', e.target.value)} style={inp} /></td>
              <td style={td}><input value={r.oversBowled} onChange={(e) => upd(i, 'oversBowled', e.target.value)} style={inp} /></td>
              <td style={td}><input type="checkbox" checked={r.allOutAgainst} onChange={(e) => upd(i, 'allOutAgainst', e.target.checked)} /></td>
              <td style={td}>{rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><Trash2 size={15} /></button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Button size="sm" variant="secondary" onClick={() => setRows([...rows, { ...blank }])} style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Plus size={14} /> Add match</Button>
      <Result hint="NRR = (runs scored ÷ overs faced) − (runs conceded ÷ overs bowled). When a side is all out, its full quota of overs is used.">
        {res ? <>NRR <strong style={{ color: res.nrr >= 0 ? '#15803d' : '#b91c1c' }}>{res.nrr > 0 ? '+' : ''}{res.nrr.toFixed(3)}</strong> · scored {res.runsFor} in {res.oversFor} ov ({res.forRate}/ov) · conceded {res.runsAgainst} in {res.oversAgainst} ov ({res.againstRate}/ov)</> : 'Fill in at least one match.'}
      </Result>
    </Card>
  );
}

/* #224 Toss */
function TossTool() {
  const [teams, setTeams] = useState({ a: '', b: '', call: 'Heads' });
  const [res, setRes] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const flip = () => {
    setSpinning(true); setRes(null);
    setTimeout(() => {
      const side = M.tossCoin();
      const caller = teams.b || 'Team B';
      const winner = side === teams.call ? caller : (teams.a || 'Team A');
      setRes({ side, winner, at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
      setSpinning(false);
    }, 900);
  };
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Coins size={16} /> Toss (#224)</span>} subtitle="A fair digital coin – uses your device’s secure random numbers">
      <div style={grid}>
        <Field label="Team that flips (home)" value={teams.a} onChange={(v) => setTeams({ ...teams, a: v })} placeholder="Team A" />
        <Field label="Team that calls (away)" value={teams.b} onChange={(v) => setTeams({ ...teams, b: v })} placeholder="Team B" />
        <label style={lbl}>Call<select value={teams.call} onChange={(e) => setTeams({ ...teams, call: e.target.value })} style={inp}><option>Heads</option><option>Tails</option></select></label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.8rem' }}>
        <Button variant="primary" onClick={flip} disabled={spinning}>{spinning ? 'Flipping…' : 'Flip the coin'}</Button>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #fde68a, #ca8a04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#713f12',
                      transition: 'transform 0.9s', transform: spinning ? 'rotateY(1080deg)' : 'none' }}>{res ? res.side[0] : '?'}</div>
      </div>
      {res && <Result hint={`Tossed at ${res.at}`}><strong>{res.side}!</strong> {res.winner} won the toss.</Result>}
    </Card>
  );
}

/* Load a real squad (#225 #226) */
function SquadLoader({ onLoad }) {
  const [teams, setTeams] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dataService.fetchMyTeams().then((t) => setTeams(t || [])).catch(() => setTeams([])); }, []);
  if (!teams.length) return null;
  return (
    <label style={{ ...lbl, maxWidth: 260 }}>Fill from one of my teams
      <select defaultValue="" disabled={busy} style={inp} onChange={async (e) => {
        if (!e.target.value) return;
        setBusy(true);
        try {
          const t = await dataService.fetchTeam(e.target.value);
          const role = { batter: 'bat', bowler: 'bowler', all_rounder: 'all', wicket_keeper: 'wk' };
          onLoad((t.squad || []).map((p) => [p.display_name, role[p.player_role]].filter(Boolean).join(', ')).join('\n'));
        } catch { /* ignore */ } finally { setBusy(false); }
      }}>
        <option value="">Choose a team…</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </label>
  );
}
const PLAYERS_HINT = 'One player per line. Optional: role (bat, bowler, all, wk) and rating 1–5, e.g. “Aziz, wk, 4”.';

/* #225 Team generator */
function TeamGenerator() {
  const [text, setText] = useState('');
  const [n, setN] = useState(2);
  const [teams, setTeams] = useState(null);
  const players = M.parsePlayers(text);
  const share = teams ? teams.map((t) => `${t.name}: ${t.players.map((p) => p.name).join(', ')}`).join('\n') : '';
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Shuffle size={16} /> Team generator (#225)</span>} subtitle="Split a group of players into fair teams">
      <SquadLoader onLoad={setText} />
      <label style={{ ...lbl, marginTop: '0.5rem' }}>Players ({players.length})<textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Aziz, wk, 4\nMunna, bowler, 5\nRahul, bat\n…'} style={{ ...inp, resize: 'vertical' }} /></label>
      <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>{PLAYERS_HINT}</p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginTop: '0.5rem' }}>
        <div style={{ width: 120 }}><Field label="Number of teams" type="number" min="2" value={n} onChange={(v) => setN(v)} /></div>
        <Button variant="primary" disabled={players.length < 2} onClick={() => setTeams(M.makeTeams(players, n))}>{teams ? 'Shuffle again' : 'Make teams'}</Button>
      </div>
      {teams && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem', marginTop: '0.8rem' }}>
            {teams.map((t) => (
              <div key={t.name} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.6rem' }}>
                <div style={{ fontWeight: 800 }}>{t.name} <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>({t.players.length} · strength {t.total})</span></div>
                <ol style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem', fontSize: '0.84rem' }}>{t.players.map((p) => <li key={p.name}>{p.name}{p.role === 'wicket_keeper' ? ' (wk)' : ''}</li>)}</ol>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
            <Button size="sm" variant="secondary" onClick={() => copy(share)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Copy size={13} /> Copy</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', alignSelf: 'center', color: '#15803d' }}>Share on WhatsApp</a>
          </div>
        </>
      )}
    </Card>
  );
}

/* #226 Playing XI generator */
function XiGenerator() {
  const [text, setText] = useState('');
  const [size, setSize] = useState(11);
  const [bowlers, setBowlers] = useState(5);
  const [res, setRes] = useState(null);
  const players = M.parsePlayers(text);
  const roleName = { batter: 'Batter', bowler: 'Bowler', all_rounder: 'All-rounder', wicket_keeper: 'Wicket-keeper' };
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Users size={16} /> Playing XI generator (#226)</span>} subtitle="Suggests a balanced side and batting order from your squad">
      <SquadLoader onLoad={setText} />
      <label style={{ ...lbl, marginTop: '0.5rem' }}>Squad ({players.length})<textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} style={{ ...inp, resize: 'vertical' }} placeholder={'Aziz, wk, 4\nMunna, bowler, 5\n…'} /></label>
      <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>{PLAYERS_HINT}</p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ width: 120 }}><Field label="Players a side" type="number" min="2" value={size} onChange={(v) => setSize(v)} /></div>
        <div style={{ width: 150 }}><Field label="Bowling options" type="number" min="1" value={bowlers} onChange={(v) => setBowlers(v)} /></div>
        <Button variant="primary" disabled={!players.length} onClick={() => setRes(M.pickPlayingXI(players, { size: Number(size) || 11, bowlersNeeded: Number(bowlers) || 0 }))}>Suggest XI</Button>
      </div>
      {res && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem', marginTop: '0.8rem' }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: '0.3rem' }}>Playing XI (batting order)</div>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.86rem' }}>{res.xi.map((p) => <li key={p.name}>{p.name} <span style={{ color: '#94a3b8' }}>{roleName[p.role] || ''}</span></li>)}</ol>
          </div>
          <div>
            <div style={{ fontWeight: 800, marginBottom: '0.3rem' }}>Bench</div>
            <div style={{ fontSize: '0.84rem', color: '#475569' }}>{res.bench.map((p) => p.name).join(', ') || '—'}</div>
            {res.notes.map((x) => <p key={x} style={{ fontSize: '0.78rem', color: '#b45309', margin: '0.4rem 0 0' }}>{x}</p>)}
          </div>
        </div>
      )}
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Only a suggestion – the captain picks the real Playing XI on the match page.</p>
    </Card>
  );
}

/* #227 Fixture generator */
function FixtureTool() {
  const [text, setText] = useState('');
  const [format, setFormat] = useState('round_robin');
  const [sched, setSched] = useState({ start: '', time: '09:00', perDay: 3, gap: 90 });
  const [list, setList] = useState(null);
  const names = text.split('\n').map((x) => x.trim()).filter(Boolean);
  const make = () => {
    let fx = format === 'knockout' ? knockoutFirstRound(names).fixtures : roundRobin(names, format === 'double');
    if (sched.start) fx = scheduleFixtures(fx, { startDate: sched.start, firstTime: sched.time, perDay: Number(sched.perDay) || 1, gapMinutes: Number(sched.gap) || 60 });
    setList(fx);
  };
  const text2 = list ? list.map((f, i) => `${i + 1}. ${f.team_a_id} vs ${f.team_b_id}${f.scheduled_at ? ' – ' + new Date(f.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}`).join('\n') : '';
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><CalendarDays size={16} /> Fixture generator (#227)</span>} subtitle="Quick fixture list for any set of teams (tournaments on this site make their own fixtures)">
      <label style={lbl}>Teams ({names.length}) – one per line<textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} style={{ ...inp, resize: 'vertical' }} /></label>
      <div style={{ ...grid, marginTop: '0.5rem' }}>
        <label style={lbl}>Format<select value={format} onChange={(e) => setFormat(e.target.value)} style={inp}>
          <option value="round_robin">League (everyone plays once)</option><option value="double">League (home and away)</option><option value="knockout">Knockout (first round)</option>
        </select></label>
        <Field label="Start date (optional)" type="date" value={sched.start} onChange={(v) => setSched({ ...sched, start: v })} />
        <Field label="First match" type="time" value={sched.time} onChange={(v) => setSched({ ...sched, time: v })} />
        <Field label="Matches per day" type="number" min="1" value={sched.perDay} onChange={(v) => setSched({ ...sched, perDay: v })} />
        <Field label="Minutes between starts" type="number" min="10" value={sched.gap} onChange={(v) => setSched({ ...sched, gap: v })} />
      </div>
      <Button variant="primary" disabled={names.length < 2} onClick={make} style={{ marginTop: '0.6rem' }}>Make fixtures</Button>
      {list && (
        <>
          <ol style={{ fontSize: '0.86rem', marginTop: '0.7rem', paddingLeft: '1.3rem' }}>
            {list.map((f, i) => <li key={i}>{f.team_a_id} vs {f.team_b_id}{f.round_no ? <span style={{ color: '#94a3b8' }}> · round {f.round_no}</span> : ''}{f.scheduled_at ? <span style={{ color: '#475569' }}> · {new Date(f.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> : ''}</li>)}
          </ol>
          {format === 'knockout' && names.length % 2 === 1 && <p style={{ fontSize: '0.78rem', color: '#b45309' }}>{names[names.length - 1]} gets a bye to the next round.</p>}
          <Button size="sm" variant="secondary" onClick={() => copy(text2)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Copy size={13} /> Copy list</Button>
        </>
      )}
    </Card>
  );
}

/* #228 Points table calculator */
function PointsTool() {
  const [teamsText, setTeamsText] = useState('');
  const [cfg, setCfg] = useState({ quota: '10', win: 2, tie: 1, nr: 1 });
  const [results, setResults] = useState([]);
  const teams = teamsText.split('\n').map((x) => x.trim()).filter(Boolean);
  const upd = (i, k, v) => setResults(results.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const table = teams.length >= 2 ? M.pointsTable(teams, results, { quota: cfg.quota, win: Number(cfg.win), tie: Number(cfg.tie), noResult: Number(cfg.nr) }) : [];
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Table2 size={16} /> Points table calculator (#228)</span>} subtitle="Enter results to see the standings with net run rate">
      <div style={grid}>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Teams – one per line<textarea rows={3} value={teamsText} onChange={(e) => setTeamsText(e.target.value)} style={{ ...inp, resize: 'vertical' }} /></label>
        <Field label="Overs per innings" value={cfg.quota} onChange={(v) => setCfg({ ...cfg, quota: v })} />
        <Field label="Points – win" type="number" value={cfg.win} onChange={(v) => setCfg({ ...cfg, win: v })} />
        <Field label="Points – tie" type="number" value={cfg.tie} onChange={(v) => setCfg({ ...cfg, tie: v })} />
        <Field label="Points – no result" type="number" value={cfg.nr} onChange={(v) => setCfg({ ...cfg, nr: v })} />
      </div>
      {teams.length >= 2 && (
        <>
          <div style={{ overflowX: 'auto', marginTop: '0.7rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={th}>Team A</th><th style={th}>Runs</th><th style={th}>Overs</th><th style={th}>All out</th><th style={th}>Team B</th><th style={th}>Runs</th><th style={th}>Overs</th><th style={th}>All out</th><th style={th}>No result</th><th style={th}></th></tr></thead>
              <tbody>{results.map((r, i) => (
                <tr key={i}>
                  <td style={td}><select value={r.a} onChange={(e) => upd(i, 'a', e.target.value)} style={inp}>{teams.map((t) => <option key={t}>{t}</option>)}</select></td>
                  <td style={td}><input type="number" value={r.aRuns} onChange={(e) => upd(i, 'aRuns', e.target.value)} style={inp} /></td>
                  <td style={td}><input value={r.aOvers} onChange={(e) => upd(i, 'aOvers', e.target.value)} style={inp} /></td>
                  <td style={td}><input type="checkbox" checked={!!r.aAllOut} onChange={(e) => upd(i, 'aAllOut', e.target.checked)} /></td>
                  <td style={td}><select value={r.b} onChange={(e) => upd(i, 'b', e.target.value)} style={inp}>{teams.map((t) => <option key={t}>{t}</option>)}</select></td>
                  <td style={td}><input type="number" value={r.bRuns} onChange={(e) => upd(i, 'bRuns', e.target.value)} style={inp} /></td>
                  <td style={td}><input value={r.bOvers} onChange={(e) => upd(i, 'bOvers', e.target.value)} style={inp} /></td>
                  <td style={td}><input type="checkbox" checked={!!r.bAllOut} onChange={(e) => upd(i, 'bAllOut', e.target.checked)} /></td>
                  <td style={td}><input type="checkbox" checked={!!r.noResult} onChange={(e) => upd(i, 'noResult', e.target.checked)} /></td>
                  <td style={td}><button onClick={() => setResults(results.filter((_, j) => j !== i))} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><Trash2 size={15} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setResults([...results, { a: teams[0], b: teams[1], aRuns: '', aOvers: cfg.quota, bRuns: '', bOvers: '' }])} style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Plus size={14} /> Add result</Button>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.8rem' }}>
            <thead><tr><th style={th}>#</th><th style={th}>Team</th><th style={th}>P</th><th style={th}>W</th><th style={th}>L</th><th style={th}>T</th><th style={th}>NR</th><th style={th}>Pts</th><th style={th}>NRR</th></tr></thead>
            <tbody>{table.map((r, i) => (
              <tr key={r.team}><td style={td}>{i + 1}</td><td style={{ ...td, fontWeight: 700 }}>{r.team}</td><td style={td}>{r.p}</td><td style={td}>{r.w}</td><td style={td}>{r.l}</td><td style={td}>{r.tie}</td><td style={td}>{r.nr}</td><td style={{ ...td, fontWeight: 800 }}>{r.pts}</td><td style={td}>{r.nrr > 0 ? '+' : ''}{r.nrr.toFixed(3)}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}
    </Card>
  );
}

/* #229 Budget */
function BudgetTool() {
  const [items, setItems] = useState([
    { label: 'Ground booking', amount: '', perMatch: true }, { label: 'Balls', amount: '', perMatch: true }, { label: 'Umpires / scorer', amount: '', perMatch: true },
    { label: 'Trophies & medals', amount: '', perMatch: false }, { label: 'Food & water', amount: '', perMatch: false }
  ]);
  const [s, setS] = useState({ teams: '8', fee: '', matches: '', sponsor: '' });
  const res = M.budget({ items, teams: s.teams, entryFee: s.fee, matches: s.matches, sponsorship: s.sponsor });
  const upd = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Wallet size={16} /> Tournament budget (#229)</span>}>
      <div style={grid}>
        <Field label="Teams" type="number" value={s.teams} onChange={(v) => setS({ ...s, teams: v })} />
        <Field label="Entry fee per team (₹)" type="number" value={s.fee} onChange={(v) => setS({ ...s, fee: v })} />
        <Field label="Number of matches" type="number" value={s.matches} onChange={(v) => setS({ ...s, matches: v })} />
        <Field label="Sponsorship (₹)" type="number" value={s.sponsor} onChange={(v) => setS({ ...s, sponsor: v })} />
      </div>
      <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {items.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={x.label} onChange={(e) => upd(i, 'label', e.target.value)} style={{ ...inp, flex: 2, minWidth: 140 }} />
            <input type="number" value={x.amount} placeholder="₹" onChange={(e) => upd(i, 'amount', e.target.value)} style={{ ...inp, flex: 1, minWidth: 90 }} />
            <label style={{ fontSize: '0.78rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}><input type="checkbox" checked={x.perMatch} onChange={(e) => upd(i, 'perMatch', e.target.checked)} /> per match</label>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={() => setItems([...items, { label: 'Other', amount: '', perMatch: false }])} style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Plus size={14} /> Add cost</Button>
      <Result hint="Break-even fee = what each team must pay so entry fees and sponsorship cover all costs.">
        Costs <strong>{fmtMoney(res.cost)}</strong> · Income <strong>{fmtMoney(res.income)}</strong> ·{' '}
        <strong style={{ color: res.balance >= 0 ? '#15803d' : '#b91c1c' }}>{res.balance >= 0 ? `Surplus ${fmtMoney(res.balance)}` : `Short by ${fmtMoney(-res.balance)}`}</strong>
        {res.breakEvenFee !== null && <> · Break-even fee <strong>{fmtMoney(res.breakEvenFee)}</strong> per team</>}
      </Result>
    </Card>
  );
}

/* #230 Prize distribution */
function PrizeTool() {
  const [pool, setPool] = useState('');
  const [roundTo, setRoundTo] = useState('100');
  const [shares, setShares] = useState([{ label: 'Winner', percent: 50 }, { label: 'Runner-up', percent: 25 }, { label: 'Player of the Tournament', percent: 10 }, { label: 'Best batter', percent: 5 }, { label: 'Best bowler', percent: 5 }, { label: 'Best fielder', percent: 5 }]);
  const res = M.splitPrizes(pool, shares, roundTo);
  const upd = (i, k, v) => setShares(shares.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Trophy size={16} /> Prize distribution (#230)</span>}>
      <div style={grid}>
        <Field label="Prize money (₹)" type="number" value={pool} onChange={setPool} />
        <Field label="Round to (₹)" type="number" value={roundTo} onChange={setRoundTo} />
      </div>
      <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {res.prizes.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input value={x.label} onChange={(e) => upd(i, 'label', e.target.value)} style={{ ...inp, flex: 2 }} />
            <input type="number" value={x.percent} onChange={(e) => upd(i, 'percent', e.target.value)} style={{ ...inp, width: 80, flex: 'none' }} /><span style={{ fontSize: '0.8rem' }}>%</span>
            <strong style={{ minWidth: 90, textAlign: 'right', fontSize: '0.9rem' }}>{fmtMoney(x.amount)}</strong>
            <button onClick={() => setShares(shares.filter((_, j) => j !== i))} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={() => setShares([...shares, { label: 'Other award', percent: 0 }])} style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Plus size={14} /> Add prize</Button>
      <Result hint="When the shares add up to 100%, any amount left over from rounding goes to the first prize.">
        Shares total <strong style={{ color: res.percentTotal === 100 ? '#15803d' : '#b91c1c' }}>{res.percentTotal}%</strong>
        {res.percentTotal !== 100 && <> – {res.percentTotal < 100 ? `${fmtMoney(res.leftover)} not given out` : 'more than 100%!'}</>}
      </Result>
    </Card>
  );
}

/* #231 Auction */
function AuctionTool() {
  const [s, setS] = useState({ purse: '', spent: '', squadSize: '15', bought: '', basePrice: '' });
  const set = (k) => (v) => setS({ ...s, [k]: v });
  const r = M.auctionBudget(s);
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Gavel size={16} /> Player auction (#231)</span>} subtitle="How much can a team still bid without running out of money?">
      <div style={grid}>
        <Field label="Total purse (₹ or points)" type="number" value={s.purse} onChange={set('purse')} />
        <Field label="Spent so far" type="number" value={s.spent} onChange={set('spent')} />
        <Field label="Squad size" type="number" value={s.squadSize} onChange={set('squadSize')} />
        <Field label="Players bought" type="number" value={s.bought} onChange={set('bought')} />
        <Field label="Base price per player" type="number" value={s.basePrice} onChange={set('basePrice')} />
      </div>
      <Result hint="Max bid keeps enough money to buy the remaining players at the base price.">
        Left <strong>{r.remaining.toLocaleString('en-IN')}</strong> for <strong>{r.slots}</strong> player(s) · Max bid now <strong>{r.maxBid.toLocaleString('en-IN')}</strong> · Average <strong>{r.averagePerSlot.toLocaleString('en-IN')}</strong> per slot
        {r.short && <div style={{ color: '#b91c1c', fontSize: '0.85rem' }}>Not enough left to fill the squad at the base price.</div>}
      </Result>
    </Card>
  );
}

/* #232 Ground */
function GroundTool() {
  const [s, setS] = useState({ straight: '', square: '' });
  const g = M.groundSize(s.straight, s.square);
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Ruler size={16} /> Ground dimensions (#232)</span>} subtitle="Distances from the middle of the pitch to the boundary">
      <div style={grid}>
        <Field label="Straight boundary (m)" type="number" value={s.straight} onChange={(v) => setS({ ...s, straight: v })} />
        <Field label="Square boundary (m)" type="number" value={s.square} onChange={(v) => setS({ ...s, square: v })} placeholder="same as straight" />
      </div>
      <Result hint="Reference: pitch 22 yards (20.12 m) between the stumps; 30-yard circle ≈ 27.4 m; international boundaries are usually 65–90 yards (≈ 59–82 m). Local grounds are often much smaller – set your boundary rules in Playing conditions.">
        {g ? <>Boundary ≈ <strong>{g.straightYards}</strong> × <strong>{g.squareYards}</strong> yards · rope length ≈ <strong>{g.perimeter} m</strong> · playing area ≈ <strong>{g.area.toLocaleString('en-IN')} m²</strong> ({g.acres} acres)</> : 'Enter the boundary distance.'}
      </Result>
    </Card>
  );
}

const TOOLS = [
  ['rates', 'Run rate, strike rate & averages', Gauge, '#216–221', RateTools],
  ['nrr', 'Net Run Rate', Activity, '#222', NrrTool],
  ['dls', 'Rain target (DLS help)', Target, '#223', DlsHelper],
  ['toss', 'Toss', Coins, '#224', TossTool],
  ['teams', 'Team generator', Shuffle, '#225', TeamGenerator],
  ['xi', 'Playing XI generator', Users, '#226', XiGenerator],
  ['fixtures', 'Fixture generator', CalendarDays, '#227', FixtureTool],
  ['points', 'Points table', Table2, '#228', PointsTool],
  ['budget', 'Tournament budget', Wallet, '#229', BudgetTool],
  ['prizes', 'Prize distribution', Trophy, '#230', PrizeTool],
  ['auction', 'Player auction', Gavel, '#231', AuctionTool],
  ['ground', 'Ground dimensions', Ruler, '#232', GroundTool]
];

export function ToolsView() {
  const [tool, setTool] = useState('rates');
  const T = TOOLS.find((t) => t[0] === tool) || TOOLS[0];
  const Comp = T[4];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Wrench size={22} /> Cricket tools</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Calculators and generators for organisers, captains and scorers. Nothing here is saved.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '0.5rem' }}>
        {TOOLS.map(([id, label, Icon, tag]) => (
          <button key={id} onClick={() => setTool(id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 0.7rem', borderRadius: '0.6rem', cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem', fontWeight: 700,
                     border: `1px solid ${tool === id ? '#16a34a' : '#e2e8f0'}`, backgroundColor: tool === id ? '#f0fdf4' : '#fff', color: tool === id ? '#166534' : '#334155' }}>
            <Icon size={16} /> <span style={{ flex: 1 }}>{label}</span><span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 500 }}>{tag}</span>
          </button>
        ))}
      </div>
      <Comp />
    </div>
  );
}

export default ToolsView;
