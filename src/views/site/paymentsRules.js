// Batch 16 (#271-#283): plain rules for the payments screens, free of React so they can be tested.
export const inrText = (paise) => `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function membershipLine(m) {
  if (!m) return '';
  if (m.is_free) return 'Free membership – every feature you have now stays free.';
  const left = m.days_left;
  const end = m.ends_at ? new Date(m.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
  return `${m.kind === 'premium' ? 'Premium membership' : 'Tournament organiser package'} active until ${end}${left != null ? ` (${left} day${left === 1 ? '' : 's'} left)` : ''}.`;
}

export function renewalNudge(m) {
  if (!m || m.is_free || m.days_left == null) return null;
  return m.days_left <= 7 ? `Your plan ends in ${m.days_left} day${m.days_left === 1 ? '' : 's'}. Buying the same plan again adds time after the end date.` : null;
}

export function refundStatusLabel(p) {
  if (!p) return '';
  if (p.refunded_paise > 0 && p.refunded_paise >= p.amount_paise) return 'Fully refunded';
  if (p.refunded_paise > 0) return `Partly refunded (${inrText(p.refunded_paise)})`;
  if (p.refund_status === 'open') return 'Refund requested – waiting for a decision';
  if (p.refund_status === 'rejected') return 'Refund request declined';
  return '';
}

export const canRequestRefund = (p) => !!p && p.refunded_paise < p.amount_paise && !p.refund_status;

export function refundDecisionProblem(approve, rupees, leftPaise, note) {
  if (String(note || '').trim().length < 3) return 'Add a short note for the member (at least 3 characters).';
  if (approve && rupees !== '' && rupees != null) {
    const paise = Math.round(Number(rupees) * 100);
    if (!Number.isFinite(paise) || paise <= 0) return 'Enter a refund amount greater than zero.';
    if (paise > leftPaise) return 'That is more than what is left to refund.';
  }
  return null;
}

export const rupeesToPaise = (v) => (v === '' || v == null ? null : Math.round(Number(v) * 100));

export function invoiceText(i) {
  const lines = [
    i.seller_name, i.seller_address, i.seller_gstin ? `GSTIN: ${i.seller_gstin}` : null, '',
    i.test_mode ? 'INVOICE (TEST PAYMENT – not a tax invoice)' : 'INVOICE',
    `Invoice no: ${i.invoice_no}`, `Date: ${new Date(i.issued_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    i.payer_name ? `Billed to: ${i.payer_name}` : null, `Item: ${i.description}`,
    `Amount paid: ${inrText(i.amount_paise)}`,
    i.refunded_paise > 0 ? `Refunded: ${inrText(i.refunded_paise)}` : null,
    i.refunded_paise > 0 ? `Net: ${inrText(i.amount_paise - i.refunded_paise)}` : null,
    i.footer ? '' : null, i.footer || null
  ].filter((x) => x !== null && x !== undefined);
  return lines.join('\n');
}

export function monthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
