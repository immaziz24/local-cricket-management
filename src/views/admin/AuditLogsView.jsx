import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  FileText,
  Search,
  Filter,
  Download,
  ShieldAlert,
  Clock,
  Terminal
} from 'lucide-react';

export function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [exportNotice, setExportNotice] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [severityFilter, searchQuery]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await dataService.fetchAuditLogs({
        severity: severityFilter,
        query: searchQuery
      });
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(logs, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setExportNotice('Audit trail exported successfully as JSON.');
    setTimeout(() => setExportNotice(null), 3000);
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
            <Badge variant="primary">FEATURE #267</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Immutable Compliance Stream
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            Activity and Audit Logs
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Chronological audit trail recording authentication events, score corrections, and administrative decisions.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={handleExport}
          style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
        >
          <Download size={14} />
          Export Audit Trail (.JSON)
        </Button>
      </div>

      {exportNotice && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          color: '#166534',
          fontSize: '0.85rem'
        }}>
          {exportNotice}
        </div>
      )}

      {/* Filter Toolbar */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        backgroundColor: '#f8fafc',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ color: '#64748b' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, actor name, or match ID..."
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              border: '1px solid #cbd5e1',
              borderRadius: '0.375rem',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} style={{ color: '#64748b' }} />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '0.4rem 0.6rem',
              border: '1px solid #cbd5e1',
              borderRadius: '0.375rem',
              fontSize: '0.85rem'
            }}
          >
            <option value="all">All Severities</option>
            <option value="info">INFO</option>
            <option value="warning">WARNING</option>
            <option value="critical">CRITICAL</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <Card title={`System Audit Trail (${logs.length} events)`}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '1rem 0', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
            No audit records match the selected filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {logs.map((log) => {
              const badgeVariant =
                log.severity === 'CRITICAL' ? 'danger' : log.severity === 'WARNING' ? 'warning' : 'primary';
              return (
                <div key={log.id} style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  fontSize: '0.825rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Badge variant={badgeVariant}>{log.severity}</Badge>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {log.action} • <span style={{ fontWeight: 500, color: '#475569' }}>{log.details}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Actor: <strong>{log.actor}</strong> ({log.role}) • Target: {log.target} • IP: {log.ip_address}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={13} />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

