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
import { TeamsView } from './views/teams/TeamsView.jsx';
import { TeamDetailView } from './views/teams/TeamDetailView.jsx';
import { PlayerProfileView } from './views/teams/PlayerProfileView.jsx';
import { MatchCentreView } from './views/matches/MatchCentreView.jsx';
import { useDashboardData } from './hooks/useDashboardData.js';
import { dataService, onAuthChange } from './services/dataService.js';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTournamentId, setSelectedTournamentId] = useState('trn-001');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [liveCount, setLiveCount] = useState(0);

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

  // #28 Shareable links: ?match=<id> or ?tournament=<id> open that page directly.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const matchId = q.get('match');
    const tournamentId = q.get('tournament');
    if (matchId && /^[0-9a-f-]{36}$/i.test(matchId)) { setSelectedMatchId(matchId); setActiveTab('match-centre'); }
    else if (tournamentId && /^[0-9a-f-]{36}$/i.test(tournamentId)) { setSelectedTournamentId(tournamentId); setActiveTab('tournament-details'); }
  }, []);
  useEffect(() => {
    const url = activeTab === 'match-centre' && selectedMatchId ? `?match=${selectedMatchId}`
      : activeTab === 'tournament-details' && selectedTournamentId && /^[0-9a-f-]{36}$/i.test(selectedTournamentId) ? `?tournament=${selectedTournamentId}`
      : window.location.pathname;
    if (`${window.location.pathname}${window.location.search}` !== (url.startsWith('?') ? `${window.location.pathname}${url}` : url)) {
      window.history.replaceState(null, '', url);
    }
  }, [activeTab, selectedMatchId, selectedTournamentId]);

  const handleNavigate = (tab, param = null) => {
    if (tab === 'tournament-details' && param) {
      setSelectedTournamentId(param);
    }
    if (tab === 'team-details' && param) {
      setSelectedTeamId(param);
    }
    if (tab === 'player-profile' && param) {
      setSelectedPlayerId(param);
    }
    if (tab === 'match-centre' && param) {
      setSelectedMatchId(param);
    }
    setActiveTab(tab);
  };
  const { stats, liveMatches, tournaments, penaltyPolicy, loading } = useDashboardData();

  // Real number of live matches (refreshed every minute)
  useEffect(() => {
    let alive = true;
    const tick = () => dataService.countLiveMatches().then((n) => { if (alive) setLiveCount(n || 0); }).catch(() => {});
    tick();
    const id = setInterval(tick, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

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

      {activeTab === 'matches' && <MatchesView key={currentUser ? currentUser.id : 'guest'} currentUser={currentUser} onNavigate={handleNavigate} />}

      {activeTab === 'match-centre' && selectedMatchId && (
        <MatchCentreView key={selectedMatchId} matchId={selectedMatchId} onNavigate={handleNavigate} />
      )}

      {activeTab === 'tournaments' && <TournamentsView onNavigate={handleNavigate} />}

      {activeTab === 'tournament-details' && (
        <TournamentDetailsView
          tournamentId={selectedTournamentId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'create-tournament' && <CreateTournamentView onNavigate={handleNavigate} />}

      {activeTab === 'penalties' && <PenaltyRulesView />}

      {activeTab === 'teams' && <TeamsView key={currentUser ? currentUser.id : 'guest'} onNavigate={handleNavigate} />}

      {activeTab === 'team-details' && selectedTeamId && (
        <TeamDetailView key={selectedTeamId} teamId={selectedTeamId} onNavigate={handleNavigate} />
      )}

      {activeTab === 'player-profile' && selectedPlayerId && (
        <PlayerProfileView key={selectedPlayerId} playerId={selectedPlayerId} onNavigate={handleNavigate} />
      )}

      {activeTab === 'category-n' && <CategoryNView onNavigate={handleNavigate} />}

      {activeTab === 'register' && <RegisterView onNavigate={handleNavigate} />}

      {activeTab === 'login' && <LoginView key={currentUser ? currentUser.id : 'signed-out'} onNavigate={handleNavigate} />}

      {activeTab === 'password-recovery' && <PasswordRecoveryView onNavigate={handleNavigate} />}
    </AppLayout>
  );
}

export default App;
