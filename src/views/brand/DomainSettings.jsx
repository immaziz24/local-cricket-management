import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { checkDomain, dnsSteps, STATUS_TEXT } from './domainRules.js';

/** #377 Custom tournament domain mapping: the organiser connects their own web address (for example cup.myclub.com). */
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };
const note = { fontSize: '0.78rem', color: '#64748b' };
const code = { fontFamily: 'ui-monospace, Consolas, monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, wordBreak: 'break-all' };
const COLOUR = { pending: '#b45309', verified: '#059669', failed: '#b91c1c' };

export function DomainSettings({ tournament }) {
  const [rows, setRows] = useState(null);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const chk = input.trim() ? checkDomain(input) : null;
  const load = () => dataService.fetchTournamentDomains(tournament.id).then(setRows).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [tournament.id]);
  const run = async (key, fn, okText) => {
    setBusy(key); setMsg(null);
    try { const r = await fn(); if (okText) setMsg({ ok: true, text: typeof okText === 'function' ? okText(r) : okText }); await load(); } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(null); }
  };
  const add = () => run('add', () => dataService.addTournamentDomain(tournament.id, input).then((r) => { setInput(''); return r; }), 'Added. Now do the two steps below.');
  const check = (id) => run(`c${id}`, () => dataService.verifyTournamentDomain(id), (r) => (r.status === 'verified' ? 'Connected. Your tournament website now opens on this address.' : (r.error || 'The record was not found yet.')));
  const remove = (r) => { if (window.confirm(`Remove ${r.domain}?`)) run(`r${r.id}`, () => dataService.removeTournamentDomain(r.id), 'Removed.'); };
  return (
    <Card title="Your own web address" subtitle="Show this tournament's website on an address you own, such as cup.myclub.com">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="cup.myclub.com" maxLength={253} style={inp} aria-label="Web address" />
          <Button size="sm" variant="primary" disabled={busy === 'add' || !chk?.ok} onClick={add}>{busy === 'add' ? 'Adding…' : 'Add'}</Button>
        </div>
        {chk && !chk.ok && <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{chk.reason}</span>}
        {chk?.ok && chk.domain !== input.trim().toLowerCase() && <span style={note}>Will be saved as <strong>{chk.domain}</strong></span>}
        {(rows || []).map((r) => {
          const s = dnsSteps(r.domain, r.token);
          return (
            <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.92rem' }}>{r.domain}</strong>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: COLOUR[r.status] }}>{STATUS_TEXT[r.status] || r.status}</span>
              </div>
              {r.status !== 'verified' && (
                <div style={{ ...note, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span><strong>Step 1.</strong> In your domain provider's DNS page, add a <strong>TXT</strong> record. Name: <span style={code}>{s.txtName}</span> Value: <span style={code}>{s.txtValue}</span></span>
                  <span><strong>Step 2.</strong> In your hosting panel (Hostinger), add <strong>{r.domain}</strong> as an extra website address that shows this same site, and point the domain's DNS to the hosting as the panel tells you.</span>
                  <span>Then press Check. DNS changes can take from a few minutes to a few hours.</span>
                  {r.last_error && <span style={{ color: '#b45309' }}>Last check: {r.last_error}</span>}
                </div>
              )}
              {r.status === 'verified' && <span style={note}>Proven yours on {r.verified_at ? new Date(r.verified_at).toLocaleDateString() : 'an earlier date'}. Open <a href={`https://${r.domain}`} target="_blank" rel="noopener noreferrer">https://{r.domain}</a> to see it (works once the hosting step is done).</span>}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {r.status !== 'verified' && <Button size="sm" variant="secondary" disabled={busy === `c${r.id}`} onClick={() => check(r.id)}>{busy === `c${r.id}` ? 'Checking…' : 'Check now'}</Button>}
                <Button size="sm" variant="secondary" disabled={busy === `r${r.id}`} onClick={() => remove(r)}>Remove</Button>
              </div>
            </div>
          );
        })}
        {rows && rows.length === 0 && <span style={note}>No address added yet.</span>}
        {msg && <div style={{ fontSize: '0.82rem', color: msg.ok ? '#059669' : '#b91c1c' }}>{msg.text}</div>}
        <span style={note}>Up to 3 addresses. Only the first person to prove they own an address can use it. This platform cannot change your DNS or hosting for you: those two steps are done at your domain provider and hosting.</span>
      </div>
    </Card>
  );
}

export default DomainSettings;
