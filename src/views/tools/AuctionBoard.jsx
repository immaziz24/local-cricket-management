import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Gavel, Plus, Undo2, Share2, Download, Printer, ArrowLeft, Shuffle, ChevronRight, Trash2, Pencil, Users, X } from 'lucide-react';
import { ROLE_OPTIONS, BATTING_OPTIONS, BOWLING_OPTIONS, labelOf } from '../teams/playerOptions.js';

/**
 * #231 Player auction – a saved auction board like a local league auction sheet:
 * teams with a purse, numbered players, sold / unsold / undo, and per-team totals
 * (budget, used, remaining, players bought, places left, average, max next bid, minimum required).
 */
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: '#475569', fontWeight: 600 };
const money = (n) => (n == null ? '–' : Number(n).toLocaleString('en-IN'));
const ROLE = { bat: 'batter', batter: 'batter', bowl: 'bowler', bowler: 'bowler', all: 'all_rounder', ar: 'all_rounder', allrounder: 'all_rounder', 'all-rounder': 'all_rounder', wk: 'wicket_keeper', keeper: 'wicket_keeper' };
const ROLE_SHORT = { batter: 'BAT', bowler: 'BOWL', all_rounder: 'AR', wicket_keeper: 'WK' };

export const BAT_POSITIONS = [['opener', 'Opener'], ['top_order', 'Top order'], ['middle_order', 'Middle order'], ['finisher', 'Finisher'], ['lower_order', 'Lower order']];
const BAT_SHORT = { right_hand: 'RHB', left_hand: 'LHB' };
const BOWL_WORDS = { rf: 'right_arm_fast', rmf: 'right_arm_medium', rm: 'right_arm_medium', ob: 'right_arm_off_spin', offspin: 'right_arm_off_spin', lb: 'right_arm_leg_spin', legspin: 'right_arm_leg_spin',
  lf: 'left_arm_fast', lm: 'left_arm_medium', lmf: 'left_arm_medium', sla: 'left_arm_orthodox', lo: 'left_arm_orthodox', chinaman: 'left_arm_chinaman' };
const BAT_WORDS = { rhb: 'right_hand', right: 'right_hand', 'right-hand': 'right_hand', lhb: 'left_hand', left: 'left_hand', 'left-hand': 'left_hand' };
export const playerDetails = (p) => [p.role && ROLE_SHORT[p.role], BAT_SHORT[p.batting_style], p.batting_position && labelOf(BAT_POSITIONS, p.batting_position), p.bowling_style && p.bowling_style !== 'none' && labelOf(BOWLING_OPTIONS, p.bowling_style)].filter(Boolean).join(' · ');

const ROLE_WORDS = { ...ROLE, batsman: 'batter', batsmen: 'batter', batting: 'batter', bowling: 'bowler', allrounder: 'all_rounder', battingallrounder: 'all_rounder', bowlingallrounder: 'all_rounder',
  wicketkeeper: 'wicket_keeper', wicketkeeperbatsman: 'wicket_keeper', wicketkeeperbatter: 'wicket_keeper', wkbatsman: 'wicket_keeper', keeperbatsman: 'wicket_keeper' };
const HAND_WORDS = { ...BAT_WORDS, righthand: 'right_hand', righthanded: 'right_hand', righthandbat: 'right_hand', righthandbatsman: 'right_hand',
  lefthand: 'left_hand', lefthanded: 'left_hand', lefthandbat: 'left_hand', lefthandbatsman: 'left_hand' };
const BOWL_LONG = { ...BOWL_WORDS, rightarmfast: 'right_arm_fast', rightarmmedium: 'right_arm_medium', rightarmoffspin: 'right_arm_off_spin', rightarmlegspin: 'right_arm_leg_spin',
  leftarmfast: 'left_arm_fast', leftarmmedium: 'left_arm_medium', leftarmspin: 'left_arm_orthodox', leftarmorthodox: 'left_arm_orthodox' };
const IS_LC = /^LC-?\d+$/i;
const IS_DATE = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}(\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?)?$|^\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?$/i;
const IS_CODE = /^[A-Za-z]{1,10}[A-Za-z0-9/_-]*\d[A-Za-z0-9/_-]*$/;
const HEADER = /^(name|player|player name|full name|timestamp|mobile|phone|role|id)$/i;

/**
 * Reads pasted players, one per line. Works with "50, Rahim, bat, rhb, rf, 500, LC-000214" and with rows copied
 * from a registration sheet (Google Form / Excel): ID, timestamp, name, mobile, village, area, role, batting hand.
 * Dates and mobile numbers are left out (the auction page is public); village / area go into the note.
 * A sheet ID like TPL11/25-005 gives the auction number 5, so typing 5 brings that player up.
 */
