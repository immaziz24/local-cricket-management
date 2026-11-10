import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { DashboardOverview } from './views/DashboardOverview.jsx';
import { MatchesView } from './views/MatchesView.jsx';
import { TournamentsView } from './views/TournamentsView.jsx';
import { CreateTournamentView } from './views/CreateTournamentView.jsx';
import { TournamentDetailsView } from './views/TournamentDetailsView.jsx';
import { PenaltyRulesView } from './views/PenaltyRulesView.jsx';
import { RegisterView } from './views/RegisterView.jsx';
import { LoginView } from './views/LoginView.jsx';
import { PasswordRecoveryView } from './views/auth/PasswordRecoveryView.jsx';
import { CategoryNView } from './views/CategoryNView.jsx';
import { useDashboardData } from './hooks/useDashboardData.js';
import { dataService, onAuthChange } from './services/dataService.js';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTournamentId, setSelectedTournamentId] = useState('trn-001');
  const [currentUser, setCurrentUser] = useState(null);

  // Keep the signed-in user in sync across the whole app (#255).
  useEffect(() => {
    let mounted = true;
    dataService.getCurrentUser()
      .then((user) => { if (mounted) setCurrentUser(user || null); })
      .catch(() => {});
    const unsubscribe = onAuthChange((user) => { if (mounted) setCurrentUser(user || null); });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    try {
      await dataService.logoutUser();
    } finally {
      setCurrentUser(null);
      setActiveTab('login');
    }
  };

  const handleNavigate = (tab, param = null) => {
    if (tab === 'tournament-details' && param) {
      setSelectedTournamentId(param);
    }
    setActiveTab(tab);
  };
  const { stats, liveMatches, tournaments, penaltyPolicy, loading } = useDashboardData();

  const liveCount = liveMatches ? liveMatches.length : 0;

  return (
    <AppLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      liveMatchCount={liveCount}
      currentUser={currentUser}
      onSignOut={handleSignOut}
    >
      {activeTab === 'dashboard' && (
        <DashboardOverview
          stats={stats}
          liveMatches={liveMatches}
          tournaments={tournaments}
          penaltyPolicy={penaltyPolicy}
          loading={loading}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'matches' && <MatchesView />}

      {activeTab === 'tournaments' && <TournamentsView onNavigate={handleNavigate} />}

      {activeTab === 'tournament-details' && (
        <TournamentDetailsView
          tournamentId={selectedTournamentId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'create-tournament' && <CreateTournamentView onNavigate={handleNavigate} />}

      {activeTab === 'penalties' && <PenaltyRulesView />}

      {activeTab === 'category-n' && <CategoryNView onNavigate={handleNavigate} />}

      {activeTab === 'register' && <RegisterView onNavigate={handleNavigate} />}

      {activeTab === 'login' && <LoginView key={currentUser ? currentUser.id : 'signed-out'} onNavigate={handleNavigate} />}

      {activeTab === 'password-recovery' && <PasswordRecoveryView onNavigate={handleNavigate} />}
    </AppLayout>
  );
}

export default App;
