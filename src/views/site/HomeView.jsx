import { AdSlot } from '../brand/brandShared.jsx';
import { PromotedCampaigns } from '../brand/PromotionPanels.jsx';
import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { Radio, Trophy, Users, BarChart3, Landmark, Flag, Smartphone, ArrowRight, CalendarDays, MapPin, Zap, ShieldCheck, Share2 } from 'lucide-react';
import { SITE } from '../../config/site.js';

/** Home page for visitors (not signed in). Only real data – nothing is invented. */
const overs = (b) => (b == null ? '' : `${Math.floor(b / 6)}.${b % 6}`);
const score = (r, w, b) => (r == null ? 'Yet to bat' : `${r}/${w ?? 0}${b != null ? ` (${overs(b)})` : ''}`);

function MatchCard({ m, onOpen }) {
  const live = m.status === 'live' || m.status === 'paused';
  return (
    <button type="button" className="home-card" onClick={() => onOpen(m.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: live ? '#dc2626' : m.status === 'scheduled' ? '#2563eb' : '#64748b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {live && <span className="hdr-live-dot" />}{live ? 'LIVE' : m.status === 'scheduled' ? 'UPCOMING' : 'RESULT'}
        </span>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{m.tournament?.name || (m.stage === 'friendly' ? 'Friendly' : '')}{m.overs_per_innings ? ` · ${m.overs_per_innings} ov` : ''}</span>
      </div>
      {[[m.team_a, m.team_a_runs, m.team_a_wickets, m.team_a_balls], [m.team_b, m.team_b_runs, m.team_b_wickets, m.team_b_balls]].map(([t, r, w, b], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#0f172a', minWidth: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: t?.logo_url ? `center/cover url(${t.logo_url})` : '#ecfdf5', color: '#047857', fontSize: '0.7rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{!t?.logo_url && (t?.short_name || t?.name || '?').slice(0, 2).toUpperCase()}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.name || 'TBC'}</span>
          </span>
          <span style={{ fontWeight: 800, color: r == null ? '#94a3b8' : '#0f172a', fontSize: r == null ? '0.78rem' : '0.95rem', whiteSpace: 'nowrap' }}>{m.status === 'scheduled' ? '' : score(r, w, b)}</span>
        </div>
      ))}
      <div style={{ marginTop: '0.55rem', fontSize: '0.78rem', color: '#64748b' }}>
        {m.status === 'completed' ? (m.result_summary || 'Match finished') : m.status === 'scheduled' ? new Date(m.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ball-by-ball now'}
        {m.venue ? ` · ${m.venue}` : ''}
      </div>
    </button>
  );
}

function PromotedSection({ go }) {
  const [has, setHas] = React.useState(true);
  if (!has) return null;
  return (
    <section className="home-section">
      <div className="home-section-head"><div><h2>Promoted</h2><p>Tournaments looking for teams, fans and players</p></div></div>
      <PromotedWatch onEmpty={() => setHas(false)} go={go} />
    </section>
  );
}
function PromotedWatch({ onEmpty, go }) {
  const [n, setN] = React.useState(null);
  React.useEffect(() => { dataService.activeCampaigns({ limit: 3 }).then((l) => { setN((l || []).length); if (!(l || []).length) onEmpty(); }).catch(() => onEmpty()); }, []);
  return n ? <PromotedCampaigns onNavigate={go} limit={3} /> : null;
}

export function HomeView({ onNavigate }) {
  const [matches, setMatches] = useState(null);
  const [found, setFound] = useState(null);
  const [lb, setLb] = useState(null);
  useEffect(() => {
    dataService.listMatches('all', 30).then(setMatches).catch(() => setMatches([]));
    dataService.globalSearch({}).then(setFound).catch(() => setFound({}));
    dataService.fetchLeaderboards(null, 5).then(setLb).catch(() => setLb(null));
  }, []);
  const go = (t, p) => onNavigate && onNavigate(t, p);
  const list = matches || [];
  const live = list.filter((m) => m.status === 'live' || m.status === 'paused');
  const upcoming = list.filter((m) => m.status === 'scheduled').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const recent = list.filter((m) => m.status === 'completed');
  const show = [...live, ...upcoming, ...recent].slice(0, 6);
  const tournaments = found?.tournaments || [];
  const totals = lb?.totals;
  const top = (lb?.mvp || []).slice(0, 5);

  return (
    <div>
      <section className="home-hero">
        <div className="home-hero-inner">
          <div>
            <span className="home-eyebrow"><Zap size={14} /> Free for players, teams and organisers</span>
            <h1 className="home-h1">Every local match.<br /><em>Scored live.</em> Remembered forever.</h1>
            <p className="home-lead">{SITE.name} runs your tournaments, scores matches ball by ball from a phone, and builds every player's career stats – for gully, village, club and corporate cricket.</p>
            <div className="home-cta">
              <button type="button" className="hdr-btn-primary" onClick={() => go('register')}>Create free account</button>
              <button type="button" className="sf-btn-light" onClick={() => go('matches')}>{live.length ? `Watch ${live.length} live match${live.length > 1 ? 'es' : ''}` : 'Browse matches'}</button>
            </div>
            {totals && (totals.matches > 0) && (
              <div className="home-stats">
                <div className="home-stat"><b>{totals.matches}</b><span>matches scored</span></div>
                <div className="home-stat"><b>{totals.runs}</b><span>runs off the bat</span></div>
                <div className="home-stat"><b>{totals.sixes}</b><span>sixes hit</span></div>
                <div className="home-stat"><b>{totals.wickets}</b><span>wickets taken</span></div>
              </div>
            )}
          </div>
          <div className="home-hero-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, marginBottom: '0.8rem' }}><Radio size={18} color="#f87171" /> {live.length ? 'Live right now' : 'Coming up'}</div>
            {matches === null ? <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Loading…</div>
              : (live.length ? live : upcoming).slice(0, 3).length === 0 ? <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>No match is live at the moment. Create one and score it from your phone in under a minute.</div>
              : (live.length ? live : upcoming).slice(0, 3).map((m) => (
                <button key={m.id} type="button" onClick={() => go('match-centre', m.id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'block', padding: '0.75rem 0.85rem', borderRadius: '0.8rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', marginBottom: '0.5rem' }}>
                  {[[m.team_a, m.team_a_runs, m.team_a_wickets, m.team_a_balls], [m.team_b, m.team_b_runs, m.team_b_wickets, m.team_b_balls]].map(([t, r, w, b], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: '0.1rem 0' }}><span>{t?.name || 'TBC'}</span><span>{m.status === 'scheduled' ? '' : score(r, w, b)}</span></div>
                  ))}
                  <div style={{ fontSize: '0.74rem', color: '#a7f3d0', marginTop: 4 }}>{m.status === 'scheduled' ? new Date(m.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Tap to follow ball by ball →'}</div>
                </button>
              ))}
          </div>
        </div>
      </section>

      <AdSlot slot="home_top" className="home-section" />
      <PromotedSection go={go} />

      <section className="home-section">
        <div className="home-section-head"><div><h2>Matches</h2><p>Live, upcoming and latest results</p></div><button type="button" className="home-link" onClick={() => go('matches')}>All matches <ArrowRight size={15} /></button></div>
        {matches === null ? <div style={{ color: '#64748b' }}>Loading…</div> : show.length === 0 ? <div className="info-box" style={{ color: '#64748b' }}>No matches yet – be the first to score one.</div>
          : <div className="home-grid">{show.map((m) => <MatchCard key={m.id} m={m} onOpen={(id) => go('match-centre', id)} />)}</div>}
      </section>

      <AdSlot slot="home_mid" className="home-section" />

      <section className="home-section">
        <div className="home-section-head"><div><h2>Tournaments</h2><p>Open for registration and in progress</p></div><button type="button" className="home-link" onClick={() => go('tournaments')}>All tournaments <ArrowRight size={15} /></button></div>
        {found === null ? <div style={{ color: '#64748b' }}>Loading…</div> : tournaments.length === 0 ? <div className="info-box" style={{ color: '#64748b' }}>No open tournaments right now. <button type="button" className="home-link" onClick={() => go('register')}>Organise one</button></div> : (
          <div className="home-grid">
            {tournaments.map((t) => (
              <button key={t.id} type="button" className="home-card" onClick={() => go('tournament-details', t.id)}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#fef3c7,#fde68a)', color: '#92400e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trophy size={20} /></span>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div><div style={{ fontSize: '0.78rem', color: '#64748b' }}>{t.subtitle}</div></div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {top.length > 0 && (
        <section className="home-section">
          <div className="home-section-head"><div><h2>Top performers</h2><p>Most valuable players across all matches</p></div><button type="button" className="home-link" onClick={() => go('stats')}>Leaderboards <ArrowRight size={15} /></button></div>
          <div className="home-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {top.map((p, i) => (
              <button key={p.player_id} type="button" className="home-card" onClick={() => go('player-profile', p.player_id)} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: p.photo_url ? `center/cover url(${p.photo_url})` : ['#d1fae5', '#dbeafe', '#fef3c7', '#fce7f3', '#ede9fe'][i], color: '#0f172a', fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{!p.photo_url && p.name.charAt(0).toUpperCase()}</span>
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 800, color: '#0f172a' }}>{p.name}</span><span style={{ fontSize: '0.76rem', color: '#64748b' }}>{p.team} · {p.runs} runs · {p.wickets} wkts</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="home-section-head"><div><h2>Everything local cricket needs</h2><p>One free website for players, teams, organisers, grounds and officials</p></div></div>
        <div className="home-grid">
          {[[Radio, 'Live ball-by-ball scoring', 'Score from one phone; everyone follows live with commentary, scorecard and key moments.', 'matches'],
            [Trophy, 'Tournaments made easy', 'Team registration, automatic fixtures, points table, net run rate and knockouts.', 'tournaments'],
            [BarChart3, 'Player career stats', 'Every run and wicket adds to a public profile with leaderboards and awards.', 'stats'],
            [Landmark, 'Book grounds', 'Find grounds near you, see prices and free slots, and request a booking.', 'grounds'],
            [Flag, 'Umpires & scorers', 'Find officials by city and date, invite them to your match and rate them.', 'officials'],
            [Share2, 'Share everywhere', 'Result cards, posters and promo videos for WhatsApp and Instagram in one tap.', 'media']].map(([Icon, title, text, to]) => (
            <button key={title} type="button" className="home-card" onClick={() => go(to)}>
              <span className="home-feature-ico"><Icon size={22} /></span>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.55 }}>{text}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-head"><div><h2>Start in three steps</h2></div></div>
        <div className="home-steps">
          <div className="home-step"><div style={{ fontWeight: 800 }}>Register with your mobile number</div><div style={{ fontSize: '0.86rem', color: '#64748b', marginTop: 4 }}>Free, takes a minute. Your player ID and profile are made for you.</div></div>
          <div className="home-step"><div style={{ fontWeight: 800 }}>Create your team</div><div style={{ fontSize: '0.86rem', color: '#64748b', marginTop: 4 }}>Add players by mobile number – they get their stats automatically.</div></div>
          <div className="home-step"><div style={{ fontWeight: 800 }}>Play and score live</div><div style={{ fontSize: '0.86rem', color: '#64748b', marginTop: 4 }}>Start a match or a whole tournament and share the live link.</div></div>
        </div>
        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginTop: '1.2rem', alignItems: 'center' }}>
          <button type="button" className="hdr-btn-primary" onClick={() => go('register')}>Register – it's free</button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b' }}><ShieldCheck size={15} color="#059669" /> Your phone number is never shown publicly unless you choose.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b' }}><Smartphone size={15} color="#059669" /> Works on any phone browser · Android app coming soon</span>
        </div>
      </section>
    </div>
  );
}

export default HomeView;
