import test from 'node:test';
import assert from 'node:assert/strict';
import { rupees, bpsToPercent, percentToBps, parseFee, billLabel, teamFeeLabel, payoutCheck, settlementCsv, limitLine, monthToDate, LIMIT_KEYS } from '../src/views/money/moneyRules.js';

test('commission is typed as a percentage and stored in basis points (#281)', () => {
  assert.deepEqual(percentToBps('5'), { bps: 500 }); assert.deepEqual(percentToBps('2.5%'), { bps: 250 }); assert.deepEqual(percentToBps('0'), { bps: 0 });
  assert.deepEqual(percentToBps('30'), { bps: 3000 });
  assert.ok(percentToBps('30.01').error); assert.ok(percentToBps('31').error); assert.ok(percentToBps('').error); assert.ok(percentToBps('abc').error); assert.ok(percentToBps('-1').error);
  assert.equal(bpsToPercent(500), '5%'); assert.equal(bpsToPercent(250), '2.5%'); assert.equal(bpsToPercent(null), '0%');
});

test('entry fee is whole rupees or paise, empty clears it (#275)', () => {
  assert.deepEqual(parseFee('1500'), { rupees: 1500 }); assert.deepEqual(parseFee('99.50'), { rupees: 99.5 });
  assert.deepEqual(parseFee(''), { rupees: null }); assert.deepEqual(parseFee('0'), { rupees: null });
  assert.ok(parseFee('0.5').error); assert.ok(parseFee('500001').error); assert.ok(parseFee('12abc').error); assert.ok(parseFee('1.234').error);
});

test('rupee text uses Indian grouping', () => {
  assert.equal(rupees(150000), '₹1,500.00'); assert.equal(rupees(0), '₹0.00'); assert.equal(rupees(null), '₹0.00'); assert.equal(rupees(12345678), '₹1,23,456.78');
});

test('bill and team fee labels (#276, #389)', () => {
  assert.equal(billLabel({ status: 'paid' }), 'Paid'); assert.equal(billLabel({ status: 'due', overdue: true }), 'Overdue');
  assert.equal(billLabel({ status: 'due' }), 'Due'); assert.equal(billLabel({ status: 'cancelled' }), 'Cancelled'); assert.equal(billLabel(null), '');
  assert.equal(teamFeeLabel(null, 0), 'No fee'); assert.equal(teamFeeLabel(100000, 0), 'Unpaid'); assert.equal(teamFeeLabel(100000, 40000), 'Part paid'); assert.equal(teamFeeLabel(100000, 100000), 'Paid');
});

test('a payout cannot be more than the balance and needs a reference (#388)', () => {
  assert.deepEqual(payoutCheck('500', 'UTR123', 100000), { paise: 50000 });
  assert.ok(payoutCheck('1001', 'UTR123', 100000).error); assert.ok(payoutCheck('0', 'UTR123', 100000).error);
  assert.ok(payoutCheck('500', '', 100000).error); assert.ok(payoutCheck('500', 'x', 100000).error); assert.ok(payoutCheck('abc', 'UTR123', 100000).error);
  assert.deepEqual(payoutCheck('1000', 'UTR123', 100000), { paise: 100000 });
});

test('settlement CSV has a row per payment and the totals (#390)', () => {
  const csv = settlementCsv({ gross_paise: 100000, refunded_paise: 0, commission_paise: 5000, net_paise: 95000, paid_out_paise: 50000, balance_paise: 45000,
    lines: [{ date: '2026-11-20T05:00:00Z', kind: 'registration', description: 'Entry fee, "Team A"', amount_paise: 100000, refunded_paise: 0, commission_paise: 5000, net_paise: 95000, is_test: true, needs_review: null }] });
  const lines = csv.split('\r\n');
  assert.ok(lines[0].startsWith('Date,Kind')); assert.ok(lines[1].includes('"Entry fee, ""Team A"""')); assert.ok(lines[1].includes('1000.00,0.00,50.00,950.00,yes'));
  assert.ok(csv.includes('Balance still owed to organiser,,,,450.00'));
  assert.doesNotThrow(() => settlementCsv({ gross_paise: 0, refunded_paise: 0, commission_paise: 0, net_paise: 0, paid_out_paise: 0, balance_paise: 0 }));
});

test('plan limit lines (#391)', () => {
  assert.equal(limitLine('Teams', { limit: null, used: 3 }), 'Teams: no limit (you have 3)');
  assert.equal(limitLine('Teams', { limit: 5, used: 2 }), 'Teams: 2 of 5 used'); assert.equal(limitLine('Teams', { limit: 5, used: 5 }), 'Teams: 5 of 5 used – limit reached');
  assert.equal(limitLine('Teams', null), ''); assert.equal(LIMIT_KEYS.length, 2);
});

test('month to date is in Indian time', () => {
  assert.deepEqual(monthToDate(new Date('2026-11-20T10:00:00Z')), { from: '2026-11-01', to: '2026-11-20' });
  assert.deepEqual(monthToDate(new Date('2026-11-30T20:00:00Z')), { from: '2026-12-01', to: '2026-12-01' });
});
