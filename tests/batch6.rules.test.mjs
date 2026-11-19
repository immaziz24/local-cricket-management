// Batch 6: team membership history #341, duplicate merge safety #338
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateMembershipDates, spellLabel } from '../src/views/teams/membershipHistory.js';

const NOW = new Date('2026-11-19T10:00:00Z').getTime();
const d = (s) => new Date(s).toISOString();

test('corrected dates must be in the past and in order', () => {
  assert.match(validateMembershipDates({ joined: d('2027-01-01'), isCurrent: true, now: NOW }), /in the past/);
  assert.match(validateMembershipDates({ joined: d('2025-05-01'), left: d('2025-04-01'), isCurrent: false, now: NOW }), /before the joining/);
  assert.equal(validateMembershipDates({ joined: d('2025-01-01'), left: d('2025-06-01'), isCurrent: false, now: NOW }), null);
  assert.equal(validateMembershipDates({ joined: d('2025-01-01'), isCurrent: true, now: NOW }), null);
});
test('a current spell has no leaving date and a past spell needs one', () => {
  assert.match(validateMembershipDates({ joined: d('2025-01-01'), left: d('2025-06-01'), isCurrent: true, now: NOW }), /still in the squad/);
  assert.match(validateMembershipDates({ joined: d('2025-01-01'), isCurrent: false, now: NOW }), /needs a leaving date/);
  assert.match(validateMembershipDates({ joined: '', isCurrent: true, now: NOW }), /joined/);
});
test('two spells in the same team cannot overlap', () => {
  const others = [{ joined_at: d('2024-01-01'), left_at: d('2024-12-31') }];
  assert.match(validateMembershipDates({ joined: d('2024-06-01'), left: d('2025-03-01'), isCurrent: false, others, now: NOW }), /overlap/);
  assert.equal(validateMembershipDates({ joined: d('2025-01-10'), left: d('2025-03-01'), isCurrent: false, others, now: NOW }), null);
});
test('spells are labelled', () => {
  assert.match(spellLabel({ joined_at: d('2025-03-10'), left_at: null }), /Mar 2025 - now/);
  assert.match(spellLabel({ joined_at: d('2024-01-10'), left_at: d('2025-03-10') }), /Jan 2024 - Mar 2025/);
});

test('the merge function is admin-only, keeps a log, and never merges two registered accounts', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const f = readdirSync(dir).find((n) => n.includes('player_merge'));
  assert.ok(f);
  const sql = readFileSync(new URL(f, dir), 'utf8');
  assert.ok(/public\.merge_players[\s\S]*private\.is_admin\(\)/.test(sql));
  assert.ok(sql.includes('Both players belong to different registered accounts'));
  assert.ok(sql.includes('insert into public.player_merges'));
  assert.ok(sql.includes("'PLAYERS_MERGED'"));
  assert.ok(sql.includes('revoke all on function private.merge_players_core'));
});
