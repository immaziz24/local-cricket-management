import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { dataService } from '../services/dataService.js';
import { TeamRegistrationPanel } from './tournaments/TeamRegistrationPanel.jsx';
import { FixturesPanel } from './tournaments/FixturesPanel.jsx';
import { StandingsPanel } from './tournaments/StandingsPanel.jsx';
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  ShieldAlert,
  DollarSign,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  Share2,
  Copy,
  FileText,
  ChevronRight,
  Filter,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export function TournamentDetailsView(props) {
  const { tournamentId = 'trn-001', onNavigate = () => {} } = props || {};
  const [tournament, setTournament] = useState(null);
  const [allTournaments, setAllTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isOrganiser, setIsOrganiser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview | teams | fixtures | standings
  const [matchFilter, setMatchFilter] = useState('all'); // all | live | upcoming | completed
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [trnList, targetTrn, trnMatches] = await Promise.all([
          dataService.fetchTournaments(),
          dataService.fetchTournamentById(tournamentId),
          dataService.fetchTournamentMatches(tournamentId)
        ]);
        let approvedTeams = [];
        try {
          const regs = await dataService.fetchTournamentRegistrations(tournamentId);
          approvedTeams = (regs?.teams || []).filter((t) => t.status === 'approved');
          if (isMounted) setIsOrganiser(!!regs?.is_organiser);
        } catch {
          approvedTeams = [];
        }

        if (isMounted) {
          setAllTournaments(trnList || []);
          setTournament(targetTrn);
          setMatches(trnMatches || []);
          setTeams(approvedTeams);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load tournament profile.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [tournamentId]);

  const handleCopyCode = (code) => {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) {
    return <LoadingSpinner message="Loading tournament profile and specifications..." />;
  }

  if (error || !tournament) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px', margin: '2rem auto' }}>
        <div style={{
          padding: '2rem',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#991B1B', margin: '0 0 0.5rem 0' }}>
            Tournament Not Found
          </h2>
          <p style={{ color: '#7F1D1D', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            {error || 'The requested tournament identifier does not exist or has been removed.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Button variant="primary" icon={ArrowLeft} onClick={() => onNavigate('tournaments')}>
              Back to Tournament Registry
            </Button>
            <Button variant="outline" onClick={() => onNavigate('create-tournament')}>
              Create Tournament (#31)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const matchesTotal = tournament.matches_total || 1;
  const matchesDone = tournament.matches_completed || 0;
  const progressPercent = Math.round((matchesDone / matchesTotal) * 100);

  // Filter matches for Fixtures tab
  const filteredMatches = matches.filter((m) => {
    if (matchFilter === 'all') return true;
    return m.status === matchFilter;
  });

  // Calculate duration in days
  let durationDays = null;
  if (tournament.start_date && tournament.end_date) {
    const s = new Date(tournament.start_date);
    const e = new Date(tournament.end_date);
    const diffTime = Math.abs(e - s);
    durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Bar with Breadcrumb and Tournament Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => onNavigate('tournaments')}
          >
            All Tournaments
          </Button>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
            {tournament.code}
          </span>
        </div>

        {/* Quick Tournament Switcher */}
        {allTournaments.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Switch Tournament:
            </span>
            <select
              value={tournament.id}
              onChange={(e) => onNavigate('tournament-details', e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--color-text-main)',
                cursor: 'pointer'
              }}
            >
              {allTournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Hero Header Card */}
      <Card
        style={{
          borderTop: '5px solid ' + (tournament.banner_color || '#059669'),
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <Badge variant="primary">CATEGORY B • FEATURE #32</Badge>
              <Badge variant={tournament.status === 'ongoing' ? 'primary' : 'upcoming'}>
                {tournament.status}
              </Badge>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--color-primary-dark)',
                backgroundColor: 'var(--color-primary-light)',
                padding: '0.15rem 0.55rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                {tournament.code}
              </span>
            </div>

            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--color-text-main)',
              margin: '0 0 0.5rem 0',
              lineHeight: 1.2
            }}>
              {tournament.name}
            </h1>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              flexWrap: 'wrap',
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={14} color="var(--color-primary)" />
                <span style={{ fontWeight: 600 }}>{tournament.venue}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} color="var(--color-primary)" />
                <span>{tournament.start_date} to {tournament.end_date} {durationDays ? '(' + durationDays + ' Days)' : ''}</span>
              </div>
              {tournament.organizer_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Users size={14} color="var(--color-primary)" />
                  <span>Organised by: <strong>{tournament.organizer_name}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              icon={copiedCode ? CheckCircle2 : Copy}
              onClick={() => handleCopyCode(tournament.code)}
            >
              {copiedCode ? 'Code Copied!' : 'Copy Code'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Trophy}
              onClick={() => onNavigate('create-tournament')}
              style={{ backgroundColor: '#059669' }}
            >
              + Create Tournament (#31)
            </Button>
          </div>
        </div>

        {/* Vital Metric Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--color-border)'
        }}>
          {/* Format & Ball */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Format & Ball
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {tournament.format}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              {tournament.ball_type || 'Leather Ball (White)'}
            </span>
          </div>

          {/* Teams Quota */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Enrolled Teams
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {tournament.teams_count} Clubs
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              {tournament.teams_count <= 8 ? 'Single Pool' : '2 Groups of ' + (tournament.teams_count / 2)}
            </span>
          </div>

          {/* Matches & Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Fixtures
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                {progressPercent}%
              </span>
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {matchesDone} / {matchesTotal}
            </span>
            <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--color-border)', borderRadius: '999px', marginTop: '0.2rem', overflow: 'hidden' }}>
              <div style={{ width: progressPercent + '%', height: '100%', backgroundColor: tournament.banner_color || 'var(--color-primary)', borderRadius: '999px' }} />
            </div>
          </div>

          {/* Prize Stakes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Prize Purse
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#047857' }}>
              {tournament.prize_pool || 'Trophy & Medals'}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              Entry: {tournament.entry_fee || 'Free Entry'}
            </span>
          </div>

          {/* Category Q Late Arrival Standard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Late Arrival Rule (Cat Q)
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#B45309' }}>
              {tournament.penalty_policy === 'fielding_restriction'
                ? 'Fielding Restriction'
                : tournament.penalty_policy === 'penalty_runs'
                ? '5 Penalty Runs'
                : 'Overs Deduction'}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
              Single Method Constraint Active
            </span>
          </div>
        </div>
      </Card>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '0.25rem'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.65rem 1.25rem',
            fontSize: '0.88rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid var(--color-primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'overview' ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}
        >
          <Layers size={15} />
          <span>Profile & Regulations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          style={{
            padding: '0.65rem 1.25rem',
            fontSize: '0.88rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'teams' ? '3px solid var(--color-primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'teams' ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}
        >
          <Users size={15} />
          <span>Participating Clubs ({teams.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fixtures')}
          style={{
            padding: '0.65rem 1.25rem',
            fontSize: '0.88rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'fixtures' ? '3px solid var(--color-primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'fixtures' ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}
        >
          <Activity size={15} />
          <span>Fixtures & Match Schedule ({matches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('standings')}
          style={{
            padding: '0.65rem 1.25rem',
            fontSize: '0.88rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'standings' ? '3px solid var(--color-primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'standings' ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}
        >
          <Trophy size={15} />
          <span>Points Table & Knockouts</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & REGULATIONS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Tournament Specifications Card */}
          <Card
            title="Tournament Architecture & Playing Conditions"
            subtitle="Authoritative specifications configured for this tournament"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Match Format:</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{tournament.format}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Official Match Ball:</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{tournament.ball_type || 'Leather Ball (White)'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Tournament Status:</span>
                <Badge variant={tournament.status === 'ongoing' ? 'primary' : 'upcoming'}>{tournament.status}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Host Ground / Complex:</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>{tournament.venue}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Tournament Window:</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{tournament.start_date} to {tournament.end_date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Organizing Authority:</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{tournament.organizer_name || 'Tournament Committee'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Prize Pool & Honors:</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#047857' }}>{tournament.prize_pool || 'Champions Trophy'}</span>
              </div>
            </div>
          </Card>

          {/* Category Q & Local Regulations Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card
              title="Category Q Late Arrival Policy Enforcement"
              subtitle="Enforced in accordance with Master Blueprint Section 5"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
                <div style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  color: '#92400E',
                  lineHeight: 1.4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    <ShieldAlert size={16} />
                    <span>Active Penalty Method: {tournament.penalty_policy === 'fielding_restriction' ? 'Fielding Restriction' : tournament.penalty_policy === 'penalty_runs' ? 'Penalty Runs' : 'Overs Deduction'}</span>
                  </div>
                  <span>Master Blueprint Rule: Only <strong>ONE</strong> penalty method can be active in a match. Organisers must publish this rule in advance.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <div style={{ padding: '0.65rem 0.85rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: '#F8FAFC' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>Official Cutoff Time</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>Toss nominations must be submitted 15 minutes prior to scheduled start.</div>
                  </div>
                  <div style={{ padding: '0.65rem 0.85rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: '#F8FAFC' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>Sanction Authority</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>Both match umpires and designated tournament referee must co-sign penalty execution.</div>
                  </div>
                </div>

                {tournament.rules_summary && (
                  <div style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                    color: '#166534'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Special Ground Regulations:</strong>
                    <span>{tournament.rules_summary}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: TEAMS — registration (#40) and approval (#41) */}
      {activeTab === 'teams' && (
        <TeamRegistrationPanel
          tournament={tournament}
          onChanged={(regs) => setTeams((regs?.teams || []).filter((t) => t.status === 'approved'))}
        />
      )}

      {/* TAB 3: FIXTURES, SCHEDULE & CALENDAR (#42–#52) */}
      {activeTab === 'fixtures' && (
        <FixturesPanel tournament={tournament} isOrganiser={isOrganiser} onChanged={(m) => setMatches(m)} />
      )}

      {/* TAB 4: POINTS TABLE, NRR, QUALIFICATION, KNOCKOUTS, WINNER (#53–#58) */}
      {activeTab === 'standings' && (
        <StandingsPanel
          tournament={tournament}
          isOrganiser={isOrganiser}
          onTournamentChanged={async () => {
            const fresh = await dataService.fetchTournamentById(tournament.id);
            setTournament(fresh);
          }}
        />
      )}
    </div>
  );
}

