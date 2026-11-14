import React, { useEffect, useRef, useState } from 'react';
import { Menu, ChevronDown, Bell, Plus, LogOut, User, Users, Trophy, Activity, Landmark, Shield, Search, X, Settings } from 'lucide-react';
import { dataService } from '../../services/dataService.js';
import { GlobalSearch } from './GlobalSearch.jsx';
import { SITE } from '../../config/site.js';

/**
 * Site header.
 *  - Visitors: logo · main menu · search (with Near me) · live pill · Login · Register
 *  - Members:  menu button (mobile) · search · live pill · + Create · notifications · profile menu
 */
export const PUBLIC_NAV = [
  ['dashboard', 'Home'],
  ['matches', 'Matches'],
  ['tournaments', 'Tournaments'],
  ['stats', 'Players'],
  ['community', 'Community']
];
export const MORE_NAV = [
  ['news', 'News', 'Local news, previews, reports and stories'],
  ['learn', 'Learn & Quizzes', 'Coaching, rules, umpiring and scoring'],
  ['grounds', 'Grounds', 'Find and book cricket grounds'],
  ['officials', 'Umpires & Scorers', 'Hire officials for your match'],
  ['media', 'Live & Media', 'Highlights, photos and videos'],
  ['sponsors', 'Sponsors', 'Businesses backing local cricket'],
  ['laws', 'Laws & Rules', 'Cricket laws in simple words'],
  ['tools', 'Cricket Tools', 'Run rate, NRR, rain target and more'],
  ['penalties', 'Late-arrival Rules', 'How late teams are penalised']
];

export function Logo({ onClick, dark = false, small = false }) {
  return (
    <button type="button" onClick={onClick} className="site-logo" aria-label={`${SITE.name} home`}>
      <span className="site-logo-mark" style={small ? { width: 32, height: 32 } : undefined}><img src="/cricnotch.svg" alt="" /></span>
      <span className="site-logo-text">
        <span className="site-logo-name" style={{ color: dark ? '#fff' : undefined }}>{SITE.name}</span>
        {!small && <span className="site-logo-tag" style={{ color: dark ? '#86efac' : undefined }}>Grassroots cricket, scored live</span>}
      </span>
    </button>
  );
}

function useOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

