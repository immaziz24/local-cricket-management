import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  AlertCircle,
  Send
} from 'lucide-react';

/**
 * Feature #265 – User verification (optional badges)
 * 1. Any signed-in user can request a badge: Verified person, Verified umpire, Verified scorer.
 * 2. Admins and the Super-Admin review requests (approve / reject with a reason).
 * Nobody needs a badge to use the platform.
 */

const BADGES = {
  identity: { label: 'Verified person', hint: 'Confirms you are a real person (for example, name matches your ID).' },
  umpire: { label: 'Verified umpire', hint: 'For umpires with a certificate or association panel membership.' },
  scorer: { label: 'Verified scorer', hint: 'For scorers with a certificate or association experience.' }
};

const STATUS_BADGE = {
  pending: { variant: 'warning', label: 'Waiting for review' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Not approved' },
  expired: { variant: 'neutral', label: 'Expired' }
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Notice({ tone = 'success', children }) {
  const colors = tone === 'error'
    ? { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
    : { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' };
  return (
    <div style={{ padding: '0.75rem 1rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '0.5rem', color: colors.text, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {tone === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      {children}
    </div>
  );
}

export function UserVerificationView() {
  // My requests
  const [mine, setMine] = useState([]);
  const [requestType, setRequestType] = useState('identity');
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myMessage, setMyMessage] = useState(null);

  // Admin queue
  const [queue, setQueue] = useState([]);
  const [queueError, setQueueError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [reasons, setReasons] = useState({});
  const [reviewMessage, setReviewMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadMine = async () => {
    try {
      setMine((await dataService.fetchMyVerifications()) || []);
    } catch (err) {
      console.error('Failed to load my verifications:', err);
    }
  };

  const loadQueue = async () => {
    try {
      setQueue((await dataService.fetchVerificationQueue()) || []);
      setQueueError(null);
    } catch (err) {
      setQueueError(err.message || 'Could not load the review queue.');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadMine(), loadQueue()]);
    setLoading(false);
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMyMessage(null);
    try {
      await dataService.requestVerification(requestType, requestNote.trim());
      setMyMessage({ tone: 'success', text: `Request sent for the "${BADGES[requestType].label}" badge. An admin will review it.` });
      setRequestNote('');
      await Promise.all([loadMine(), loadQueue()]);
    } catch (err) {
      setMyMessage({ tone: 'error', text: err.message || 'Could not send the request. Please sign in first.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (item, approve) => {
    const note = (reasons[item.id] || '').trim();
    if (!approve && !note) {
      setReviewMessage({ tone: 'error', text: 'Please write a reason before rejecting.' });
      return;
    }
    try {
      await dataService.processUserVerification({ id: item.id, approve, note });
      setReviewMessage({
        tone: 'success',
        text: `${item.user_name}: ${approve ? 'approved' : 'not approved'} (${BADGES[item.verification_type]?.label || item.verification_type}). They have been notified.`
      });
      setReasons((prev) => ({ ...prev, [item.id]: '' }));
      await Promise.all([loadQueue(), loadMine()]);
    } catch (err) {
      setReviewMessage({ tone: 'error', text: err.message || 'Could not save the review.' });
    }
  };

  const filtered = queue.filter((q) => filter === 'all' || q.status === filter);
  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const myBadges = mine.filter((m) => m.status === 'approved');

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading verification…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Optional verified badges
          </span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>User Verification</h2>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
          Anyone can use the platform without a badge. A badge simply shows others that an admin has checked you.
        </p>
      </div>

      {/* Part 1: my badges and requests */}
      <Card title="Get verified">
        {myBadges.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {myBadges.map((b) => (
              <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '999px', color: '#065f46', fontWeight: 700, fontSize: '0.8rem' }}>
                <ShieldCheck size={14} /> {BADGES[b.verification_type]?.label}
              </span>
            ))}
          </div>
        )}

        <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {Object.entries(BADGES).map(([key, b]) => (
              <label key={key} style={{ display: 'flex', gap: '0.5rem', padding: '0.7rem', border: `1px solid ${requestType === key ? '#0f172a' : '#e2e8f0'}`, borderRadius: '0.5rem', cursor: 'pointer', backgroundColor: requestType === key ? '#f8fafc' : '#ffffff' }}>
                <input type="radio" name="badge" value={key} checked={requestType === key} onChange={() => setRequestType(key)} />
                <span>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{b.label}</strong>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{b.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Optional note for the admin, e.g. certificate number, association or club name"
            style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div>
            <Button type="submit" variant="primary" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Send size={14} /> {submitting ? 'Sending…' : 'Request badge'}
            </Button>
          </div>
        </form>

        {myMessage && <div style={{ marginTop: '0.75rem' }}><Notice tone={myMessage.tone}>{myMessage.text}</Notice></div>}

        {mine.length > 0 && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>My requests</div>
            {mine.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                <span>{BADGES[m.verification_type]?.label || m.verification_type} · <span style={{ color: '#64748b' }}>{formatDate(m.submitted_at)}</span></span>
                <Badge variant={STATUS_BADGE[m.status]?.variant}>{STATUS_BADGE[m.status]?.label || m.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Part 2: admin review */}
      {queueError ? (
        <Card title="Review requests (Admins)">
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Only Admins and the Super-Admin can review requests.
          </p>
        </Card>
      ) : (
        <Card title={`Review requests (Admins) · ${pendingCount} waiting`}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {['pending', 'approved', 'rejected', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', backgroundColor: filter === f ? '#0f172a' : '#f1f5f9', color: filter === f ? '#ffffff' : '#475569', border: 'none' }}
              >
                {f}
              </button>
            ))}
          </div>

          {reviewMessage && <div style={{ marginBottom: '0.75rem' }}><Notice tone={reviewMessage.tone}>{reviewMessage.text}</Notice></div>}

          {filtered.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              Nothing here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filtered.map((item) => (
                <div key={item.id} style={{ padding: '0.85rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <UserCheck size={16} style={{ color: '#64748b' }} />
                      <strong style={{ color: '#0f172a' }}>{item.user_name}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>wants: {BADGES[item.verification_type]?.label || item.verification_type}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Clock size={12} /> {formatDate(item.submitted_at)}
                      </span>
                      <Badge variant={STATUS_BADGE[item.status]?.variant}>{STATUS_BADGE[item.status]?.label || item.status}</Badge>
                    </span>
                  </div>

                  <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: '0.4rem' }}>
                    <strong>Note:</strong> {item.note || <span style={{ color: '#94a3b8' }}>No note given</span>}
                  </div>
                  {item.review_note && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                      <strong>Review note:</strong> {item.review_note}{item.reviewer_name ? ` — ${item.reviewer_name}` : ''}
                    </div>
                  )}

                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <input
                        value={reasons[item.id] || ''}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Note (required if rejecting)"
                        style={{ flex: 1, minWidth: '200px', padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem' }}
                      />
                      <Button variant="primary" onClick={() => handleReview(item, true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                        <CheckCircle size={14} /> Approve
                      </Button>
                      <Button variant="secondary" onClick={() => handleReview(item, false)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                        <XCircle size={14} /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default UserVerificationView;
