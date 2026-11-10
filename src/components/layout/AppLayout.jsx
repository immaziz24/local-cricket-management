import React, { useState, useEffect } from 'react';
import { dataService } from '../../services/dataService';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppLayout(props) {
  const { children, activeTab, onSelectTab, liveMatchCount, currentUser, onSignOut } = props || {};
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [platform, setPlatform] = useState(null)

  // #257: platform-wide announcement and maintenance notice, refreshed on every page change.
  useEffect(() => {
    let mounted = true
    dataService.fetchPlatformSettings()
      .then((settings) => { if (mounted) setPlatform(settings) })
      .catch(() => {})
    return () => { mounted = false }
  }, [activeTab])

  const banner = platform?.broadcast_banner
  const bannerColors = {
    info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
    critical: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' }
  }

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        liveMatchCount={liveMatchCount}
      />

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        liveMatchCount={liveMatchCount}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          onToggleMobileNav={() => setMobileNavOpen(true)}
          liveMatchCount={liveMatchCount}
          onNavigate={onSelectTab}
          currentUser={currentUser}
          onSignOut={onSignOut}
        />
        <main className="content-container">
          {platform?.maintenance_mode && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
              The platform is in maintenance mode. Some actions may be unavailable for a short time.
            </div>
          )}
          {banner && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: (bannerColors[banner.level] || bannerColors.info).bg, border: `1px solid ${(bannerColors[banner.level] || bannerColors.info).border}`, color: (bannerColors[banner.level] || bannerColors.info).text, fontSize: '0.85rem' }}>
              <strong>Announcement:</strong> {banner.message}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

