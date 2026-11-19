// Batch 4: scorer permissions #383, device names #386, migration safety
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { effectivePermissions, toSaved, permissionSummary, SCORER_PERMISSIONS } from '../src/views/officials/scorerPermissions.js';
import { deviceLabel } from '../src/views/admin/deviceLabel.js';

test('no saved permissions means a scorer may do everything', () => {
  const e = effectivePermissions(null);
  assert.ok(SCORER_PERMISSIONS.every(([k]) => e[k] === true));
  assert.equal(toSaved(e), null);
  assert.equal(permissionSummary(null), 'Full scoring');
});
test('only restrictions are saved and summarised', () => {
  const e = effectivePermissions({ edit_ball: false, penalty: false });
  assert.equal(e.edit_ball, false); assert.equal(e.score, true);
  assert.deepEqual(toSaved(e), { edit_ball: false, penalty: false });
  assert.match(permissionSummary({ edit_ball: false }), /Edit earlier balls/);
});
test('device names are readable', () => {
  assert.equal(deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36'), 'Chrome on Android');
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36 Edg/120'), 'Edge on Windows');
  assert.equal(deviceLabel(''), 'Unknown device');
});
test('the permissions migration limits only scorers and keeps the open-platform rule', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const f = readdirSync(dir).find((n) => n.includes('scorer_permissions'));
  assert.ok(f, 'migration present');
  const sql = readFileSync(new URL(f, dir), 'utf8');
  for (const k of ['created_by', 'private.is_admin()', 'is_tournament_admin']) assert.ok(sql.includes(k), `owner-level people are never limited (${k})`);
  assert.ok(sql.includes("revoke execute on function %s from public, anon"));
});
