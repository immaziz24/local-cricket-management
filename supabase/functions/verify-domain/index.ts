// #377 Custom tournament domain mapping: checks the DNS TXT record that proves the organiser controls the address.
// POST { id }  with the signed-in person's token. The database confirms the caller is the tournament organiser
// (get_domain_challenge), this function looks up  _cricnotch-verify.<domain>  over DNS-over-HTTPS, and only this
// function (service role) can record the result, so nobody can mark their own address as verified.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

async function rpc(name: string, args: Record<string, unknown>, bearer: string, apikey: string) {
  const base = Deno.env.get('SUPABASE_URL');
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.message) || `${name} failed (${res.status})`);
  return body;
}

async function txtValues(name: string): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: 'application/dns-json' } });
  if (!res.ok) throw new Error('The DNS lookup service did not answer. Try again in a minute.');
  const j = await res.json();
  return (j.Answer || []).filter((a: { type: number }) => a.type === 16).map((a: { data: string }) => String(a.data).replace(/^"|"$/g, '').replace(/"\s*"/g, ''));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const anon = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!auth || !service) return json({ error: 'Please sign in first.' }, 401);
  let id = '';
  try { id = String((await req.json()).id || ''); } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Choose an address to check.' }, 400);
  try {
    const ch = await rpc('get_domain_challenge', { p_id: id }, auth, anon); // refuses anyone who is not the organiser
    const found = await txtValues(ch.record);
    const ok = found.some((v) => v.trim() === ch.token || v.trim() === `cricnotch-verify=${ch.token}`);
    const out = await rpc('mark_domain_checked', { p_id: id, p_ok: ok, p_error: ok ? null : (found.length ? 'A record was found but the code does not match.' : 'No record found yet. DNS changes can take a while.') }, service, service);
    return json({ ...out, record: ch.record });
  } catch (e) {
    return json({ error: (e as Error).message || 'Could not check right now.' }, 400);
  }
});
