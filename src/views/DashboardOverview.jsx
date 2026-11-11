import React from 'react';
import {
  Trophy,
  Users,
  Activity,
  Flame,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function DashboardOverview(props) {
  const {
    stats,
    liveMatches = [],
    tournaments = [],
    penaltyPolicy,
    loading,
    onNavigate = () => {}
  } = props || {};
  if (loading) {
    return <LoadingSpinner message="Loading cricket dashboard metrics..." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Platform Architecture & Foundation Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0B132B 0%, #1C2541 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          color: '#FFFFFF',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(16, 185, 129, 0.18)', color: '#34D399', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              <Sparkles size={12} />
              <span>Phase 1 In Progress · Accounts are live</span>
            </div>
            <h1 style={{ fontSize: '1.6rem', color: '#FFFFFF', marginBottom: '0.35rem' }}>
              Local Cricket Management Platform
            </h1>
            <p style={{ color: '#CBD5E1', fontSize: '0.875rem', maxWidth: '640px' }}>
              Real accounts, sign-in and the Super-Admin console run on the live database. Tournaments, matches and the numbers below are still sample data until their phases are built.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('create-tournament')}
              style={{ backgroundColor: '#059669', borderColor: '#059669' }}
            >
              Create Tournament
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('matches')}
              style={{ borderColor: 'rgba(255, 255, 255, 0.25)', color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              View Match Center
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('category-n')}
              style={{ backgroundColor: '#10B981' }}
            >
              Category N Hub
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('login')}
              style={{ borderColor: 'rgba(255, 255, 255, 0.25)', color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Sign In
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('penalties')}
              style={{ borderColor: 'rgba(255, 255, 255, 0.25)', color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Category Q Rules
            </Button>
          </div>
        </div>
      </div>

      {/* Primary Key Statistics Grid */}
      <div className="grid-stats">
        <StatCard
          label="Active Tournaments"
          value={stats?.active_tournaments || 4}
          subtext="2 ongoing, 2 upcoming"
          icon={Trophy}
          color="var(--color-primary)"
        />
        <StatCard
          label="Registered Teams"
          value={stats?.registered_teams || 32}
          subtext="Across 4 city zones"
          icon={Users}
          color="#2563EB"
        />
        <StatCard
          label="Active & Live Matches"
          value={stats?.live_and_upcoming_matches || 14}
          subtext="2 in-play right now"
          icon={Activity}
          color="var(--color-danger)"
        />
        <StatCard
          label="Profiled Players"
          value={stats?.profiled_players || 520}
          subtext="With career match records"
          icon={Flame}
          color="var(--color-accent)"
        />
      </div>

      {/* Main Two-Column Section: Live Scorecards & Category Q / Tournaments */}
      <div className="grid-two-col">
        {/* Left Column: Live Matches & Scorecards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card
            title="Live Match Center"
            subtitle="Real-time simulated ball-by-ball scoreboards"
            action={
              <Button variant="ghost" size="sm" onClick={() => onNavigate('matches')}>
                <span>All Matches</span>
                <ChevronRight size={14} />
              </Button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {liveMatches.map((match) => (
                <div
                  key={match.id}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.15rem',
                    backgroundColor: '#FFFFFF',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {/* Match Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant="live">LIVE • {match.format}</Badge>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {match.stage} • {match.venue}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary-dark)', backgroundColor: 'var(--color-primary-light)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                      {match.tournament_name}
                    </span>
                  </div>

                  {/* Match Teams & Score Summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.5rem 0' }}>
                    {/* Batting Team */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: match.batting_first_team.color || '#DC2626'
                          }}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {match.batting_first_team.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          ({match.batting_first_team.short_code})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                        <span className="score-primary">
                          {match.batting_first_team.score}/{match.batting_first_team.wickets}
                        </span>
                        <span className="score-overs">({match.batting_first_team.overs} ov)</span>
                      </div>
                    </div>

                    {/* Bowling Team / Chasing Team */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: match.bowling_team.color || '#2563EB'
                          }}
                        />
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
                          {match.bowling_team.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          ({match.bowling_team.short_code})
                        </span>
                      </div>
                      {match.bowling_team.score !== undefined ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                          <span className="score-primary">
                            {match.bowling_team.score}/{match.bowling_team.wickets}
                          </span>
                          <span className="score-overs">({match.bowling_team.overs} ov)</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          Yet to bat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Toss / In-Play Commentary Note */}
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--color-border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.35rem'
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)' }}>{match.toss_summary}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                      CRR: {match.batting_first_team.run_rate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Active Tournaments Overview */}
          <Card
            title="Tournament Management Progress"
            subtitle="Scheduled, active and completed tournament structures"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Button variant="outline" size="sm" onClick={() => onNavigate('create-tournament')}>
                  + Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('tournaments')}>
                  <span>View All</span>
                  <ChevronRight size={14} />
                </Button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
              {tournaments.map((trn) => {
                const progressPct = trrnProgress(trn)
                return (
                  <div
                    key={trn.id}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div
                          onClick={() => onNavigate && onNavigate('tournament-details', trn.id)}
                          style={{ fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', color: 'var(--color-text-main)' }}
                        >
                          {trn.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {trn.format} • {trn.venue}
                        </div>
                      </div>
                      <Badge variant={trn.status === 'ongoing' ? 'primary' : 'upcoming'}>
                        {trn.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                        <span>Matches: {trn.matches_completed} / {trn.matches_total}</span>
                        <span>{progressPct}% Completed</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: progressPct + '%', height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '999px' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Category Q Rules & Architecture Highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Category Q Confirmed Rules Card */}
          <Card
            title="Category Q: Late Arrival Penalty"
            subtitle="Confirmed local match regulation standards"
            action={
              <Badge variant="upcoming">Phase 4 Scope</Badge>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#92400E' }}>
                <strong>Single Method Rule:</strong> Only ONE penalty method can be active in a match.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>1. Overs Deduction</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Proportional reduction of match overs for late side</div>
                </div>

                <div style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: '#2563EB' }}>2. Fielding Restriction</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Additional fielders placed inside 30-yard circle</div>
                </div>

                <div style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: '#DC2626' }}>3. Penalty Runs</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Fixed run grant awarded to the opposing team</div>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                • Organiser selects method & identifies late/benefiting teams.<br />
                • Authorised organiser or umpire approval required.<br />
                • Local match rules must be published in advance.
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('penalties')}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                View Full Penalty Specification
              </Button>
            </div>
          </Card>

          {/* Architecture / Deployment Readiness */}
          <Card title="System Readiness Status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857' }}>
                <CheckCircle2 size={16} />
                <span>Frontend-First Architecture Initialized</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857' }}>
                <CheckCircle2 size={16} />
                <span>Replaceable Mock Data Access Layer Active</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857' }}>
                <CheckCircle2 size={16} />
                <span>Hostinger Business Specs Verified (50GB, 2 Cores)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B' }}>
                <Info size={16} />
                <span>Database / Backend Implementation: Deferred</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B' }}>
                <Info size={16} />
                <span>310-Feature Master List: Pending Source Confirmation</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function trrnProgress(trn) {
  if (!trn.matches_total) return 0
  return Math.round((trn.matches_completed / trn.matches_total) * 100)
}

