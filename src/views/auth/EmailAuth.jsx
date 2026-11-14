import React, { useState } from 'react';
import { dataService } from '../../services/dataService';
import { BATTING_OPTIONS, BOWLING_OPTIONS, ROLE_OPTIONS } from '../teams/playerOptions';

export function EmailAuth({ register = false, onNavigate }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({});
  const fields = [['player_role', 'Playing role', ROLE_OPTIONS], ['batting_style', 'Batting style', BATTING_OPTIONS], ['bowling_style', 'Bowling style', BOWLING_OPTIONS]];
  async function submit(verify) {
    setBusy(true);
    setError('');
    try {
      if (verify) {
        const result = await dataService.verifySignupCode({ email, code });
        if (!result.signed_in) throw new Error('Please request a new sign-in code.');
        onNavigate('dashboard');
      } else {
        await dataService.requestEmailCode(email, register ? profile : null);
        setSent(true);
        setCode('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card" style={{ maxWidth: 480, margin: '1rem auto', padding: '1.25rem' }}>
      <h1>{register ? 'Create your Cricnotch account' : 'Sign in to Cricnotch'}</h1>
      <form style={{ display: 'grid', gap: '0.8rem' }} onSubmit={(event) => { event.preventDefault(); submit(sent); }}>
        {sent ? <>
          <p>Enter the six-digit code sent to {email}.</p>
          <label>Verification code <input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
        </> : <>
          {register && <label>Full name <input autoComplete="name" required maxLength={100} value={profile.full_name || ''} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} /></label>}
          <label>Email address <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {register && fields.map(([name, label, options]) => (
            <label key={name}>{label} <select required value={profile[name] || ''} onChange={(event) => setProfile({ ...profile, [name]: event.target.value })}>
              <option value="">Choose</option>
              {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select></label>
          ))}
          {register && <label><input type="checkbox" required /> I agree to the <a href="?page=terms" target="_blank" rel="noreferrer">Terms of Use</a></label>}
        </>}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="hdr-btn-primary" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify and sign in' : 'Send email code'}</button>
        {sent && <div>
          <button type="button" disabled={busy} onClick={() => submit(false)}>Resend code</button>
          <button type="button" disabled={busy} onClick={() => { setSent(false); setError(''); }}>Change email</button>
        </div>}
        <button type="button" disabled={busy} onClick={() => onNavigate(register ? 'login' : 'register')}>{register ? 'Already registered? Sign in' : 'New to Cricnotch? Create an account'}</button>
      </form>
    </section>
  );
}
