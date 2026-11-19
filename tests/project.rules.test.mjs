// Project rules from CLAUDE.md: no secrets in the code, data access only through dataService, migrations are tidy
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', '.vite', 'android', 'ios'].includes(name)) continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const read = (p) => readFileSync(p, 'utf8');
const src = walk(join(root, 'src')).filter((f) => /\.(jsx?|mjs)$/.test(f));

test('the service-role key is never in the frontend code', () => {
  src.forEach((f) => assert.doesNotMatch(read(f), /service_role|SERVICE_ROLE/, relative(root, f)));
});
test('.env is ignored by git and .env.example holds only public settings', () => {
  assert.match(read(join(root, '.gitignore')), /^\.env$/m);
  const ex = read(join(root, '.env.example'));
  assert.doesNotMatch(ex, /service_role|secret|sk_live|rzp_live/i);
});
test('no real secrets are written into source files', () => {
  src.forEach((f) => {
    const t = read(f);
    assert.doesNotMatch(t, /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\./, `JWT-like token in ${relative(root, f)}`);
    assert.doesNotMatch(t, /rzp_live_[A-Za-z0-9]+/, `live Razorpay key in ${relative(root, f)}`);
  });
});
test('views and components never call Supabase directly (only dataService does)', () => {
  const bad = src.filter((f) => /[\\/]src[\\/](views|components)[\\/]/.test(f))
    .filter((f) => /@supabase\/supabase-js|supabaseClient/.test(read(f)));
  assert.deepEqual(bad.map((f) => relative(root, f)), []);
});
test('migration files are named correctly, in order, with no duplicate timestamps', () => {
  const dir = join(root, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length > 50);
  const stamps = files.map((f) => { assert.match(f, /^\d{14}_[a-z0-9_]+\.sql$/, f); return f.slice(0, 14); });
  assert.equal(new Set(stamps).size, stamps.length, 'two migrations share a timestamp');
});
test('security-definer functions in recent migrations set a safe search_path', () => {
  const dir = join(root, 'supabase', 'migrations');
  const recent = readdirSync(dir).filter((f) => f.endsWith('.sql') && f >= '20261112').sort();
  const problems = [];
  recent.forEach((f) => {
    const t = read(join(dir, f));
    const defs = t.split(/create\s+(?:or\s+replace\s+)?function/i).slice(1);
    defs.forEach((d) => {
      const header = d.split(/\bas\s+\$/i)[0];
      if (/security\s+definer/i.test(header) && !/set\s+search_path/i.test(header)) problems.push(`${f}: ${header.trim().split('\n')[0].slice(0, 60)}`);
    });
  });
  assert.deepEqual(problems, []);
});
test('the docs the project depends on exist', () => {
  ['CLAUDE.md', 'docs/01-MASTER-BLUEPRINT.md', 'docs/03-PROGRESS-TRACKER.md', 'docs/08-CURRENT-STATUS.md'].forEach((f) => assert.ok(existsSync(join(root, f)), f));
});
