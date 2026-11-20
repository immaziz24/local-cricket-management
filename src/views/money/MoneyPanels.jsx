import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { rupees, bpsToPercent, percentToBps, parseFee, billLabel, teamFeeLabel, payoutCheck, settlementCsv, limitLine, LIMIT_KEYS, monthToDate } from './moneyRules.js';

const inp = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', boxSizing: 'border-box' };
const note = (m) => m && <p role="status" style={{ margin: '0.5rem 0 0', fontSize: '0.83rem', color: m.ok ? '#166534' : '#b91c1c' }}>{m.text}</p>;
const small = { fontSize: '0.8rem', color: '#64748b' };

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/** Opens the Razorpay page for a bill or an entry fee. */
export function usePay() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const pay = async (body) => {
    setBusy(true); setMsg(null);
    try { window.open(await dataService.createCheckout(body), '_blank', 'noopener,noreferrer'); setMsg({ ok: true, text: 'The payment page opened in a new tab. Your payment shows up here after Razorpay confirms it.' }); }
    catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  return { busy, msg, pay };
}

/** #275 A team owner pays the tournament entry fee online. */
export function PayEntryFeeButton({ tournament, team }) {
  const { busy, msg, pay } = usePay();
  if (!tournament?.entry_fee_paise) return null;
  return (
    <span>
      <Button size="sm" disabled={busy} onClick={() => pay({ purpose: 'registration', tournamentId: tournament.id, teamId: team.id })}>Pay entry fee {rupees(tournament.entry_fee_paise)}</Button>
      {note(msg)}
    </span>
  );
}

/** #276 #389 Bills the signed-in user has to pay (sponsor packages, adverts). */
export function MyBillsCard() {
  const [bills, setBills] = useState(null);
  const [err, setErr] = useState('');
  const { busy, msg, pay } = usePay();
  useEffect(() => { let on = true; dataService.listMyBills().then((r) => on && setBills(r)).catch((e) => on && setErr(e.message)); return () => { on = false; }; }, []);
  if (err) return <section className="info-box"><h2>My bills</h2><p role="alert">{err}</p></section>;
  if (!bills) return null;
  return (
    <section className="info-box">
      <h2>My bills</h2>
      {bills.length === 0 ? <p>You have no bills.</p> : (
        <ul>{bills.map((b) => (
          <li key={b.id}>
            <strong>{b.description}</strong> · {rupees(b.amount_paise)} · {billLabel(b)}{b.status === 'due' && b.due_on ? ` · due ${new Date(b.due_on).toLocaleDateString('en-IN')}` : ''}
            {b.status === 'due' && <> · <button type="button" className="home-link" disabled={busy} onClick={() => pay({ billId: b.id })}>Pay now</button></>}
          </li>
        ))}</ul>
      )}
      {note(msg)}
    </section>
  );
}

/** #391 What the user's plan allows. */
export function EntitlementsCard() {
  const [e, setE] = useState(null);
  useEffect(() => { let on = true; dataService.getMyEntitlements().then((r) => on && setE(r)).catch(() => {}); return () => { on = false; }; }, []);
  if (!e) return null;
  return (
    <section className="info-box">
      <h2>What my plan allows</h2>
      <ul><li>{limitLine('Tournaments', e.max_tournaments)}</li><li>{limitLine('Teams', e.max_teams)}</li></ul>
      {e.is_admin && <p style={small}>Admins are not limited.</p>}
    </section>
  );
}

