import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { dataService } from '../services/dataService.js';
import { TournamentLogo } from './tournaments/TournamentBranding.jsx';
import { Trophy, Calendar, Users, MapPin, PlusCircle, Sparkles, Eye } from 'lucide-react';

const FILTERS = [
  ['live', 'Live'],
  ['upcoming', 'Upcoming'],
  ['finished', 'Finished'],
  ['mine', 'My tournaments'],
  ['all', 'All'],
];

export function TournamentsView(props) {
  const { currentUser, seriesOnly = false, onNavigate = () => {} } = props || {};
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setFilter] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadTournaments() {
      try {
        const data = await dataService.fetchTournaments();
        const events = (data || []).filter((event) => (event.category === 'Series') === seriesOnly);
        const items = seriesOnly ? await Promise.all(events.map(async (event) => {
          const matches = await dataService.fetchTournamentMatches(event.id);
          const seriesStatus = matches.some((match) => match.status === 'live') ? 'live'
            : matches.length > 0 && matches.every((match) => ['completed', 'abandoned', 'cancelled'].includes(match.status)) ? 'finished'
            : 'upcoming';
          return { ...event, seriesStatus };
        })) : events;
        if (isMounted) setTournaments(items);
      } catch (err) {
        if (isMounted) setError(err.message || 'Could not load tournaments.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadTournaments();
    return () => { isMounted = false; };
  }, [seriesOnly]);

  const defaultFilter = tournaments.some((t) => seriesOnly ? t.seriesStatus === 'live' : t.status === 'ongoing') ? 'live' : 'upcoming';
  const filter = selectedFilter === 'mine' && !currentUser ? defaultFilter : selectedFilter ?? defaultFilter;
  const visibleTournaments = tournaments.filter((t) => {
    if (seriesOnly) return t.seriesStatus === filter;
    switch (filter) {
      case 'live': return t.status === 'ongoing';
      case 'upcoming': return ['registration', 'upcoming'].includes(t.status);
      case 'finished': return t.status === 'completed';
      case 'mine': return t.owner_id === currentUser?.id;
      default: return true;
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header with Title and Create Tournament Action */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              {seriesOnly ? 'Head-to-head cricket' : 'Tournament Registries & Fixtures'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.25rem 0' }}>
            {seriesOnly ? 'Series' : 'Tournament Registries'}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
            {seriesOnly ? 'Browse live series, upcoming fixtures, and completed results.' : 'Registered tournaments, playing formats, fixture progress, and venues'}
          </p>
        </div>

        <Button
          variant="primary"
          icon={PlusCircle}
          onClick={() => onNavigate(seriesOnly ? (currentUser ? 'create-series' : 'login') : 'create-tournament')}
          style={{ backgroundColor: '#059669' }}
        >
          {seriesOnly ? (currentUser ? 'Create series' : 'Sign in to create a series') : 'Create Tournament'}
        </Button>
      </div>

      <div role="group" aria-label="Filter tournaments" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {FILTERS.filter(([value]) => seriesOnly ? ['live', 'upcoming', 'finished'].includes(value) : value !== 'mine' || currentUser).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
            style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', fontSize: '0.85rem', cursor: 'pointer',
              fontWeight: filter === value ? 700 : 500, border: '1px solid ' + (filter === value ? '#0f172a' : '#cbd5e1'),
              backgroundColor: filter === value ? '#0f172a' : '#fff', color: filter === value ? '#fff' : '#334155' }}>
            {seriesOnly && value === 'finished' ? 'Completed' : label}
          </button>
        ))}
      </div>

      {error ? <p role="alert">{error}</p> : loading ? (
        <LoadingSpinner message="Fetching tournament registries..." />
      ) : visibleTournaments.length === 0 ? (
        <p role="status">{seriesOnly ? 'No ' + (filter === 'finished' ? 'completed' : filter) + ' series yet.' : 'No tournaments in this view.'}</p>
      ) : (
        <div className="grid-cards">
          {visibleTournaments.map((trn) => {
            const pct = trn.matches_total ? Math.round((trn.matches_completed / trn.matches_total) * 100) : 0;
            return (
              <Card
                key={trn.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  borderTop: '4px solid ' + (trn.banner_color || 'var(--color-primary)')
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <Badge variant={trn.status === 'ongoing' ? 'primary' : 'upcoming'}>
                    {seriesOnly ? { live: 'Live', upcoming: 'Upcoming', finished: 'Completed' }[trn.seriesStatus] : trn.status}
                  </Badge>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    {trn.code}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <TournamentLogo tournament={trn} size={44} />
                <div>
                  <h3
                    onClick={() => onNavigate && onNavigate('tournament-details', trn.id)}
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      margin: '0 0 0.2rem 0',
                      cursor: 'pointer'
                    }}
                  >
                    {trn.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-primary-dark)', fontWeight: 600, marginTop: '0.2rem' }}>
                    {trn.format} {trn.ball_type ? ' ' + trn.ball_type : ''}
                  </div>
                </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                  <div style={{ marginTop: '0.75rem', color: '#475569' }}>
                    {currentUser?.id && trn.owner_id === currentUser.id
                      ? 'Created by me'
                      : 'Created by ' + (trn.tournament_creator_name || 'an unavailable account')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={13} />
                    <span>{trn.start_date} to {trn.end_date}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={13} />
                    <span>{trn.venue}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Users size={13} />
                    <span>{trn.teams_count} team slots</span>
                  </div>
                </div>

                {/* Progress */}
                <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                    <span>Fixtures Completed</span>
                    <span style={{ fontWeight: 700 }}>{trn.matches_completed} / {trn.matches_total} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', backgroundColor: trn.banner_color || 'var(--color-primary)', borderRadius: '999px' }} />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={Eye}
                    onClick={() => onNavigate && onNavigate('tournament-details', trn.id)}
                    style={{ width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}
                  >
                    {seriesOnly ? 'View series' : 'View Details'}
                  </Button>
                  {currentUser && !['completed', 'cancelled'].includes(trn.status) &&
                    (trn.owner_id === currentUser.id || (trn.registration_open !== false && ['registration', 'upcoming'].includes(trn.status))) && (
                    <Button size="sm" onClick={() => onNavigate('tournament-details', trn.id, 'teams')}
                      style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}>
                      {trn.owner_id === currentUser.id ? 'Add teams' : 'Register my team'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
