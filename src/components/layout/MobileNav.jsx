import React from 'react';
import {
  X,
  LayoutDashboard,
  Trophy,
  Activity,
  ShieldAlert,
  Globe,
  Server,
  Database,
  UserPlus,
  LogIn,
  KeyRound,
  ShieldCheck,
  PlusCircle,
  BarChart3,
  BookOpen,
  Wrench,
  Flag,
  MapPin,
  Users,
  Store,
  Clapperboard,
} from 'lucide-react';

export function MobileNav(props) {
  const {
    isOpen = false,
    onClose = () => {},
    activeTab = 'dashboard',
    onSelectTab = () => {},
    liveMatchCount = 0
  } = props || {};
  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'category-n', label: 'Category N Phase 1', icon: ShieldCheck, tag: '#254-270' },
    { id: 'register', label: 'User Registration', icon: UserPlus, tag: '#254' },
    { id: 'login', label: 'User Login & Logout', icon: LogIn, tag: '#255' },
    { id: 'password-recovery', label: 'Password Recovery', icon: KeyRound, tag: '#256' },
    { id: 'teams', label: 'My Teams', icon: Users, tag: 'New' },
    { id: 'matches', label: 'Matches', icon: Activity, badge: liveMatchCount > 0 ? `${liveMatchCount} Live` : null },
    { id: 'officials', label: 'Umpires & Scorers', icon: Flag },
    { id: 'grounds', label: 'Grounds', icon: MapPin },
    { id: 'community', label: 'Community', icon: Store },
    { id: 'media', label: 'Live & Media', icon: Clapperboard },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
    { id: 'laws', label: 'Laws & Rules', icon: BookOpen },
    { id: 'tools', label: 'Cricket Tools', icon: Wrench },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy, count: '4' },
    { id: 'create-tournament', label: 'Create Tournament', icon: PlusCircle, tag: '#31' },
    { id: 'penalties', label: 'Late Arrival Rules', icon: ShieldAlert, tag: 'Cat Q' }
  ];

  const handleSelect = (id) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex'
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(11, 19, 43, 0.65)',
          backdropFilter: 'blur(3px)',
          transition: 'opacity 0.2s ease'
        }}
      />

      {/* Slide-over panel */}
      <div
        style={{
          position: 'relative',
          width: '280px',
          maxWidth: '85vw',
          backgroundColor: 'var(--color-bg-sidebar)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 51
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <img src="/cricket-ball.svg" alt="Ball" style={{ width: '26px', height: '26px' }} />
            <div>
              <div style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1rem', color: '#FFFFFF' }}>
                Local Cricket
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-light)' }}>
                Management Platform
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.4rem',
              color: '#CBD5E1',
              borderRadius: 'var(--radius-sm)'
            }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Links */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'tournaments' && activeTab === 'tournament-details');
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#E2E8F0',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.9rem',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 700
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {item.tag && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: '#FEF08A',
                      padding: '0.1rem 0.45rem',
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

        {/* System info */}
        <div
          style={{
            padding: '1rem',
            margin: '0.75rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            color: '#94A3B8'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981', fontWeight: 600, marginBottom: '0.25rem' }}>
            <Database size={13} />
            <span>Mock Service Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem' }}>
            <Globe size={12} />
            <span>localcricket.plateria.in</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
            <Server size={12} />
            <span>Hostinger Business</span>
          </div>
        </div>
      </div>
    </div>
  );
}
