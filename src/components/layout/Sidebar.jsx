import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Logo } from './SiteHeader.jsx';
import { memberNav, isActiveItem } from './navItems.js';

/** Sidebar for signed-in members (desktop). Visitors use the top menu instead. */
export function Sidebar({ activeTab, onSelectTab, isCollapsed, onToggleCollapse, liveMatchCount = 0, isAdmin = false }) {
  const groups = memberNav({ isAdmin, liveMatchCount });
  return (
    <aside className="desktop-sidebar app-sidebar" style={{ width: isCollapsed ? 76 : 256 }}>
      <div className="app-sidebar-brand">
        {isCollapsed ? <button type="button" className="site-logo" onClick={() => onSelectTab('dashboard')} aria-label="Home"><span className="site-logo-mark"><img src="/cricket-ball.svg" alt="" /></span></button>
          : <Logo dark onClick={() => onSelectTab('dashboard')} />}
      </div>
      <nav className="app-sidebar-nav" aria-label="Member menu">
        {groups.map((g, gi) => (
          <div key={gi} className="app-sidebar-group">
            {g.title && !isCollapsed && <div className="app-sidebar-title">{g.title}</div>}
            {g.items.map((item) => {
              const Icon = item.icon; const on = isActiveItem(item, activeTab);
              return (
                <button key={item.id} type="button" title={isCollapsed ? item.label : undefined} onClick={() => onSelectTab(item.id)} className={`sidebar-link${on ? ' active' : ''}`}>
                  <Icon size={18} style={{ flexShrink: 0 }} />
                  {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
                  {!isCollapsed && item.badge && <span className="sidebar-badge">{item.badge}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <button type="button" className="app-sidebar-collapse" onClick={onToggleCollapse} aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}>
        {isCollapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> <span>Collapse</span></>}
      </button>
    </aside>
  );
}

export default Sidebar;
