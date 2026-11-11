import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Search, Download, RefreshCw, ShieldAlert } from 'lucide-react';

/** Feature #267 – Activity and audit logs (Admin / Super-Admin). Read-only record of every important change. */

const ACTION_LABELS = {
  ROLE_ASSIGNED: 'Role given',
  ROLE_REVOKED: 'Role removed',
  ROLE_PERMISSION_CHANGED: 'Permission changed',
  ROLE_PERMISSIONS_RESET: 'Permissions reset',
  MAINTENANCE_MODE_CHANGED: 'Maintenance mode changed',
  BROADCAST_PUBLISHED: 'Announcement banner published',
  BROADCAST_CLEARED: 'Announcement banner cleared',
  VERIFICATION_REQUESTED: 'Badge requested',
  VERIFICATION_APPROVED: 'Badge approved',
  VERIFICATION_REJECTED: 'Badge rejected',
  USER_REPORTED: 'Member reported',
  REPORT_RESOLVED: 'Report resolved',
  REPORT_DISMISSED: 'Report dismissed',
  USER_SUSPENDED: 'Member suspended',
  SUSPENSION_LIFTED: 'Suspension lifted',
  PLATFORM_SNAPSHOT_EXPORTED: 'Backup exported',
  PERSONAL_DATA_EXPORTED: 'Personal data downloaded',
  ANNOUNCEMENT_SENT: 'Notification sent to all'
};

const label = (a) => ACTION_LABELS[a] || String(a || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const when = (v) => new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const detail = (row) => {
  const m = row.metadata || {};
  const parts = [];
  if (m.role) parts.push(`role: ${m.role}`);
  if (m.permission) parts.push(`${m.permission} → ${m.enabled ? 'on' : 'off'}`);
  if (m.type) parts.push(`badge: ${m.type}`);
  if (m.reason) parts.push(`reason: ${m.reason}`);
  if (m.days !== undefined && m.days !== null) parts.push(`${m.days} days`);
  if (m.enabled !== undefined && !m.permission) parts.push(m.enabled ? 'on' : 'off');
  if (m.message) parts.push(`"${m.message}"`);
  if (m.title) parts.push(`"${m.title}"`);
  if (m.recipients !== undefined) parts.push(`${m.recipients} recipients`);
  return parts.join(' · ');
};

export function AuditLogsView() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (q = search) => {
    setLoading(true);
    try {
      setRows((await dataService.fetchAuditLogs(q.trim(), 300)) || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  const exportCsv = () => {
    const header = ['When', 'Action', 'By', 'Affected member', 'Details'];
    const lines = rows.map((r) => [new Date(r.created_at).toISOString(), label(r.action), r.actor_name, r.target_name || '', detail(r)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) {
    return (
      <Card>
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <ShieldAlert size={30} style={{ color: '#dc2626' }} />
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.35rem 0 0.25rem' }}>Activity & Audit Log</h2>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
          Every important change — roles, badges, reports, suspensions, settings — is recorded here and cannot be edited.
        </p>
      </div>

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }}>
            <Search size={14} style={{ color: '#94a3b8' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by member name or action (e.g. SUSPENDED)" style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.85rem' }} />
          </div>
          <Button type="submit" variant="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={14} /> Search</Button>
          <Button type="button" variant="secondary" onClick={exportCsv} disabled={rows.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Download size={14} /> Export CSV</Button>
        </form>

        {loading ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>No activity recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.5rem' }}>When</th>
                  <th style={{ padding: '0.5rem' }}>What happened</th>
                  <th style={{ padding: '0.5rem' }}>By</th>
                  <th style={{ padding: '0.5rem' }}>Member affected</th>
                  <th style={{ padding: '0.5rem' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', color: '#64748b' }}>{when(r.created_at)}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 600, color: '#0f172a' }}>{label(r.action)}</td>
                    <td style={{ padding: '0.5rem' }}>{r.actor_name}</td>
                    <td style={{ padding: '0.5rem' }}>{r.target_name || '—'}</td>
                    <td style={{ padding: '0.5rem', color: '#475569' }}>{detail(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default AuditLogsView;