function Dropdown({ label, children, align = 'right', buttonClass = 'hdr-link', icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className={buttonClass} onClick={() => setOpen(!open)} aria-expanded={open}>
        {icon}{label}{label && <ChevronDown size={14} style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />}
      </button>
      {open && <div className={`hdr-menu ${align}`} onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

function Notifications({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const load = () => dataService.fetchMyNotifications().then((n) => setItems(n || [])).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  const unread = items.filter((n) => !n.read_at);
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && unread.length) { try { await dataService.markNotificationsRead(unread.slice(0, 50).map((n) => n.id)); } catch { /* ignore */ } setTimeout(load, 1500); }
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="hdr-icon-btn" onClick={toggle} aria-label={`Notifications${unread.length ? `, ${unread.length} new` : ''}`}>
        <Bell size={19} />{unread.length > 0 && <span className="hdr-dot">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="hdr-menu right" style={{ width: 340, maxHeight: 420, overflowY: 'auto', padding: 0 }}>
          <div className="hdr-menu-head">Notifications</div>
          {items.length === 0 ? <div style={{ padding: '1.2rem', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>You're all caught up.</div>
            : items.slice(0, 12).map((n) => (
              <div key={n.id} className="hdr-notif" style={{ backgroundColor: n.read_at ? '#fff' : '#f0fdf4' }}>
                <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{n.title}</div>
                {n.body && <div style={{ fontSize: '0.8rem', color: '#475569' }}>{n.body}</div>}
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          {onNavigate && <button type="button" className="hdr-menu-foot" onClick={() => { setOpen(false); onNavigate('settings'); }}>Notification settings</button>}
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ currentUser, isAdmin, liveMatchCount = 0, activeTab, onNavigate, onSignOut, onToggleMobileNav, variant = 'public' }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  useEffect(() => { const s = () => setScrolled(window.scrollY > 6); s(); window.addEventListener('scroll', s, { passive: true }); return () => window.removeEventListener('scroll', s); }, []);
  const go = (t, p) => onNavigate && onNavigate(t, p);
  const initial = (currentUser?.full_name || currentUser?.email || '?').charAt(0).toUpperCase();
  const isPublic = variant === 'public';

  return (
    <header className={`site-header ${isPublic ? 'is-public' : 'is-member'}${scrolled ? ' scrolled' : ''}`}>
      <div className="site-header-inner">
        {<button type="button" className="hdr-icon-btn hdr-burger" onClick={onToggleMobileNav} aria-label="Open menu"><Menu size={21} /></button>}
        {isPublic && <Logo onClick={() => go('dashboard')} />}

        {isPublic && (
          <nav className="hdr-nav" aria-label="Main">
            {PUBLIC_NAV.map(([id, label]) => (
              <button key={id} type="button" className={`hdr-link${activeTab === id || (id === 'tournaments' && activeTab === 'tournament-details') || (id === 'matches' && activeTab === 'match-centre') ? ' active' : ''}`} onClick={() => go(id)}>
                {label}{id === 'matches' && liveMatchCount > 0 && <span className="hdr-live-count">{liveMatchCount}</span>}
              </button>
            ))}
            <Dropdown label="More">
              {MORE_NAV.map(([id, label, hint]) => (
                <button key={id} type="button" className="hdr-menu-item" onClick={() => go(id)}>
                  <span style={{ fontWeight: 700 }}>{label}</span><span className="hdr-menu-hint">{hint}</span>
                </button>
              ))}
            </Dropdown>
          </nav>
        )}

        <div className="hdr-search"><GlobalSearch onNavigate={go} /></div>

        <div className="hdr-right">
          <button type="button" className="hdr-icon-btn hdr-search-toggle" onClick={() => setMobileSearch(true)} aria-label="Search"><Search size={19} /></button>
          {liveMatchCount > 0 && (
            <button type="button" className="hdr-live hdr-live-main" onClick={() => go('matches')} title="Live matches">
              <span className="hdr-live-dot" />{liveMatchCount}<span className="hdr-live-text">&nbsp;Live</span>
            </button>
          )}
          {currentUser ? (
            <>
              <Dropdown buttonClass="hdr-create" label={<span className="hdr-create-label">Create</span>} icon={<Plus size={16} />}>
                <button type="button" className="hdr-menu-item" onClick={() => go('matches')}><span style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><Activity size={14} /> New match</span><span className="hdr-menu-hint">Score a friendly or practice match</span></button>
                <button type="button" className="hdr-menu-item" onClick={() => go('create-tournament')}><span style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><Trophy size={14} /> New tournament</span><span className="hdr-menu-hint">League or knockout with fixtures</span></button>
                <button type="button" className="hdr-menu-item" onClick={() => go('teams')}><span style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><Users size={14} /> New team</span><span className="hdr-menu-hint">Add your squad by mobile number</span></button>
                <button type="button" className="hdr-menu-item" onClick={() => go('grounds')}><span style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><Landmark size={14} /> List a ground</span><span className="hdr-menu-hint">Take bookings for your ground</span></button>
              </Dropdown>
              <Notifications onNavigate={go} />
              <Dropdown buttonClass="hdr-avatar-btn" label={null} icon={<span className="hdr-avatar">{initial}</span>}>
                <div className="hdr-menu-head" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 800 }}>{currentUser.full_name || currentUser.email}</span>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>{currentUser.role || 'Member'}</span>
                </div>
                <button type="button" className="hdr-menu-item row" onClick={() => go('settings')}><User size={15} /> My account</button>
                <button type="button" className="hdr-menu-item row" onClick={() => go('teams')}><Users size={15} /> My teams</button>
                <button type="button" className="hdr-menu-item row" onClick={() => go('matches')}><Activity size={15} /> My matches</button>
                {isAdmin && <button type="button" className="hdr-menu-item row" onClick={() => go('admin')}><Shield size={15} /> Admin panel</button>}
                <button type="button" className="hdr-menu-item row" onClick={() => go('settings')}><Settings size={15} /> Settings & privacy</button>
                <button type="button" className="hdr-menu-item row danger" onClick={onSignOut}><LogOut size={15} /> Sign out</button>
              </Dropdown>
            </>
          ) : (
            <>
              <button type="button" className="hdr-btn-primary" onClick={() => go('login')}>Sign in</button>
            </>
          )}
        </div>
      </div>

      <div className="hdr-status-row">
        {liveMatchCount > 0 && (
          <button type="button" className="hdr-live hdr-live-mobile" onClick={() => go('matches')} aria-label={`${liveMatchCount} live matches`}>
            <span className="hdr-live-dot" />{liveMatchCount} Live
          </button>
        )}
        <HeaderClock />
      </div>
      {mobileSearch && (
        <div className="hdr-mobile-search">
          <GlobalSearch onNavigate={go} compact autoFocus onDone={() => setMobileSearch(false)} />
          <button type="button" className="hdr-icon-btn" onClick={() => setMobileSearch(false)} aria-label="Close search"><X size={20} /></button>
        </div>
      )}
    </header>
  );
}

const clockFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit'
});

function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <time dateTime={now.toISOString()} style={{
      display: 'block', textAlign: 'end', marginInlineStart: 'auto',
      color: '#475569', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums'
    }}>
      {clockFormat.format(now)}
    </time>
  );
}

export default SiteHeader;
