import React from 'react';
import { Menu, Globe, Server, Activity, UserPlus, LogIn, LogOut } from 'lucide-react';
import { Badge } from '../common/Badge';

export function Header(props) {
  const { onToggleMobileNav, liveMatchCount = 0, onNavigate, currentUser, onSignOut } = props || {};
  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button
          onClick={onToggleMobileNav}
          className="btn btn-ghost btn-sm mobile-menu-toggle"
          style={{ display: 'inline-flex', padding: '0.4rem' }}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--color-bg-sidebar)' }}>
            Local Cricket
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'none' }}>
            | Management Platform
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Category N CTAs: signed-in user, or Login / Register */}
        {currentUser ? (
          <>
            <button
              onClick={() => onNavigate && onNavigate('login')}
              className="btn btn-ghost btn-sm"
              title="My account"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', fontWeight: 600 }}
            >
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-light, #D1FAE5)',
                  color: 'var(--color-primary-dark, #065F46)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}
              >
                {(currentUser.full_name || currentUser.email || '?').charAt(0).toUpperCase()}
              </span>
              <span className="header-user-name">{currentUser.full_name || currentUser.email}</span>
            </button>
            <button
              onClick={onSignOut}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
        <>
        <button
          onClick={() => onNavigate && onNavigate('login')}
          className="btn btn-outline btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
        >
          <LogIn size={13} />
          <span>Login</span>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('register')}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
        >
          <UserPlus size={13} />
          <span>Register</span>
        </button>
        </>
        )}

        {/* Live Matches Pulse */}
        {liveMatchCount > 0 && (
          <Badge variant="live" className="badge-live-pulse-container">
            {liveMatchCount} Live Match{liveMatchCount > 1 ? 'es' : ''}
          </Badge>
        )}

        {/* Temporary Domain Badge */}
        <div
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.65rem',
            backgroundColor: 'var(--color-border-subtle)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)'
          }}
          className="header-domain-pill"
        >
          <Globe size={13} color="var(--color-primary)" />
          <span>localcricket.plateria.in</span>
        </div>

        {/* Hostinger Status Pill */}
        <div
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.65rem',
            backgroundColor: '#ECFDF5',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#065F46'
          }}
          className="header-server-pill"
        >
          <Server size={12} color="#059669" />
          <span>Hostinger Business</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @media (min-width: 640px) {
          .header-domain-pill {
            display: inline-flex !important;
          }
        }
        @media (min-width: 1024px) {
          .mobile-menu-toggle {
            display: none !important;
          }
          .header-server-pill {
            display: inline-flex !important;
          }
        }
      `
      }} />
    </header>
  )
}

