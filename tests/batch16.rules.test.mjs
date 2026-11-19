import test from 'node:test';
import assert from 'node:assert/strict';
import { inrText, membershipLine, renewalNudge, refundStatusLabel, canRequestRefund, refundDecisionProblem, rupeesToPaise, invoiceText, monthLabel } from '../src/views/site/paymentsRules.js';
import { DEFAULT_ACCESS, readAccess, saveAccess, accessAttributes, describeAccess, connectionIsSlow } from '../src/views/settings/accessibility.js';
import { installState, isIosSafari } from '../src/views/settings/installApp.js';
import { markOf, serverChange, conflictOptions, describeAction, describeConflict, queueCopyText, saveMark, loadMark, clearMark } from '../src/views/matches/syncConflicts.js';
import { achievementLink, badgeFromSearch, achievementShareText, orderBadges } from '../src/views/teams/achievements.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('money and membership text', () => {
  assert.equal(inrText(9900), '₹99.00');
  assert.match(membershipLine({ is_free: true }), /Free membership/);
  assert.match(membershipLine({ is_free: false, kind: 'premium', ends_at: '2027-01-10T00:00:00Z', days_left: 1 }), /Premium membership active until .* \(1 day left\)/);
  assert.ok(renewalNudge({ is_free: false, days_left: 3 }));
  assert.equal(renewalNudge({ is_free: false, days_left: 30 }), null);
  assert.equal(renewalNudge({ is_free: true }), null);
});

test('refund labels and the request button', () => {
  assert.equal(refundStatusLabel({ amount_paise: 100, refunded_paise: 100 }), 'Fully refunded');
  assert.match(refundStatusLabel({ amount_paise: 100, refunded_paise: 40 }), /Partly refunded/);
  assert.match(refundStatusLabel({ amount_paise: 100, refunded_paise: 0, refund_status: 'open' }), /waiting/);
  assert.match(refundStatusLabel({ amount_paise: 100, refunded_paise: 0, refund_status: 'rejected' }), /declined/);
  assert.equal(canRequestRefund({ amount_paise: 100, refunded_paise: 0, refund_status: null }), true);
  assert.equal(canRequestRefund({ amount_paise: 100, refunded_paise: 0, refund_status: 'open' }), false);
  assert.equal(canRequestRefund({ amount_paise: 100, refunded_paise: 100 }), false);
});

test('refund decision checks', () => {
  assert.ok(refundDecisionProblem(true, '', 1000, 'x'));
  assert.equal(refundDecisionProblem(true, '', 1000, 'okay'), null);
  assert.ok(refundDecisionProblem(true, '20', 1000, 'okay'));
  assert.ok(refundDecisionProblem(true, '0', 1000, 'okay'));
  assert.equal(refundDecisionProblem(true, '5', 1000, 'okay'), null);
  assert.equal(refundDecisionProblem(false, '9999', 1000, 'okay'), null);
  assert.equal(rupeesToPaise('12.5'), 1250); assert.equal(rupeesToPaise(''), null);
});

test('invoice text', () => {
  const t = invoiceText({ seller_name: 'Cricnotch', invoice_no: 'CN-2026-000001', issued_at: '2026-11-19T10:00:00Z', payer_name: 'Khan', description: 'Test payment — Premium', amount_paise: 9900, refunded_paise: 0, test_mode: true, footer: 'Thanks' });
  assert.match(t, /TEST PAYMENT/); assert.match(t, /CN-2026-000001/); assert.match(t, /₹99\.00/); assert.match(t, /Thanks/);
  assert.match(invoiceText({ seller_name: 'A', invoice_no: 'X', issued_at: '2026-11-19T10:00:00Z', description: 'd', amount_paise: 100, refunded_paise: 40, test_mode: false }), /Net: ₹0\.60/);
  assert.equal(monthLabel('2026-11'), 'Nov 2026');
});

test('accessibility choices', () => {
  const s = mem();
  assert.equal(readAccess(s).chosen, false);
  saveAccess({ ...DEFAULT_ACCESS, low_data: true, large_text: true }, s);
  const a = readAccess(s);
  assert.equal(a.low_data, true); assert.equal(a.high_contrast, false); assert.equal(a.chosen, true);
  assert.deepEqual(accessAttributes(a), { 'data-large-text': '1', 'data-contrast': null, 'data-reduce-motion': null, 'data-low-data': '1' });
  assert.match(describeAccess(a), /larger text.*low data/);
  assert.match(describeAccess(DEFAULT_ACCESS), /normal/);
  assert.equal(readAccess({ getItem: () => '{bad' }).chosen, false);
  assert.equal(connectionIsSlow({ saveData: true }), true);
  assert.equal(connectionIsSlow({ effectiveType: '2g' }), true);
  assert.equal(connectionIsSlow({ effectiveType: '4g' }), false);
  assert.equal(connectionIsSlow(null), false);
});

