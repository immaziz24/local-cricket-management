import test from 'node:test';
import assert from 'node:assert/strict';
import { recapStatusLabel, recapCredit, recapRejectProblem, recapEditProblem, recapIsChanged, pendingRecap } from '../src/views/news/recapRules.js';

test('status labels', () => {
  assert.equal(recapStatusLabel({ status: 'pending' }), 'Waiting for approval');
  assert.match(recapStatusLabel({ status: 'approved', edited: true }), /edited by a person/);
  assert.equal(recapStatusLabel({ status: 'approved', edited: false }), 'Approved and published');
  assert.equal(recapStatusLabel(null), '');
});
test('credit line says a person approved', () => {
  assert.match(recapCredit(false), /approved by a match official/);
  assert.match(recapCredit(true), /edited and approved/);
});
test('reject needs a reason', () => {
  assert.ok(recapRejectProblem('no'));
  assert.ok(recapRejectProblem('   '));
  assert.equal(recapRejectProblem('Scores wrong'), null);
});
test('edit checks', () => {
  assert.ok(recapEditProblem('abc', 'x'.repeat(30)));
  assert.ok(recapEditProblem('A real headline', 'short'));
  assert.ok(recapEditProblem('A real headline', 'x'.repeat(20001)));
  assert.equal(recapEditProblem('A real headline', 'x'.repeat(30)), null);
});
test('change detection and pending pick', () => {
  const r = { drafted_title: 'T title', drafted_body: 'body body' };
  assert.equal(recapIsChanged(r, 'T title', ' body body '), false);
  assert.equal(recapIsChanged(r, 'T title', 'body body more'), true);
  assert.equal(pendingRecap([{ status: 'approved' }, { status: 'pending', id: 1 }]).id, 1);
  assert.equal(pendingRecap([]), null);
});
