import React from 'react';
import { authBackend } from '../../services/dataService';
import {
  LayoutDashboard,
  Trophy,
  Activity,
  ShieldAlert,
  Users,
  MapPin,
  Database,
  Layers,
  UserPlus,
  LogIn,
  KeyRound,
  ShieldCheck,
  PlusCircle
} from 'lucide-react';

export function Sidebar(props) {
  const { activeTab, onSelectTab, isCollapsed, onToggleCollapse, liveMatchCount = 0 } = props || {};
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'category-n', label: 'Category N Phase 1', icon: ShieldCheck, tag: '#254-270' },
    { id: 'register', label: 'User Registration', icon: UserPlus, tag: '#254' },
    { id: 'login', label: 'User Login & Logout', icon: LogIn, tag: '#255' },
    { id: 'password-recovery', label: 'Password Recovery', icon: KeyRound, tag: '#256' },
    { id: 'teams', label: 'My Teams', icon: Users, tag: 'New' },
    { id: 'matches', label: 'Matches', icon: Activity, badge: liveMatchCount > 0 ? `${liveMatchCount} Live` : null },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'create-tournament', label: 'Create Tournament', icon: PlusCircle, tag: '#31' },
    { id: 'penalties', label: 'Late Arrival Rules', icon: ShieldAlert, tag: 'Cat Q' }
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? '72px' : '260px',
        backgroundColor: 'var(--color-bg-sidebar)',
        color: 'var(--color-text-inverse)',
        display: 'none',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 30,
        borderRight: '1px solid rgba(255, 255, 255, 0.08)'
      }}
      className="desktop-sidebar"
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '1.25rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          minHeight: '64px'
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <img src="/cricket-ball.svg" alt="Ball" style={{ width: '22px', height: '22px' }} />
        </div>
        {!isCollapsed && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1rem', color: '#FFFFFF' }}>
              Local Cricket
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-light)', opacity: 0.9 }}>
              Management Platform
            </div>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'tournaments' && activeTab === 'tournament-details');
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#FFFFFF' : '#CBD5E1',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                transition: 'all 0.15s ease',
                width: '100%',
                textAlign: 'left'
              }}
              className="sidebar-link"
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!isCollapsed && (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              )}
              {!isCollapsed && item.badge && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700
                  }}
                >
                  {item.badge}
                </span>
              )}
              {!isCollapsed && item.tag && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    color: '#FEF08A',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700
                  }}
                >
                  {item.tag}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info Pill */}
      {!isCollapsed && (
        <div
          style={{
            padding: '1rem',
            margin: '0.75rem',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.72rem',
            color: '#94A3B8'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981', fontWeight: 600, marginBottom: '0.25rem' }}>
            <Database size={12} />
            <span>{authBackend === 'supabase' ? 'Database Connected' : 'Mock Data Layer Active'}</span>
          </div>
          <div>{authBackend === 'supabase' ? 'Real data: accounts, admin, roles, badges' : 'Future Supabase-ready facade'}</div>
          <div style={{ marginTop: '0.35rem', color: '#64748B' }}>
            {authBackend === 'supabase' ? 'Other screens: sample data' : 'Phase 2: Tournaments (#31)'}
          </div>
        </div>
      )}
    </aside>
  );
}