test('install states', () => {
  assert.equal(installState({ standalone: true }), 'installed');
  assert.equal(installState({ hasPrompt: true }), 'ready');
  assert.equal(installState({ ios: true }), 'ios');
  assert.equal(installState({}), 'browser');
  assert.equal(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605'), true);
  assert.equal(isIosSafari('Mozilla/5.0 (iPhone) CriOS/120 Safari'), false);
  assert.equal(isIosSafari('Mozilla/5.0 (Linux; Android 13) Chrome/120'), false);
});

test('offline conflict classification', () => {
  const mark = markOf({ status: 'live', current: { innings_no: 1, legal_balls: 10, runs: 20, wickets: 1 } });
  assert.equal(serverChange(mark, { status: 'live', current: { innings_no: 1, legal_balls: 10, runs: 20, wickets: 1 } }), 'same');
  assert.equal(serverChange(mark, { status: 'live', current: { innings_no: 1, legal_balls: 12, runs: 24, wickets: 1 } }), 'server_ahead');
  assert.equal(serverChange(mark, { status: 'live', current: { innings_no: 2, legal_balls: 0, runs: 0, wickets: 0 } }), 'innings_changed');
  assert.equal(serverChange(mark, { status: 'completed', current: null }), 'match_closed');
  assert.equal(serverChange(null, { status: 'live', current: { innings_no: 1 } }), 'unknown');
  assert.equal(serverChange(mark, null), 'unknown');
  assert.deepEqual(conflictOptions('same'), ['retry', 'save_copy', 'discard']);
  assert.deepEqual(conflictOptions('server_ahead'), ['save_copy', 'discard']);
});

test('offline conflict wording and copy', () => {
  assert.equal(describeAction({ kind: 'ball', payload: { runs: 4 } }), '4 runs');
  assert.equal(describeAction({ kind: 'ball', payload: { runs: 0, extra: 'wide' } }), 'wide');
  assert.equal(describeAction({ kind: 'ball', payload: { runs: 0, wicket: 'run_out' } }), '0 runs, wicket (run out)');
  assert.equal(describeAction({ kind: 'players', payload: {} }), 'Batters or bowler chosen');
  const q = [{ kind: 'ball', payload: { runs: 1 } }, { kind: 'ball', payload: { runs: 6 } }];
  const c = describeConflict(q[0], 'Pick the bowler first', { innings_no: 1, legal_balls: 0, runs: 0, wickets: 0 }, { status: 'live', current: { innings_no: 1, legal_balls: 0, runs: 0, wickets: 0 } }, q);
  assert.equal(c.kind, 'same'); assert.equal(c.heldCount, 2); assert.ok(c.options.includes('retry'));
  const t = queueCopyText('m1', q, new Date('2026-11-19T00:00:00Z'));
  assert.match(t, /1\. 1 run\b/); assert.match(t, /2\. 6 runs/); assert.match(t, /raw data/);
  const s = mem(); saveMark('m1', { a: 1 }, s); assert.deepEqual(loadMark('m1', s), { a: 1 }); clearMark('m1', s); assert.equal(loadMark('m1', s), null);
});

test('achievement links and ordering', () => {
  assert.equal(achievementLink('https://x.in/', 'abc', 'century'), 'https://x.in/?page=player-profile&id=abc&badge=century');
  assert.equal(achievementLink('https://x.in', 'abc'), 'https://x.in/?page=player-profile&id=abc');
  assert.equal(badgeFromSearch('?page=player-profile&id=1&badge=five_wickets'), 'five_wickets');
  assert.equal(badgeFromSearch('?badge=<script>'), null);
  assert.equal(badgeFromSearch(''), null);
  assert.match(achievementShareText('Fayej', { title: '3-wicket haul', detail: '1 time' }), /Fayej – 3-wicket haul/);
  assert.deepEqual(orderBadges([{ key: 'a' }, { key: 'b' }, { key: 'c' }], 'c').map((b) => b.key), ['c', 'a', 'b']);
  assert.deepEqual(orderBadges([{ key: 'a' }], null).map((b) => b.key), ['a']);
});
