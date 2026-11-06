import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  ShieldAlert,
  AlertOctagon,
  Ban,
  UserX,
  RotateCcw,
  CheckCircle,
  FileText
} from 'lucide-react';

export function UserReportingSuspensionView() {
  const [reports, setReports] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [loading, setLoading] = useState(true);

  // New suspension form state
  const [targetUser, setTargetUser] = useState('');
  const [duration, setDuration] = useState('14 Days');
  const [reason, setReason] = useState('Code of Conduct Infraction');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reps, susps] = await Promise.all([
        dataService.fetchUserReports(),
        dataService.fetchActiveSuspensions()
      ]);
      setReports(reps || []);
      setSuspensions(susps || []);
    } catch (err) {
      console.error('Failed to load disciplinary reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuspension = async (e) => {
    e?.preventDefault();
    if (!targetUser.trim()) return;

    try {
      const res = await dataService.suspendUserAccount({
        userId: `usr-${Date.now().toString().slice(-4)}`,
        userName: targetUser.trim(),
        reason,
        duration
      });
      setSuspensions((prev) => [res, ...prev]);
      setFeedback(`Suspension imposed on ${targetUser} for ${duration}.`);
      setTargetUser('');
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to suspend user:', err);
    }
  };

  const handleLift = async (id) => {
    try {
      await dataService.liftSuspension(id);
      setSuspensions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'Lifted' } : s))
      );
      setFeedback(`Suspension ${id} lifted.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to lift suspension:', err);
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
            <Badge variant="danger">FEATURE #266</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Disciplinary & Code of Conduct Enforcement
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            User Reporting and Suspension
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Process umpire match incident reports, log disciplinary sanctions, and enforce player account suspensions.
          </p>
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

      {/* 2-Column: Incident Reports + Suspend Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Incident Reports Table */}
        <Card title={`Official Incident Reports (${reports.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {reports.map((r) => (
              <div key={r.id} style={{
                padding: '0.85rem',
                backgroundColor: '#fff1f2',
                border: '1px solid #ffe4e6',
                borderRadius: '0.5rem',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <strong style={{ color: '#9f1239' }}>{r.reported_user_name}</strong>
                  <Badge variant={r.severity === 'High' ? 'danger' : 'warning'}>
                    {r.severity} Severity
                  </Badge>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#881337', marginBottom: '0.25rem' }}>
                  <strong>{r.incident_type}</strong> • Reported by: {r.reported_by}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {r.description} ({r.match_ref})
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Apply Suspension Form */}
        <Card title="Impose Account Suspension">
          <form onSubmit={handleApplySuspension}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Player or Official Name
              </label>
              <input
                type="text"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="e.g. Vikram Singh"
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

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Suspension Period
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem'
                }}
              >
                <option value="7 Days">7 Days (1 League Match)</option>
                <option value="14 Days">14 Days (2 League Matches)</option>
                <option value="30 Days">30 Days (Tournament Phase)</option>
                <option value="Entire Season">Full Season Ban</option>
                <option value="Indefinite">Permanent Indefinite Suspension</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                Reason / Rule Violation
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Level 2 Code of Conduct: Umpire Dissent"
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

            <Button type="submit" variant="danger" style={{ width: '100%', justifyContent: 'center' }}>
              <Ban size={15} />
              Enforce Account Suspension
            </Button>
          </form>
        </Card>
      </div>

      {/* Active Suspensions Archive */}
      <Card title={`Active Disciplinary Suspensions (${suspensions.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {suspensions.map((s) => (
            <div key={s.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserX size={16} style={{ color: '#b91c1c' }} />
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{s.user_name}</strong>
                  <Badge variant={s.status === 'Active' ? 'danger' : 'default'}>{s.status}</Badge>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Duration: <strong>{s.duration}</strong> • Reason: {s.reason}
                </div>
              </div>

              {s.status === 'Active' && (
                <Button
                  variant="secondary"
                  onClick={() => handleLift(s.id)}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  <RotateCcw size={13} />
                  Lift Ban Early
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

