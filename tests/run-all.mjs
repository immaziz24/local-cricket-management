// Runs every tests/*.rules.test.mjs with Node's built-in test runner (works on Node 18 and newer).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.rules.test.mjs')).sort().map((f) => join(dir, f));
if (files.length === 0) { console.error('No test files found.'); process.exit(1); }
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
