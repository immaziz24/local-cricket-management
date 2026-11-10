import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Users,
  UserPlus,
  AlertTriangle,
  BadgeCheck,
  Clock,
  RefreshCw
} from 'lucide-react';

/**
 * Feature #258 – Admin Dashboard
 * Daily operations desk for Admins and the Super-Admin.
 * Real data today: members, recent sign-ups, verification requests, user reports.
 * Tournament approvals, team sanctions and match disputes appear here once
 * those features exist (Phase 2 and Phase 4).
 */

const ROLE_LABELS = {
  super_admin: 'Super-Admin',
  admin: 'Admin',
  organiser: 'Organiser',
  team_owner: 'Team Owner',
  captain: 'Captain',
  scorer: 'Scorer',
  umpire: 'Umpire',
  player: 'Player'
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const titleCase = (text) =>
  String(text || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function StatCard({ label, value, note, icon: Icon, color }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{label}</span>
        <Icon size={18} style={{ color }} />
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{note}</div>
    </Card>
  );
}

function EmptyRow({ children }) {
  return (
    <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
      {children}
    </div>
  );
}

export function AdminDashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await dataService.fetchAdminDashboard();
      setData(result);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      setLoadError(err.message || 'Could not load the Admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Loading Admin Operations Desk...
      </div>
    );
  }

  if (loadError) {
    return (
      <Card>
        <div style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={32} style={{ color: '#dc2626' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Admin access required</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', maxWidth: '440px' }}>
            {loadError} Sign in with an Admin or Super-Admin account to use this dashboard.
          </p>
          <Button variant="outline" onClick={loadDashboard}>Try Again</Button>
        </div>
      </Card>
    );
  }

  const recentUsers = data?.recent_users || [];
  const verifications = data?.pending_verification_items || [];
  const reports = data?.open_report_items || [];
  const needsAttention = (data?.pending_verifications || 0) + (data?.open_reports || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
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
            <Badge variant="warning">FEATURE #258</Badge>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin Operations Desk
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Admin Dashboard</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
            Members, verification requests and user reports that need an admin.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Needs attention</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: needsAttention ? '#fbbf24' : '#4ade80' }}>
              {needsAttention ? `${needsAttention} item${needsAttention > 1 ? 's' : ''}` : 'All clear'}
            </div>
          </div>
          <Button variant="outline" onClick={loadDashboard} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <StatCard label="Total Members" value={data?.total_users ?? 0} note={`+${data?.new_users_7d ?? 0} joined in the last 7 days`} icon={Users} color="#0284c7" />
        <StatCard label="Verification Requests" value={data?.pending_verifications ?? 0} note="Waiting for review (#265)" icon={BadgeCheck} color="#16a34a" />
        <StatCard label="Open User Reports" value={data?.open_reports ?? 0} note="Waiting for review (#266)" icon={AlertTriangle} color="#d97706" />
        <StatCard label="Suspended Accounts" value={data?.suspended_users ?? 0} note="Currently suspended" icon={ShieldCheck} color="#8b5cf6" />
      </div>

      {/* Recent members */}
      <Card title="Recent Sign-ups">
        {recentUsers.length === 0 ? (
          <EmptyRow>No members yet.</EmptyRow>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Joined</th>
                  <th style={{ padding: '0.5rem' }}>Roles</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <UserPlus size={14} style={{ color: '#94a3b8' }} />
                        {u.display_name}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#64748b' }}>{formatDate(u.created_at)}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      {(u.roles || []).length === 0 ? (
                        <span style={{ color: '#94a3b8' }}>Member</span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {u.roles.map((r) => (
                            <Badge key={r} variant="primary">{ROLE_LABELS[r] || titleCase(r)}</Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <Badge variant={u.account_status === 'active' ? 'success' : 'danger'}>{titleCase(u.account_status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Queues */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <Card title="Verification Requests (#265)">
          {verifications.length === 0 ? (
            <EmptyRow>No verification requests waiting.</EmptyRow>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {verifications.map((v) => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                  <span><strong>{v.user_name}</strong> · {titleCase(v.verification_type)}</span>
                  <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> {formatDate(v.submitted_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            Approve or reject in the User Governance tab once #265 is connected.
          </p>
        </Card>

        <Card title="Open User Reports (#266)">
          {reports.length === 0 ? (
            <EmptyRow>No open reports.</EmptyRow>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {reports.map((r) => (
                <div key={r.id} style={{ padding: '0.6rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{r.reported_user_name}</strong>
                    <Badge variant="warning">{titleCase(r.status)}</Badge>
                  </div>
                  <div style={{ color: '#64748b', marginTop: '0.2rem' }}>
                    {r.reason} · reported by {r.reporter_name} · {formatDate(r.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            Review and suspend in the User Governance tab once #266 is connected.
          </p>
        </Card>
      </div>

      {/* Coming later */}
      <Card title="Coming with later phases">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {[
            { icon: Trophy, title: 'Tournament approvals', when: 'Phase 2 · tournament management (#31–58)' },
            { icon: Users, title: 'Team registrations to approve', when: 'Phase 2 · team approval (#41)' },
            { icon: AlertTriangle, title: 'Match disputes', when: 'Phase 4 · dispute management (#143)' }
          ].map(({ icon: Icon, title, when }) => (
            <div key={title} style={{ padding: '0.85rem', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#334155' }}>
                <Icon size={15} /> {title}
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>{when}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default AdminDashboardView;
