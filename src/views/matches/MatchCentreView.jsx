import './matchCentre.css';
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ArticleFeed } from '../news/newsShared.jsx';
import { MatchRecapPanel } from '../news/MatchRecapPanel.jsx';
import { ArrowLeft, Coins, MapPin, Clock, Trophy, AlertCircle, CheckCircle, Share2, Copy, PauseCircle, PlayCircle } from 'lucide-react';
import { LineupPanel } from '../tournaments/LineupPanel.jsx';
import { ScoringPanel } from './ScoringPanel.jsx';
import { loadQueue } from './offlineScoring.js';

function readCachedMatch(matchId) {
  try { return JSON.parse(localStorage.getItem(`cricnotch:match-centre:${matchId}`)); }
  catch { return null; }
}
import { FullScorecard } from './FullScorecard.jsx';
import { CommentaryPanel } from './CommentaryPanel.jsx';
import { MatchHistoryPanel } from './MatchHistoryPanel.jsx';
import { MatchAnalysisPanel } from '../stats/MatchAnalysisPanel.jsx';
import { PlayingConditionsPanel } from '../rules/PlayingConditionsPanel.jsx';
import { RuleOverridesPanel } from '../rules/RuleOverridesPanel.jsx';
import { MatchReportsPanel } from './MatchReportsPanel.jsx';
import { MatchOfficialsPanel } from '../officials/MatchOfficialsPanel.jsx';
import { MatchGroundCard } from '../grounds/MatchGroundCard.jsx';
import { MatchPunctualityPanel } from '../punctuality/MatchPunctualityPanel.jsx';
import { scoreLine } from '../tournaments/MatchResultForm.jsx';
import { LiveStreamPanel } from '../media/LiveStreamPanel.jsx';
import { HighlightsPanel } from '../media/HighlightsPanel.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { MatchShareCards } from '../media/ShareStudio.jsx';
import { SponsorStrip, AdSlot } from '../brand/brandShared.jsx';

/**
 * Match page: details, #3 Playing XI, #4 substitutes, #5 toss winner, #6 bat or bowl.
 * Scoring (#7-#19), commentary (#20), scorecards (#21-#23), pause/resume (#24-#25),
 * share link (#28), instant live updates (#29) and scoring history (#30).
 */

const STATUS = { live: ['danger', 'LIVE'], scheduled: ['warning', 'Not started'], completed: ['success', 'Finished'], abandoned: ['neutral', 'Abandoned'], cancelled: ['neutral', 'Cancelled'] };
const when = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';

