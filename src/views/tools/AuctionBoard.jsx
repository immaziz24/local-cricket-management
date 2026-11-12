import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Gavel, Plus, Undo2, Share2, Download, Printer, ArrowLeft, Shuffle, ChevronRight, Trash2, Pencil, Users } from 'lucide-react';

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

/** "50, Rahim, bat, 500"  or  "Rahim"  or  "Rahim, wk" → player rows */
export function parseAuctionPlayers(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = l.split(/[,\t]/).map((x) => x.trim()).filter(Boolean);
    const p = {};
    if (/^\d{1,4}$/.test(parts[0]) && parts.length > 1) p.number = parts.shift();
    p.name = parts.shift() || '';
    parts.forEach((x) => { const r = ROLE[x.toLowerCase()]; if (r) p.role = r; else if (/^\d+$/.test(x)) p.base_price = x; });
    return p;
  }).filter((p) => p.name);
}

function AuctionForm({ auction = null, tournamentId = null, onSaved, onCancel }) {
  const [f, setF] = useState(() => ({
    name: auction?.name || '', base_price: auction?.base_price ?? 300, bid_step: auction?.bid_step ?? 50, squad_size: auction?.squad_size ?? 14,
    budget: auction?.teams?.[0]?.budget ?? 10000,
    teams: auction ? auction.teams.map((t) => `${t.name}, ${t.budget}`).join('\n') : ''
  }));
  const [players, setPlayers] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const rows = f.teams.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
        const m = l.match(/^(.*?)[,\t]\s*(\d+)\s*$/);
        const name = (m ? m[1] : l).trim();
        const old = auction?.teams?.find((t) => t.name === name) || (auction?.teams?.[i] && !m ? auction.teams[i] : null);
        return { id: old?.id, name, budget: m ? Number(m[2]) : Number(f.budget) };
      });
      let a = await dataService.saveAuction(auction?.id || null, { name: f.name, base_price: Number(f.base_price), bid_step: Number(f.bid_step), squad_size: Number(f.squad_size), tournament_id: auction?.tournament_id || tournamentId || null, teams: rows });
      const list = parseAuctionPlayers(players);
      if (list.length) a = await dataService.addAuctionPlayers(a.id, list);
      onSaved(a);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Auction name<input style={inp} value={f.name} onChange={set('name')} placeholder="e.g. Gully Cricket Premier League 2026" maxLength={120} /></label>
        <label style={lbl}>Purse per team<input style={inp} type="number" min={0} value={f.budget} onChange={set('budget')} /></label>
        <label style={lbl}>Base price<input style={inp} type="number" min={1} value={f.base_price} onChange={set('base_price')} /></label>
        <label style={lbl}>Bid step<input style={inp} type="number" min={1} value={f.bid_step} onChange={set('bid_step')} /></label>
        <label style={lbl}>Players per team<input style={inp} type="number" min={1} max={40} value={f.squad_size} onChange={set('squad_size')} /></label>
      </div>
      <label style={lbl}>Teams – one per line (add “, 5000” for a different purse)
        <textarea rows={5} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} value={f.teams} onChange={set('teams')} placeholder={'Meherapur 11\nSakib 11\nGolapganj 11, 5000'} />
      </label>
      {!auction && (
        <label style={lbl}>Players (optional now – you can add later). One per line: number, name, role, base price
          <textarea rows={5} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} value={players} onChange={(e) => setPlayers(e.target.value)} placeholder={'1, Rahim, bat\n2, Karim, bowler, 500\nSabbir, wk'} />
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
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => dataService.getAuction(auctionId).then((r) => { if (!r) setErr('Auction not found.'); else { setA(r); setErr(null); } }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [auctionId, currentUser?.id]);
  useEffect(() => { if (a?.can_run) return undefined; const t = setInterval(load, 5000); return () => clearInterval(t); }, [a?.can_run, auctionId]);
  useEffect(() => { if (a?.name) document.title = `${a.name} · Auction · Local Cricket`; }, [a?.name]);

  const cur = useMemo(() => a?.players.find((p) => p.id === (pick || a.current_player_id)) || null, [a, pick]);
  useEffect(() => { if (cur) setPrice(String(cur.base_price)); }, [cur?.id]);

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
  const sell = (team) => cur && run(() => dataService.sellAuctionPlayer(cur.id, team.id, Number(price)), `${cur.name} sold to ${team.name} for ${money(price)}.`);
  const maxRows = Math.max(0, ...a.teams.map((t) => t.bought));
  const byTeam = Object.fromEntries(a.teams.map((t) => [t.id, a.players.filter((p) => p.team_id === t.id).sort((x, y) => x.sale_seq - y.sale_seq)]));
  const link = `${window.location.origin}${window.location.pathname}?auction=${a.id}`;
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: a.name, url: link }); return; } catch { /* cancelled */ } } try { await navigator.clipboard.writeText(link); setMsg({ ok: true, text: 'Link copied.' }); } catch { window.prompt('Copy this link', link); } };
  const csv = () => {
    const rows = [['Team', 'No.', 'Player', 'Role', 'Price']];
    a.teams.forEach((t) => byTeam[t.id].forEach((p) => rows.push([t.name, p.number, p.name, p.role || '', p.price])));
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
          {a.can_run && <button type="button" className="btn-mini" onClick={() => setEditing((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={13} /> Teams & settings</button>}
        </div>
      </div>
      {msg && <div style={{ padding: '0.55rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.86rem', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</div>}
      {editing && <Card title="Teams & settings"><AuctionForm auction={a} onCancel={() => setEditing(false)} onSaved={(r) => { setA(r); setEditing(false); setMsg({ ok: true, text: 'Saved.' }); }} /></Card>}

      {/* On the block */}
      {(a.can_run || cur) && a.status !== 'finished' && (
        <Card title="On the block">
          {cur ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
                <span style={{ width: 58, height: 58, borderRadius: 14, background: 'linear-gradient(135deg,#065f46,#10b981)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900 }}>{cur.number}</span>
                <div><div style={{ fontSize: '1.35rem', fontWeight: 900 }}>{cur.name}</div><div style={{ fontSize: '0.84rem', color: '#64748b' }}>{cur.role ? ROLE_SHORT[cur.role] + ' · ' : ''}Base price {money(cur.base_price)}{cur.status === 'unsold' ? ' · was unsold' : ''}</div></div>
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
      {a.can_run && a.status === 'finished' && <Button variant="secondary" size="sm" onClick={() => run(() => dataService.finishAuction(a.id, false), 'Auction reopened.')} style={{ alignSelf: 'flex-start' }}>Reopen auction</Button>}

      {/* The sheet */}
      <Card title="Auction sheet">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr><th style={{ ...th, position: 'sticky', left: 0 }}>#</th>{a.teams.map((t) => <th key={t.id} colSpan={2} style={th}>{t.name}</th>)}</tr>
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
      </Card>

      {/* Player pool */}
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Users size={17} /> Players ({a.players.length})</span>}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          {[['all', 'All'], ['available', `Not sold yet (${open.length})`], ['sold', 'Sold'], ['unsold', `Unsold (${unsold.length})`]].map(([k, l]) => (
            <button key={k} type="button" className="btn-mini" onClick={() => setFilter(k)} style={{ fontWeight: filter === k ? 800 : 500, borderColor: filter === k ? '#059669' : undefined }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.4rem' }}>
          {a.players.filter((p) => filter === 'all' || p.status === filter).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.55rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.82rem', backgroundColor: p.status === 'sold' ? '#f0fdf4' : p.status === 'unsold' ? '#fff7ed' : '#fff' }}>
              <strong style={{ color: '#94a3b8', minWidth: 26 }}>{p.number}</strong>
              <span style={{ flex: 1, minWidth: 0 }}>{p.name}{p.role ? <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> {ROLE_SHORT[p.role]}</span> : null}<br />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.status === 'sold' ? `${teamName(p.team_id)} · ${money(p.price)}` : p.status === 'unsold' ? 'Unsold' : `Base ${money(p.base_price)}`}</span></span>
              {a.can_run && p.status !== 'sold' && a.status !== 'finished' && <button type="button" title="Put on the block" onClick={() => choose(p.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#059669' }}><Gavel size={14} /></button>}
              {a.can_run && p.status === 'sold' && <button type="button" title="Undo this sale" onClick={() => window.confirm(`Undo the sale of ${p.name}?`) && run(() => dataService.undoAuctionSale(a.id, p.id), 'Sale undone.')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><Undo2 size={14} /></button>}
              {a.can_run && p.status !== 'sold' && <button type="button" title="Remove" onClick={() => window.confirm(`Remove ${p.name}?`) && run(() => dataService.removeAuctionPlayer(p.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>
        {a.can_run && (
          <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={lbl}>Add players – one per line: number, name, role (bat / bowler / all / wk), base price
              <textarea rows={4} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={'60, Rahim, bat\nKarim, bowler, 500'} />
            </label>
            <Button variant="primary" size="sm" disabled={busy || !parseAuctionPlayers(adding).length} onClick={async () => { const r = await run(() => dataService.addAuctionPlayers(a.id, parseAuctionPlayers(adding)), 'Players added.'); if (r) setAdding(''); }} style={{ alignSelf: 'flex-start' }}>
              Add {parseAuctionPlayers(adding).length || ''} player{parseAuctionPlayers(adding).length === 1 ? '' : 's'}
            </Button>
          </div>
        )}
      </Card>
      {a.can_run && (
        <button type="button" onClick={async () => { if (!window.confirm('Delete this auction for good?')) return; const r = await run(() => dataService.deleteAuction(a.id)); if (r) onNavigate('tools'); }}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem' }}>Delete auction</button>
      )}
    </div>
  );
}

export default AuctionBoard;