/** #275 #276 #388 #389 #390 The organiser's fees, bills and settlement for one tournament. */
export function TournamentMoneyPanel({ tournament, onChanged }) {
  const [r, setR] = useState(null);
  const [bills, setBills] = useState([]);
  const [fee, setFee] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [rep, b] = await Promise.all([dataService.getTournamentSettlement(tournament.id), dataService.listTournamentBills(tournament.id)]);
      setR(rep); setBills(b); setFee(rep.tournament.entry_fee_paise ? String(rep.tournament.entry_fee_paise / 100) : '');
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }, [tournament.id]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, ok) => { setBusy(true); setMsg(null); try { const out = await fn(); setMsg({ ok: true, text: typeof ok === 'function' ? ok(out) : ok }); await load(); } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const saveFee = () => {
    const p = parseFee(fee);
    if (p.error) { setMsg({ ok: false, text: p.error }); return; }
    run(() => dataService.setTournamentEntryFee(tournament.id, p.rupees), p.rupees ? 'Entry fee saved. Team owners can now pay online.' : 'Entry fee removed.').then(() => onChanged && onChanged());
  };
  return (
    <Card title="Fees and settlement" subtitle="Entry fees, sponsor bills and what the platform owes you.">
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 260, fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
        Entry fee per team (₹, leave empty for free)
        <input style={inp} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
      </label>
      <div style={{ marginTop: 6 }}><Button size="sm" disabled={busy} onClick={saveFee}>Save entry fee</Button></div>
      {!r ? <p role="status" style={small}>Loading…</p> : (
        <>
          <dl style={{ marginTop: '0.8rem' }}>
            <dt>Collected online</dt><dd>{rupees(r.gross_paise)} ({r.registration.count} entry fee{r.registration.count === 1 ? '' : 's'}, {r.sponsorship.count} sponsor payment{r.sponsorship.count === 1 ? '' : 's'})</dd>
            {r.refunded_paise > 0 && <><dt>Refunded</dt><dd>{rupees(r.refunded_paise)}</dd></>}
            <dt>Platform commission</dt><dd>{rupees(r.commission_paise)} (now {bpsToPercent(r.commission_bps_now)})</dd>
            <dt>Your share</dt><dd>{rupees(r.net_paise)}</dd>
            <dt>Already paid to you</dt><dd>{rupees(r.paid_out_paise)}</dd>
            <dt>Balance owed to you</dt><dd><strong>{rupees(r.balance_paise)}</strong></dd>
          </dl>
          <p style={small}>Teams: {r.teams.paid} paid, {r.teams.unpaid} unpaid, {r.teams.approved} approved.{r.unpaid_teams.length ? ` Unpaid: ${r.unpaid_teams.join(', ')}.` : ''}</p>
          {r.review_count > 0 && <p style={{ ...small, color: '#b45309' }}>{r.review_count} payment{r.review_count === 1 ? ' needs' : 's need'} a look by the platform admin (for example a short payment).</p>}
          {r.payouts.length > 0 && (<><h3>Payouts to you</h3><ul>{r.payouts.map((p) => <li key={p.id}>{rupees(p.amount_paise)} · {new Date(p.paid_at).toLocaleDateString('en-IN')} · ref {p.reference}</li>)}</ul></>)}
          <Button size="sm" variant="secondary" onClick={() => download(`settlement-${tournament.id.slice(0, 8)}.csv`, settlementCsv(r))}>Download settlement report (CSV)</Button>
        </>
      )}
      <h3 style={{ marginTop: '1rem' }}>Sponsor bills</h3>
      {bills.length === 0 ? <p style={small}>No sponsor bills yet. A bill is created when a sponsor with an amount becomes active.</p> : (
        <ul>{bills.map((b) => <li key={b.id}>{b.sponsor || 'Sponsor'} · {rupees(b.amount_paise)} · {billLabel(b)}{b.reminders ? ` · ${b.reminders} reminder${b.reminders === 1 ? '' : 's'} sent` : ''}</li>)}</ul>
      )}
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.generateSponsorBills(tournament.id), (n) => (n ? `${n} bill${n === 1 ? '' : 's'} created.` : 'Every active sponsor already has a bill.'))}>Create missing sponsor bills</Button>
      {note(msg)}
    </Card>
  );
}

