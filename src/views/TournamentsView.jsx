import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { dataService } from '../services/dataService.js';
import { TournamentLogo } from './tournaments/TournamentBranding.jsx';
import { Trophy, Calendar, Users, MapPin, PlusCircle, Sparkles, Eye } from 'lucide-react';

export function TournamentsView(props) {
  const { onNavigate = () => {} } = props || {};
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadTournaments() {
      try {
        const data = await dataService.fetchTournaments();
        if (isMounted) setTournaments(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadTournaments();
    return () => { isMounted = false; };
  }, []);

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
              Tournament Registries & Fixtures
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 0.25rem 0' }}>
            Tournament Registries
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Registered tournaments, playing formats, fixture progress, and venues
          </p>
        </div>

        <Button
          variant="primary"
          icon={PlusCircle}
          onClick={() => onNavigate && onNavigate('create-tournament')}
          style={{ backgroundColor: '#059669' }}
        >
          Create Tournament
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching tournament registries..." />
      ) : (
        <div className="grid-cards">
          {tournaments.map((trn) => {
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
                    {trn.status}
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
                    {trn.format} {trn.ball_type ? '• ' + trn.ball_type : ''}
                  </div>
                </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
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
                    <span>{trn.teams_count} Participating Teams</span>
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
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
