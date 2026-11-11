import React, { useState, useEffect } from 'react';
import { dataService } from '../../services/dataService';
import { SiteHeader } from './SiteHeader.jsx';
import { SiteFooter } from './SiteFooter.jsx';
import { Sidebar } from './Sidebar.jsx';
import { MobileNav } from './MobileNav.jsx';
import './site.css';

/**
 * Visitors: website layout (top menu, no sidebar) + footer.
 * Members: sidebar + slim header + footer.
 */
export function AppLayout(props) {
  const { children, activeTab, onSelectTab, liveMatchCount, currentUser, onSignOut, isAdmin = false, fullBleed = false } = props || {};
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('lc_sidebar') === '1'; } catch { return false; } });
  const [platform, setPlatform] = useState(null);

  // Platform-wide announcement and maintenance notice, refreshed on every page change.
  useEffect(() => {
    let mounted = true;
    dataService.fetchPlatformSettings().then((s) => { if (mounted) setPlatform(s); }).catch(() => {});
    return () => { mounted = false; };
  }, [activeTab]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [activeTab]);

  const toggleCollapse = () => { const v = !sidebarCollapsed; setSidebarCollapsed(v); try { localStorage.setItem('lc_sidebar', v ? '1' : '0'); } catch { /* ignore */ } };
  const banner = platform?.broadcast_banner;
  const colors = { info: ['#EFF6FF', '#BFDBFE', '#1D4ED8'], warning: ['#FFFBEB', '#FDE68A', '#92400E'], critical: ['#FEF2F2', '#FECACA', '#B91C1C'] };
  const [bg, bd, tx] = colors[banner?.level] || colors.info;
  const member = !!currentUser;

  const notices = (
    <>
      {platform?.maintenance_mode && <div className="site-notice" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>The website is in maintenance mode. Some actions may be unavailable for a short time.</div>}
      {banner && <div className="site-notice" style={{ backgroundColor: bg, borderColor: bd, color: tx }}><strong>Announcement:</strong> {banner.message}</div>}
    </>
  );

  return (
    <div className={`app-container ${member ? 'layout-member' : 'layout-public'}`}>
      {member && <Sidebar activeTab={activeTab} onSelectTab={onSelectTab} isCollapsed={sidebarCollapsed} onToggleCollapse={toggleCollapse} liveMatchCount={liveMatchCount} isAdmin={isAdmin} />}
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} activeTab={activeTab} onSelectTab={onSelectTab} liveMatchCount={liveMatchCount} currentUser={currentUser} isAdmin={isAdmin} onSignOut={onSignOut} />
      <div className="main-wrapper">
        <SiteHeader variant={member ? 'member' : 'public'} currentUser={currentUser} isAdmin={isAdmin} liveMatchCount={liveMatchCount} activeTab={activeTab}
          onNavigate={onSelectTab} onSignOut={onSignOut} onToggleMobileNav={() => setMobileNavOpen(true)} />
        {fullBleed ? (
          <main className="content-full">{(platform?.maintenance_mode || banner) && <div className="content-container" style={{ paddingBottom: 0 }}>{notices}</div>}{children}</main>
        ) : (
          <main className="content-container">{notices}{children}</main>
        )}
        <SiteFooter onNavigate={onSelectTab} />
      </div>
    </div>
  );
}

export default AppLayout;