export function readAuctionPlayers(text) {
  const seen = new Set();
  let repeats = 0;
  const list = [];
  String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const parts = (line.includes('\t') ? line.split('\t') : line.split(/[,|]/)).map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (parts.some((x) => HEADER.test(x)) && !parts.some((x) => /\d{5,}/.test(x))) return; // header row
    const p = {}; const extra = []; let phone = ''; let phones = 0; let firstPhoneAt = -1; let nameAt = -1;
    parts.forEach((x, i) => {
      const k = x.toLowerCase().replace(/[\s_-]+/g, '');
      const digits = x.replace(/[\s+()-]/g, '');
      if (IS_LC.test(x)) { if (!p.player_code) p.player_code = x.toUpperCase(); return; }
      if (IS_DATE.test(x)) return;
      if (/^\d{10,13}$/.test(digits)) { phones += 1; if (!phone) { phone = digits.slice(-10); firstPhoneAt = i; } return; }
      if (/^\d{1,8}$/.test(x)) { if (i === 0 && !p.number && x.length <= 4) p.number = String(Number(x)); else if (!p.base_price) p.base_price = String(Number(x)); return; }
      if (ROLE_WORDS[k]) { if (!p.role) p.role = ROLE_WORDS[k]; return; }
      if (HAND_WORDS[k]) { if (!p.batting_style) p.batting_style = HAND_WORDS[k]; return; }
      if (BOWL_LONG[k]) { if (!p.bowling_style) p.bowling_style = BOWL_LONG[k]; return; }
      if (!p.player_code && !p.name && !x.includes(' ') && IS_CODE.test(x)) { p.player_code = x.toUpperCase(); return; }
      if (!p.name) { p.name = x.replace(/^@+/, '').slice(0, 80); nameAt = i; }
      else extra.push(x);
    });
    // the mobile number was typed in the name column too: the next word is the village, not the name
    if (phones >= 2 && firstPhoneAt >= 0 && firstPhoneAt < nameAt) { extra.unshift(p.name); p.name = ''; }
    if (!p.name && p.player_code && !IS_LC.test(p.player_code)) p.name = p.player_code;
    if (!p.name && !p.player_code) return;
    if (!p.number && p.player_code && !IS_LC.test(p.player_code)) {
      const m = p.player_code.match(/(\d{1,4})$/);
      if (m && Number(m[1]) > 0) p.number = String(Number(m[1]));
    }
    const notes = [...new Set(extra)];
    if (notes.length) p.note = notes.join(', ').slice(0, 200);
    const key = `${(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${phone}`;
    if (phone && p.name && seen.has(key)) { repeats += 1; return; }
    seen.add(key);
    list.push(p);
  });
  return { list, repeats };
}
export const parseAuctionPlayers = (text) => readAuctionPlayers(text).list;

/** Small line under a paste box: how many players were read, and the first one as a check. */
function PasteSummary({ text }) {
  const { list, repeats } = readAuctionPlayers(text);
  if (!String(text || '').trim()) return null;
  const f = list[0];
  return (
    <span style={{ fontSize: '0.76rem', color: list.length ? '#065f46' : '#b91c1c' }}>
      {list.length ? `${list.length} player${list.length === 1 ? '' : 's'} found` : 'No players found yet'}
      {repeats ? ` · ${repeats} repeated row${repeats === 1 ? '' : 's'} (same name and mobile) left out` : ''}
      {f ? ` · first: ${f.number ? `${f.number}. ` : ''}${f.name || f.player_code}${f.player_code && f.name !== f.player_code ? ` (${f.player_code})` : ''}${playerDetails(f) ? ` · ${playerDetails(f)}` : ''}` : ''}
    </span>
  );
}

