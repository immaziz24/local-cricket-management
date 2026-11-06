import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { dataService } from '../services/dataService';
import { Trophy, Calendar, Users, MapPin, CheckCircle } from 'lucide-react';

export function TournamentsView() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadTournaments() {
      try {
        const data = await dataService.fetchTournaments()
        if (isMounted) setTournaments(data)
      } catch (err) {
        console.error(err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadTournaments()
    return () => { isMounted = false }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Tournament Registries</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Registered tournaments, formats, fixture progress, and venues
        </p>
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching tournament registries..." />
      ) : (
        <div className="grid-cards">
          {tournaments.map((trn) => {
            const pct = trn.matches_total ? Math.round((trn.matches_completed / trn.matches_total) * 100) : 0
            return (
              <Card key={trn.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <Badge variant={trn.status === 'ongoing' ? 'primary' : 'upcoming'}>
                    {trn.status}
                  </Badge>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    {trn.code}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {trn.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-primary-dark)', fontWeight: 600, marginTop: '0.2rem' }}>
                    {trn.format}
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
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '999px' }} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

