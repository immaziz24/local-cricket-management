import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { dataService } from '../services/dataService.js';

// Feature Views
import { RegisterView } from './RegisterView.jsx';
import { LoginView } from './LoginView.jsx';
import { PasswordRecoveryView } from './auth/PasswordRecoveryView.jsx';
import { SuperAdminDashboardView } from './admin/SuperAdminDashboardView.jsx';
import { AdminDashboardView } from './admin/AdminDashboardView.jsx';
import { RolePermissionsView } from './admin/RolePermissionsView.jsx';
import { UserVerificationView } from './admin/UserVerificationView.jsx';
import { UserReportingSuspensionView } from './admin/UserReportingSuspensionView.jsx';
import { AuditLogsView } from './admin/AuditLogsView.jsx';
import { DatabaseBackupView } from './admin/DatabaseBackupView.jsx';
import { SecurityPrivacyView } from './admin/SecurityPrivacyView.jsx';
import { NotificationsManagementView } from './admin/NotificationsManagementView.jsx';

import {
  ShieldCheck,
  UserPlus,
  LogIn,
  KeyRound,
  LayoutDashboard,
  Users,
  Shield,
  UserX,
  FileText,
  Database,
  Lock,
  Bell,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';

export function CategoryNView({ onNavigate, initialTab = 'overview' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadManifest();
    checkSession();
  }, []);

  const loadManifest = async () => {
    try {
      const data = await dataService.fetchCategoryNSlots();
      setSlots(data || []);
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      const user = await dataService.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('Failed to check session:', err);
    }
  };

  const tabPillars = [
    { id: 'overview', label: 'All 17 Features Grid', icon: Layers, count: 17 },
    { id: 'auth', label: 'Auth & Access (#254-#256)', icon: UserPlus, count: 3 },
    { id: 'dashboards', label: 'Dashboards (#257-#258)', icon: LayoutDashboard, count: 2 },
    { id: 'rbac', label: 'Role Permissions (#259-#264)', icon: Shield, count: 6 },
    { id: 'governance', label: 'User Governance (#265-#266)', icon: UserX, count: 2 },
    { id: 'secops', label: 'Security & Operations (#267-#270)', icon: Lock, count: 4 }
  ];

  // Quick sub-tabs within pillars
  const [authSubTab, setAuthSubTab] = useState('register');
  const [dashSubTab, setDashSubTab] = useState('superadmin');
  const [secopsSubTab, setSecopsSubTab] = useState('audit');
  const [govSubTab, setGovSubTab] = useState('verification');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Category N Banner */}
      <div style={{
        padding: '1.5rem 1.75rem',
        backgroundColor: '#0f172a',
        borderRadius: '0.75rem',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: '#10b981',
              color: '#ffffff'
            }}>
              PHASE 1 COMPLETE
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Category N • Administration, Security and User Management
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.35rem 0', letterSpacing: '-0.02em' }}>
            Phase 1 Coordination Hub (Features #254–270)
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
            Unified administrative control, authentication suite, 6-persona RBAC, audit logging, and data protection.
          </p>
        </div>

        {/* Current Session Capsule */}
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          textAlign: 'right'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Active Session</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>
            {currentUser ? currentUser.full_name : 'Guest User'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            Role: <strong>{currentUser ? currentUser.role : 'Unauthenticated'}</strong>
          </div>
        </div>
      </div>

      {/* Pillar Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '0.25rem',
        borderBottom: '1px solid var(--border-color, #e2e8f0)'
      }}>
        {tabPillars.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.825rem',
                fontWeight: 700,
                backgroundColor: isSelected ? 'var(--primary-color, #047857)' : 'var(--card-bg, #ffffff)',
                color: isSelected ? '#ffffff' : 'var(--text-main, #334155)',
                boxShadow: isSelected ? '0 2px 4px rgba(4,120,87,0.2)' : '0 1px 2px rgba(0,0,0,0.05)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '9999px',
                backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                color: isSelected ? '#ffffff' : '#64748b'
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* PILLAR 1: ALL 17 FEATURES GRID (OVERVIEW) */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Status Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <Card>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Features in Phase 1</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>17 / 17</div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>100% Phase Scope Built</div>
            </Card>
            <Card>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Authentication Workflows</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', margin: '0.25rem 0' }}>3 Features</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>#254 Register, #255 Login, #256 Reset</div>
            </Card>
            <Card>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>RBAC Persona Schemas</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#8b5cf6', margin: '0.25rem 0' }}>6 Roles</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>#259 to #264 Configured</div>
            </Card>
            <Card>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Security & Operations</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', margin: '0.25rem 0' }}>6 Features</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>#265–#270 Verified</div>
            </Card>
          </div>

          {/* Master 17-Slot Grid */}
          <Card title="Phase 1 Feature Inventory (#254–#270)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {slots.map((slot) => (
                <div key={slot.id} style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#1d4ed8',
                        fontFamily: 'monospace'
                      }}>
                        SLOT #{slot.id}
                      </span>
                      <Badge variant="success">Implemented & Verified</Badge>
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
                      {slot.title}
                    </strong>
                    <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                      {slot.description}
                    </p>
                  </div>

                  {/* Launch Button to Jump into Tab */}
                  <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      {slot.pillar}
                    </span>
                    <button
                      onClick={() => {
                        if (slot.id === 254) { setActiveTab('auth'); setAuthSubTab('register'); }
                        else if (slot.id === 255) { setActiveTab('auth'); setAuthSubTab('login'); }
                        else if (slot.id === 256) { setActiveTab('auth'); setAuthSubTab('recovery'); }
                        else if (slot.id === 257) { setActiveTab('dashboards'); setDashSubTab('superadmin'); }
                        else if (slot.id === 258) { setActiveTab('dashboards'); setDashSubTab('admin'); }
                        else if (slot.id >= 259 && slot.id <= 264) { setActiveTab('rbac'); }
                        else if (slot.id === 265) { setActiveTab('governance'); setGovSubTab('verification'); }
                        else if (slot.id === 266) { setActiveTab('governance'); setGovSubTab('suspension'); }
                        else if (slot.id === 267) { setActiveTab('secops'); setSecopsSubTab('audit'); }
                        else if (slot.id === 268) { setActiveTab('secops'); setSecopsSubTab('backup'); }
                        else if (slot.id === 269) { setActiveTab('secops'); setSecopsSubTab('security'); }
                        else if (slot.id === 270) { setActiveTab('secops'); setSecopsSubTab('notifications'); }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color, #047857)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      Open Module <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* PILLAR 2: AUTH & ACCESS (#254, #255, #256) */}
      {activeTab === 'auth' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setAuthSubTab('register')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: authSubTab === 'register' ? '#0f172a' : '#f1f5f9',
                color: authSubTab === 'register' ? '#ffffff' : '#475569'
              }}
            >
              #254 User Registration
            </button>
            <button
              onClick={() => setAuthSubTab('login')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: authSubTab === 'login' ? '#0f172a' : '#f1f5f9',
                color: authSubTab === 'login' ? '#ffffff' : '#475569'
              }}
            >
              #255 User Login & Logout
            </button>
            <button
              onClick={() => setAuthSubTab('recovery')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: authSubTab === 'recovery' ? '#0f172a' : '#f1f5f9',
                color: authSubTab === 'recovery' ? '#ffffff' : '#475569'
              }}
            >
              #256 Password Recovery
            </button>
          </div>

          {authSubTab === 'register' && <RegisterView onNavigate={onNavigate} />}
          {authSubTab === 'login' && <LoginView onNavigate={onNavigate} />}
          {authSubTab === 'recovery' && <PasswordRecoveryView onNavigate={onNavigate} />}
        </div>
      )}

      {/* PILLAR 3: ADMINISTRATIVE DASHBOARDS (#257, #258) */}
      {activeTab === 'dashboards' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setDashSubTab('superadmin')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: dashSubTab === 'superadmin' ? '#0f172a' : '#f1f5f9',
                color: dashSubTab === 'superadmin' ? '#ffffff' : '#475569'
              }}
            >
              #257 Super-Admin Dashboard
            </button>
            <button
              onClick={() => setDashSubTab('admin')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: dashSubTab === 'admin' ? '#0f172a' : '#f1f5f9',
                color: dashSubTab === 'admin' ? '#ffffff' : '#475569'
              }}
            >
              #258 Admin Dashboard
            </button>
          </div>

          {dashSubTab === 'superadmin' && <SuperAdminDashboardView />}
          {dashSubTab === 'admin' && <AdminDashboardView />}
        </div>
      )}

      {/* PILLAR 4: ROLE-BASED ACCESS CONTROL (#259–#264) */}
      {activeTab === 'rbac' && <RolePermissionsView />}

      {/* PILLAR 5: USER GOVERNANCE (#265, #266) */}
      {activeTab === 'governance' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setGovSubTab('verification')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: govSubTab === 'verification' ? '#0f172a' : '#f1f5f9',
                color: govSubTab === 'verification' ? '#ffffff' : '#475569'
              }}
            >
              #265 User Verification
            </button>
            <button
              onClick={() => setGovSubTab('suspension')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: govSubTab === 'suspension' ? '#0f172a' : '#f1f5f9',
                color: govSubTab === 'suspension' ? '#ffffff' : '#475569'
              }}
            >
              #266 Reporting & Suspension
            </button>
          </div>

          {govSubTab === 'verification' && <UserVerificationView />}
          {govSubTab === 'suspension' && <UserReportingSuspensionView />}
        </div>
      )}

      {/* PILLAR 6: SECURITY & OPERATIONS (#267–#270) */}
      {activeTab === 'secops' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', overflowX: 'auto' }}>
            <button
              onClick={() => setSecopsSubTab('audit')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: secopsSubTab === 'audit' ? '#0f172a' : '#f1f5f9',
                color: secopsSubTab === 'audit' ? '#ffffff' : '#475569'
              }}
            >
              #267 Activity & Audit Logs
            </button>
            <button
              onClick={() => setSecopsSubTab('backup')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: secopsSubTab === 'backup' ? '#0f172a' : '#f1f5f9',
                color: secopsSubTab === 'backup' ? '#ffffff' : '#475569'
              }}
            >
              #268 Database Backup
            </button>
            <button
              onClick={() => setSecopsSubTab('security')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: secopsSubTab === 'security' ? '#0f172a' : '#f1f5f9',
                color: secopsSubTab === 'security' ? '#ffffff' : '#475569'
              }}
            >
              #269 Security & Privacy
            </button>
            <button
              onClick={() => setSecopsSubTab('notifications')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: secopsSubTab === 'notifications' ? '#0f172a' : '#f1f5f9',
                color: secopsSubTab === 'notifications' ? '#ffffff' : '#475569'
              }}
            >
              #270 Notifications
            </button>
          </div>

          {secopsSubTab === 'audit' && <AuditLogsView />}
          {secopsSubTab === 'backup' && <DatabaseBackupView />}
          {secopsSubTab === 'security' && <SecurityPrivacyView />}
          {secopsSubTab === 'notifications' && <NotificationsManagementView />}
        </div>
      )}
    </div>
  );
}
