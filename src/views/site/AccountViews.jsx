import React, { useEffect, useState } from 'react';
import { Lock, Bell, BadgeCheck, Flag, LayoutDashboard, Mail, Shield, FileText, Database, Megaphone, Users, Newspaper } from 'lucide-react';
import { dataService } from '../../services/dataService.js';
import { SuperAdminDashboardView } from '../admin/SuperAdminDashboardView.jsx';
import { AdminDashboardView } from '../admin/AdminDashboardView.jsx';
import { RolePermissionsView } from '../admin/RolePermissionsView.jsx';
import { UserVerificationView } from '../admin/UserVerificationView.jsx';
import { UserReportingSuspensionView } from '../admin/UserReportingSuspensionView.jsx';
import { AuditLogsView } from '../admin/AuditLogsView.jsx';
import { DatabaseBackupView } from '../admin/DatabaseBackupView.jsx';
import { SecurityPrivacyView } from '../admin/SecurityPrivacyView.jsx';
import { NotificationsManagementView } from '../admin/NotificationsManagementView.jsx';
import { AdsPanel } from '../brand/AdsPanel.jsx';
import { CampaignModeration } from '../brand/CampaignModeration.jsx';
import { ReportedArticlesPanel } from '../news/NewsLearnViews.jsx';

/** Settings & Privacy (every member) and Admin Panel (Admin / Super-Admin). */
function Tabs({ tabs, tab, setTab }) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', marginBottom: '1.2rem' }}>
      {tabs.map(([id, label, Icon]) => (
        <button key={id} type="button" onClick={() => setTab(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.6rem 0.9rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: tab === id ? '#065f46' : '#64748b', borderBottom: `3px solid ${tab === id ? '#059669' : 'transparent'}`, marginBottom: -1 }}>
          <Icon size={16} /> {label}
        </button>
      ))}
    </div>
  );
}

function PageTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{title}</h1>
      {sub && <p style={{ margin: '0.25rem 0 0', color: '#64748b' }}>{sub}</p>}
    </div>
  );
}

export function SettingsView({ currentUser, onNavigate }) {
  const [tab, setTab] = useState('privacy');
  if (!currentUser) return <div className="info-box">Please <button type="button" className="home-link" onClick={() => onNavigate('login')}>log in</button> to see your settings.</div>;
  return (
    <div>
      <PageTitle title="Settings & Privacy" sub="Control who sees your details, what you are notified about, and your account safety." />
      <Tabs tab={tab} setTab={setTab} tabs={[['privacy', 'Privacy & security', Lock], ['notifications', 'Notifications', Bell], ['verify', 'Verification badge', BadgeCheck], ['report', 'Report a member', Flag]]} />
      {tab === 'privacy' && <SecurityPrivacyView />}
      {tab === 'notifications' && <NotificationsManagementView />}
      {tab === 'verify' && <UserVerificationView />}
      {tab === 'report' && <UserReportingSuspensionView />}
    </div>
  );
}

const TOPIC = { general: 'General', support: 'Support', organiser: 'Organiser', ground: 'Ground / academy', sponsor: 'Sponsorship', report: 'Report', privacy: 'Privacy request' };

export function ContactMessagesPanel() {
  const [filter, setFilter] = useState('');
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => dataService.listContactMessages(filter || null).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [filter]);
  const set = async (id, status) => { try { await dataService.setContactMessageStatus(id, status); load(); } catch (e) { setErr(e.message); } };
  return (
    <div className="info-box">
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        {[['', 'All'], ['new', 'New'], ['read', 'Read'], ['replied', 'Replied'], ['closed', 'Closed']].map(([k, l]) => (
          <button key={k || 'all'} type="button" onClick={() => setFilter(k)} style={{ padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${filter === k ? '#16a34a' : '#e2e8f0'}`, backgroundColor: filter === k ? '#dcfce7' : '#fff', fontWeight: filter === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.86rem' }}>{err}</div>}
      {list === null ? 'Loading…' : list.length === 0 ? <span style={{ color: '#94a3b8' }}>No messages.</span> : list.map((m) => (
        <div key={m.id} style={{ padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '0.7rem', marginBottom: '0.6rem', backgroundColor: m.status === 'new' ? '#f0fdf4' : '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{m.name} <span style={{ fontWeight: 500, color: '#64748b' }}>· {m.contact}</span></strong>
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>{TOPIC[m.topic] || m.topic} · {new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{m.user_id ? ' · member' : ' · visitor'}</span>
          </div>
          <p style={{ margin: '0.4rem 0', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{m.message}</p>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={m.status} onChange={(e) => set(m.id, e.target.value)} style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
              {['new', 'read', 'replied', 'closed'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {/@/.test(m.contact) && <a href={`mailto:${m.contact}?subject=${encodeURIComponent('Re: your message to Local Cricket')}`} style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 700 }}>Reply by email</a>}
            {/^\+?[\d\s-]{8,}$/.test(m.contact) && <a href={`https://wa.me/${m.contact.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 700 }}>Reply on WhatsApp</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminPanelView({ currentUser, isAdmin, isSuperAdmin, onNavigate }) {
  const [tab, setTab] = useState('overview');
  if (!isAdmin) return <div className="info-box">This page is only for administrators.</div>;
  const tabs = [['overview', 'Overview', LayoutDashboard], ['messages', 'Contact messages', Mail], ['roles', 'Roles & admins', Shield], ['verify', 'Verification requests', BadgeCheck],
    ['reports', 'Reports & suspensions', Users], ['notify', 'Message all members', Megaphone], ['ads', 'Adverts & campaigns', Megaphone], ['articles', 'Reported articles', Newspaper], ['audit', 'Audit log', FileText], ...(isSuperAdmin ? [['backup', 'Backups', Database]] : [])];
  return (
    <div>
      <PageTitle title="Admin Panel" sub={`Signed in as ${currentUser?.full_name || ''} (${currentUser?.role || 'Admin'})`} />
      <Tabs tab={tab} setTab={setTab} tabs={tabs} />
      {tab === 'overview' && (isSuperAdmin ? <SuperAdminDashboardView /> : <AdminDashboardView />)}
      {tab === 'messages' && <ContactMessagesPanel />}
      {tab === 'roles' && <RolePermissionsView onNavigate={onNavigate} />}
      {tab === 'verify' && <UserVerificationView />}
      {tab === 'reports' && <UserReportingSuspensionView />}
      {tab === 'notify' && <NotificationsManagementView />}
      {tab === 'audit' && <AuditLogsView />}
      {tab === 'articles' && <ReportedArticlesPanel onNavigate={onNavigate} />}
      {tab === 'ads' && <><AdsPanel scope="site" /><div style={{ height: '1rem' }} /><CampaignModeration onNavigate={onNavigate} /></>}
      {tab === 'backup' && isSuperAdmin && <DatabaseBackupView />}
    </div>
  );
}
