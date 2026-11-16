import React, { useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';

export function TournamentAdmins({ tournamentId }) {
  const [open, setOpen] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [identifier, setIdentifier] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action, userId) {
    setBusy(true);
    setError('');
    if (action === 'lookup') setCandidate(null);
    try {
      const result = await dataService.manageTournamentAdmins(tournamentId, action, identifier.trim(), userId);
      if (action === 'lookup') setCandidate(result);
      else {
        setAdmins(result);
        if (action === 'grant') {
          setIdentifier('');
          setCandidate(null);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => {
        setOpen(!open);
        if (!open) run('list');
      }}>Tournament admins</Button>
      {open && <div>
        <form onSubmit={event => { event.preventDefault(); run('lookup'); }}>
          <label>
            Registered mobile number or email{' '}
            <input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} required disabled={busy} value={identifier}
              onChange={event => { setIdentifier(event.target.value); setCandidate(null); }} />
          </label>{' '}
          <Button type="submit" size="sm" disabled={busy}>Find account</Button>
        </form>
        {candidate && <p>
          Give {candidate.name} access to manage and score matches in this tournament?{' '}
          <Button type="button" size="sm" disabled={busy} onClick={() => run('grant', candidate.id)}>Make admin</Button>
        </p>}
        {admins.length > 0 && <ul>
          {admins.map(admin => <li key={admin.id}>
            {admin.name}{' '}
            <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={() => run('revoke', admin.id)}>Remove access</Button>
          </li>)}
        </ul>}
        {busy && <p role="status">Updating tournament admins…</p>}
        {error && <p role="alert">{error}</p>}
      </div>}
    </div>
  );
}