/** One player: ID / Cricnotch ID, name, role, batting hand and position, bowling style, base price. */
function PlayerForm({ player = null, basePrice, onSave, onCancel, busy }) {
  const [f, setF] = useState(() => ({ number: player?.number ?? '', player_code: player?.player_code || '', name: player?.name || '', role: player?.role || '',
    batting_style: player?.batting_style || '', batting_position: player?.batting_position || '', bowling_style: player?.bowling_style || '',
    base_price: player?.base_price && player.base_price !== basePrice ? player.base_price : '', note: player?.note || '' }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const opt = (list, empty) => [<option key="" value="">{empty}</option>, ...list.map(([v, l]) => <option key={v} value={v}>{l}</option>)];
  const ok = f.name.trim() || /^LC-?\d+$/i.test(f.player_code.trim());
  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.6rem', padding: '0.75rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <strong style={{ fontSize: '0.88rem' }}>{player ? `Edit player ${player.number}` : 'Add a player'}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.55rem' }}>
        <label style={lbl}>Auction number<input style={inp} type="number" min={1} value={f.number} onChange={set('number')} placeholder="Auto" /></label>
        <label style={lbl}>Player ID (LC-000214 or your sheet ID)<input style={inp} value={f.player_code} onChange={set('player_code')} placeholder="Optional" maxLength={40} /></label>
        <label style={{ ...lbl, gridColumn: 'span 2' }}>Name<input style={inp} value={f.name} onChange={set('name')} placeholder="Filled in from the ID if left empty" maxLength={80} /></label>
        <label style={lbl}>Role<select style={inp} value={f.role} onChange={set('role')}>{opt(ROLE_OPTIONS, 'Choose role')}</select></label>
        <label style={lbl}>Batting<select style={inp} value={f.batting_style} onChange={set('batting_style')}>{opt(BATTING_OPTIONS, 'Right / left hand')}</select></label>
        <label style={lbl}>Batting position<select style={inp} value={f.batting_position} onChange={set('batting_position')}>{opt(BAT_POSITIONS, 'Any')}</select></label>
        <label style={lbl}>Bowling<select style={inp} value={f.bowling_style} onChange={set('bowling_style')}>{opt(BOWLING_OPTIONS, 'Bowling style')}</select></label>
        <label style={lbl}>Base price<input style={inp} type="number" min={1} value={f.base_price} onChange={set('base_price')} placeholder={`Default ${money(basePrice)}`} /></label>
        <label style={{ ...lbl, gridColumn: 'span 2' }}>Note<input style={inp} value={f.note} onChange={set('note')} placeholder="Optional" maxLength={200} /></label>
      </div>
      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Type a Cricnotch player ID (LC-…, shown on their profile) and their name, role, batting and bowling are filled in for you.</span>
      <div style={{ display: 'flex', gap: '0.45rem' }}>
        <Button variant="primary" size="sm" disabled={busy || !ok} onClick={() => onSave({ ...f, number: f.number === '' ? undefined : String(f.number), base_price: f.base_price === '' ? undefined : String(f.base_price) })}>{player ? 'Save player' : 'Add player'}</Button>
        {onCancel && <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

function AuctionForm({ auction = null, tournamentId = null, onSaved, onCancel }) {
  const [f, setF] = useState(() => ({ name: auction?.name || '', base_price: auction?.base_price ?? 300, bid_step: auction?.bid_step ?? 50, squad_size: auction?.squad_size ?? 14, budget: auction?.teams?.[0]?.budget ?? 10000 }));
  const [teams, setTeams] = useState(() => (auction ? auction.teams.map((t) => ({ id: t.id, name: t.name, short_name: t.short_name || '', owner_name: t.owner_name || '', budget: t.budget, team_id: t.team_id || '' }))
    : [{ name: '', short_name: '', owner_name: '', budget: '' }, { name: '', short_name: '', owner_name: '', budget: '' }]));
  const [mine, setMine] = useState([]);
  const [players, setPlayers] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { dataService.fetchMyTeams().then((r) => setMine(r || [])).catch(() => setMine([])); }, []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setT = (i, k, v) => setTeams((ts) => ts.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const addMine = (t) => setTeams((ts) => {
    if (ts.some((x) => x.team_id === t.id)) return ts;
    const empty = ts.findIndex((x) => !x.name.trim());
    const row = { name: t.name, short_name: t.short_name || '', owner_name: '', budget: '', team_id: t.id };
    return empty >= 0 ? ts.map((x, j) => (j === empty ? row : x)) : [...ts, row];
  });
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const rows = teams.filter((t) => t.name.trim()).map((t) => ({ id: t.id, name: t.name.trim(), short_name: t.short_name, owner_name: t.owner_name, team_id: t.team_id || null, budget: t.budget === '' ? Number(f.budget) : Number(t.budget) }));
      let a = await dataService.saveAuction(auction?.id || null, { name: f.name, base_price: Number(f.base_price), bid_step: Number(f.bid_step), squad_size: Number(f.squad_size), tournament_id: auction?.tournament_id || tournamentId || null, teams: rows });
      const list = parseAuctionPlayers(players);
      if (list.length) a = await dataService.addAuctionPlayers(a.id, list);
      onSaved(a);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const cell = { ...inp, padding: '0.4rem 0.5rem' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Auction name<input style={inp} value={f.name} onChange={set('name')} placeholder="Type your auction name" maxLength={120} /></label>
        <label style={lbl}>Purse per team<input style={inp} type="number" min={0} value={f.budget} onChange={set('budget')} /></label>
        <label style={lbl}>Base price<input style={inp} type="number" min={1} value={f.base_price} onChange={set('base_price')} /></label>
        <label style={lbl}>Bid step<input style={inp} type="number" min={1} value={f.bid_step} onChange={set('bid_step')} /></label>
        <label style={lbl}>Players per team<input style={inp} type="number" min={1} max={40} value={f.squad_size} onChange={set('squad_size')} /></label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <span style={{ ...lbl, flexDirection: 'row' }}>Teams</span>
        {mine.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.76rem', color: '#64748b' }}>
            Add your team:
            {mine.map((t) => <button key={t.id} type="button" className="btn-mini" disabled={teams.some((x) => x.team_id === t.id)} onClick={() => addMine(t)}>+ {t.name}</button>)}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
            <thead><tr style={{ fontSize: '0.74rem', color: '#475569', textAlign: 'left' }}><th style={{ padding: 4 }}>Team name</th><th style={{ padding: 4 }}>Short</th><th style={{ padding: 4 }}>Owner / captain</th><th style={{ padding: 4 }}>Purse</th><th /></tr></thead>
            <tbody>{teams.map((t, i) => (
              <tr key={i}>
                <td style={{ padding: 3 }}><input style={cell} value={t.name} onChange={(e) => setT(i, 'name', e.target.value)} placeholder="Type team name" maxLength={80} /></td>
                <td style={{ padding: 3, width: 80 }}><input style={cell} value={t.short_name} onChange={(e) => setT(i, 'short_name', e.target.value)} placeholder="Short" maxLength={10} /></td>
                <td style={{ padding: 3 }}><input style={cell} value={t.owner_name} onChange={(e) => setT(i, 'owner_name', e.target.value)} placeholder="Optional" maxLength={80} /></td>
                <td style={{ padding: 3, width: 110 }}><input style={cell} type="number" min={0} value={t.budget} onChange={(e) => setT(i, 'budget', e.target.value)} placeholder={String(f.budget)} /></td>
                <td style={{ padding: 3, width: 30 }}>{teams.length > 2 && <button type="button" onClick={() => setTeams((ts) => ts.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={15} /></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {teams.length < 32 && <button type="button" className="btn-mini" onClick={() => setTeams((ts) => [...ts, { name: '', short_name: '', owner_name: '', budget: '' }])} style={{ alignSelf: 'flex-start' }}>+ Add team</button>}
      </div>
      {!auction && (
        <label style={lbl}>Players (optional now – you can add them later). One per line, or copy the rows straight from your registration sheet (ID, name, mobile, village, role, batting hand)
          <textarea rows={4} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} value={players} onChange={(e) => setPlayers(e.target.value)} placeholder="One player per line" />
          <PasteSummary text={players} />
        </label>
      )}
      {err && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : auction ? 'Save changes' : 'Create auction'}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

/** List of my auctions (or a tournament's) with a create button. */
export function AuctionsHome({ currentUser, onNavigate, tournamentId = null, canCreate = true }) {
  const [list, setList] = useState(null);
  const [making, setMaking] = useState(false);
  useEffect(() => {
    if (!currentUser && !tournamentId) { setList([]); return; }
    dataService.listAuctions(tournamentId ? { tournament_id: tournamentId } : {}).then((r) => setList(r || [])).catch(() => setList([]));
  }, [currentUser?.id, tournamentId]);
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Gavel size={17} /> Player auction</span>}
      subtitle="Run your league auction live: purses, base price, sold / unsold, and every team's remaining money and max bid"
      action={currentUser && canCreate && !making ? <Button variant="primary" size="sm" onClick={() => setMaking(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> New auction</Button> : null}>
      {making && <div style={{ marginBottom: '1rem' }}><AuctionForm tournamentId={tournamentId} onCancel={() => setMaking(false)} onSaved={(a) => onNavigate('auction', a.id)} /></div>}
      {!currentUser && !tournamentId ? <span style={{ fontSize: '0.86rem', color: '#64748b' }}>Log in to run an auction.</span>
        : list === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span>
        : list.length === 0 ? (!making && <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No auctions yet.</span>)
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {list.map((a) => (
              <button key={a.id} type="button" onClick={() => onNavigate('auction', a.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.6rem', background: '#fff', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <span><strong>{a.name}</strong><br /><span style={{ fontSize: '0.76rem', color: '#64748b' }}>{a.teams} teams · {a.sold}/{a.players} players sold · {a.status === 'finished' ? 'Finished' : 'Open'}</span></span>
                <ChevronRight size={18} color="#94a3b8" />
              </button>
            ))}
          </div>
        )}
    </Card>
  );
}

/** The live board. Organiser runs it; everyone with the link can watch (refreshes every few seconds). */
export function AuctionBoard({ auctionId, currentUser, onNavigate }) {
  const [a, setA] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState('');
  const [pick, setPick] = useState('');
  const [adding, setAdding] = useState('');
  const [filter, setFilter] = useState('all');
  const [editP, setEditP] = useState(null); // player id, or 'new'
  const [bulk, setBulk] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [step, setStep] = useState(null); // teams | players | live | results
  const [query, setQuery] = useState('');

  const load = () => dataService.getAuction(auctionId).then((r) => { if (!r) setErr('Auction not found.'); else { setA(r); setErr(null); } }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [auctionId, currentUser?.id]);
  useEffect(() => { if (a?.can_run) return undefined; const t = setInterval(load, 5000); return () => clearInterval(t); }, [a?.can_run, auctionId]);
  useEffect(() => { if (a?.name) document.title = `${a.name} · Auction · Cricnotch`; }, [a?.name]);

  const cur = useMemo(() => a?.players.find((p) => p.id === (pick || a.current_player_id)) || null, [a, pick]);
  useEffect(() => { if (cur) setPrice(String(cur.base_price)); }, [cur?.id]);
  useEffect(() => { if (a && step === null) setStep(a.can_run && a.players.length === 0 ? 'players' : 'live'); }, [a?.id]);

  if (err) return <Card><span style={{ color: '#b91c1c' }}>{err}</span></Card>;
  if (!a) return <div style={{ color: '#94a3b8' }}>Loading auction…</div>;

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (r?.id) setA(r); if (okText) setMsg({ ok: true, text: okText }); return r; }
    catch (e) { setMsg({ ok: false, text: e.message }); return null; }
    finally { setBusy(false); }
  };
  const teamName = (id) => a.teams.find((t) => t.id === id)?.name || '';
  const open = a.players.filter((p) => p.status === 'available');
  const unsold = a.players.filter((p) => p.status === 'unsold');
  const choose = async (id) => { setPick(id); if (a.can_run) await run(() => dataService.setAuctionCurrent(a.id, id || null)); setPick(''); };
  const next = () => { const p = open[0] || unsold[0]; if (p) choose(p.id); };
  const random = () => { const pool = open.length ? open : unsold; if (pool.length) choose(pool[Math.floor(Math.random() * pool.length)].id); };
  // Find a player by auction number (23), player ID (LC-000214, 214) or name
  const findPlayer = (q0) => {
    const q = String(q0 || '').trim();
    if (!q) return { list: [] };
    const digits = q.replace(/\D/g, '');
    const norm = (x) => String(x || '').toUpperCase().replace(/\s+/g, '');
    const exact = a.players.filter((p) => p.player_code && norm(p.player_code) === norm(q));
    if (exact.length) return { list: exact };
    const byNumber = /^\d{1,4}$/.test(q) ? a.players.filter((p) => String(p.number) === q) : [];
    if (byNumber.length) return { list: byNumber };
    const byCode = digits ? a.players.filter((p) => p.player_code && p.player_code.replace(/\D/g, '').replace(/^0+/, '') === digits.replace(/^0+/, '')) : [];
    if (byCode.length) return { list: byCode };
    return { list: a.players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) };
  };
  const found = findPlayer(query);
  const bringUp = (p) => {
    if (!p) return;
    if (p.status === 'sold') { setMsg({ ok: false, text: `${p.name} is already sold to ${teamName(p.team_id)} for ${money(p.price)}. Use Undo on that sale first.` }); return; }
    setQuery(''); choose(p.id);
  };
  const sell = (team) => cur && run(() => dataService.sellAuctionPlayer(cur.id, team.id, Number(price)), `${cur.name} sold to ${team.name} for ${money(price)}.`);
  const maxRows = Math.max(0, ...a.teams.map((t) => t.bought));
  const byTeam = Object.fromEntries(a.teams.map((t) => [t.id, a.players.filter((p) => p.team_id === t.id).sort((x, y) => x.sale_seq - y.sale_seq)]));
  const link = `${window.location.origin}${window.location.pathname}?auction=${a.id}`;
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: a.name, url: link }); return; } catch { /* cancelled */ } } try { await navigator.clipboard.writeText(link); setMsg({ ok: true, text: 'Link copied.' }); } catch { window.prompt('Copy this link', link); } };
  const csv = () => {
    const rows = [['Team', 'No.', 'Player', 'Player ID', 'Role', 'Batting', 'Batting position', 'Bowling', 'Price']];
    const det = (p) => [p.player_code || '', labelOf(ROLE_OPTIONS, p.role), labelOf(BATTING_OPTIONS, p.batting_style), labelOf(BAT_POSITIONS, p.batting_position), labelOf(BOWLING_OPTIONS, p.bowling_style)];
    a.teams.forEach((t) => byTeam[t.id].forEach((p) => rows.push([t.name, p.number, p.name, ...det(p), p.price])));
    rows.push([]); rows.push(['Not sold', 'No.', 'Player', 'Player ID', 'Role', 'Batting', 'Batting position', 'Bowling', 'Base price']);
    a.players.filter((p) => p.status !== 'sold').forEach((p) => rows.push([p.status, p.number, p.name, ...det(p), p.base_price]));
    rows.push([]); rows.push(['Team', 'Budget', 'Used', 'Remaining', 'Players bought', 'Places left', 'Average', 'Max next bid', 'Minimum required']);
    a.teams.forEach((t) => rows.push([t.name, t.budget, t.used, t.remaining, t.bought, t.places_left, t.average, t.max_bid, t.min_required]));
    const blob = new Blob(['﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = `${a.name.replace(/[^\w-]+/g, '_')}_auction.csv`; el.click(); URL.revokeObjectURL(u);
  };
  const th = { padding: '0.45rem 0.5rem', fontSize: '0.78rem', fontWeight: 800, border: '1px solid #e2e8f0', whiteSpace: 'nowrap', backgroundColor: '#065f46', color: '#fff' };
  const td = { padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
  const sumRow = (label, key, fmt = money, warn) => (
    <tr><td style={{ ...td, fontWeight: 800, backgroundColor: '#f1f5f9', position: 'sticky', left: 0 }}>{label}</td>
      {a.teams.map((t) => <td key={t.id} colSpan={2} style={{ ...td, textAlign: 'right', fontWeight: 700, color: warn && warn(t) ? '#b91c1c' : undefined }}>{fmt(t[key])}</td>)}</tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button type="button" onClick={() => onNavigate(a.tournament_id ? 'tournament-details' : 'tools', a.tournament_id || undefined)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', gap: '0.3rem', alignItems: 'center', color: '#334155', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
        <ArrowLeft size={16} /> {a.tournament ? a.tournament.name : 'Cricket tools'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', display: 'flex', alignItems: 'center', gap: 8 }}><Gavel size={22} /> {a.name}</h1>
          <div style={{ fontSize: '0.84rem', color: '#64748b' }}>{a.teams.length} teams · {a.squad_size} players each · base price {money(a.base_price)} · {a.players.filter((p) => p.status === 'sold').length}/{a.players.length} sold{a.status === 'finished' ? ' · FINISHED' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-mini" onClick={share} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Share2 size={13} /> Share live link</button>
          <button type="button" className="btn-mini" onClick={csv} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={13} /> Excel (CSV)</button>
          <button type="button" className="btn-mini" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Printer size={13} /> Print</button>
        </div>
      </div>
      {msg && <div style={{ padding: '0.55rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.86rem', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${a.can_run ? 4 : 2}, 1fr)`, gap: 6 }}>
        {(a.can_run ? [['teams', '① Teams', `${a.teams.length} teams`], ['players', '② Players', `${a.players.length} players`], ['live', '③ Live auction', a.status === 'finished' ? 'Finished' : cur ? `On the block: ${cur.name}` : 'Sell players'], ['results', '④ Results', `${a.players.filter((p) => p.status === 'sold').length} sold`]]
          : [['live', 'Live auction', cur ? `On the block: ${cur.name}` : 'Watching'], ['results', 'Results', `${a.players.filter((p) => p.status === 'sold').length} sold`]]).map(([k, l, sub]) => (
          <button key={k} type="button" onClick={() => setStep(k)}
            style={{ padding: '0.6rem 0.5rem', borderRadius: '0.7rem', cursor: 'pointer', textAlign: 'left', font: 'inherit', border: `2px solid ${step === k ? '#059669' : '#e2e8f0'}`, backgroundColor: step === k ? '#ecfdf5' : '#fff' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: step === k ? '#065f46' : '#0f172a' }}>{l}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
          </button>
        ))}
      </div>
      {step === 'teams' && a.can_run && <Card title="① Teams & settings" subtitle="Team names, owners, purse, base price and players per team"><AuctionForm auction={a} onSaved={(r) => { setA(r); setMsg({ ok: true, text: 'Teams saved.' }); }} /></Card>}

      {/* On the block */}
      {step === 'live' && (a.can_run || cur) && a.status !== 'finished' && (
        <Card title="③ Live auction – on the block">
          {a.can_run && (
            <div style={{ marginBottom: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ ...lbl, fontSize: '0.84rem', color: '#0f172a' }}>Type the player's number or ID
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && found.list.length === 1) bringUp(found.list[0]); }}
                    placeholder="e.g. 23 or LC-000214 or a name" autoFocus style={{ ...inp, fontSize: '1.15rem', fontWeight: 700, padding: '0.6rem 0.75rem' }} />
                  <Button variant="primary" disabled={busy || found.list.length !== 1} onClick={() => bringUp(found.list[0])}>Bring up</Button>
                </div>
              </label>
              {query.trim() && (found.list.length === 0 ? <span style={{ fontSize: '0.82rem', color: '#b91c1c' }}>No player with that number, ID or name.</span> : found.list.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {found.list.map((p) => <button key={p.id} type="button" className="btn-mini" onClick={() => bringUp(p)}>{p.number}. {p.name}{p.status === 'sold' ? ' (sold)' : ''}</button>)}
                </div>
              ))}
            </div>
          )}
          {cur ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
                <span style={{ width: 58, height: 58, borderRadius: 14, background: 'linear-gradient(135deg,#065f46,#10b981)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900 }}>{cur.number}</span>
                <div><div style={{ fontSize: '1.35rem', fontWeight: 900 }}>{cur.name}</div><div style={{ fontSize: '0.84rem', color: '#64748b' }}>{playerDetails(cur) ? `${playerDetails(cur)} · ` : ''}{cur.player_code ? `${cur.player_code} · ` : ''}Base price {money(cur.base_price)}{cur.status === 'unsold' ? ' · was unsold' : ''}</div>{cur.note && <div style={{ fontSize: '0.8rem', color: '#475569' }}>{cur.note}</div>}</div>
              </div>
              {a.can_run && (
                <>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Final bid</span>
                    <input type="number" min={cur.base_price} step={a.bid_step} value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...inp, width: 130, fontSize: '1.1rem', fontWeight: 800 }} />
                    {[1, 2, 5].map((k) => <button key={k} type="button" className="btn-mini" onClick={() => setPrice(String(Number(price || 0) + k * a.bid_step))}>+{money(k * a.bid_step)}</button>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.45rem' }}>
                    {a.teams.map((t) => {
                      const can = t.places_left > 0 && Number(price) <= t.max_bid && Number(price) >= cur.base_price;
                      return (
                        <button key={t.id} type="button" disabled={busy || !can} onClick={() => sell(t)}
                          style={{ padding: '0.55rem', borderRadius: '0.6rem', border: `2px solid ${can ? '#059669' : '#e2e8f0'}`, backgroundColor: can ? '#ecfdf5' : '#f8fafc', cursor: can ? 'pointer' : 'not-allowed', textAlign: 'left', font: 'inherit' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>Sold to {t.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Max bid {money(t.max_bid)} · {t.places_left} left</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => dataService.setAuctionCurrent(a.id, null))}>Put back</Button>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => dataService.markAuctionUnsold(cur.id), `${cur.name} is unsold.`)}>Unsold</Button>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={next} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ChevronRight size={14} /> Next player</Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value="" onChange={(e) => choose(e.target.value)} style={{ ...inp, maxWidth: 280 }}>
                <option value="">Choose a player…</option>
                {[...open, ...unsold].map((p) => <option key={p.id} value={p.id}>{p.number}. {p.name}{p.status === 'unsold' ? ' (unsold)' : ''}</option>)}
              </select>
              <Button variant="primary" size="sm" disabled={busy || !(open.length + unsold.length)} onClick={next} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ChevronRight size={14} /> Next by number</Button>
              <Button variant="secondary" size="sm" disabled={busy || !(open.length + unsold.length)} onClick={random} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Shuffle size={14} /> Random</Button>
              {!(open.length + unsold.length) && <span style={{ fontSize: '0.84rem', color: '#64748b' }}>No players left to sell.</span>}
            </div>
          )}
          {a.can_run && (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.8rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.7rem' }}>
              <button type="button" className="btn-mini" disabled={busy} onClick={() => run(() => dataService.undoAuctionSale(a.id, null), 'Last sale undone.')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Undo2 size={13} /> Undo last sale</button>
              <button type="button" className="btn-mini" disabled={busy} onClick={() => window.confirm('Finish the auction? No more sales after this (you can reopen it).') && run(() => dataService.finishAuction(a.id, true), 'Auction finished.')}>Finish auction</button>
            </div>
          )}
        </Card>
      )}
      {step === 'live' && (
        <Card title="Teams' money">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
              <thead><tr>{['Team', 'Bought', 'Places left', 'Used', 'Remaining', 'Max next bid'].map((h) => <th key={h} style={{ ...th, textAlign: h === 'Team' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
              <tbody>{a.teams.map((t) => (
                <tr key={t.id}><td style={{ ...td, fontWeight: 700 }}>{t.name}</td><td style={{ ...td, textAlign: 'right' }}>{t.bought}</td><td style={{ ...td, textAlign: 'right' }}>{t.places_left}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(t.used)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{money(t.remaining)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#065f46' }}>{money(t.max_bid)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}
      {a.can_run && a.status === 'finished' && <Button variant="secondary" size="sm" onClick={() => run(() => dataService.finishAuction(a.id, false), 'Auction reopened.')} style={{ alignSelf: 'flex-start' }}>Reopen auction</Button>}

      {/* ④ Results: one card per team, then the sheet */}
      {step === 'results' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.8rem' }}>
          {a.teams.map((t) => (
            <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.8rem', overflow: 'hidden', backgroundColor: '#fff' }}>
              <div style={{ background: 'linear-gradient(135deg,#065f46,#10b981)', color: '#fff', padding: '0.6rem 0.8rem' }}>
                <div style={{ fontWeight: 900 }}>{t.name}{t.short_name ? ` (${t.short_name})` : ''}</div>
                <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>{t.owner_name ? `${t.owner_name} · ` : ''}{t.bought}/{a.squad_size} players · used {money(t.used)} · left {money(t.remaining)}</div>
              </div>
              {byTeam[t.id].length === 0 ? <div style={{ padding: '0.7rem', fontSize: '0.82rem', color: '#94a3b8' }}>No players bought yet.</div> : byTeam[t.id].map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.45rem 0.8rem', borderTop: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                  <strong style={{ color: '#94a3b8', minWidth: 24 }}>{p.number}</strong>
                  <span style={{ flex: 1, minWidth: 0 }}><strong>{p.name}</strong>{p.player_code ? <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}> {p.player_code}</span> : null}
                    {playerDetails(p) && <><br /><span style={{ fontSize: '0.72rem', color: '#475569' }}>{playerDetails(p)}</span></>}</span>
                  <strong style={{ color: '#065f46' }}>{money(p.price)}</strong>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {step === 'results' && <Card title="Auction sheet">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr><th style={{ ...th, position: 'sticky', left: 0 }}>#</th>{a.teams.map((t) => <th key={t.id} colSpan={2} style={th}>{t.name}{t.owner_name ? <div style={{ fontWeight: 500, fontSize: '0.7rem', opacity: 0.85 }}>{t.owner_name}</div> : null}</th>)}</tr>
              <tr><th style={{ ...th, backgroundColor: '#ecfdf5', color: '#065f46', position: 'sticky', left: 0 }} />{a.teams.map((t) => <React.Fragment key={t.id}><th style={{ ...th, backgroundColor: '#ecfdf5', color: '#065f46' }}>Player</th><th style={{ ...th, backgroundColor: '#ecfdf5', color: '#065f46' }}>Price</th></React.Fragment>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, i) => (
                <tr key={i}><td style={{ ...td, color: '#94a3b8', position: 'sticky', left: 0, backgroundColor: '#fff' }}>{i + 1}</td>
                  {a.teams.map((t) => { const p = byTeam[t.id][i]; return (
                    <React.Fragment key={t.id}>
                      <td style={td} title={p ? `No. ${p.number}` : ''}>{p ? <><span style={{ color: '#94a3b8' }}>{p.number}</span> {p.name}</> : ''}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{p ? money(p.price) : ''}</td>
                    </React.Fragment>
                  ); })}
                </tr>
              ))}
              {sumRow('Budget', 'budget')}
              {sumRow('Used', 'used')}
              {sumRow('Remaining', 'remaining')}
              {sumRow('Players bought', 'bought', String)}
              {sumRow('Players remaining', 'places_left', String)}
              {sumRow('Average', 'average', (v) => money(Math.round(v)))}
              {sumRow('Max next bid', 'max_bid')}
              {sumRow('Minimum required', 'min_required', money, (t) => t.remaining < t.min_required)}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.74rem', color: '#64748b' }}>Max next bid = remaining money − (places left − 1) × base price, so every team can still fill its squad. Minimum required = places left × base price.</p>
      </Card>}

      {/* ② Player pool */}
      {step === 'players' && <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Users size={17} /> ② Players ({a.players.length})</span>}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          {[['all', 'All'], ['available', `Not sold yet (${open.length})`], ['sold', 'Sold'], ['unsold', `Unsold (${unsold.length})`]].map(([k, l]) => (
            <button key={k} type="button" className="btn-mini" onClick={() => setFilter(k)} style={{ fontWeight: filter === k ? 800 : 500, borderColor: filter === k ? '#059669' : undefined }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.4rem' }}>
          {a.players.filter((p) => filter === 'all' || p.status === filter).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.82rem', backgroundColor: p.status === 'sold' ? '#f0fdf4' : p.status === 'unsold' ? '#fff7ed' : '#fff' }}>
              <strong style={{ color: '#94a3b8', minWidth: 26 }}>{p.number}</strong>
              <span style={{ flex: 1, minWidth: 0 }}>{p.name}{p.player_code ? <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}> {p.player_code}</span> : null}
                {playerDetails(p) && <><br /><span style={{ fontSize: '0.7rem', color: '#475569' }}>{playerDetails(p)}</span></>}<br />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.status === 'sold' ? `${teamName(p.team_id)} · ${money(p.price)}` : p.status === 'unsold' ? 'Unsold' : `Base ${money(p.base_price)}`}</span></span>
              {a.can_run && p.status !== 'sold' && a.status !== 'finished' && <button type="button" title="Put on the block" onClick={() => { choose(p.id); setStep('live'); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#059669' }}><Gavel size={14} /></button>}
              {a.can_run && p.status === 'sold' && <button type="button" title="Undo this sale" onClick={() => window.confirm(`Undo the sale of ${p.name}?`) && run(() => dataService.undoAuctionSale(a.id, p.id), 'Sale undone.')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><Undo2 size={14} /></button>}
              {a.can_run && <button type="button" title="Edit player" onClick={() => setEditP(p.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#334155' }}><Pencil size={13} /></button>}
              {a.can_run && p.status !== 'sold' && <button type="button" title="Remove" onClick={() => window.confirm(`Remove ${p.name}?`) && run(() => dataService.removeAuctionPlayer(p.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>
        {a.can_run && editP && (
          <div style={{ marginTop: '0.9rem' }}>
            <PlayerForm key={`${editP}-${formKey}`} player={editP === 'new' ? null : a.players.find((p) => p.id === editP)} basePrice={a.base_price} busy={busy} onCancel={() => setEditP(null)}
              onSave={async (v) => { const r = await run(() => (editP === 'new' ? dataService.addAuctionPlayers(a.id, [v]) : dataService.updateAuctionPlayer(editP, v)), editP === 'new' ? `${v.name || v.player_code} added.` : 'Player saved.'); if (r) { if (editP === 'new') setFormKey((k) => k + 1); else setEditP(null); } }} />
          </div>
        )}
        {a.can_run && !editP && (
          <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
            <Button variant="primary" size="sm" onClick={() => setEditP('new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Add a player</Button>
            <Button variant="secondary" size="sm" onClick={() => setBulk((v) => !v)}>{bulk ? 'Hide paste box' : 'Paste many players'}</Button>
          </div>
        )}
        {a.can_run && bulk && (
          <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={lbl}>Paste players – copy the rows from your registration sheet (ID, name, mobile, village, role, batting hand), or type one per line: number, name, role (bat / bowler / all / wk), batting (rhb / lhb), bowling (rf, rm, ob, lb, lf, lm, sla), base price
              <textarea rows={4} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="One player per line" />
              <PasteSummary text={adding} />
            </label>
            <Button variant="primary" size="sm" disabled={busy || !parseAuctionPlayers(adding).length} onClick={async () => { const r = await run(() => dataService.addAuctionPlayers(a.id, parseAuctionPlayers(adding)), 'Players added.'); if (r) setAdding(''); }} style={{ alignSelf: 'flex-start' }}>
              Add {parseAuctionPlayers(adding).length || ''} player{parseAuctionPlayers(adding).length === 1 ? '' : 's'}
            </Button>
          </div>
        )}
        {a.can_run && a.players.length > 0 && <div style={{ marginTop: '0.9rem' }}><Button variant="primary" onClick={() => setStep('live')}>Start the live auction →</Button></div>}
      </Card>}
      {a.can_run && step === 'teams' && (
        <button type="button" onClick={async () => { if (!window.confirm('Delete this auction for good?')) return; const r = await run(() => dataService.deleteAuction(a.id)); if (r) onNavigate('tools'); }}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem' }}>Delete auction</button>
      )}
    </div>
  );
}

export default AuctionBoard;
