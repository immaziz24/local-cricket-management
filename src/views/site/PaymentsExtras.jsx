import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { downloadBlob } from '../media/mediaUtils.js';
import { inrText, membershipLine, renewalNudge, invoiceText, refundDecisionProblem, rupeesToPaise, monthLabel } from './paymentsRules.js';

/** #271 free membership, #272 premium, #273 organiser packages: what plan the signed-in member has. */
export function MembershipCard() {
  const [m, setM] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { dataService.getMyMembership().then(setM).catch((e) => setErr(e.message)); }, []);
  const nudge = renewalNudge(m);
  return (
    <section className="info-box">
      <h2>My membership</h2>
      {err ? <p role="alert">{err}</p> : !m ? <p role="status">Loading…</p> : (
        <>
          <p><strong>{m.is_free ? 'Free' : m.kind === 'premium' ? 'Premium' : 'Organiser package'}</strong> – {membershipLine(m)}</p>
          {nudge && <p role="status">{nudge}</p>}
          {(m.all || []).length > 0 && (
            <ul aria-label="Recent plans">{m.all.map((x, i) => <li key={i}>{x.kind} · {x.plan} · {x.status} · until {new Date(x.ends_at).toLocaleDateString('en-IN')}</li>)}</ul>
          )}
        </>
      )}
    </section>
  );
}

/** #277 invoice and receipt for one payment (print or download). */
export function InvoicePanel({ paymentId, onClose }) {
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { dataService.getMyInvoice(paymentId).then(setInv).catch((e) => setErr(e.message)); }, [paymentId]);
  return (
    <div className="info-box" style={{ border: '1px solid #cbd5e1', padding: 12 }}>
      {err ? <p role="alert">{err}</p> : !inv ? <p role="status">Loading invoice…</p> : (
        <>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{invoiceText(inv)}</pre>
          <button type="button" onClick={() => window.print()}>Print</button>{' '}
          <button type="button" onClick={() => downloadBlob(new Blob([invoiceText(inv)], { type: 'text/plain;charset=utf-8' }), `${inv.invoice_no}.txt`)}>Download</button>{' '}
        </>
      )}
      <button type="button" onClick={onClose}>Close</button>
    </div>
  );
}

/** #278 admin decides each open refund request. Money is returned in the Razorpay dashboard; this records it and tells the member. */
export function RefundDecisionRow({ refund, onDone }) {
  const left = refund.amount_paise - refund.refunded_paise;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const decide = async (approve) => {
    const problem = refundDecisionProblem(approve, amount, left, note);
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr('');
    try { await dataService.decidePaymentRefund(refund.payment_id, approve, approve ? rupeesToPaise(amount) : null, note.trim(), ref.trim()); onDone && onDone(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <li style={{ marginBottom: 12 }}>
      <strong>{refund.description}</strong> · {refund.payer_name || 'Member'} · paid {inrText(refund.amount_paise)} · left to refund {inrText(left)}<br />
      <em>"{refund.reason}"</em><br />
      <input aria-label="Refund amount in rupees (empty = everything left)" placeholder={`Amount ₹ (empty = ${inrText(left)})`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />{' '}
      <input aria-label="Razorpay refund id (optional)" placeholder="Razorpay refund id (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />{' '}
      <input aria-label="Note for the member" placeholder="Note for the member" value={note} onChange={(e) => setNote(e.target.value)} />{' '}
      <button type="button" disabled={busy} onClick={() => decide(true)}>Approve</button>{' '}
      <button type="button" disabled={busy} onClick={() => decide(false)}>Decline</button>
      {err && <p role="alert">{err}</p>}
    </li>
  );
}

/** #282 revenue by month and by kind of plan. */
export function RevenueBreakdown({ data }) {
  if (!data) return null;
  return (
    <>
      <dl>
        <dt>Active paid members</dt><dd>{data.active_members ?? 0}</dd>
        <dt>Open refund requests</dt><dd>{data.open_refunds ?? 0}</dd>
        <dt>Net collections</dt><dd>{inrText(data.net_paise)}</dd>
      </dl>
      <h3>By month</h3>
      {(data.by_month || []).length === 0 ? <p>No payments yet.</p> : (
        <table><thead><tr><th>Month</th><th>Payments</th><th>Collected</th><th>Refunded</th></tr></thead>
          <tbody>{data.by_month.map((r) => <tr key={r.month}><td>{monthLabel(r.month)}</td><td>{r.count}</td><td>{inrText(r.captured_paise)}</td><td>{inrText(r.refunded_paise)}</td></tr>)}</tbody></table>
      )}
      <h3>By plan type</h3>
      {(data.by_kind || []).length === 0 ? <p>No payments yet.</p> : (
        <ul>{data.by_kind.map((r) => <li key={r.kind}>{r.kind} · {r.count} payment{r.count === 1 ? '' : 's'} · {inrText(r.captured_paise)}</li>)}</ul>
      )}
    </>
  );
}

/** #277 the seller details printed on every invoice (admin). */
export function InvoiceSettingsCard() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { dataService.getInvoiceSettings().then((s) => setF({ seller_name: s.seller_name || '', seller_address: s.seller_address || '', seller_gstin: s.seller_gstin || '', footer: s.footer || '' })).catch((e) => setMsg(e.message)); }, []);
  const save = async () => { try { await dataService.setInvoiceSettings(f); setMsg('Saved. New and old invoices now show these details.'); } catch (e) { setMsg(e.message); } };
  if (!f) return msg ? <p role="alert">{msg}</p> : null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <section className="info-box">
      <h3>Invoice details</h3>
      <p>Shown at the top and bottom of every invoice. Put your real business name, address and GSTIN here before you go live.</p>
      <label>Business name <input value={f.seller_name} onChange={set('seller_name')} maxLength={120} /></label><br />
      <label>Address <input value={f.seller_address} onChange={set('seller_address')} maxLength={300} /></label><br />
      <label>GSTIN <input value={f.seller_gstin} onChange={set('seller_gstin')} maxLength={20} /></label><br />
      <label>Footer line <input value={f.footer} onChange={set('footer')} maxLength={200} /></label><br />
      <button type="button" onClick={save}>Save</button>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
