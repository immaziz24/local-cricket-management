import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { dataService } from '../services/dataService.js';
import { Activity, PlusCircle, MapPin, Clock, Trophy, AlertCircle } from 'lucide-react';
import { NewMatchForm } from './matches/NewMatchForm.jsx';
import { scoreLine } from './tournaments/MatchResultForm.jsx';

/**
 * Matches page (Phase 3): live, upcoming and finished matches from the real database,
 * and #1 "Start a match".
 */

const FILTERS = [
  ['live', 'Live'],
  ['upcoming', 'Upcoming'],
  ['completed', 'Finished'],
  ['mine', 'My matches'],
  ['all', 'All']
];
const STATUS = { live: ['danger', 'LIVE'], scheduled: ['warning', 'Upcoming'], completed: ['success', 'Finished'], abandoned: ['neutral', 'Abandoned'], cancelled: ['neutral', 'Cancelled'] };

const when = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';

export function MatchesView({ onNavigate = () => {}, currentUser }) {
  const [filter, setFilter] = useState('live');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const load = async (f = filter) => {
    setLoading(true); setError(null);
    try { setList((await dataService.listMatches(f, 60)) || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(filter); }, [filter]);
  // first visit: if nothing is live, show upcoming
  useEffect(() => {
    dataService.countLiveMatches().then((n) => { if (!n) setFilter('upcoming'); }).catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Activity size={24} color="#dc2626" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Matches</h1>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Live scores, upcoming games and results</div>
          </div>
        </div>
        {currentUser ? (
          <Button variant="primary" onClick={() => setShowNew(!showNew)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <PlusCircle size={16} /> {showNew ? 'Close' : 'Start a match'}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => onNavigate('login')}>Sign in to start a match</Button>
        )}
      </div>

      {showNew && <NewMatchForm onCreated={(id) => onNavigate('match-centre', id)} onCancel={() => setShowNew(false)} />}

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {FILTERS.filter(([v]) => v !== 'mine' || currentUser).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFilter(v)}
            style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: filter === v ? 700 : 500,
                     border: `1px solid ${filter === v ? '#0f172a' : '#cbd5e1'}`, backgroundColor: filter === v ? '#0f172a' : '#fff', color: filter === v ? '#fff' : '#334155' }}>
            {l}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#b91c1c', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><AlertCircle size={15} /> {error}</div>}

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading matches…</div>
      ) : list.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            {filter === 'live' ? 'No match is live right now.' : filter === 'upcoming' ? 'No upcoming matches.' : filter === 'completed' ? 'No finished matches yet.' : 'No matches yet.'}
            {currentUser ? ' Use "Start a match" to create one.' : ''}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.9rem' }}>
          {list.map((m) => {
            const [variant, label] = STATUS[m.status] || ['neutral', m.status];
            const a = scoreLine(m.team_a_runs, m.team_a_wickets, m.team_a_balls);
            const b = scoreLine(m.team_b_runs, m.team_b_wickets, m.team_b_balls);
            return (
              <button key={m.id} type="button" onClick={() => onNavigate('match-centre', m.id)}
                style={{ textAlign: 'left', cursor: 'pointer', border: `1px solid ${m.status === 'live' ? '#fecaca' : '#e2e8f0'}`, borderRadius: '0.75rem', padding: '0.9rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                    {m.tournament ? <><Trophy size={12} /> {m.tournament.name}</> : (m.title || 'Friendly match')}
                  </span>
                  <Badge variant={variant}>{label}</Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}><strong>{m.team_a.name}</strong><span>{a || ''}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}><strong>{m.team_b.name}</strong><span>{b || ''}</span></div>
                {m.result_summary && <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 700 }}>{m.result_summary}</div>}
                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {m.scheduled_at && <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}><Clock size={11} /> {when(m.scheduled_at)}</span>}
                  {(m.venue || m.city) && <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}><MapPin size={11} /> {[m.venue, m.city].filter(Boolean).join(', ')}</span>}
                  {m.overs_per_innings && <span>{m.overs_per_innings} overs</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MatchesView;
