import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Search, User, Users, Activity, Trophy, Trash2, Save, ExternalLink, X, ShieldCheck } from 'lucide-react';

/**
 * #257 Super-admin dashboard / #258 admin dashboard – control centre:
 * find any user, team, match or tournament and fix it. #18 – correct or delete any ball of any match.
 * Admins can edit; only the Super-Admin can delete accounts. Every change goes to the audit log.
 */
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.75rem', color: '#475569', fontWeight: 600 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.6rem' };
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.55rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.55rem', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left', font: 'inherit', width: '100%' };
const KINDS = [['all', 'Everything'], ['users', 'Users'], ['teams', 'Teams'], ['matches', 'Matches'], ['tournaments', 'Tournaments']];
const WICKETS = [['', 'No wicket'], ['bowled', 'Bowled'], ['caught', 'Caught'], ['caught_and_bowled', 'Caught & bowled'], ['lbw', 'LBW'], ['stumped', 'Stumped'], ['run_out', 'Run out'], ['hit_wicket', 'Hit wicket'], ['retired_hurt', 'Retired hurt'], ['retired_out', 'Retired out'], ['obstructing', 'Obstructing the field'], ['timed_out', 'Timed out']];
const day = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');

function Msg({ m }) {
  if (!m) return null;
  return <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.84rem', backgroundColor: m.ok ? '#f0fdf4' : '#fef2f2', color: m.ok ? '#166534' : '#b91c1c' }}>{m.text}</div>;
}

