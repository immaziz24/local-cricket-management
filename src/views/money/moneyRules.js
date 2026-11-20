// Batch 21 (#275-#281, #388-#391): plain rules for the money screens, free of React so they can be tested.
export const rupees = (paise) => `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Commission is stored in basis points (500 = 5%). The admin types a percentage. */
export const bpsToPercent = (bps) => `${(Number(bps) || 0) / 100}%`;
export function percentToBps(text) {
  const t = String(text ?? '').trim().replace('%', '');
  if (t === '' || !/^\d+(\.\d{1,2})?$/.test(t)) return { error: 'Enter a percentage such as 5 or 2.5.' };
  const bps = Math.round(Number(t) * 100);
  if (bps > 3000) return { error: 'The commission cannot be more than 30%.' };
  return { bps };
}

/** Entry fee typed in rupees. Empty or 0 clears the fee. */
export function parseFee(text) {
  const t = String(text ?? '').trim();
  if (t === '' || Number(t) === 0) return { rupees: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { error: 'Enter the fee in rupees, for example 1500.' };
  const n = Number(t);
  if (n < 1 || n > 500000) return { error: 'The fee must be between ₹1 and ₹5,00,000.' };
  return { rupees: n };
}

export function billLabel(b) {
  if (!b) return '';
  if (b.status === 'paid') return 'Paid';
  if (b.status === 'cancelled') return 'Cancelled';
  return b.overdue ? 'Overdue' : 'Due';
}

/** What an organiser sees about the entry fee of one team. */
export function teamFeeLabel(entryFeePaise, paidPaise) {
  if (!entryFeePaise) return 'No fee';
  if ((paidPaise || 0) >= entryFeePaise) return 'Paid';
  if ((paidPaise || 0) > 0) return 'Part paid';
  return 'Unpaid';
}

export function payoutCheck(amountText, reference, balancePaise) {
  const t = String(amountText ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t) || Number(t) <= 0) return { error: 'Enter the amount in rupees.' };
  if (String(reference ?? '').trim().length < 2) return { error: 'Enter the bank or UPI reference of the transfer.' };
  const paise = Math.round(Number(t) * 100);
  if (paise > balancePaise) return { error: `That is more than the organiser is owed (${rupees(balancePaise)}).` };
  return { paise };
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** #390 The settlement report as a CSV file. */
export function settlementCsv(report) {
  const rows = [['Date', 'Kind', 'Description', 'Paid (INR)', 'Refunded (INR)', 'Platform commission (INR)', 'Organiser share (INR)', 'Test payment', 'Needs review']];
  for (const l of report?.lines || []) {
    rows.push([l.date ? new Date(l.date).toISOString().slice(0, 10) : '', l.kind, l.description, (l.amount_paise / 100).toFixed(2), (l.refunded_paise / 100).toFixed(2),
      (l.commission_paise / 100).toFixed(2), (l.net_paise / 100).toFixed(2), l.is_test ? 'yes' : 'no', l.needs_review || '']);
  }
  rows.push([]);
  rows.push(['', '', 'Total collected', (report.gross_paise / 100).toFixed(2), (report.refunded_paise / 100).toFixed(2), (report.commission_paise / 100).toFixed(2), (report.net_paise / 100).toFixed(2)]);
  rows.push(['', '', 'Already paid out to organiser', '', '', '', (report.paid_out_paise / 100).toFixed(2)]);
  rows.push(['', '', 'Balance still owed to organiser', '', '', '', (report.balance_paise / 100).toFixed(2)]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** #391 One line about a plan limit. A null limit means no limit. */
export function limitLine(label, entry) {
  if (!entry) return '';
  if (entry.limit == null) return `${label}: no limit (you have ${entry.used})`;
  const left = Math.max(entry.limit - entry.used, 0);
  return `${label}: ${entry.used} of ${entry.limit} used${left === 0 ? ' – limit reached' : ''}`;
}

export const LIMIT_KEYS = [['max_tournaments', 'Tournaments a user can create'], ['max_teams', 'Teams a user can create']];

/** Period for ad billing: the first day of this month up to today, in Indian time. */
export function monthToDate(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear(); const m = String(ist.getUTCMonth() + 1).padStart(2, '0'); const d = String(ist.getUTCDate()).padStart(2, '0');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}
