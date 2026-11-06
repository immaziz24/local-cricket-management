import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  Database,
  Download,
  HardDrive,
  ShieldCheck,
  RotateCcw,
  PlusCircle,
  CheckCircle,
  FileArchive
} from 'lucide-react';

export function DatabaseBackupView() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupType, setBackupType] = useState('Full Platform Snapshot');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await dataService.fetchDatabaseBackups();
      setBackups(data || []);
    } catch (err) {
      console.error('Failed to load database backups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await dataService.triggerDatabaseBackup({ type: backupType });
      setBackups((prev) => [res, ...prev]);
      setFeedback(`New snapshot generated: ${res.id} (${res.size}). Checksum verified.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to create backup:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleSimulateRestore = async (id) => {
    try {
      const res = await dataService.simulateBackupRestore(id);
      setFeedback(`Restore point test successful for ${id}: ${res.message}`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to simulate restore:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div style={{
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Badge variant="primary">FEATURE #268</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Data Resilience & Disaster Recovery
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            Database Backup Management
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Automated nightly snapshot archives, on-demand exports, and integrity verification.
          </p>
        </div>

        {/* Create Backup Control */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={backupType}
            onChange={(e) => setBackupType(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.825rem',
              border: '1px solid #cbd5e1',
              borderRadius: '0.375rem'
            }}
          >
            <option value="Full Platform Snapshot">Full Platform Snapshot</option>
            <option value="Scores & Match Center Data">Scores & Match Center Data</option>
            <option value="User Accounts & RBAC">User Accounts & RBAC</option>
          </select>
          <Button
            variant="primary"
            onClick={handleCreateBackup}
            disabled={creating}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
          >
            <PlusCircle size={15} />
            {creating ? 'Archiving...' : 'Trigger Backup'}
          </Button>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          color: '#166534',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={16} />
          {feedback}
        </div>
      )}

      {/* Backup Archives Table */}
      <Card title={`Available Backup Snapshots (${backups.length})`}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading database backup manifest...
          </div>
        ) : backups.length === 0 ? (
          <div style={{ padding: '1rem 0', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
            No backup archives found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {backups.map((b) => (
              <div key={b.id} style={{
                padding: '1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <FileArchive size={18} style={{ color: '#0284c7' }} />
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{b.id}</strong>
                    <Badge variant="success">{b.status}</Badge>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({b.size})</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
                    Type: <strong>{b.type}</strong> • Records: {b.records_count?.toLocaleString()} rows
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                    SHA-256: {b.checksum}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="secondary"
                    onClick={() => handleSimulateRestore(b.id)}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  >
                    <RotateCcw size={13} />
                    Test Restore Point
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

