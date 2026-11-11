import React, { useEffect } from 'react';
import { X, LogIn, UserPlus, LogOut } from 'lucide-react';
import { Logo, PUBLIC_NAV, MORE_NAV } from './SiteHeader.jsx';
import { memberNav, isActiveItem } from './navItems.js';

/** Slide-in menu for phones and tablets – visitor menu or member menu. */
export function MobileNav({ isOpen = false, onClose = () => {}, activeTab = 'dashboard', onSelectTab = () => {}, liveMatchCount = 0, currentUser, isAdmin, onSignOut }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [isOpen]);
  if (!isOpen) return null;
  const pick = (id) => { onSelectTab(id); onClose(); };
  const groups = currentUser ? memberNav({ isAdmin, liveMatchCount }) : [
    { title: null, items: PUBLIC_NAV.map(([id, label]) => ({ id, label, badge: id === 'matches' && liveMatchCount > 0 ? `${liveMatchCount} Live` : null, also: id === 'matches' ? ['match-centre'] : id === 'tournaments' ? ['tournament-details'] : [] })) },
    { title: 'More', items: MORE_NAV.map(([id, label]) => ({ id, label })) }
  ];
  return (
    <div className="mnav-overlay" onClick={onClose}>
      <aside className="mnav" onClick={(e) => e.stopPropagation()} aria-label="Menu">
        <div className="mnav-head">
          <Logo dark small onClick={() => pick('dashboard')} />
          <button type="button" className="mnav-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        {currentUser && (
          <div className="mnav-user">
            <span className="hdr-avatar">{(currentUser.full_name || '?').charAt(0).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.full_name}</div><div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{currentUser.role || 'Member'}</div></div>
          </div>
        )}
        <nav className="mnav-list">
          {groups.map((g, gi) => (
            <div key={gi} className="app-sidebar-group">
              {g.title && <div className="app-sidebar-title">{g.title}</div>}
              {g.items.map((item) => {
                const Icon = item.icon; const on = isActiveItem(item, activeTab);
                return (
                  <button key={item.id} type="button" onClick={() => pick(item.id)} className={`sidebar-link${on ? ' active' : ''}`}>
                    {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
                    <span className="sidebar-label">{item.label}</span>
                    {item.badge && <span className="sidebar-badge">{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mnav-foot">
          {currentUser ? (
            <button type="button" className="mnav-btn outline" onClick={() => { onClose(); onSignOut && onSignOut(); }}><LogOut size={16} /> Sign out</button>
          ) : (
            <>
              <button type="button" className="mnav-btn primary" onClick={() => pick('register')}><UserPlus size={16} /> Register – it's free</button>
              <button type="button" className="mnav-btn outline" onClick={() => pick('login')}><LogIn size={16} /> Log in</button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default MobileNav;
