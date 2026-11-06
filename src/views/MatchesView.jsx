import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { dataService } from '../services/dataService';
import { Calendar, MapPin, Clock, ArrowRight } from 'lucide-react';

export function MatchesView() {
  const [filter, setFilter] = useState('all')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadMatches() {
      setLoading(true)
      try {
        const data = await dataService.fetchMatches(filter)
        if (isMounted) setMatches(data)
      } catch (err) {
        console.error(err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadMatches()
    return () => { isMounted = false }
  }, [filter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title & Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Match Center & Fixtures</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Simulated cricket match fixtures served via the replaceable mock data layer
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#FFFFFF', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          {['all', 'live', 'upcoming', 'completed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: filter === tab ? 'var(--color-primary)' : 'transparent',
                color: filter === tab ? '#FFFFFF' : 'var(--color-text-muted)'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching match scorecards..." />
      ) : matches.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            No matches found for filter: <strong>{filter}</strong>
          </div>
        </Card>
      ) : (
        <div className="grid-cards">
          {matches.map((m) => (
            <Card key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <Badge variant={m.status}>{m.status}</Badge>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {m.format}
                </span>
              </div>

              {/* Tournament & Venue info */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-primary-dark)' }}>
                  {m.tournament_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  <MapPin size={12} />
                  <span>{m.venue}</span>
                </div>
              </div>

              {/* Score Display Area */}
              <div
                style={{
                  padding: '0.85rem',
                  backgroundColor: 'var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                {/* Team A */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {m.batting_first_team ? m.batting_first_team.name : m.team_a?.name}
                  </span>
                  {m.batting_first_team && (
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {m.batting_first_team.score}/{m.batting_first_team.wickets} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>({m.batting_first_team.overs} ov)</span>
                    </span>
                  )}
                  {m.team_a && m.team_a.score !== undefined && (
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {m.team_a.score}/{m.team_a.wickets}
                    </span>
                  )}
                </div>

                {/* Team B */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: m.status === 'live' && !m.bowling_team?.score ? 'var(--color-text-muted)' : 'inherit' }}>
                    {m.bowling_team ? m.bowling_team.name : m.team_b?.name}
                  </span>
                  {m.bowling_team && m.bowling_team.score !== undefined && (
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {m.bowling_team.score}/{m.bowling_team.wickets} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>({m.bowling_team.overs} ov)</span>
                    </span>
                  )}
                  {m.team_b && m.team_b.score !== undefined && (
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {m.team_b.score}/{m.team_b.wickets}
                    </span>
                  )}
                </div>
              </div>

              {/* Footer status summary */}
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingTop: '0.25rem' }}>
                {m.status === 'completed' && (
                  <span style={{ color: '#047857', fontWeight: 600 }}>{m.result}</span>
                )}
                {m.status === 'live' && (
                  <span>{m.toss_summary}</span>
                )}
                {m.status === 'upcoming' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={12} />
                    {m.match_date} at {m.match_time}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

