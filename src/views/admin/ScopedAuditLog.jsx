import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';

/** #385 Activity log for one tournament / match / team, visible only to whoever manages it. */
export function ScopedAuditLog({ scope, id }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { dataService.listScopedAuditLogs(scope, id).then(setRows).catch((e) => setErr(e.message)); }, [scope, id]);
  const when = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  const nice = (a) => String(a || '').toLowerCase().replace(/_/g, ' ');
  return (
    <details style={{ marginTop: '0.75rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>Activity log</summary>
      {err ? <p style={{ fontSize: '0.83rem', color: '#b91c1c' }}>{err}</p> : !rows ? <p style={{ fontSize: '0.83rem', color: '#64748b' }}>Loading…</p> : rows.length === 0 ? <p style={{ fontSize: '0.83rem', color: '#94a3b8' }}>Nothing recorded yet.</p> : (
        <ul style={{ margin: '0.4rem 0 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 320, overflowY: 'auto' }}>
          {rows.map((r) => (
            <li key={r.id} style={{ fontSize: '0.8rem', color: '#334155', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.4rem', backgroundColor: '#f8fafc' }}>
              <strong>{r.actor_name}</strong> {nice(r.action)}{r.target_name ? ` (${r.target_name})` : ''} <span style={{ color: '#94a3b8' }}>· {when(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
