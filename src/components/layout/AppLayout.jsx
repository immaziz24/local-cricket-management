import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppLayout({ children, activeTab, onSelectTab, liveMatchCount }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          onToggleMobileNav={() => setMobileNavOpen(true)}
          liveMatchCount={liveMatchCount}
          onNavigate={onSelectTab}
        />
        <main className="content-container">
          {children}
        </main>
      </div>
    </div>
  )
}

