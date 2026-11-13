import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { Calendar, MapPin, Trophy, Users, Share2, QrCode, Phone, MessageCircle, Mail, Instagram, Facebook, Youtube, ArrowRight, X } from 'lucide-react';
import { THEMES, fmtDate, siteUrl, money, AdSlot, SponsorStrip, QrCard, trackOnce } from './brandShared.jsx';
import { TrophyTile } from './AwardsPanel.jsx';
import { MerchPanel } from './MerchPanel.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';

/** #189 Tournament website – one shareable page per tournament: ?t=CODE (also reached by its QR code, #190). */
const ALL = ['fixtures', 'results', 'points', 'stats', 'teams', 'sponsors', 'awards', 'gallery', 'merch'];
const over = (b) => (b == null ? '' : `${Math.floor(b / 6)}.${b % 6}`);
const score = (r, w, b) => (r == null ? '–' : `${r}/${w ?? 0}${b != null ? ` (${over(b)})` : ''}`);

function Section({ id, title, children, dark }) {
  return (
    <section id={id} style={{ padding: '2rem 1rem', background: dark ? '#0f172a' : undefined }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.4rem', fontWeight: 900, color: dark ? '#fff' : '#0f172a' }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function MatchRow({ m, onOpen }) {
  const live = m.status === 'live' || m.status === 'paused';
  return (
    <button type="button" onClick={onOpen} style={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem', padding: '0.7rem 0.85rem', border: `1px solid ${live ? '#fecaca' : '#e2e8f0'}`, borderRadius: '0.7rem', background: live ? '#fff7f7' : '#fff', cursor: 'pointer' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{live ? <span style={{ color: '#dc2626', fontWeight: 800 }}>● LIVE · </span> : ''}{m.group?.name ? `${m.group.name} · ` : ''}{m.stage && m.stage !== 'league' ? `${String(m.stage).replace(/_/g, ' ')} · ` : ''}{m.match_no ? `Match ${m.match_no} · ` : ''}{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date to be set'}</span>
        <span style={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{m.team_a?.name || 'TBC'}</span><span style={{ fontWeight: 700 }}>{m.status !== 'scheduled' ? score(m.team_a_runs, m.team_a_wickets, m.team_a_balls) : ''}</span></span>
        <span style={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{m.team_b?.name || 'TBC'}</span><span style={{ fontWeight: 700 }}>{m.status !== 'scheduled' ? score(m.team_b_runs, m.team_b_wickets, m.team_b_balls) : ''}</span></span>
        {m.result_summary && <span style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 700 }}>{m.result_summary}</span>}
      </div>
      <ArrowRight size={16} color="#94a3b8" style={{ alignSelf: 'center' }} />
    </button>
  );
}

export function TournamentSiteView({ refCode, currentUser, onNavigate }) {
  const [d, setD] = useState(undefined);
  const [matches, setMatches] = useState([]);
  const [points, setPoints] = useState([]);
  const [lb, setLb] = useState(null);
  const [awards, setAwards] = useState([]);
  const [qr, setQr] = useState(false);
  const [merchCount, setMerchCount] = useState(0);
  useEffect(() => {
    setD(undefined);
    dataService.getTournamentSite(refCode).then((r) => {
      setD(r || null);
      if (!r) return;
      const id = r.tournament.id;
      trackOnce('site', id, () => dataService.recordView('tournament_site', id));
      dataService.fetchTournamentMatches(id).then((m) => setMatches(m || [])).catch(() => {});
      dataService.fetchPointsTable(id).then((p) => setPoints(p || [])).catch(() => {});
      dataService.fetchLeaderboards(id, 5).then(setLb).catch(() => {});
      dataService.listAwards(id).then((a) => setAwards(a?.items || [])).catch(() => {});
      dataService.listMerch(id).then((m) => setMerchCount((m?.items || []).length)).catch(() => {});
    }).catch(() => setD(null));
  }, [refCode]);
  useEffect(() => { if (d?.tournament) document.title = `${d.tournament.name} · Cricnotch`; }, [d]);

  if (d === undefined) return <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#64748b' }}>Loading tournament…</div>;
  if (d === null) return <div style={{ padding: '4rem 1rem', textAlign: 'center' }}><h2>Tournament not found</h2><p style={{ color: '#64748b' }}>Check the code or link.</p><button type="button" className="hdr-btn-primary" onClick={() => onNavigate('tournaments')}>See all tournaments</button></div>;

  const t = d.tournament; const site = d.site || {};
  const show = (k) => (site.sections || ALL).includes(k);
  const [c1, c2] = THEMES[site.theme] || [t.banner_color || THEMES.green[0], THEMES.green[1]];
  const url = siteUrl(`t=${t.code || t.id}`);
  const live = matches.filter((m) => m.status === 'live' || m.status === 'paused');
  const upcoming = matches.filter((m) => m.status === 'scheduled');
  const results = matches.filter((m) => m.status === 'completed').reverse();
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const nav = [['fixtures', 'Fixtures', upcoming.length + live.length], ['results', 'Results', results.length], ['points', 'Points table', points.length], ['stats', 'Top players', lb?.most_runs?.length],
    ['teams', 'Teams', d.teams.length], ['awards', 'Awards', awards.length], ['gallery', 'Photos', 1], ['merch', 'Shop', merchCount], ['about', 'About', site.about || site.contact_phone ? 1 : 0]].filter(([k, , n]) => (k === 'about' || show(k)) && n);
  const share = `🏏 ${t.name}${t.start_date ? ` – ${fmtDate(t.start_date)}` : ''}${t.venue ? ` at ${t.venue}` : ''}\nFixtures, live scores & results: ${url}`;
  const groups = [...new Set(points.map((p) => p.group_name || ''))];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>
      {/* hero */}
      <header style={{ background: t.banner_url ? `linear-gradient(135deg, ${c1}ee, ${c2}cc), center/cover url(${t.banner_url})` : `linear-gradient(135deg, ${c1}, ${c2})`, color: '#fff', padding: '3rem 1rem 2.4rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: '1.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 110, height: 110, borderRadius: '1.2rem', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {t.logo_url ? <img src={t.logo_url} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} /> : <Trophy size={52} />}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>{t.status === 'ongoing' ? 'IN PROGRESS' : t.status === 'completed' ? 'COMPLETED' : t.registration_open ? 'REGISTRATION OPEN' : 'UPCOMING'} · CODE {t.code}</div>
            <h1 style={{ margin: '0.2rem 0', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1, color: '#fff' }}>{t.name}</h1>
            {site.tagline && <div style={{ fontSize: '1.05rem', opacity: 0.92 }}>{site.tagline}</div>}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem', fontSize: '0.9rem', opacity: 0.95 }}>
              {t.start_date && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Calendar size={15} /> {fmtDate(t.start_date)}{t.end_date && t.end_date !== t.start_date ? ` – ${fmtDate(t.end_date)}` : ''}</span>}
              {(t.venue || t.city) && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><MapPin size={15} /> {[t.venue, t.city].filter(Boolean).join(', ')}</span>}
              <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Users size={15} /> {d.teams.length}{t.teams_count ? ` / ${t.teams_count}` : ''} teams</span>
              {t.overs_per_innings && <span>{t.overs_per_innings} overs · {t.ball_type || ''}</span>}
            </div>
            {(t.entry_fee || t.prize_pool) && <div style={{ marginTop: '0.6rem', fontWeight: 800, fontSize: '1rem' }}>{t.prize_pool ? `🏆 Prize ${/^\d+$/.test(String(t.prize_pool)) ? money(t.prize_pool) : t.prize_pool}` : ''}{t.entry_fee && t.prize_pool ? '  ·  ' : ''}{t.entry_fee ? `Entry ${/^\d+$/.test(String(t.entry_fee)) ? money(t.entry_fee) : t.entry_fee}` : ''}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {t.registration_open && t.status !== 'completed' && <button type="button" onClick={() => onNavigate('tournament-details', t.id)} style={{ background: '#fff', color: c1, border: 'none', borderRadius: 999, padding: '0.6rem 1.1rem', fontWeight: 800, cursor: 'pointer' }}>Register your team</button>}
              {live.length > 0 && <button type="button" onClick={() => onNavigate('match-centre', live[0].id)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.1rem', fontWeight: 800, cursor: 'pointer' }}>● Watch live score</button>}
              <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', borderRadius: 999, padding: '0.6rem 1rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Share2 size={15} /> Share</a>
              <button type="button" onClick={() => setQr(true)} style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}><QrCode size={15} /> QR code</button>
              <button type="button" onClick={() => onNavigate('tournament-details', t.id)} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: '0.6rem 1rem', fontWeight: 700, cursor: 'pointer' }}>{d.is_organiser ? 'Manage tournament' : 'Full details'}</button>
            </div>
          </div>
        </div>
      </header>

      {/* section menu */}
      {nav.length > 1 && (
        <nav style={{ position: 'sticky', top: 64, zIndex: 20, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: '0.2rem', overflowX: 'auto', padding: '0.4rem 0.6rem' }}>
            {nav.map(([k, l]) => <button key={k} type="button" onClick={() => go(k)} style={{ whiteSpace: 'nowrap', background: 'none', border: 'none', padding: '0.45rem 0.75rem', borderRadius: 999, cursor: 'pointer', fontWeight: 700, color: '#334155', fontSize: '0.88rem' }}>{l}</button>)}
          </div>
        </nav>
      )}

      {show('sponsors') && <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.2rem 1rem 0' }}><SponsorStrip tournamentId={t.id} onNavigate={onNavigate} /></div>}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1rem 0' }}><AdSlot slot="tournament_site" tournamentId={t.id} /></div>

      {show('fixtures') && (upcoming.length + live.length > 0) && (
        <Section id="fixtures" title={live.length ? 'Live & upcoming' : 'Upcoming fixtures'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.6rem' }}>
            {[...live, ...upcoming].slice(0, 24).map((m) => <MatchRow key={m.id} m={m} onOpen={() => onNavigate('match-centre', m.id)} />)}
          </div>
        </Section>
      )}
      {show('results') && results.length > 0 && (
        <Section id="results" title="Results">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.6rem' }}>
            {results.slice(0, 24).map((m) => <MatchRow key={m.id} m={m} onOpen={() => onNavigate('match-centre', m.id)} />)}
          </div>
        </Section>
      )}
      {show('points') && points.length > 0 && (
        <Section id="points" title="Points table">
          {groups.map((g) => (
            <div key={g || 'all'} style={{ marginBottom: '1rem', overflowX: 'auto' }}>
              {g && <div style={{ fontWeight: 800, marginBottom: '0.4rem' }}>{g}</div>}
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '0.6rem', overflow: 'hidden', fontSize: '0.88rem' }}>
                <thead><tr style={{ background: c1, color: '#fff' }}>{['#', 'Team', 'P', 'W', 'L', 'T/NR', 'Pts', 'NRR'].map((h) => <th key={h} style={{ padding: '0.5rem', textAlign: h === 'Team' ? 'left' : 'center' }}>{h}</th>)}</tr></thead>
                <tbody>{points.filter((p) => (p.group_name || '') === g).map((p) => (
                  <tr key={p.team_id} style={{ borderBottom: '1px solid #f1f5f9', background: p.qualified ? '#f0fdf4' : undefined }}>
                    <td style={{ padding: '0.45rem', textAlign: 'center' }}>{p.rank_no}</td>
                    <td style={{ padding: '0.45rem', fontWeight: 700 }}>{p.team_name}{p.qualified ? ' ✓' : ''}</td>
                    {[p.played, p.won, p.lost, (p.tied || 0) + (p.no_result || 0)].map((v, i) => <td key={i} style={{ padding: '0.45rem', textAlign: 'center' }}>{v}</td>)}
                    <td style={{ padding: '0.45rem', textAlign: 'center', fontWeight: 800 }}>{p.points}</td>
                    <td style={{ padding: '0.45rem', textAlign: 'center' }}>{p.nrr != null ? Number(p.nrr).toFixed(3) : '–'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </Section>
      )}
      {show('stats') && lb && (lb.most_runs?.length || lb.most_wickets?.length) > 0 && (
        <Section id="stats" title="Top players">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.8rem' }}>
            {[['most_runs', 'Most runs'], ['most_wickets', 'Most wickets'], ['most_sixes', 'Most sixes']].filter(([k]) => lb[k]?.length).map(([k, l]) => (
              <div key={k} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.8rem', padding: '0.8rem' }}>
                <div style={{ fontWeight: 900, marginBottom: '0.4rem' }}>{l}</div>
                {lb[k].map((p, i) => (
                  <button key={p.player_id} type="button" onClick={() => onNavigate('player-profile', p.player_id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, padding: '0.3rem 0', background: 'none', border: 'none', borderBottom: '1px solid #f8fafc', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <span style={{ textAlign: 'left' }}><span style={{ color: '#94a3b8', marginRight: 6 }}>{i + 1}</span>{p.name} <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{p.team}</span></span><strong>{p.value}</strong>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}
      {show('teams') && d.teams.length > 0 && (
        <Section id="teams" title={`Teams (${d.teams.length})`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.6rem' }}>
            {d.teams.map((tm) => (
              <button key={tm.id} type="button" onClick={() => onNavigate('team-details', tm.id)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.8rem', padding: '0.8rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {tm.logo_url ? <img src={tm.logo_url} alt="" style={{ width: 54, height: 54, objectFit: 'contain' }} /> : <span style={{ width: 54, height: 54, borderRadius: 27, background: c1, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(tm.short_name || tm.name).slice(0, 2).toUpperCase()}</span>}
                <span style={{ fontWeight: 800, textAlign: 'center' }}>{tm.name}</span>
                {tm.city && <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{tm.city}</span>}
              </button>
            ))}
          </div>
        </Section>
      )}
      {show('awards') && awards.length > 0 && (
        <Section id="awards" title="Awards">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
            {awards.map((a) => <TrophyTile key={a.id} a={{ ...a, tournament: null }} onOpen={() => a.player ? onNavigate('player-profile', a.player.id) : onNavigate('team-details', a.team.id)} />)}
          </div>
        </Section>
      )}
      {show('gallery') && <div id="gallery" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem 0' }}><MediaGallery scope="tournament" scopeId={t.id} kinds={['photo', 'video']} title="Photos & videos" /></div>}
      {show('merch') && <div id="merch" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem 0' }}><MerchPanel tournament={t} currentUser={currentUser} onNavigate={onNavigate} compact /></div>}

      <Section id="about" title="About & contact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div style={{ fontSize: '0.92rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
            {site.about || t.rules_summary || `${t.name} is organised by ${t.organizer_name || 'the organiser'} on Cricnotch.`}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.8rem', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.9rem' }}>
            <strong>{site.contact_name || t.organizer_name || 'Organiser'}</strong>
            {site.contact_phone && <a href={`tel:${site.contact_phone}`} style={{ color: '#2563eb', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Phone size={15} /> {site.contact_phone}</a>}
            {site.whatsapp && <a href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(`Hi, about ${t.name}`)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#15803d', display: 'inline-flex', gap: 6, alignItems: 'center' }}><MessageCircle size={15} /> WhatsApp</a>}
            {site.email && <a href={`mailto:${site.email}`} style={{ color: '#2563eb', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Mail size={15} /> {site.email}</a>}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              {site.instagram && <a href={site.instagram} target="_blank" rel="noopener noreferrer nofollow" aria-label="Instagram" style={{ color: '#be185d' }}><Instagram size={20} /></a>}
              {site.facebook && <a href={site.facebook} target="_blank" rel="noopener noreferrer nofollow" aria-label="Facebook" style={{ color: '#1d4ed8' }}><Facebook size={20} /></a>}
              {site.youtube && <a href={site.youtube} target="_blank" rel="noopener noreferrer nofollow" aria-label="YouTube" style={{ color: '#dc2626' }}><Youtube size={20} /></a>}
            </div>
            {!site.contact_phone && !site.whatsapp && !site.email && <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Contact details not added yet.</span>}
          </div>
        </div>
      </Section>

      {qr && (
        <div onClick={() => setQr(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '1rem', padding: '1.2rem', maxWidth: 560, width: '100%', position: 'relative' }}>
            <button type="button" onClick={() => setQr(false)} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <h3 style={{ marginTop: 0 }}>Scan to open {t.name}</h3>
            <QrCard url={url} title={t.name} subtitle="Fixtures, live scores & results" size={200} />
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentSiteView;
