import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { MatchesView } from './views/MatchesView.jsx';
import { TournamentsView } from './views/TournamentsView.jsx';
import { CreateTournamentView } from './views/CreateTournamentView.jsx';
import { TournamentDetailsView } from './views/TournamentDetailsView.jsx';
import { PenaltyRulesView } from './views/PenaltyRulesView.jsx';
import { RegisterView } from './views/RegisterView.jsx';
import { LoginView } from './views/LoginView.jsx';
import { PasswordRecoveryView } from './views/auth/PasswordRecoveryView.jsx';
import { TeamsView } from './views/teams/TeamsView.jsx';
import { TeamDetailView } from './views/teams/TeamDetailView.jsx';
import { PlayerProfileView } from './views/teams/PlayerProfileView.jsx';
import { MatchCentreView } from './views/matches/MatchCentreView.jsx';
import { StatsView } from './views/stats/StatsView.jsx';
import { LawsView } from './views/rules/LawsView.jsx';
import { ToolsView } from './views/tools/ToolsView.jsx';
import { OfficialsView, OfficialProfileView } from './views/officials/OfficialsView.jsx';
import { GroundsView } from './views/grounds/GroundsView.jsx';
import { GroundDetailView } from './views/grounds/GroundDetailView.jsx';
import { CommunityView } from './views/community/CommunityView.jsx';
import { MediaView } from './views/media/MediaView.jsx';
import { SponsorsView, SponsorProfileView } from './views/brand/SponsorsView.jsx';
import { TournamentSiteView } from './views/brand/TournamentSiteView.jsx';
import { CertificateVerifyView } from './views/brand/AwardsPanel.jsx';
import { HomeView } from './views/site/HomeView.jsx';
import { MemberHomeView } from './views/site/MemberHomeView.jsx';
import { AboutView, ContactView, PrivacyView, TermsView, GuidelinesView, RefundView, FaqView } from './views/site/InfoPages.jsx';
import { SettingsView, AdminPanelView } from './views/site/AccountViews.jsx';
import { NewsView, LearnView } from './views/news/NewsLearnViews.jsx';
import { ArticleView } from './views/news/ArticleView.jsx';
import { QuizView } from './views/news/QuizViews.jsx';
import { dataService, onAuthChange } from './services/dataService.js';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTournamentId, setSelectedTournamentId] = useState('trn-001');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const [selectedGroundId, setSelectedGroundId] = useState(null);
  const [selectedSponsorId, setSelectedSponsorId] = useState(null);
  const [siteRef, setSiteRef] = useState(null);
  const [verifyCode, setVerifyCode] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [liveCount, setLiveCount] = useState(0);
  const isSuperAdmin = currentUser?.role === 'Super-Admin';
  const isAdmin = isSuperAdmin || currentUser?.role === 'Admin';

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
      setActiveTab('dashboard');
    }
  };

  // #28 Shareable links: ?match=<id> or ?tournament=<id> open that page directly.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const matchId = q.get('match');
    const tournamentId = q.get('tournament');
    const site = q.get('t');
    const verify = q.get('verify');
    const sponsor = q.get('sponsor');
    const article = q.get('article');
    const quiz = q.get('quiz');
    if (matchId && /^[0-9a-f-]{36}$/i.test(matchId)) { setSelectedMatchId(matchId); setActiveTab('match-centre'); }
    else if (tournamentId && /^[0-9a-f-]{36}$/i.test(tournamentId)) { setSelectedTournamentId(tournamentId); setActiveTab('tournament-details'); }
    else if (site && /^[A-Za-z0-9-]{2,40}$/.test(site)) { setSiteRef(site); setActiveTab('tournament-site'); }
    else if (verify && /^[A-Za-z0-9-]{4,20}$/.test(verify)) { setVerifyCode(verify.toUpperCase()); setActiveTab('verify'); }
    else if (sponsor && /^[0-9a-f-]{36}$/i.test(sponsor)) { setSelectedSponsorId(sponsor); setActiveTab('sponsor'); }
    else if (article && /^[0-9a-f-]{36}$/i.test(article)) { setSelectedArticleId(article); setActiveTab('article'); }
    else if (quiz && /^[0-9a-f-]{36}$/i.test(quiz)) { setSelectedQuizId(quiz); setActiveTab('quiz'); }
  }, []);
  useEffect(() => {
    const url = activeTab === 'match-centre' && selectedMatchId ? `?match=${selectedMatchId}`
      : activeTab === 'tournament-details' && selectedTournamentId && /^[0-9a-f-]{36}$/i.test(selectedTournamentId) ? `?tournament=${selectedTournamentId}`
      : activeTab === 'tournament-site' && siteRef ? `?t=${siteRef}`
      : activeTab === 'verify' && verifyCode ? `?verify=${verifyCode}`
      : activeTab === 'sponsor' && selectedSponsorId ? `?sponsor=${selectedSponsorId}`
      : activeTab === 'article' && selectedArticleId ? `?article=${selectedArticleId}`
      : activeTab === 'quiz' && selectedQuizId ? `?quiz=${selectedQuizId}`
      : window.location.pathname;
    if (`${window.location.pathname}${window.location.search}` !== (url.startsWith('?') ? `${window.location.pathname}${url}` : url)) {
      window.history.replaceState(null, '', url);
    }
  }, [activeTab, selectedMatchId, selectedTournamentId, siteRef, verifyCode, selectedSponsorId, selectedArticleId, selectedQuizId]);

  // Browser tab title for each page
  useEffect(() => {
    const names = { dashboard: currentUser ? 'My cricket' : 'Live scores, tournaments & teams', matches: 'Matches', 'match-centre': 'Match', tournaments: 'Tournaments', 'tournament-details': 'Tournament',
      stats: 'Players & stats', community: 'Community', media: 'Live & Media', grounds: 'Grounds', officials: 'Umpires & scorers', laws: 'Laws & Rules', tools: 'Cricket tools',
      teams: 'My teams', sponsors: 'Sponsors', sponsor: 'Sponsor', verify: 'Check a certificate', login: 'Log in', register: 'Register', about: 'About us', contact: 'Contact us', privacy: 'Privacy Policy', terms: 'Terms of Use', faq: 'FAQ', settings: 'Settings', admin: 'Admin panel', news: 'Cricket news', learn: 'Learn cricket', article: 'Article', quiz: 'Quiz' };
    document.title = `${names[activeTab] || 'Local Cricket'} · Local Cricket`;
  }, [activeTab, currentUser]);

  const handleNavigate = (tab, param = null) => {
    if (tab === 'category-n') tab = isAdmin ? 'admin' : 'settings';
    if (tab === 'password-recovery' && currentUser) tab = 'settings';
    if (tab === 'tournament-details' && param) {
      setSelectedTournamentId(param);
    }
    if (tab === 'team-details' && param) {
      setSelectedTeamId(param);
    }
    if (tab === 'player-profile' && param) {
      setSelectedPlayerId(param);
    }
    if (tab === 'ground' && param) {
      setSelectedGroundId(param);
    }
    if (tab === 'official-profile' && param) {
      setSelectedOfficialId(param);
    }
    if (tab === 'sponsor' && param) {
      setSelectedSponsorId(param);
    }
    if (tab === 'tournament-site' && param) {
      setSiteRef(param);
    }
    if (tab === 'verify') {
      setVerifyCode(param || null);
    }
    if (tab === 'article' && param) {
      setSelectedArticleId(param);
    }
    if (tab === 'quiz' && param) {
      setSelectedQuizId(param);
    }
    if (tab === 'match-centre' && param) {
      setSelectedMatchId(param);
    }
    setActiveTab(tab);
  };

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
      onSelectTab={(t) => handleNavigate(t)}
      liveMatchCount={liveCount}
      currentUser={currentUser}
      isAdmin={isAdmin}
      onSignOut={handleSignOut}
      fullBleed={(activeTab === 'dashboard' && !currentUser) || activeTab === 'tournament-site'}
    >
      {activeTab === 'dashboard' && (currentUser
        ? <MemberHomeView currentUser={currentUser} onNavigate={handleNavigate} />
        : <HomeView onNavigate={handleNavigate} />)}

      {activeTab === 'about' && <AboutView onNavigate={handleNavigate} />}
      {activeTab === 'contact' && <ContactView key={currentUser ? currentUser.id : 'guest'} currentUser={currentUser} />}
      {activeTab === 'privacy' && <PrivacyView />}
      {activeTab === 'terms' && <TermsView />}
      {activeTab === 'guidelines' && <GuidelinesView />}
      {activeTab === 'refunds' && <RefundView />}
      {activeTab === 'faq' && <FaqView onNavigate={handleNavigate} />}
      {activeTab === 'settings' && <SettingsView currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'admin' && <AdminPanelView currentUser={currentUser} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onNavigate={handleNavigate} />}

      {activeTab === 'matches' && <MatchesView key={currentUser ? currentUser.id : 'guest'} currentUser={currentUser} onNavigate={handleNavigate} />}

      {activeTab === 'match-centre' && selectedMatchId && (
        <MatchCentreView key={selectedMatchId} matchId={selectedMatchId} onNavigate={handleNavigate} />
      )}

      {activeTab === 'stats' && <StatsView onNavigate={handleNavigate} />}

      {activeTab === 'laws' && <LawsView />}

      {activeTab === 'tools' && <ToolsView />}

      {activeTab === 'officials' && <OfficialsView currentUser={currentUser} onNavigate={handleNavigate} />}

      {activeTab === 'grounds' && <GroundsView currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'community' && <CommunityView currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'media' && <MediaView onNavigate={handleNavigate} />}
      {activeTab === 'news' && <NewsView key={currentUser ? currentUser.id : 'guest'} currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'learn' && <LearnView key={currentUser ? currentUser.id : 'guest'} currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'article' && selectedArticleId && <ArticleView key={selectedArticleId} articleId={selectedArticleId} currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'quiz' && selectedQuizId && <QuizView key={selectedQuizId} quizId={selectedQuizId} currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'sponsors' && <SponsorsView key={currentUser ? currentUser.id : 'guest'} currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'sponsor' && selectedSponsorId && <SponsorProfileView key={`${selectedSponsorId}-${currentUser?.id || 'guest'}`} sponsorId={selectedSponsorId} onNavigate={handleNavigate} />}
      {activeTab === 'tournament-site' && siteRef && <TournamentSiteView key={`${siteRef}-${currentUser?.id || 'guest'}`} refCode={siteRef} currentUser={currentUser} onNavigate={handleNavigate} />}
      {activeTab === 'verify' && <CertificateVerifyView key={verifyCode || 'none'} code={verifyCode} onNavigate={handleNavigate} />}

      {activeTab === 'ground' && selectedGroundId && (
        <GroundDetailView key={selectedGroundId} groundId={selectedGroundId} currentUser={currentUser} onNavigate={handleNavigate} />
      )}

      {activeTab === 'official-profile' && selectedOfficialId && (
        <OfficialProfileView key={selectedOfficialId} userId={selectedOfficialId} onNavigate={handleNavigate} />
      )}

      {activeTab === 'tournaments' && <TournamentsView onNavigate={handleNavigate} />}

      {activeTab === 'tournament-details' && (
        <TournamentDetailsView
          key={selectedTournamentId}
          tournamentId={selectedTournamentId}
          currentUser={currentUser}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'create-tournament' && <CreateTournamentView onNavigate={handleNavigate} />}

      {activeTab === 'penalties' && <PenaltyRulesView currentUser={currentUser} onNavigate={handleNavigate} />}

      {activeTab === 'teams' && <TeamsView key={currentUser ? currentUser.id : 'guest'} onNavigate={handleNavigate} />}

      {activeTab === 'team-details' && selectedTeamId && (
        <TeamDetailView key={selectedTeamId} teamId={selectedTeamId} onNavigate={handleNavigate} />
      )}

      {activeTab === 'player-profile' && selectedPlayerId && (
        <PlayerProfileView key={selectedPlayerId} playerId={selectedPlayerId} onNavigate={handleNavigate} />
      )}

      {activeTab === 'register' && <RegisterView onNavigate={handleNavigate} />}

      {activeTab === 'login' && <LoginView key={currentUser ? currentUser.id : 'signed-out'} onNavigate={handleNavigate} />}

      {activeTab === 'password-recovery' && <PasswordRecoveryView onNavigate={handleNavigate} />}
    </AppLayout>
  );
}

export default App;
