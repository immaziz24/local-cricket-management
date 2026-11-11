import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { ArticleFeed } from '../news/newsShared.jsx';
import { Activity, Trophy, Users, Landmark, ArrowRight, Bell, Radio, Plus, Flag, Store } from 'lucide-react';

/** Home page for signed-in members: "My cricket". */
const overs = (b) => (b == null ? '' : `${Math.floor(b / 6)}.${b % 6}`);
const sc = (r, w, b) => (r == null ? '–' : `${r}/${w ?? 0} (${overs(b)})`);
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function Panel({ title, action, onAction, children }) {
  return (
    <div className="info-box" style={{ padding: '1.1rem 1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{title}</h3>
        {action && <button type="button" className="home-link" onClick={onAction}>{action} <ArrowRight size={14} /></button>}
      </div>
      {children}
    </div>
  );
}

export function MemberHomeView({ currentUser, onNavigate }) {
  const [mine, setMine] = useState(null);
  const [live, setLive] = useState(null);
  const [teams, setTeams] = useState(null);
  const [notes, setNotes] = useState(null);
  const [found, setFound] = useState(null);
  useEffect(() => {
    dataService.listMatches('mine', 20).then(setMine).catch(() => setMine([]));
    dataService.listMatches('live', 6).then(setLive).catch(() => setLive([]));
    dataService.fetchMyTeams().then(setTeams).catch(() => setTeams([]));
    dataService.fetchMyNotifications().then(setNotes).catch(() => setNotes([]));
    dataService.globalSearch({}).then(setFound).catch(() => setFound({}));
  }, []);
  const go = (t, p) => onNavigate && onNavigate(t, p);
  const first = (currentUser?.full_name || '').split(' ')[0];
  const myActive = (mine || []).filter((m) => ['live', 'paused', 'scheduled'].includes(m.status))
    .sort((a, b) => (a.status === 'scheduled') - (b.status === 'scheduled') || new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const myDone = (mine || []).filter((m) => m.status === 'completed').slice(0, 4);
  const row = (m) => (
    <button key={m.id} type="button" onClick={() => go('match-centre', m.id)} className="gs-item" style={{ border: '1px solid #f1f5f9', marginBottom: 6 }}>
      <span className={`gs-ico${m.status === 'live' ? ' live' : ''}`}><Activity size={15} /></span>
      <span className="gs-text">
        <span className="gs-title">{m.status === 'live' && <span className="gs-live-dot" />}{m.team_a?.name} vs {m.team_b?.name}</span>
        <span className="gs-sub">{m.status === 'scheduled' ? new Date(m.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : m.status === 'completed' ? (m.result_summary || 'Finished') : `${sc(m.team_a_runs, m.team_a_wickets, m.team_a_balls)} · ${sc(m.team_b_runs, m.team_b_wickets, m.team_b_balls)}`}</span>
      </span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="home-hero" style={{ borderRadius: '1.2rem' }}>
        <div style={{ padding: '1.6rem 1.6rem 1.4rem' }}>
          <div style={{ fontSize: '0.86rem', color: '#a7f3d0', fontWeight: 700 }}>{greet()}{first ? `, ${first}` : ''} 👋</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.7rem', letterSpacing: '-0.02em', margin: '0.2rem 0 1rem' }}>What are we playing today?</div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {[[Activity, 'Start a match', 'matches'], [Trophy, 'Create tournament', 'create-tournament'], [Users, 'My teams', 'teams'], [Landmark, 'Book a ground', 'grounds'], [Flag, 'Find umpire / scorer', 'officials'], [Store, 'Community', 'community']].map(([Icon, l, t]) => (
              <button key={t} type="button" onClick={() => go(t)} className="sf-btn-light" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={15} /> {l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Panel title="My matches" action="All matches" onAction={() => go('matches')}>
          {mine === null ? <span style={{ color: '#64748b', fontSize: '0.86rem' }}>Loading…</span>
            : myActive.length + myDone.length === 0 ? <div style={{ fontSize: '0.88rem', color: '#64748b' }}>No matches yet. <button type="button" className="home-link" onClick={() => go('matches')}><Plus size={14} /> Start one</button></div>
            : <>{myActive.map(row)}{myDone.length > 0 && <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.6rem 0 0.4rem' }}>Recent results</div>}{myDone.map(row)}</>}
        </Panel>

        <Panel title="My teams" action="Manage" onAction={() => go('teams')}>
          {teams === null ? <span style={{ color: '#64748b', fontSize: '0.86rem' }}>Loading…</span>
            : teams.length === 0 ? <div style={{ fontSize: '0.88rem', color: '#64748b' }}>You are not in a team yet. <button type="button" className="home-link" onClick={() => go('teams')}><Plus size={14} /> Create a team</button></div>
            : teams.slice(0, 6).map((t) => (
              <button key={t.id} type="button" onClick={() => go('team-details', t.id)} className="gs-item" style={{ border: '1px solid #f1f5f9', marginBottom: 6 }}>
                <span className="gs-ico">{t.logo_url ? <img src={t.logo_url} alt="" /> : <Users size={15} />}</span>
                <span className="gs-text"><span className="gs-title">{t.name}</span><span className="gs-sub">{[t.city, `${t.squad_size ?? 0} players`, t.i_own ? 'Owner' : 'Member'].filter(Boolean).join(' · ')}</span></span>
              </button>
            ))}
        </Panel>

        <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Radio size={16} color="#dc2626" /> Live around the site</span>} action="Matches" onAction={() => go('matches')}>
          {live === null ? <span style={{ color: '#64748b', fontSize: '0.86rem' }}>Loading…</span> : live.length === 0 ? <span style={{ fontSize: '0.88rem', color: '#64748b' }}>No live matches right now.</span> : live.map(row)}
          {(found?.tournaments || []).length > 0 && (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.8rem 0 0.4rem' }}>Open tournaments</div>
              {found.tournaments.slice(0, 3).map((t) => (
                <button key={t.id} type="button" onClick={() => go('tournament-details', t.id)} className="gs-item" style={{ border: '1px solid #f1f5f9', marginBottom: 6 }}>
                  <span className="gs-ico"><Trophy size={15} /></span><span className="gs-text"><span className="gs-title">{t.title}</span><span className="gs-sub">{t.subtitle}</span></span>
                </button>
              ))}
            </>
          )}
        </Panel>

        <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Bell size={16} /> Latest notifications</span>} action="Settings" onAction={() => go('settings')}>
          {notes === null ? <span style={{ color: '#64748b', fontSize: '0.86rem' }}>Loading…</span> : notes.length === 0 ? <span style={{ fontSize: '0.88rem', color: '#64748b' }}>Nothing new.</span>
            : notes.slice(0, 5).map((n) => (
              <div key={n.id} style={{ padding: '0.5rem 0.2rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: n.read_at ? 600 : 800, fontSize: '0.86rem' }}>{n.title}</div>
                {n.body && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{n.body}</div>}
              </div>
            ))}
        </Panel>
      </div>

      <ArticleFeed title="Latest news & tips" filter={{ featured_first: true }} limit={3} onNavigate={go} currentUser={currentUser} hideWhenEmpty />
    </div>
  );
}

export default MemberHomeView;
