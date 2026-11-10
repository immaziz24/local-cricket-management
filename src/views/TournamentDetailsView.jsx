import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { dataService } from '../services/dataService.js';
import { TeamRegistrationPanel } from './tournaments/TeamRegistrationPanel.jsx';
import { FixturesPanel } from './tournaments/FixturesPanel.jsx';
import { StandingsPanel } from './tournaments/StandingsPanel.jsx';
import { BannerStrip, TournamentLogo, BrandingControls } from './tournaments/TournamentBranding.jsx';
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
              Create Tournament
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
        {/* #33 banner and logo */}
        <BannerStrip tournament={tournament} />
        {isOrganiser && (
          <BrandingControls
            tournament={tournament}
            onChanged={async () => setTournament(await dataService.fetchTournamentById(tournament.id))}
          />
        )}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <TournamentLogo tournament={tournament} size={72} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
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
              New tournament
            </Button>
          </div>
        </div>

        {/* Key facts (local cricket) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--color-border)'
        }}>
          {[
            ['Overs', tournament.match_type === 'two_innings' ? 'Two innings' : `${tournament.overs_per_innings || '?'} overs`, tournament.match_type === 'box_cricket' ? 'Box cricket' : `${tournament.players_per_side || 11} a side`],
            ['Ball', tournament.ball_type || 'Not set', tournament.pitch_type ? `${tournament.pitch_type} pitch` : 'Pitch not set'],
            ['Teams', `${teams.length} / ${tournament.teams_count}`, tournament.category || 'Open'],
            ['Prizes', tournament.prize_pool || 'Not set', tournament.entry_fee ? `Entry: ${tournament.entry_fee}` : 'No entry fee set']
          ].map(([label, value, sub]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: label === 'Prizes' ? '#047857' : 'var(--color-text-main)' }}>{value}</span>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>{sub}</span>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Matches played</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{progressPercent}%</span>
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{matchesDone} / {matchesTotal}</span>
            <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--color-border)', borderRadius: '999px', marginTop: '0.2rem', overflow: 'hidden' }}>
              <div style={{ width: progressPercent + '%', height: '100%', backgroundColor: tournament.banner_color || 'var(--color-primary)', borderRadius: '999px' }} />
            </div>
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
          <span>About & Rules</span>
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
          <span>Teams ({teams.length})</span>
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
          <span>Fixtures ({matches.length})</span>
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

      {/* TAB 1: ABOUT & RULES */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <Card title="About this tournament">
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.25rem' }}>
              {[
                ['Match type', tournament.match_type === 'box_cricket' ? 'Box cricket' : tournament.match_type === 'two_innings' ? 'Two innings' : 'Limited overs'],
                ['Overs per innings', tournament.match_type === 'two_innings' ? '—' : (tournament.overs_per_innings || 'Not set')],
                ['Players a side', tournament.players_per_side || 11],
                ['Ball', tournament.ball_type || 'Not set'],
                ['Pitch', tournament.pitch_type || 'Not set'],
                ['Category', tournament.category || 'Open'],
                ['Ground', tournament.venue],
                ['City', tournament.city || '—'],
                ['Dates', `${tournament.start_date} to ${tournament.end_date}`],
                ['Organiser', tournament.organizer_name || '—'],
                ['Entry fee', tournament.entry_fee || '—'],
                ['Prizes', tournament.prize_pool || '—']
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.55rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{k}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Rules">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.25rem' }}>
              {tournament.penalty_policy && tournament.penalty_policy !== 'none' && (
                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', fontSize: '0.84rem', color: '#92400E' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    <ShieldAlert size={16} /> Late-arrival rule
                  </div>
                  {tournament.penalty_policy === 'fielding_restriction'
                    ? 'A team that arrives late fields with restrictions.'
                    : tournament.penalty_policy === 'penalty_runs'
                    ? 'The other team gets penalty runs when a team arrives late.'
                    : 'A team that arrives late loses overs.'}
                </div>
              )}
              {tournament.rules_summary ? (
                <div style={{ whiteSpace: 'pre-line', fontSize: '0.88rem', color: 'var(--color-text-main)', lineHeight: 1.5 }}>{tournament.rules_summary}</div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>The organiser has not written the rules yet.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: TEAMS — registration (#40) and approval (#41) */}
      {activeTab === 'teams' && (
        <TeamRegistrationPanel
          tournament={tournament}
          onNavigate={onNavigate}
          onTournamentChanged={async () => setTournament(await dataService.fetchTournamentById(tournament.id))}
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