export function MatchCentreView({ matchId, onNavigate = () => {} }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [toss, setToss] = useState({ winner: '', decision: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lineupKey, setLineupKey] = useState(0);
  const [tab, setTab] = useState('live');
  const [analysis, setAnalysis] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [finishReason, setFinishReason] = useState('');

  const load = async () => {
    try {
      const match = await dataService.fetchMatchCentre(matchId);
      setData(match);
      setError(null);
      try {
        // The scoring panel separately restores its cached scoring state.
        localStorage.setItem(`cricnotch:match-centre:${matchId}`, JSON.stringify({ ...match, can_score: false }));
      } catch { /* storage may be unavailable */ }
    } catch (err) {
      const cached = !navigator.onLine && readCachedMatch(matchId);
      if (cached) { setData(cached); setError(null); }
      else setError(err.message);
    }
  };
  const completed = data?.match?.status === 'completed';
  useEffect(() => {
    if (!completed && data?.match?.status !== 'abandoned') return;
    let active = true;
    dataService.fetchMatchAnalysis(matchId).then((analysis) => {
      if (!active) return;
      setAnalysis(analysis);
    }).catch(() => { if (active) setAnalysis(null); });
    return () => { active = false; };
  }, [completed, data?.match?.status, matchId, refreshKey]);

  useEffect(() => { load(); }, [matchId]);
  useEffect(() => {
    window.addEventListener('online', load);
    return () => window.removeEventListener('online', load);
  }, [matchId]);
  // #29 instant updates: every ball scored anywhere refreshes this page
  useEffect(() => dataService.subscribeToMatch(matchId, () => { load(); setRefreshKey((k) => k + 1); }), [matchId]);

  if (error) return <Card><div style={{ color: '#b91c1c', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><AlertCircle size={16} /> {error}</div></Card>;
  if (!data) return <div style={{ color: '#94a3b8' }}>Loading match.</div>;

  const m = data.match;
  const staff = data.can_manage || data.can_score;
  const players = analysis?.players || [];
  const batters = players.filter((p) => p.runs > 0 || p.balls > 0)
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 3);
  const bowlers = players.filter((p) => p.wickets > 0 || p.runs_conceded > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded).slice(0, 3);
  const honours = [
    ['Player of the Match', analysis?.player_of_match],
    ['Best batter', batters[0], batters[0] && `${batters[0].runs} runs (${batters[0].balls} balls)`],
    ['Best bowler', bowlers[0], bowlers[0] && `${bowlers[0].wickets}/${bowlers[0].runs_conceded}`],
  ];
  const a = data.team_a; const b = data.team_b;
  const [variant, label] = STATUS[m.status] || ['neutral', m.status];
  const nameOf = (id) => (id === a?.id ? a.name : id === b?.id ? b.name : '');
  const overs = m.overs_per_innings || data.tournament?.overs_per_innings;
  const perSide = m.players_per_side || data.tournament?.players_per_side || 11;
  const ball = m.ball_type || data.tournament?.ball_type;

  const shareUrl = `${window.location.origin}${window.location.pathname}?match=${m.id}`;
  const shareText = () => {
    const sa = scoreLine(m.team_a_runs, m.team_a_wickets, m.team_a_balls);
    const sb = scoreLine(m.team_b_runs, m.team_b_wickets, m.team_b_balls);
    const head = `${a?.name || 'TBD'}${sa ? ` ${sa}` : ''} vs ${b?.name || 'TBD'}${sb ? ` ${sb}` : ''}`;
    const tail = m.result_summary ? ` - ${m.result_summary}` : m.status === 'live' ? ' - LIVE' : '';
    return `${head}${tail}\n${shareUrl}`;
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('Copy this link', shareUrl); }
  };
  const nativeShare = async () => {
    if (window.CricnotchSharing?.shareLink) {
      window.CricnotchSharing.shareLink('Live cricket score', shareUrl);
      return;
    }
    if (navigator.share) { try { await navigator.share({ title: 'Live cricket score', text: shareText() }); } catch { /* cancelled */ } }
    else copyLink();
  };
  const togglePause = async () => {
    setBusy(true); setMsg(null);
    try {
      if (m.paused_at) await dataService.resumeMatch(m.id);
      else await dataService.pauseMatch(m.id, pauseReason || 'Play stopped');
      setPauseReason(''); await load();
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  const finishMatch = async (event) => {
    event.preventDefault();
    if (busy || !finishReason.trim()) return;
    if (!navigator.onLine || loadQueue(m.id).length) {
      setMsg({ ok: false, text: 'Connect to the internet and let pending balls sync before finishing.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await dataService.abandonMatch(m.id, finishReason.trim());
      setFinishing(false);
      setFinishReason('');
      setRefreshKey((key) => key + 1);
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const startMatch = async () => {
    if (!toss.winner || !toss.decision) { setMsg({ ok: false, text: 'Choose who won the toss and what they chose.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await dataService.startMatch(m.id, toss.winner, toss.decision);
      setMsg({ ok: true, text: 'Match started.' });
      await load(); setLineupKey((k) => k + 1);
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  };

  if (m.status === 'scheduled' && !staff) {
    const squads = tab === 'fixture-squads';
    const round = ({ league: 'League Matches', group: 'Group Stage', final: 'Final' })[m.stage]
      || m.stage?.replaceAll('_', ' ') || (m.match_no ? `Match ${m.match_no}` : 'Upcoming match');
    const back = () => onNavigate(data.tournament ? 'tournament-details' : 'matches', data.tournament?.id);
    const details = [
      ['Tournament', data.tournament?.id ? <button type="button" className="fixture-tournament" onClick={back}>{data.tournament.name}<span aria-hidden="true">></span></button> : data.tournament?.name],
      ['Round', round],
      ['Match type', ({ box_cricket: 'Box cricket', two_innings: 'Two innings', limited_overs: 'Limited overs' })[m.match_type || data.tournament?.match_type]],
      ['Overs', overs],
      ['Date & time', m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
      }) + ' IST' : null],
      ['Venue', [data.ground_name || m.venue, m.city].filter(Boolean).join(', ')],
      ['Ball type', ball],
      ['Match ID', m.id],
    ];
    return (
      <section className="fixture-screen">
        <header className="fixture-toolbar">
          <button type="button" className="fixture-icon" onClick={back} aria-label="Back"><ArrowLeft size={23} /></button>
          <h1>{round}</h1>
          <button type="button" className="fixture-icon" onClick={nativeShare} aria-label="Share match"><Share2 size={21} /></button>
          <button type="button" className="fixture-icon" onClick={copyLink} aria-label={copied ? 'Link copied' : 'Copy match link'}><Copy size={20} /></button>
        </header>
        <nav className="fixture-tabs" aria-label="Fixture sections">
          <button type="button" aria-pressed={!squads} onClick={() => setTab('live')}>Info</button>
          <button type="button" aria-pressed={squads} onClick={() => setTab('fixture-squads')}>Squads</button>
        </nav>
        <div className="fixture-content">
          {copied && <span role="status">Match link copied.</span>}
          {squads ? (
            <>
              <h2>Squads</h2>
              <div className="fixture-team-links">
                {[a, b].filter(team => team?.id).map(team => (
                  <button type="button" key={team.id} onClick={() => onNavigate('team-details', team.id)}>{team.name}</button>
                ))}
              </div>
              {a && b ? <LineupPanel match={m} /> : <p>Teams to be announced.</p>}
            </>
          ) : (
            <>
              <h2>Match details</h2>
              <dl className="fixture-info">
                {details.map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value || '-'}</dd></div>)}
              </dl>
              <h2>Match banner</h2>
              <div className="fixture-banner">
                <span>{data.tournament?.name || 'Cricnotch'}{m.match_no ? ` � Match ${m.match_no}` : ''}</span>
                <strong>{a?.name || 'TBD'} <small>vs</small> {b?.name || 'TBD'}</strong>
                <span>{label}</span>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="match-centre" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <button type="button" onClick={() => onNavigate(data.tournament ? 'tournament-details' : 'matches', data.tournament?.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', gap: '0.3rem', alignItems: 'center', color: '#334155', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
        <ArrowLeft size={16} /> {data.tournament ? data.tournament.name : 'All matches'}
      </button>

      {/* Header */}
      <section className="match-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#b6ccda', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              {data.tournament ? <><Trophy size={13} /> {data.tournament.name}{m.match_no ? ` � Match ${m.match_no}` : ''}</> : (m.title || 'Friendly match')}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Badge variant={variant}>{label}</Badge>
              {data.can_manage && <span>Managed by me</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'start', gap: '0.75rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, overflowWrap: 'anywhere' }}>{a?.name || 'TBD'}</div>
              <div style={{ fontSize: '1.05rem', color: '#e0edf3' }}>{scoreLine(m.team_a_runs, m.team_a_wickets, m.team_a_balls) || (m.status === 'live' ? 'Yet to bat' : '-')}</div>
            </div>
            <div style={{ color: '#94a3b8', fontWeight: 700 }}>vs</div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, overflowWrap: 'anywhere' }}>{b?.name || 'TBD'}</div>
              <div style={{ fontSize: '1.05rem', color: '#e0edf3' }}>{scoreLine(m.team_b_runs, m.team_b_wickets, m.team_b_balls) || (m.status === 'live' ? 'Yet to bat' : '-')}</div>
            </div>
          </div>
          {m.result_summary && <div style={{ textAlign: 'center', fontWeight: 800, color: '#84f2ba' }}>{m.result_summary}</div>}
          {m.toss_winner_id && (
            <div style={{ textAlign: 'center', fontSize: '0.88rem', color: '#e0edf3', display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
              <Coins size={15} /> {nameOf(m.toss_winner_id)} won the toss and chose to {m.toss_decision === 'bat' ? 'bat' : 'bowl'} first.
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.8rem', color: '#b6ccda' }}>
            <span>{m.match_type === 'two_innings' ? 'Two innings' : `${overs || '?'} overs`}{m.match_type === 'box_cricket' ? ' � box cricket' : ''}</span>
            <span>{perSide} a side</span>
            {ball && <span>{ball} ball</span>}
            {m.scheduled_at && <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}><Clock size={12} /> {when(m.scheduled_at)}</span>}
            {(m.venue || m.city) && <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}><MapPin size={12} /> {[m.venue, m.city].filter(Boolean).join(', ')}</span>}
            {data.scorer_name && <span>Scorer: {data.scorer_name}</span>}
          </div>
          {completed && honours?.some(([, player]) => player) && (
            <div aria-label="Match awards" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {honours.map(([label, player, figures]) => player && (
                <div key={label} style={{ flex: '1 1 10rem', background: '#ffffff18', borderRadius: '0.55rem', padding: '0.65rem' }}>
                  <small>{label}</small>
                  <div><strong>{player.name}</strong></div>
                  {figures && <small>{figures}</small>}
                </div>
              ))}
            </div>
          )}
        </section>

      {/* #28 share, #24 #25 pause / resume */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="secondary" size="sm" onClick={nativeShare} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Share2 size={14} /> Share</Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText())}`} target="_blank" rel="noreferrer"
           style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d', textDecoration: 'none', border: '1px solid #bbf7d0', borderRadius: '0.45rem', padding: '0.35rem 0.7rem', backgroundColor: '#f0fdf4' }}>WhatsApp</a>
        <Button variant="secondary" size="sm" onClick={copyLink} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Copy size={14} /> {copied ? 'Copied!' : 'Copy link'}</Button>
        {data.can_score && m.status === 'live' && (
          <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', marginLeft: 'auto' }}>
            {!m.paused_at && <input value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} placeholder="Reason (rain, break.)" style={{ padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem', width: 160 }} />}
            <Button variant="secondary" size="sm" disabled={busy} onClick={togglePause} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {m.paused_at ? <><PlayCircle size={14} /> Resume play</> : <><PauseCircle size={14} /> Pause</>}
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setFinishing(!finishing)}>
              Finish match
            </Button>
          </span>
        )}
      </div>

      {data.can_score && m.status === 'live' && finishing && (
        <Card title="Finish match early">
          <p>The scorecard will be kept and the match will count as no result.</p>
          <form onSubmit={finishMatch}>
            <label>Reason <input required value={finishReason} onChange={(event) => setFinishReason(event.target.value)} placeholder="For example, rain" /></label>
            <Button type="submit" disabled={busy || !finishReason.trim()}>Confirm no result</Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setFinishing(false)}>Cancel</Button>
          </form>
        </Card>
      )}

      {m.status === 'live' && m.paused_at && (
        <div style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontWeight: 700, fontSize: '0.9rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <PauseCircle size={16} /> Play stopped: {m.paused_reason} (since {new Date(m.paused_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })})
        </div>
      )}

      {msg && (
        <div style={{ padding: '0.65rem 0.9rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center', backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c' }}>
          {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      {staff && data.tournament?.id && <SponsorStrip tournamentId={data.tournament.id} showBanner={false} onNavigate={onNavigate} />}
      {staff && <AdSlot slot="match_page" tournamentId={data.tournament?.id || null} />}

      {/* Tabs once the match has started */}
      {m.status !== 'scheduled' && (
        <nav className="match-tabs" aria-label="Match sections">
          {[['live', m.status === 'live' ? 'Live' : 'Summary'], ['scorecard', 'Scorecard'], ...(completed && data.can_score ? [['scoring', 'Scoring tools']] : []), ['commentary', 'Commentary'], ['over', 'Over'], ['analysis', 'Analysis'], ['lineups', 'Playing XI'], ['matchday', 'Match day'], ['officials', 'Ground & officials'], ['rules', 'Rules'], ['media', 'Video & media'], ['news', 'Previews & reports'], ['reports', 'Reports'], ['history', 'History']].filter(([v]) => staff || ['live', 'scorecard', 'commentary', 'over', 'analysis', 'lineups'].includes(v)).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)}
              style={{ padding: '0.55rem 1rem', border: 'none', borderBottom: `3px solid ${tab === v ? '#059669' : 'transparent'}`, background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: tab === v ? '#065f46' : '#64748b' }}>
              {l}
            </button>
          ))}
        </nav>
      )}

      {/* Step 1: Playing XI (#3, #4) */}
      {((staff && m.status === 'scheduled') || tab === 'lineups') && (
        <Card title={m.status === 'scheduled' ? '1. Playing XI & substitutes' : 'Playing XI'}>
          {a && b ? <LineupPanel key={lineupKey} match={m} /> : <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Both teams must be set first.</span>}
        </Card>
      )}

      {/* Step 2: Toss (#5, #6) */}
      {m.status === 'scheduled' && data.can_score && a && b && (
        <Card title="2. Toss">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>Who won the toss?</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[a, b].map((t) => (
                  <button key={t.id} type="button" onClick={() => setToss({ ...toss, winner: t.id })}
                    style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, border: `2px solid ${toss.winner === t.id ? '#059669' : '#e2e8f0'}`, backgroundColor: toss.winner === t.id ? '#ecfdf5' : '#fff' }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            {toss.winner && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>{nameOf(toss.winner)} chose to</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[['bat', 'Bat first'], ['bowl', 'Bowl first']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setToss({ ...toss, decision: v })}
                      style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, border: `2px solid ${toss.decision === v ? '#059669' : '#e2e8f0'}`, backgroundColor: toss.decision === v ? '#ecfdf5' : '#fff' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Button variant="primary" disabled={busy || !toss.winner || !toss.decision} onClick={startMatch}>{busy ? 'Starting.' : 'Start match'}</Button>
              <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: '#64748b' }}>Both Playing XIs must be picked first.</span>
            </div>
          </div>
        </Card>
      )}

      {/* Category E: playing conditions (editable until the match starts) */}
      {data.can_manage && m.status === 'scheduled' && (
        <Button variant="outline" size="sm" style={{ alignSelf: 'flex-start' }}
          onClick={() => document.getElementById('match-playing-conditions')?.scrollIntoView({ block: 'start' })}>
          Set late-arrival rule
        </Button>
      )}
      {staff && m.status === 'scheduled' && <RuleOverridesPanel matchId={m.id} refreshKey={refreshKey} />}
      {staff && m.status === 'scheduled' && <MatchPunctualityPanel matchId={m.id} refreshKey={refreshKey} />}
      {staff && m.status === 'scheduled' && <MatchGroundCard match={m} groundName={data.ground_name} canManage={data.can_manage} onNavigate={onNavigate} onChanged={load} />}
      {staff && m.status === 'scheduled' && <MatchOfficialsPanel match={m} onNavigate={onNavigate} />}
      {staff && m.status === 'scheduled' && (
        <div id="match-playing-conditions" style={{ scrollMarginTop: '9rem' }}>
          <PlayingConditionsPanel matchId={m.id} />
        </div>
      )}
      {staff && m.status === 'scheduled' && <LiveStreamPanel matchId={m.id} matchStatus={m.status} />}
      {staff && m.status === 'scheduled' && <MatchShareCards matchId={m.id} refreshKey={refreshKey} />}
      {staff && m.status === 'scheduled' && <ArticleFeed title="Match previews" filter={{ match_id: m.id }} writeKinds={['preview']} defaults={{ match_id: m.id }} onNavigate={onNavigate} limit={6} emptyText="No preview yet - write one." />}

      {/* Ball-by-ball scoring and scorecard (#7-#19) */}
      {(m.status === 'live' && tab === 'live' || completed && data.can_score && tab === 'scoring') && <ScoringPanel matchId={m.id} mode="live" refreshKey={refreshKey} onChanged={() => load()} />}
      {m.status !== 'scheduled' && m.status !== 'live' && tab === 'live' && (
        <>
          <Card title="Best performances">
            {[
              ['Batters', batters, ['R', 'B', 'SR'], (p) => [p.runs, p.balls, p.balls ? (100 * p.runs / p.balls).toFixed(2) : '-']],
              ['Bowlers', bowlers, ['R', 'W'], (p) => [p.runs_conceded, p.wickets]]
            ].map(([title, entries, columns, figures]) => (
              <table key={title} className="match-summary-table">
                <thead><tr><th scope="col">{title}</th>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
                <tbody>
                  {entries.map((player) => (
                    <tr key={player.player_id}><th scope="row">{player.name}</th>
                      {figures(player).map((value, index) => <td key={columns[index]}>{value}</td>)}
                    </tr>
                  ))}
                  {!entries.length && <tr><td colSpan={columns.length + 1}>No recorded performances.</td></tr>}
                </tbody>
              </table>
            ))}
          </Card>
          {!!analysis?.innings?.length && (
            <Card title="Innings summary">
              <ul className="match-summary-innings">
                {analysis.innings.map((innings) => (
                  <li key={innings.innings_no}>
                    <strong>{innings.team} � Innings {innings.innings_no}</strong>
                    <span>{innings.runs}/{innings.wickets} ({Math.floor(innings.legal_balls / 6)}.{innings.legal_balls % 6} ov)</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      {m.status !== 'scheduled' && tab === 'scorecard' && <FullScorecard matchId={m.id} refreshKey={refreshKey} onNavigate={onNavigate} />}
      {m.status !== 'scheduled' && ['commentary', 'over'].includes(tab) && <CommentaryPanel key={tab} byOver={tab === 'over'} matchId={m.id} live={m.status === 'live'} refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'analysis' && <MatchAnalysisPanel matchId={m.id} matchStatus={m.status} canScore={data.can_score} refreshKey={refreshKey} onNavigate={onNavigate} />}
      {m.status !== 'scheduled' && tab === 'rules' && <PlayingConditionsPanel matchId={m.id} />}
      {m.status !== 'scheduled' && tab === 'rules' && <RuleOverridesPanel matchId={m.id} refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'matchday' && <MatchPunctualityPanel matchId={m.id} refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'officials' && <MatchGroundCard match={m} groundName={data.ground_name} canManage={data.can_manage} onNavigate={onNavigate} onChanged={load} />}
      {m.status !== 'scheduled' && tab === 'officials' && <MatchOfficialsPanel match={m} onNavigate={onNavigate} />}
      {m.status !== 'scheduled' && tab === 'reports' && <MatchReportsPanel matchId={m.id} refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'history' && <MatchHistoryPanel matchId={m.id} refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'media' && <LiveStreamPanel matchId={m.id} matchStatus={m.status} />}
      {m.status !== 'scheduled' && tab === 'media' && <HighlightsPanel matchId={m.id} refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'media' && <MediaGallery scope="match" scopeId={m.id} kinds={['photo', 'video']} title="Match photos & videos" subtitle="Photo gallery and video uploads" refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'media' && <MatchShareCards matchId={m.id} refreshKey={refreshKey} />}
      {m.status === 'completed' && tab === 'news' && staff && <MatchRecapPanel matchId={m.id} />}
      {m.status !== 'scheduled' && tab === 'news' && <ArticleFeed title="Match previews & reports" subtitle="Write a report - it starts from the scorecard" filter={{ match_id: m.id }} writeKinds={['match_report', 'preview']} defaults={{ match_id: m.id, kind: 'match_report' }} onNavigate={onNavigate} limit={12} emptyText="No report yet - be the first to write one." />}
    </div>
  );
}

export default MatchCentreView;
