import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Flag, Search, Ban, CheckCircle, XCircle, AlertCircle, Unlock } from 'lucide-react';

/**
 * Feature #266 – User reporting and suspension
 * 1. Any signed-in user can report a member.
 * 2. Admins / Super-Admin review reports, suspend members (days or until further notice) and lift suspensions.
 */

const REASONS = [
  'Abusive or offensive behaviour',
  'Cheating or score tampering',
  'Fake account or impersonation',
  'Spam or scam',
  'Repeated late arrival / no-show',
  'Other'
];

const DURATIONS = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: 'Until further notice', days: null }
];

const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Notice({ msg }) {
  if (!msg) return null;
  const err = msg.tone === 'error';
  return (
    <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: err ? '#fef2f2' : '#f0fdf4', border: `1px solid ${err ? '#fecaca' : '#bbf7d0'}`, color: err ? '#b91c1c' : '#166534' }}>
      {err ? <AlertCircle size={16} /> : <CheckCircle size={16} />} {msg.text}
    </div>
  );
}

function MemberPicker({ value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (value || query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try { setResults((await dataService.searchMembers(query.trim())) || []); } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  if (value) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px solid #0f172a', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
        <strong>{value.display_name}</strong>
        <button type="button" onClick={() => { onChange(null); setQuery(''); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem' }}>Change</button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }}>
        <Search size={14} style={{ color: '#94a3b8' }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.85rem' }} />
      </div>
      {results.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', marginTop: '0.25rem', overflow: 'hidden' }}>
          {results.map((m) => (
            <button key={m.id} type="button" onClick={() => onChange(m)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
              {m.display_name}
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>No member found with that name.</div>
      )}
    </div>
  );
}

const fieldStyle = { width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' };

export function UserReportingSuspensionView() {
  // Report form (any user)
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState(REASONS[0]);
  const [reportText, setReportText] = useState('');
  const [reportMsg, setReportMsg] = useState(null);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [adminMsg, setAdminMsg] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendDays, setSuspendDays] = useState(7);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadAdmin(); }, []);

  const loadAdmin = async () => {
    try {
      const [r, s] = await Promise.all([dataService.fetchUserReports(), dataService.fetchActiveSuspensions()]);
      setReports(r || []);
      setSuspensions(s || []);
      setIsAdmin(true);
    } catch {
      setIsAdmin(false);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reportTarget) { setReportMsg({ tone: 'error', text: 'Please choose the member you want to report.' }); return; }
    setBusy(true);
    try {
      await dataService.reportUser(reportTarget.id, reportReason, reportText.trim());
      setReportMsg({ tone: 'success', text: `Thank you. Your report about ${reportTarget.display_name} was sent to the admins.` });
      setReportTarget(null); setReportText('');
      if (isAdmin) loadAdmin();
    } catch (err) {
      setReportMsg({ tone: 'error', text: err.message || 'Could not send the report. Please sign in first.' });
    } finally { setBusy(false); }
  };

  const closeReport = async (r, dismiss) => {
    setBusy(true);
    try {
      await dataService.resolveUserReport(r.id, dismiss, dismiss ? 'Dismissed by admin' : 'Action taken by admin');
      setAdminMsg({ tone: 'success', text: `Report about ${r.reported_user_name} ${dismiss ? 'dismissed' : 'marked resolved'}.` });
      await loadAdmin();
    } catch (err) {
      setAdminMsg({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  };

  const startSuspendFromReport = (r) => {
    setSuspendTarget({ id: r.reported_user_id, display_name: r.reported_user_name });
    setSuspendReason(r.reason || '');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const doSuspend = async (e) => {
    e.preventDefault();
    if (!suspendTarget || !suspendReason.trim()) { setAdminMsg({ tone: 'error', text: 'Choose a member and write a reason.' }); return; }
    if (!window.confirm(`Suspend ${suspendTarget.display_name}?`)) return;
    setBusy(true);
    try {
      await dataService.suspendUserAccount({ userId: suspendTarget.id, userName: suspendTarget.display_name, reason: suspendReason.trim(), days: suspendDays });
      setAdminMsg({ tone: 'success', text: `${suspendTarget.display_name} has been suspended and notified.` });
      setSuspendTarget(null); setSuspendReason('');
      await loadAdmin();
    } catch (err) {
      setAdminMsg({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  };

  const doLift = async (s) => {
    if (!window.confirm(`Lift the suspension for ${s.user_name}?`)) return;
    setBusy(true);
    try {
      await dataService.liftSuspension(s.id, 'Lifted by admin');
      setAdminMsg({ tone: 'success', text: `${s.user_name} can use the platform again.` });
      await loadAdmin();
    } catch (err) {
      setAdminMsg({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  };

  const openReports = reports.filter((r) => ['submitted', 'under_review'].includes(r.status));
  const shownReports = showAll ? reports : openReports;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keep the community safe</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>Report & Suspend</h2>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
          Anyone can report a member who misbehaves. Admins review reports and can suspend accounts.
        </p>
      </div>

      {/* Report a member */}
      <Card title="Report a member">
        <form onSubmit={submitReport} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <MemberPicker value={reportTarget} onChange={setReportTarget} placeholder="Type the member's name (at least 2 letters)" />
          <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} style={fieldStyle}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={2} maxLength={1000} placeholder="What happened? (optional)" style={fieldStyle} />
          <div>
            <Button type="submit" variant="primary" disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Flag size={14} /> Send report
            </Button>
          </div>
          <Notice msg={reportMsg} />
        </form>
      </Card>

      {!isAdmin ? (
        <Card title="Admin tools">
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Only Admins and the Super-Admin can review reports and suspend members.</p>
        </Card>
      ) : (
        <>
          <Notice msg={adminMsg} />

          {/* Reports queue */}
          <Card title={`Reports · ${openReports.length} open`}>
            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'inline-flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show closed reports too
            </label>
            {shownReports.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>No reports.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {shownReports.map((r) => {
                  const isOpen = ['submitted', 'under_review'].includes(r.status);
                  return (
                    <div key={r.id} style={{ padding: '0.8rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span><strong>{r.reported_user_name}</strong> <span style={{ color: '#64748b', fontSize: '0.85rem' }}>· {r.reason || r.incident_type}</span></span>
                        <Badge variant={isOpen ? 'warning' : 'neutral'}>{String(r.status).replace('_', ' ')}</Badge>
                      </div>
                      {r.description && <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: '0.3rem' }}>{r.description}</div>}
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                        Reported by {r.reporter_name || r.reported_by} · {fmt(r.created_at || r.date)}
                        {r.reported_account_status === 'suspended' && <span style={{ color: '#b91c1c', fontWeight: 600 }}> · currently suspended</span>}
                      </div>
                      {isOpen && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                          <Button variant="danger" disabled={busy} onClick={() => startSuspendFromReport(r)} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Ban size={13} /> Suspend member
                          </Button>
                          <Button variant="primary" disabled={busy} onClick={() => closeReport(r, false)} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle size={13} /> Mark resolved
                          </Button>
                          <Button variant="secondary" disabled={busy} onClick={() => closeReport(r, true)} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <XCircle size={13} /> Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Active suspensions */}
          <Card title={`Suspended members · ${suspensions.length}`}>
            {suspensions.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>Nobody is suspended.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {suspensions.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.65rem 0.85rem', border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                    <span>
                      <strong>{s.user_name}</strong> · {s.reason}
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                        Since {fmt(s.starts_at || s.start_date)} · {s.ends_at || s.end_date ? `until ${fmt(s.ends_at || s.end_date)}` : 'until further notice'} · by {s.issued_by_name || s.imposed_by}
                      </span>
                    </span>
                    <Button variant="secondary" disabled={busy} onClick={() => doLift(s)} style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Unlock size={13} /> Lift suspension
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Suspend a member */}
          <Card title="Suspend a member">
            <form onSubmit={doSuspend} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <MemberPicker value={suspendTarget} onChange={setSuspendTarget} placeholder="Type the member's name" />
              <input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} maxLength={300} placeholder="Reason (shown to the member)" style={fieldStyle} />
              <select value={suspendDays === null ? 'none' : String(suspendDays)} onChange={(e) => setSuspendDays(e.target.value === 'none' ? null : Number(e.target.value))} style={fieldStyle}>
                {DURATIONS.map((d) => <option key={d.label} value={d.days === null ? 'none' : String(d.days)}>{d.label}</option>)}
              </select>
              <div>
                <Button type="submit" variant="danger" disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Ban size={14} /> Suspend
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}

export default UserReportingSuspensionView;
