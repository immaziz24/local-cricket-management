import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  UserCheck,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export function UserVerificationView() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await dataService.fetchVerificationQueue();
      setQueue(data || []);
    } catch (err) {
      console.error('Failed to load verification queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (id, status, reason = '') => {
    try {
      await dataService.processUserVerification({ id, status, rejectionReason: reason });
      setFeedback(`Application ${id} marked as ${status.toUpperCase()}.`);
      setTimeout(() => setFeedback(null), 3000);

      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status, rejection_reason: reason } : item))
      );
    } catch (err) {
      console.error('Failed to process verification:', err);
    }
  };

  const filteredItems = queue.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

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
            <Badge variant="success">FEATURE #265</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Identity & Credential Governance
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            User Verification Desk
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Audit and sanction official credentials for players, certified umpires, and official scorers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', 'pending', 'verified', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                backgroundColor: filter === f ? '#0f172a' : '#f1f5f9',
                color: filter === f ? '#ffffff' : '#475569',
                border: 'none'
              }}
            >
              {f}
            </button>
          ))}
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

      {/* Verification Queue Cards */}
      <Card title={`Submitted Documents Queue (${filteredItems.length})`}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            Loading verification requests...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '1rem 0', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
            No verification records match this filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredItems.map((item) => (
              <div key={item.id} style={{
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
                    <UserCheck size={18} style={{ color: '#0284c7' }} />
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{item.user_name}</strong>
                    <Badge variant={item.status === 'verified' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}>
                      {item.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                    Role: <strong>{item.role}</strong> • Club / Body: {item.club_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.2rem' }}>
                    Document: <strong>{item.document_type}</strong> ({item.document_number})
                  </div>
                </div>

                {item.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="primary"
                      onClick={() => handleProcess(item.id, 'verified')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      <CheckCircle size={14} />
                      Verify & Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleProcess(item.id, 'rejected', 'Document illegible')}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