function UserEditor({ id, currentUser, onClose, onChanged, onNavigate }) {
  const [u, setU] = useState(null);
  const [f, setF] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dataService.adminGetUser(id).then((r) => { setU(r); setF({ name: r.name || '', mobile: r.mobile || '', status: r.status }); }).catch((e) => setM({ ok: false, text: e.message })); }, [id]);
  if (!u) return <Msg m={m} />;
  const isSuper = currentUser?.role === 'Super-Admin';
  const act = async (fn, ok) => { setBusy(true); setM(null); try { const r = await fn(); if (r?.id) { setU(r); } setM({ ok: true, text: ok }); onChanged(); } catch (e) { setM({ ok: false, text: e.message }); } finally { setBusy(false); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div><strong style={{ fontSize: '1.05rem' }}>{u.name}</strong>{u.is_super_admin && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#7c3aed', fontWeight: 800 }}>SUPER-ADMIN</span>}
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{u.email} · joined {day(u.created_at)} · last sign-in {day(u.last_sign_in_at)} · email {u.email_confirmed ? 'confirmed' : 'NOT confirmed'}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Owns {u.teams_owned} teams, {u.tournaments_owned} tournaments · created {u.matches_created} matches · roles: {(u.roles || []).map((r) => r.role.replace('_', ' ')).join(', ') || 'player'}</div>
        </div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
      </div>
      <div style={grid}>
        <label style={lbl}>Name<input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label style={lbl}>Mobile<input style={inp} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></label>
        <label style={lbl}>Account<select style={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option>{f.status === 'pending_verification' && <option value="pending_verification">Pending</option>}</select></label>
      </div>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => act(() => dataService.adminUpdateUser(u.id, { name: f.name, mobile: f.mobile, ...(f.status !== u.status ? { status: f.status } : {}) }), 'Saved.')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Save size={14} /> Save</Button>
        {!u.email_confirmed && <Button variant="secondary" size="sm" disabled={busy} onClick={() => act(() => dataService.adminUpdateUser(u.id, { email_confirmed: true }), 'Email marked as confirmed – they can sign in now.')}>Confirm email</Button>}
        {u.player && <Button variant="secondary" size="sm" onClick={() => onNavigate('player-profile', u.player.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={13} /> Player profile</Button>}
        {isSuper && !u.is_super_admin && u.id !== currentUser?.id && (
          <Button variant="secondary" size="sm" disabled={busy} style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => { const why = window.prompt(`Delete ${u.name}'s account for good? Their teams and tournaments will move to you. Type a reason to confirm:`); if (why) act(() => dataService.adminDeleteUser(u.id, why).then(() => { onClose(); return null; }), 'Account deleted.'); }}>
            <Trash2 size={13} /> Delete account
          </Button>
        )}
      </div>
      <Msg m={m} />
    </div>
  );
}

function SimpleEditor({ kind, item, onClose, onChanged, onNavigate }) {
  const [f, setF] = useState(() => (kind === 'teams' ? { name: item.name || '', city: item.city || '' } : { name: item.name || '', venue: item.venue || '', status: item.status }));
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setM(null); try { await (kind === 'teams' ? dataService.adminUpdateTeam(item.id, f) : dataService.adminUpdateTournament(item.id, f)); setM({ ok: true, text: 'Saved.' }); onChanged(); } catch (e) { setM({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const del = async () => {
    if (!window.confirm(kind === 'teams' ? `Delete team ${item.name}? (Only possible if it has not played a match.)` : `Delete tournament ${item.name} and ALL its matches? This cannot be undone.`)) return;
    setBusy(true); try { await (kind === 'teams' ? dataService.adminDeleteTeam(item.id) : dataService.adminDeleteTournament(item.id)); onChanged(); onClose(); } catch (e) { setM({ ok: false, text: e.message }); setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{item.name}</strong><button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button></div>
      <div style={grid}>
        <label style={lbl}>Name<input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        {kind === 'teams' ? <label style={lbl}>City<input style={inp} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label> : (
          <>
            <label style={lbl}>Venue<input style={inp} value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></label>
            <label style={lbl}>Status<select style={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['registration', 'upcoming', 'ongoing', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={save}>Save</Button>
        <Button variant="secondary" size="sm" onClick={() => onNavigate(kind === 'teams' ? 'team-details' : 'tournament-details', item.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={13} /> Open</Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={del} style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash2 size={13} /> Delete</Button>
      </div>
      <Msg m={m} />
    </div>
  );
}

function BallRow({ b, players, onSave, onDelete, busy }) {
  const [f, setF] = useState(null);
  const label = b.is_wicket || b.wicket_type ? 'W' : b.extra_type ? `${b.extra_runs}${{ wide: 'wd', no_ball: 'nb', bye: 'b', leg_bye: 'lb' }[b.extra_type]}${b.runs_bat ? `+${b.runs_bat}` : ''}` : String(b.runs_bat);
  if (!f) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 8, alignItems: 'center', padding: '0.35rem 0.5rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
        <span style={{ color: '#64748b' }}>{b.over}.{b.ball}</span>
        <span><strong style={{ display: 'inline-block', minWidth: 34, color: label === 'W' ? '#dc2626' : b.extra_type ? '#b45309' : '#0f172a' }}>{label}</strong> {b.bowler} to {b.striker}{b.wicket_type ? ` – ${b.wicket_type.replace(/_/g, ' ')}${b.dismissed ? ` (${b.dismissed})` : ''}` : ''}</span>
        <button type="button" className="btn-mini" onClick={() => setF({ runs_bat: b.runs_bat, extra_type: b.extra_type || '', extra_runs: b.extra_runs, wicket_type: b.wicket_type || '', dismissed_id: b.dismissed_id || b.striker_id, fielder_id: b.fielder_id || '', bowler_id: b.bowler_id, striker_id: b.striker_id })}>Fix</button>
      </div>
    );
  }
  const sel = (k, opts) => <select style={inp} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{opts}</select>;
  const pOpts = (team) => [<option key="" value="">–</option>, ...players.filter((p) => !team || p.team_id === team).map((p) => <option key={p.id + p.team_id} value={p.id}>{p.name}</option>)];
  return (
    <div style={{ border: '2px solid #f59e0b', borderRadius: '0.5rem', padding: '0.6rem', margin: '0.3rem 0', backgroundColor: '#fffbeb', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <strong style={{ fontSize: '0.82rem' }}>Ball {b.over}.{b.ball}</strong>
      <div style={grid}>
        <label style={lbl}>Runs off the bat{sel('runs_bat', [0, 1, 2, 3, 4, 5, 6, 7].map((r) => <option key={r} value={r}>{r}</option>))}</label>
        <label style={lbl}>Extra{sel('extra_type', [['', 'None'], ['wide', 'Wide'], ['no_ball', 'No ball'], ['bye', 'Bye'], ['leg_bye', 'Leg bye']].map(([v, l]) => <option key={v} value={v}>{l}</option>))}</label>
        {f.extra_type && <label style={lbl}>Extra runs (total)<input type="number" min={0} max={10} style={inp} value={f.extra_runs} onChange={(e) => setF({ ...f, extra_runs: e.target.value })} /></label>}
        <label style={lbl}>Bowler{sel('bowler_id', pOpts())}</label>
        <label style={lbl}>Striker{sel('striker_id', pOpts())}</label>
        <label style={lbl}>Wicket{sel('wicket_type', WICKETS.map(([v, l]) => <option key={v} value={v}>{l}</option>))}</label>
        {f.wicket_type && <label style={lbl}>Batter out{sel('dismissed_id', pOpts())}</label>}
        {['caught', 'run_out', 'stumped'].includes(f.wicket_type) && <label style={lbl}>Fielder{sel('fielder_id', pOpts())}</label>}
      </div>
      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Extra runs are the total for the extra, including the penalty run (e.g. a plain wide = 1).</div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => onSave(b.id, { ...f, runs_bat: Number(f.runs_bat), extra_runs: f.extra_type ? Number(f.extra_runs) : 0 }).then((ok) => ok && setF(null))}>Save ball</Button>
        <Button variant="secondary" size="sm" onClick={() => setF(null)}>Cancel</Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => window.confirm('Delete this ball completely?') && onDelete(b.id)} style={{ color: '#b91c1c' }}>Delete ball</Button>
      </div>
    </div>
  );
}

function MatchFixer({ item, onClose, onChanged, onNavigate }) {
  const [d, setD] = useState(null);
  const [mf, setMf] = useState({ status: item.status, result_summary: item.result || '' });
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => dataService.adminListBalls(item.id).then(setD).catch((e) => setM({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [item.id]);
  const saveBall = async (id, p) => { setBusy(true); setM(null); try { setD(await dataService.adminUpdateBall(id, p)); setM({ ok: true, text: 'Ball corrected. Scorecard, totals and stats are updated.' }); onChanged(); return true; } catch (e) { setM({ ok: false, text: e.message }); return false; } finally { setBusy(false); } };
  const delBall = async (id) => { setBusy(true); try { setD(await dataService.adminDeleteBall(id)); setM({ ok: true, text: 'Ball deleted.' }); onChanged(); } catch (e) { setM({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const saveMatch = async () => { setBusy(true); setM(null); try { await dataService.adminUpdateMatch(item.id, mf); setM({ ok: true, text: 'Match saved.' }); onChanged(); } catch (e) { setM({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const delMatch = async () => { if (!window.confirm(`Delete ${item.title} with all its balls? This cannot be undone.`)) return; try { await dataService.adminDeleteMatch(item.id); onChanged(); onClose(); } catch (e) { setM({ ok: false, text: e.message }); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><div><strong>{item.title}</strong><div style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.score} · {item.status}{item.tournament ? ` · ${item.tournament}` : ''}</div></div><button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button></div>
      <div style={grid}>
        <label style={lbl}>Status<select style={inp} value={mf.status} onChange={(e) => setMf({ ...mf, status: e.target.value })}>{['scheduled', 'live', 'completed', 'abandoned', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label style={{ ...lbl, gridColumn: 'span 2' }}>Result text<input style={inp} value={mf.result_summary} onChange={(e) => setMf({ ...mf, result_summary: e.target.value })} placeholder="e.g. Munna won by 5 wickets" /></label>
      </div>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={saveMatch}>Save match</Button>
        <Button variant="secondary" size="sm" onClick={() => onNavigate('match-centre', item.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={13} /> Open match</Button>
        <Button variant="secondary" size="sm" onClick={delMatch} style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash2 size={13} /> Delete match</Button>
      </div>
      <Msg m={m} />
      {!d ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading balls…</span> : d.innings.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No balls scored yet.</span> : d.innings.map((inn) => (
        <div key={inn.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#059669', color: '#fff', padding: '0.45rem 0.7rem', fontWeight: 700, fontSize: '0.86rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Innings {inn.innings_no}: {inn.batting_team}</span><span>{inn.runs}/{inn.wickets} ({Math.floor(inn.legal_balls / 6)}.{inn.legal_balls % 6} ov)</span>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>{inn.balls.map((b) => <BallRow key={b.id} b={b} players={d.players} busy={busy} onSave={saveBall} onDelete={delBall} />)}</div>
        </div>
      ))}
      <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>Corrections rebuild the innings totals, over numbers, scorecard and player stats. If the match is still live, check the batters at the crease on the scoring screen afterwards.</p>
    </div>
  );
}

export function AdminControlCentre({ currentUser, onNavigate }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(null); // { kind, item }
  const search = () => dataService.adminSearch(q, kind).then((r) => { setRes(r); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { const t = setTimeout(search, q ? 300 : 0); return () => clearTimeout(t); }, [q, kind]);
  const lists = [['users', 'Users', User], ['teams', 'Teams', Users], ['matches', 'Matches', Activity], ['tournaments', 'Tournaments', Trophy]];
  const editor = open && (open.kind === 'users' ? <UserEditor id={open.item.id} currentUser={currentUser} onClose={() => setOpen(null)} onChanged={search} onNavigate={onNavigate} />
    : open.kind === 'matches' ? <MatchFixer item={open.item} onClose={() => setOpen(null)} onChanged={search} onNavigate={onNavigate} />
    : <SimpleEditor kind={open.kind} item={open.item} onClose={() => setOpen(null)} onChanged={search} onNavigate={onNavigate} />);
  const sub = (k, x) => (k === 'users' ? `${x.email || ''}${x.mobile ? ` · ${x.mobile}` : ''} · ${x.status}${x.email_confirmed ? '' : ' · email not confirmed'}`
    : k === 'teams' ? `${x.city || ''} · ${x.players} players · owner ${x.owner || '–'}`
    : k === 'matches' ? `${x.score} · ${x.status}${x.tournament ? ` · ${x.tournament}` : ''}`
    : `${x.code || ''} · ${x.status} · ${x.venue || ''} · owner ${x.owner || '–'}`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={18} /> Control centre</span>}
        subtitle="Find any user, team, match or tournament and fix it. Every change is saved in the audit log.">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', borderRadius: 999, padding: '0.35rem 0.8rem', flex: '1 1 260px', backgroundColor: '#fff' }}>
            <Search size={16} color="#94a3b8" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, mobile, team, tournament code or ID" style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.88rem' }} />
          </label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{KINDS.map(([k, l]) => <button key={k} type="button" className="btn-mini" onClick={() => setKind(k)} style={{ fontWeight: kind === k ? 800 : 500, borderColor: kind === k ? '#059669' : undefined }}>{l}</button>)}</div>
        </div>
        {err && <div style={{ color: '#b91c1c', fontSize: '0.84rem', marginTop: 8 }}>{err}</div>}
      </Card>
      {editor && <Card>{editor}</Card>}
      {res && lists.filter(([k]) => res[k]).map(([k, l, Icon]) => (
        <Card key={k} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={16} /> {l} ({res[k].length}{res[k].length === 40 ? '+' : ''})</span>}>
          {res[k].length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>None found.</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {res[k].map((x) => (
                <button key={x.id} type="button" style={{ ...row, borderColor: open?.item?.id === x.id ? '#059669' : '#e2e8f0' }} onClick={() => { setOpen({ kind: k, item: x }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <span style={{ minWidth: 0 }}><strong>{x.name || x.title}</strong>{(x.roles || []).length ? <span style={{ fontSize: '0.68rem', color: '#7c3aed', fontWeight: 800 }}> {x.roles.join(', ').replace(/_/g, '-').toUpperCase()}</span> : null}
                    <br /><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{sub(k, x)}</span></span>
                  <span style={{ fontSize: '0.75rem', color: '#2563eb', flexShrink: 0 }}>{k === 'matches' ? 'Fix scores' : 'Edit'}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      ))}
      <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>Showing the 40 newest of each type – search to find anyone among all members.</p>
    </div>
  );
}

export default AdminControlCentre;
