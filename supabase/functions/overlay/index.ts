// #371 OBS-compatible live overlay endpoint.
// GET  <project>/functions/v1/overlay?match=<match id>   ->  small JSON with the live score, refreshed by the scorer.
// Public (no sign-in): it only returns what the public match page already shows. Reads through the same safe database
// functions as the website (get_live_state, get_match_centre), so private matches stay private.
import { normalizeOverlay, parseOverlayRequest } from './normalize.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra } });

async function rpc(name: string, args: Record<string, unknown>) {
  const base = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!base || !key) throw new Error('Service is not set up.');
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!res.ok) throw new Error(`${name} failed (${res.status})`);
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Use GET.' }, 405);
  const q = parseOverlayRequest(req.url);
  if (q.error) return json({ error: q.error }, 400);
  try {
    const [centre, live] = await Promise.all([rpc('get_match_centre', { p_match_id: q.match }), rpc('get_live_state', { p_match_id: q.match })]);
    const out = normalizeOverlay(centre, live);
    if (!out) return json({ error: 'Match not found.' }, 404);
    return json(out, 200, { 'Cache-Control': 'public, max-age=2' });
  } catch (_e) {
    return json({ error: 'The score is not available right now. Try again in a moment.' }, 502);
  }
});
