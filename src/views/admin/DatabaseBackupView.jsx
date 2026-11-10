import React, { useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Download, Database, Info, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Feature #268 – Database backup
 * Super-Admin can download a full JSON snapshot of platform data at any time.
 * Automatic daily backups and point-in-time restore are provided by Supabase on paid plans.
 */

const downloadJson = (obj, name) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export function DatabaseBackupView() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const runExport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const snap = await dataService.exportPlatformSnapshot();
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
      downloadJson(snap, `local-cricket-backup-${stamp}.json`);
      setMsg({ ok: true, text: `Backup downloaded: ${snap.profiles?.length ?? 0} members, ${snap.user_reports?.length ?? 0} reports, ${snap.audit_logs_last_1000?.length ?? 0} log entries. Keep the file somewhere safe (e.g. Google Drive).` });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
        <Badge variant="success">FEATURE #268</Badge>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.35rem 0 0.25rem' }}>Database Backup</h2>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>Download a copy of all platform data whenever you want.</p>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Database size={36} style={{ color: '#0284c7', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>Download backup now</h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
              Members, roles, permissions, badges, reports, suspensions, settings and the latest 1,000 log entries, as one JSON file. Super-Admin only. Every download is recorded in the audit log.
            </p>
            <Button variant="primary" onClick={runExport} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={14} /> {busy ? 'Preparing…' : 'Download backup'}
            </Button>
          </div>
        </div>
        {msg && (
          <div style={{ marginTop: '1rem', padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
            {msg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {msg.text}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.85rem', color: '#475569' }}>
          <Info size={18} style={{ color: '#64748b', flexShrink: 0 }} />
          <div>
            <strong>Automatic backups:</strong> the database runs on Supabase's free plan. Automatic daily backups with one-click restore come with Supabase's paid plan — recommended before the public launch. Until then, download a backup regularly (for example once a week).
          </div>
        </div>
      </Card>
    </div>
  );
}

export default DatabaseBackupView;
