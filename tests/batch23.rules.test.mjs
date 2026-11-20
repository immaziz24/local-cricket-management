import test from 'node:test';
import assert from 'node:assert/strict';
import { actionId, buildPending, pruneQueue, parseSent } from '../src/views/matches/backgroundSync.js';

const session = { url: 'https://x.supabase.co', key: 'k', token: 't', exp: 2000000000 };
const ball = { id: 'a1', kind: 'ball', payload: { runs: 1, client_id: 'c1' } };
const players = { id: 'a2', kind: 'players', payload: { striker: 's', nonStriker: null, bowler: 'b' } };

test('each queued action can be tracked by its id (#289)', () => {
  assert.equal(actionId(ball), 'a1'); assert.equal(actionId({ kind: 'ball', payload: { client_id: 'c9' } }), 'c9');
  assert.equal(actionId({ kind: 'players', payload: {} }), null); assert.equal(actionId(null), null);
});

test('the Android copy has the sign-in and the actions in order', () => {
  const o = JSON.parse(buildPending(session, [ball, players]));
  assert.equal(o.url, session.url); assert.equal(o.token, 't'); assert.equal(o.exp, 2000000000);
  assert.deepEqual(o.actions.map((a) => a.id), ['a1', 'a2']); assert.equal(o.actions[1].kind, 'players');
});

test('nothing is copied when the queue is empty, signed out, or an action cannot be tracked', () => {
  assert.equal(buildPending(session, []), ''); assert.equal(buildPending(session, null), '');
  assert.equal(buildPending({ ...session, token: null }, [ball]), ''); assert.equal(buildPending(null, [ball]), '');
  assert.equal(buildPending(session, [ball, { kind: 'players', payload: {} }]), '');
  assert.equal(buildPending(session, [{ id: 'z', kind: 'undo', payload: {} }]), '');
});

test('actions the app already uploaded are removed when the page opens again', () => {
  assert.deepEqual(pruneQueue([ball, players], ['a1']).map((a) => a.id), ['a2']);
  assert.deepEqual(pruneQueue([ball, players], ['a1', 'a2']), []);
  assert.equal(pruneQueue([ball], []).length, 1); assert.equal(pruneQueue([ball], null).length, 1); assert.deepEqual(pruneQueue(null, ['a1']), []);
});

test('the list the app returns is read safely', () => {
  assert.deepEqual(parseSent('{"m1":["a1","a2"],"m2":["b"]}', 'm1'), ['a1', 'a2']);
  assert.deepEqual(parseSent('{"m1":["a1"]}', 'm9'), []); assert.deepEqual(parseSent('not json', 'm1'), []); assert.deepEqual(parseSent('', 'm1'), []);
});
