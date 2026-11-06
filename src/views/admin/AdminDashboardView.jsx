import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  ShieldCheck,
  Trophy,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter
} from 'lucide-react';

export function AdminDashboardView() {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await dataService.fetchAdminQueue();
      setQueue(data);
    } catch (err) {
      console.error('Failed to load admin queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (itemId, type, resolution) => {
    try {
      await dataService.resolveAdminQueueItem({ id: itemId, type, resolution, notes: 'Approved via Admin Console' });
      setActionNotice(`Action confirmed: ${resolution.toUpperCase()} applied to item ${itemId}.`);
      setTimeout(() => setActionNotice(null), 3500);

      // Locally update state for responsive feel
      if (type === 'tournament') {
        setQueue((prev) => ({
          ...prev,
          pending_tournaments: prev.pending_tournaments.filter((t) => t.id !== itemId)
        }));
      } else if (type === 'team') {
        setQueue((prev) => ({
          ...prev,
          pending_team_sanctions: prev.pending_team_sanctions.filter((tm) => tm.id !== itemId)
        }));
      } else if (type === 'dispute') {
        setQueue((prev) => ({
          ...prev,
          active_disputes: prev.active_disputes.filter((d) => d.id !== itemId)
        }));
      }
    } catch (err) {
      console.error('Failed to resolve queue item:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Loading Admin Operations Desk...
      </div>
    );
  }

  const tournamentCount = queue?.pending_tournaments?.length || 0;
  const teamCount = queue?.pending_team_sanctions?.length || 0;
  const disputeCount = queue?.active_disputes?.length || 0;
  const totalPending = tournamentCount + teamCount + disputeCount;

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
            <Badge variant="primary">FEATURE #258</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              League Administration
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            Admin Dashboard
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Operational queues for tournament sanctions, team eligibility verification, and match disputes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: '#f1f5f9',
            borderRadius: '0.5rem',
            fontSize: '0.825rem',
            fontWeight: 600,
            color: '#334155'
          }}>
            Queue Items: <strong style={{ color: totalPending > 0 ? '#b91c1c' : '#15803d' }}>{totalPending}</strong>
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          color: '#166534',
          fontSize: '0.85rem'
        }}>
          <CheckCircle size={16} />
          {actionNotice}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setFilterTab('all')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: filterTab === 'all' ? '#0f172a' : 'transparent',
            color: filterTab === 'all' ? '#ffffff' : '#64748b',
            border: 'none'
          }}
        >
          All Items ({totalPending})
        </button>
        <button
          onClick={() => setFilterTab('tournaments')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: filterTab === 'tournaments' ? '#0f172a' : 'transparent',
            color: filterTab === 'tournaments' ? '#ffffff' : '#64748b',
            border: 'none'
          }}
        >
          Tournaments ({tournamentCount})
        </button>
        <button
          onClick={() => setFilterTab('teams')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: filterTab === 'teams' ? '#0f172a' : 'transparent',
            color: filterTab === 'teams' ? '#ffffff' : '#64748b',
            border: 'none'
          }}
        >
          Team Sanctions ({teamCount})
        </button>
        <button
          onClick={() => setFilterTab('disputes')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: filterTab === 'disputes' ? '#0f172a' : 'transparent',
            color: filterTab === 'disputes' ? '#ffffff' : '#64748b',
            border: 'none'
          }}
        >
          Match Disputes ({disputeCount})
        </button>
      </div>

      {/* 1. Pending Tournaments Section */}
      {(filterTab === 'all' || filterTab === 'tournaments') && (
        <Card title={`Pending Tournament Sanctions (${tournamentCount})`}>
          {tournamentCount === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No pending tournament applications awaiting sanction.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {queue.pending_tournaments.map((trn) => (
                <div key={trn.id} style={{
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Trophy size={16} style={{ color: '#d97706' }} />
                      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{trn.name}</strong>
                      <Badge variant="warning">Awaiting Sanction</Badge>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                      Organiser: {trn.applicant} • Ground: {trn.grounds} • {trn.dates} ({trn.teams} Teams)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="primary"
                      onClick={() => handleAction(trn.id, 'tournament', 'sanctioned')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      Sanction
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleAction(trn.id, 'tournament', 'rejected')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 2. Pending Team Sanctions */}
      {(filterTab === 'all' || filterTab === 'teams') && (
        <Card title={`Pending Team Roster Sanctions (${teamCount})`}>
          {teamCount === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No team roster verification requests pending.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {queue.pending_team_sanctions.map((tm) => (
                <div key={tm.id} style={{
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={16} style={{ color: '#0284c7' }} />
                      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{tm.team_name}</strong>
                      <Badge variant={tm.fee_status === 'Paid' ? 'success' : 'warning'}>
                        {tm.fee_status}
                      </Badge>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                      Owner: {tm.owner} • Roster Size: {tm.roster_count} Players
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="primary"
                      onClick={() => handleAction(tm.id, 'team', 'approved')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      Approve Roster
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleAction(tm.id, 'team', 'clarification_requested')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      Request Info
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 3. Match Disputes */}
      {(filterTab === 'all' || filterTab === 'disputes') && (
        <Card title={`Active Match Disputes (${disputeCount})`}>
          {disputeCount === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No active match disputes filed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {queue.active_disputes.map((d) => (
                <div key={d.id} style={{
                  padding: '1rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={16} style={{ color: '#d97706' }} />
                      <strong style={{ fontSize: '0.95rem', color: '#92400e' }}>{d.match}</strong>
                      <Badge variant="warning">{d.status}</Badge>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#78350f', marginTop: '0.35rem' }}>
                      Raised By: {d.raised_by} • Issue: {d.reason}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="primary"
                      onClick={() => handleAction(d.id, 'dispute', 'dismissed')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      Uphold Decision
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleAction(d.id, 'dispute', 'scheduled')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      Open Hearing
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