/** #279 #280 #281 #388 #391 The platform admin's money card. */
export function AdminMoneyCard() {
  const [fees, setFees] = useState(null);
  const [pct, setPct] = useState('');
  const [rec, setRec] = useState(null);
  const [ads, setAds] = useState(null);
  const [limits, setLimits] = useState(null);
  const [range, setRange] = useState(monthToDate());
  const [pay, setPay] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lim, setLim] = useState({ plan: 'free', key: 'max_teams', value: '' });
  const load = useCallback(async () => {
    try {
      const [f, rc, a, l] = await Promise.all([dataService.getFeeSettings(), dataService.getPayoutReconciliation(), dataService.adRevenueReport(range.from, range.to), dataService.listPlanLimits()]);
      setFees(f); setPct(String((f.commission_bps || 0) / 100)); setRec(rc); setAds(a); setLimits(l);
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }, [range.from, range.to]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, ok) => { setBusy(true); setMsg(null); try { const out = await fn(); setMsg({ ok: true, text: typeof ok === 'function' ? ok(out) : ok }); await load(); } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const saveCommission = () => { const p = percentToBps(pct); if (p.error) { setMsg({ ok: false, text: p.error }); return; } run(() => dataService.setCommission(p.bps), 'Commission saved. It applies to new payments only.'); };
  const payOut = (row) => {
    const p = pay[row.tournament_id] || {};
    const c = payoutCheck(p.amount, p.reference, row.balance_paise);
    if (c.error) { setMsg({ ok: false, text: c.error }); return; }
    run(() => dataService.recordPayout(row.tournament_id, c.paise, p.reference.trim(), p.note || null, null), 'Payout recorded and the organiser was told.');
    setPay((s) => ({ ...s, [row.tournament_id]: {} }));
  };
  const setP = (id, k, v) => setPay((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));
  const saveLimit = () => run(() => dataService.setPlanLimit(lim.plan, lim.key, lim.value === '' ? null : Number(lim.value)), lim.value === '' ? 'Limit removed.' : 'Limit saved.');
  return (
    <Card title="Money" subtitle="Commission, payouts to organisers, advert revenue and plan limits.">
      {note(msg)}
      <h3>Platform commission</h3>
      {fees && <p style={small}>Now {bpsToPercent(fees.commission_bps)}. It is taken from tournament entry fees and sponsor payments and kept by the platform.</p>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: 90 }} inputMode="decimal" aria-label="Commission percent" value={pct} onChange={(e) => setPct(e.target.value)} /> %
        <Button size="sm" disabled={busy} onClick={saveCommission}>Save commission</Button>
      </div>

      <h3 style={{ marginTop: '1.2rem' }}>Payouts to organisers</h3>
      {!rec ? <p style={small}>Loading…</p> : (
        <>
          <p style={small}>Owed to organisers {rupees(rec.owed_paise)} · platform commission earned {rupees(rec.commission_paise)}{rec.overpaid_paise > 0 ? ` · overpaid ${rupees(rec.overpaid_paise)}` : ''}{rec.review_count ? ` · ${rec.review_count} payment(s) need review` : ''}</p>
          {rec.rows.length === 0 ? <p style={small}>No online payments for any tournament yet.</p> : rec.rows.map((row) => (
            <div key={row.tournament_id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.55rem 0.7rem', marginBottom: 6 }}>
              <strong>{row.name}</strong> <span style={small}>· organiser {row.organiser || 'unknown'}</span>
              <div style={small}>Collected {rupees(row.gross_paise)} · commission {rupees(row.commission_paise)} · paid out {rupees(row.paid_out_paise)} · <strong>{row.status === 'owed' ? `owed ${rupees(row.balance_paise)}` : row.status === 'overpaid' ? `overpaid ${rupees(-row.balance_paise)}` : 'settled'}</strong></div>
              {row.balance_paise > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <input style={{ ...inp, width: 100 }} placeholder="₹ amount" aria-label="Payout amount" value={pay[row.tournament_id]?.amount || ''} onChange={(e) => setP(row.tournament_id, 'amount', e.target.value)} />
                  <input style={{ ...inp, width: 150 }} placeholder="Bank / UPI reference" aria-label="Payout reference" value={pay[row.tournament_id]?.reference || ''} onChange={(e) => setP(row.tournament_id, 'reference', e.target.value)} />
                  <Button size="sm" disabled={busy} onClick={() => payOut(row)}>Record payout</Button>
                </div>
              )}
            </div>
          ))}
          <p style={small}>Record a payout only after you have sent the money by bank or UPI. This screen does not move money.</p>
        </>
      )}

      <h3 style={{ marginTop: '1.2rem' }}>Advert revenue</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" style={inp} aria-label="From" value={range.from} onChange={(e) => setRange((s) => ({ ...s, from: e.target.value }))} />
        <input type="date" style={inp} aria-label="To" value={range.to} onChange={(e) => setRange((s) => ({ ...s, to: e.target.value }))} />
      </div>
      {ads && (
        <>
          <p style={small}>Earned {rupees(ads.accrued_paise)} · billed {rupees(ads.billed_paise)} · paid {rupees(ads.paid_paise)}</p>
          {ads.rows.length === 0 ? <p style={small}>No adverts with rates or traffic in this period. Set rates below on an advert to start billing.</p> : ads.rows.map((a) => (
            <AdRow key={a.ad_id} a={a} busy={busy} range={range} run={run} />
          ))}
        </>
      )}

      <h3 style={{ marginTop: '1.2rem' }}>Reminders</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.sendBillReminders(), (n) => `${n} bill reminder${n === 1 ? '' : 's'} sent.`)}>Send bill reminders</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.sendRenewalReminders(), (n) => `${n} plan renewal reminder${n === 1 ? '' : 's'} sent.`)}>Send plan renewal reminders</Button>
      </div>
      <p style={small}>Reminders go out when you press these buttons. They are not scheduled yet.</p>

      <h3 style={{ marginTop: '1.2rem' }}>Plan limits</h3>
      <p style={small}>No limits are set by default. If a plan has no limit, it is unlimited, and a user gets the best limit across their plans.</p>
      {limits?.limits?.length > 0 && <ul>{limits.limits.map((l) => <li key={`${l.plan}${l.key}`}>{l.plan}: {LIMIT_KEYS.find((k) => k[0] === l.key)?.[1] || l.key} = {l.value}</li>)}</ul>}
      {limits && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={inp} aria-label="Plan" value={lim.plan} onChange={(e) => setLim({ ...lim, plan: e.target.value })}>{limits.plans.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select style={inp} aria-label="Limit" value={lim.key} onChange={(e) => setLim({ ...lim, key: e.target.value })}>{LIMIT_KEYS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input style={{ ...inp, width: 100 }} inputMode="numeric" placeholder="number" aria-label="Limit value" value={lim.value} onChange={(e) => setLim({ ...lim, value: e.target.value })} />
          <Button size="sm" disabled={busy} onClick={saveLimit}>Save (empty removes)</Button>
        </div>
      )}
    </Card>
  );
}

