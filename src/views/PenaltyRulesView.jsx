import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { dataService } from '../services/dataService';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ShieldAlert, CheckCircle, AlertTriangle, Scale, Clock, Users, FileText } from 'lucide-react';

export function PenaltyRulesView() {
  const [policy, setPolicy] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadPolicy() {
      try {
        const data = await dataService.fetchCategoryQPolicy()
        if (isMounted) setPolicy(data)
      } catch (err) {
        console.error(err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadPolicy()
    return () => { isMounted = false }
  }, [])

  if (loading) {
    return <LoadingSpinner message="Loading Category Q regulation specifications..." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px' }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
          <Badge variant="upcoming">Category Q Scope</Badge>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Phase 4 Development • Confirmed Requirements
          </span>
        </div>
        <h1 style={{ fontSize: '1.6rem', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>
          Late Arrival Penalty Rules
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Standardized operational governance for tournament directors, match referees, and umpires.
          Preserved strictly from source specifications without invented calculations.
        </p>
      </div>

      {/* Critical Core Rule Callout */}
      <div
        style={{
          backgroundColor: '#FEF3C7',
          border: '1px solid #FDE68A',
          borderRadius: 'var(--radius-md)',
          padding: '1.15rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          color: '#92400E'
        }}
      >
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
            Single Active Method Invariant
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
            Only <strong>ONE</strong> penalty method can be active in any single match. Multiple concurrent penalty methods are strictly prohibited.
          </div>
        </div>
      </div>

      {/* The Three Penalty Methods */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)' }}>
          The Three Permissible Penalty Methods
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Method 1 */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                1
              </div>
              <h3 style={{ fontSize: '1rem' }}>Overs Deduction</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              Proportionally reduces the maximum allocated overs for the late-arriving side, shortening their batting innings while maintaining the non-offending team's full allocation.
            </p>
          </Card>

          {/* Method 2 */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#DBEAFE', color: '#1E40AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                2
              </div>
              <h3 style={{ fontSize: '1rem' }}>Fielding Restriction</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              Imposes field placement sanctions by requiring additional fielders to remain inside the 30-yard fielding circle during specified overs of play.
            </p>
          </Card>

          {/* Method 3 */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#991B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                3
              </div>
              <h3 style={{ fontSize: '1rem' }}>Penalty Runs</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              Directly credits extra penalty runs to the non-offending opponent's score before or during the match according to pre-published local league bylaws.
            </p>
          </Card>
        </div>
      </div>

      {/* Operational Workflow Guidelines */}
      <Card title="Administrative & Approval Workflow">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Users size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Organiser Selection & Identification</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                The match organiser is solely authorized to select which of the three penalty methods applies and explicitly identifies both the late-arriving team and the benefiting opponent.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Scale size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Authorised Umpire / Organiser Approval</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                An authorised organiser or official match umpire must formally approve and sign off on the penalty before it takes effect on the match card.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <FileText size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Advance Publication of Match Rules</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Local match rules and penalty thresholds must be published and distributed to all participating teams in advance of tournament fixtures.
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

