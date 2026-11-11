import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  ShieldAlert,
  Server,
  Activity,
  Cpu,
  HardDrive,
  Users,
  Radio,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Bell
} from 'lucide-react';

export function SuperAdminDashboardView() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLevel, setBroadcastLevel] = useState('info');
  const [broadcastStatus, setBroadcastStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await dataService.fetchSuperAdminMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load super admin metrics:', err);
      setLoadError(err.message || 'Could not load the Super-Admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMaintenance = async () => {
    if (!metrics) return;
    const targetState = !metrics.maintenance_mode;
    setMaintenanceLoading(true);
    setActionError(null);
    try {
      await dataService.togglePlatformMaintenance(targetState);
      setMetrics((prev) => ({ ...prev, maintenance_mode: targetState }));
    } catch (err) {
      console.error('Failed to toggle maintenance mode:', err);
      setActionError(err.message || 'Could not change maintenance mode.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e?.preventDefault();
    if (!broadcastMessage.trim()) return;

    try {
      const res = await dataService.setGlobalBroadcast({
        message: broadcastMessage.trim(),
        level: broadcastLevel
      });
      setBroadcastStatus('Global announcement active and broadcast across all views.');
      setBroadcastMessage('');
      setMetrics((prev) => ({ ...prev, broadcast_banner: res.broadcast }));
      setTimeout(() => setBroadcastStatus(null), 4000);
    } catch (err) {
      console.error('Failed to dispatch broadcast:', err);
      setActionError(err.message || 'Could not publish the announcement.');
    }
  };

  const handleClearBroadcast = async () => {
    try {
      await dataService.setGlobalBroadcast(null);
      setMetrics((prev) => ({ ...prev, broadcast_banner: null }));
    } catch (err) {
      console.error('Failed to clear broadcast:', err);
      setActionError(err.message || 'Could not clear the announcement.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Loading Super-Admin Platform Telemetry...
      </div>
    );
  }

  if (loadError) {
    return (
      <Card>
        <div style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={32} style={{ color: '#dc2626' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Super-Admin access required</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', maxWidth: '440px' }}>
            {loadError} Sign in with a Super-Admin account to use this dashboard.
          </p>
          <Button variant="outline" onClick={loadMetrics}>Try Again</Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {actionError && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.85rem' }}>
          {actionError}
        </div>
      )}
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: '#0f172a',
        borderRadius: '0.75rem',
        color: '#ffffff'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Platform Master Console
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
            Super-Admin Dashboard
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>
            Root governance, global cluster health, maintenance toggles, and tenant administration.
          </p>
        </div>

        {/* Maintenance Toggle Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Platform State:</div>
            <div style={{
              fontWeight: 700,
              fontSize: '0.85rem',
              color: metrics?.maintenance_mode ? '#f87171' : '#4ade80'
            }}>
              {metrics?.maintenance_mode ? 'MAINTENANCE MODE' : 'LIVE & OPERATIONAL'}
            </div>
          </div>
          <Button
            variant={metrics?.maintenance_mode ? 'primary' : 'danger'}
            onClick={handleToggleMaintenance}
            disabled={maintenanceLoading}
            style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}
          >
            {maintenanceLoading ? 'Updating...' : metrics?.maintenance_mode ? 'Exit Maintenance' : 'Engage Maintenance'}
          </Button>
        </div>
      </div>

      {/* Global Broadcast Alert if Active */}
      {metrics?.broadcast_banner && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.25rem',
          backgroundColor: metrics.broadcast_banner.level === 'critical' ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${metrics.broadcast_banner.level === 'critical' ? '#fecaca' : '#bfdbfe'}`,
          borderRadius: '0.5rem',
          color: metrics.broadcast_banner.level === 'critical' ? '#b91c1c' : '#1d4ed8',
          fontSize: '0.875rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Radio size={16} />
            <strong>Active Platform Broadcast:</strong> {metrics.broadcast_banner.message}
          </div>
          <button
            onClick={handleClearBroadcast}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          >
            Dismiss [X]
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Accounts</span>
            <Users size={18} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            {metrics?.total_users}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem' }}>
            +{metrics?.new_users_7d ?? 0} new in the last 7 days
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Pending Verifications</span>
            <Activity size={18} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            {metrics?.pending_verifications ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            Awaiting review
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Suspended Accounts</span>
            <Cpu size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            {metrics?.suspended_users ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            Open reports: {metrics?.open_reports ?? 0}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Active Matches</span>
            <CheckCircle size={18} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            {metrics?.active_matches ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
          </div>
        </Card>
      </div>

      {/* Role Breakdown & Platform Broadcast Composer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Role Breakdown Table */}
        <Card title="Role Distribution Breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {metrics?.role_breakdown && Object.entries(metrics.role_breakdown).map(([roleKey, count]) => {
              const formattedName = roleKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div key={roleKey} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.375rem',
                  fontSize: '0.825rem'
                }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{formattedName}</span>
                  <Badge variant="primary">{count}</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Global Broadcast Composer */}
        <Card title="Global Platform Broadcast Dispatcher">
          <form onSubmit={handleSendBroadcast}>
            {broadcastStatus && (
              <div style={{
                padding: '0.6rem 0.8rem',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                marginBottom: '0.85rem'
              }}>
                {broadcastStatus}
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Broadcast Notification Banner
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="e.g. Scheduled platform maintenance at 11:00 PM IST. Live score recording will remain cached locally."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Severity:</label>
              <select
                value={broadcastLevel}
                onChange={(e) => setBroadcastLevel(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem'
                }}
              >
                <option value="info">Informational (Blue)</option>
                <option value="warning">Warning (Yellow)</option>
                <option value="critical">Critical / Emergency (Red)</option>
              </select>
            </div>

            <Button type="submit" variant="primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Bell size={15} />
              Dispatch Global Broadcast
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