function AdRow({ a, busy, range, run }) {
  const [r, setR] = useState({ flat: String(a.flat_fee_paise / 100), cpm: String(a.cpm_paise / 100), cpc: String(a.cpc_paise / 100) });
  const toPaise = (v) => Math.round(Number(v || 0) * 100);
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.7rem', marginBottom: 6 }}>
      <strong>{a.title}</strong> <span style={small}>· {a.sponsor || 'no sponsor'} · {a.impressions} views · {a.clicks} clicks · earns {rupees(a.total_paise)}{a.billed_paise ? ` · billed ${rupees(a.billed_paise)}` : ''}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
        <input style={{ ...inp, width: 80 }} aria-label="Flat fee rupees" placeholder="Flat ₹" value={r.flat} onChange={(e) => setR({ ...r, flat: e.target.value })} />
        <input style={{ ...inp, width: 90 }} aria-label="Rupees per 1000 views" placeholder="₹/1000 views" value={r.cpm} onChange={(e) => setR({ ...r, cpm: e.target.value })} />
        <input style={{ ...inp, width: 80 }} aria-label="Rupees per click" placeholder="₹/click" value={r.cpc} onChange={(e) => setR({ ...r, cpc: e.target.value })} />
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => dataService.setAdRates(a.ad_id, toPaise(r.flat), toPaise(r.cpm), toPaise(r.cpc)), 'Rates saved.')}>Save rates</Button>
        <Button size="sm" disabled={busy || a.total_paise <= 0 || a.billed_paise > 0} onClick={() => run(() => dataService.billAdPlacement(a.ad_id, range.from, range.to), 'Bill sent to the sponsor.')}>Bill this period</Button>
      </div>
    </div>
  );
}
