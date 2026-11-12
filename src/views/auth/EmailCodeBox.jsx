import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { MailCheck } from 'lucide-react';

/** #254 After sign-up: type the 6-digit code from the email (the link in the same email works too). */
export function EmailCodeBox({ email, onVerified }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [wait, setWait] = useState(60);
  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { const r = await dataService.verifySignupCode({ email, code }); setMsg({ ok: true, text: 'Email confirmed. Welcome to Local Cricket!' }); onVerified && onVerified(r); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setMsg(null);
    try { await dataService.resendSignupCode(email); setMsg({ ok: true, text: 'A new code has been sent.' }); setWait(60); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={verify} style={{ width: '100%', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '0.8rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#166534' }}><MailCheck size={20} /> Enter the 6-digit code</div>
      <div style={{ fontSize: '0.84rem', color: '#475569', textAlign: 'center' }}>We sent a code to <strong>{email}</strong>. Type it here, or tap the link in the same email. Check Spam if you can't see it.</div>
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" autoFocus
        style={{ width: 200, textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.5rem', fontWeight: 800, padding: '0.5rem', border: '2px solid #86efac', borderRadius: '0.6rem', outline: 'none' }} />
      <button type="submit" className="btn btn-primary" disabled={busy || code.length < 6} style={{ minWidth: 200 }}>{busy ? 'Checking…' : 'Confirm my email'}</button>
      <button type="button" onClick={resend} disabled={busy || wait > 0} style={{ background: 'none', border: 'none', color: wait > 0 ? '#94a3b8' : '#2563eb', cursor: wait > 0 ? 'default' : 'pointer', fontSize: '0.82rem' }}>
        {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
      </button>
      {msg && <div style={{ fontSize: '0.84rem', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</div>}
    </form>
  );
}

export default EmailCodeBox;
