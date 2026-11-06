import React, { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { DashboardOverview } from './views/DashboardOverview.jsx';
import { MatchesView } from './views/MatchesView.jsx';
import { TournamentsView } from './views/TournamentsView.jsx';
import { PenaltyRulesView } from './views/PenaltyRulesView.jsx';
import { RegisterView } from './views/RegisterView.jsx';
import { LoginView } from './views/LoginView.jsx';
import { PasswordRecoveryView } from './views/auth/PasswordRecoveryView.jsx';
import { CategoryNView } from './views/CategoryNView.jsx';
import { useDashboardData } from './hooks/useDashboardData.js';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { stats, liveMatches, tournaments, penaltyPolicy, loading } = useDashboardData();

  const liveCount = liveMatches ? liveMatches.length : 0;

  return (
    <AppLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      liveMatchCount={liveCount}
    >
      {activeTab === 'dashboard' && (
        <DashboardOverview
          stats={stats}
          liveMatches={liveMatches}
          tournaments={tournaments}
          penaltyPolicy={penaltyPolicy}
          loading={loading}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'matches' && <MatchesView />}

      {activeTab === 'tournaments' && <TournamentsView />}

      {activeTab === 'penalties' && <PenaltyRulesView />}

      {activeTab === 'category-n' && <CategoryNView onNavigate={setActiveTab} />}

      {activeTab === 'register' && <RegisterView onNavigate={setActiveTab} />}

      {activeTab === 'login' && <LoginView onNavigate={setActiveTab} />}

      {activeTab === 'password-recovery' && <PasswordRecoveryView onNavigate={setActiveTab} />}
    </AppLayout>
  );
}

export default App;
