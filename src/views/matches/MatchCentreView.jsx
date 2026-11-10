import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowLeft, Coins, MapPin, Clock, Trophy, AlertCircle, CheckCircle, Share2, Copy, PauseCircle, PlayCircle } from 'lucide-react';
import { LineupPanel } from '../tournaments/LineupPanel.jsx';
import { ScoringPanel } from './ScoringPanel.jsx';
import { CommentaryPanel } from './CommentaryPanel.jsx';
import { MatchHistoryPanel } from './MatchHistoryPanel.jsx';
import { MatchAnalysisPanel } from '../stats/MatchAnalysisPanel.jsx';
import { PlayingConditionsPanel } from '../rules/PlayingConditionsPanel.jsx';
import { scoreLine } from '../tournaments/MatchResultForm.jsx';

/**
 * Match page: details, #3 Playing XI, #4 substitutes, #5 toss winner, #6 bat or bowl.
 * Scoring (#7–#19), commentary (#20), scorecards (#21–#23), pause/resume (#24–#25),
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  const load = async () => {
    try { setData(await dataService.fetchMatchCentre(matchId)); setError(null); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [matchId]);
  // #29 instant updates: every ball scored anywhere refreshes this page
  useEffect(() => dataService.subscribeToMatch(matchId, () => { load(); setRefreshKey((k) => k + 1); }), [matchId]);

  if (error) return <Card><div style={{ color: '#b91c1c', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><AlertCircle size={16} /> {error}</div></Card>;
  if (!data) return <div style={{ color: '#94a3b8' }}>Loading match…</div>;

  const m = data.match;
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
    const tail = m.result_summary ? ` – ${m.result_summary}` : m.status === 'live' ? ' – LIVE' : '';
    return `${head}${tail}\n${shareUrl}`;
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('Copy this link', shareUrl); }
  };
  const nativeShare = async () => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <button type="button" onClick={() => onNavigate(data.tournament ? 'tournament-details' : 'matches', data.tournament?.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', gap: '0.3rem', alignItems: 'center', color: '#334155', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
        <ArrowLeft size={16} /> {data.tournament ? data.tournament.name : 'All matches'}
      </button>

      {/* Header */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              {data.tournament ? <><Trophy size={13} /> {data.tournament.name}{m.match_no ? ` · Match ${m.match_no}` : ''}</> : (m.title || 'Friendly match')}
            </span>
            <Badge variant={variant}>{label}</Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{a?.name || 'TBD'}</div>
              <div style={{ fontSize: '1.05rem', color: '#334155' }}>{scoreLine(m.team_a_runs, m.team_a_wickets, m.team_a_balls) || ''}</div>
            </div>
            <div style={{ color: '#94a3b8', fontWeight: 700 }}>vs</div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{b?.name || 'TBD'}</div>
              <div style={{ fontSize: '1.05rem', color: '#334155' }}>{scoreLine(m.team_b_runs, m.team_b_wickets, m.team_b_balls) || ''}</div>
            </div>
          </div>
          {m.result_summary && <div style={{ textAlign: 'center', fontWeight: 800, color: '#065f46' }}>{m.result_summary}</div>}
          {m.toss_winner_id && (
            <div style={{ textAlign: 'center', fontSize: '0.88rem', color: '#334155', display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
              <Coins size={15} /> {nameOf(m.toss_winner_id)} won the toss and chose to {m.toss_decision === 'bat' ? 'bat' : 'bowl'} first.
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.8rem', color: '#64748b' }}>
            <span>{m.match_type === 'two_innings' ? 'Two innings' : `${overs || '?'} overs`}{m.match_type === 'box_cricket' ? ' · box cricket' : ''}</span>
            <span>{perSide} a side</span>
            {ball && <span>{ball} ball</span>}
            {m.scheduled_at && <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}><Clock size={12} /> {when(m.scheduled_at)}</span>}
            {(m.venue || m.city) && <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}><MapPin size={12} /> {[m.venue, m.city].filter(Boolean).join(', ')}</span>}
            {data.scorer_name && <span>Scorer: {data.scorer_name}</span>}
          </div>
        </div>
      </Card>

      {/* #28 share, #24 #25 pause / resume */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="secondary" size="sm" onClick={nativeShare} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Share2 size={14} /> Share</Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText())}`} target="_blank" rel="noreferrer"
           style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d', textDecoration: 'none', border: '1px solid #bbf7d0', borderRadius: '0.45rem', padding: '0.35rem 0.7rem', backgroundColor: '#f0fdf4' }}>WhatsApp</a>
        <Button variant="secondary" size="sm" onClick={copyLink} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Copy size={14} /> {copied ? 'Copied!' : 'Copy link'}</Button>
        {data.can_score && m.status === 'live' && (
          <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', marginLeft: 'auto' }}>
            {!m.paused_at && <input value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} placeholder="Reason (rain, break…)" style={{ padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem', width: 160 }} />}
            <Button variant="secondary" size="sm" disabled={busy} onClick={togglePause} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {m.paused_at ? <><PlayCircle size={14} /> Resume play</> : <><PauseCircle size={14} /> Pause</>}
            </Button>
          </span>
        )}
      </div>

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

      {/* Tabs once the match has started */}
      {m.status !== 'scheduled' && (
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          {[['live', m.status === 'live' ? 'Live' : 'Summary'], ['scorecard', 'Scorecard'], ['commentary', 'Commentary'], ['analysis', 'Analysis'], ['lineups', 'Playing XI'], ['rules', 'Rules'], ['history', 'History']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setTab(v)}
              style={{ padding: '0.55rem 1rem', border: 'none', borderBottom: `3px solid ${tab === v ? '#059669' : 'transparent'}`, background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: tab === v ? '#065f46' : '#64748b' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Playing XI (#3, #4) */}
      {(m.status === 'scheduled' || tab === 'lineups') && (
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
              <Button variant="primary" disabled={busy || !toss.winner || !toss.decision} onClick={startMatch}>{busy ? 'Starting…' : 'Start match'}</Button>
              <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: '#64748b' }}>Both Playing XIs must be picked first.</span>
            </div>
          </div>
        </Card>
      )}

      {/* Category E: playing conditions (editable until the match starts) */}
      {m.status === 'scheduled' && <PlayingConditionsPanel matchId={m.id} />}

      {m.status === 'scheduled' && !data.can_score && (
        <Card><p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>This match has not started yet. Only the scorer or the tournament organiser can start it.</p></Card>
      )}

      {/* Ball-by-ball scoring and scorecard (#7–#19) */}
      {m.status !== 'scheduled' && tab === 'live' && <ScoringPanel matchId={m.id} mode="live" refreshKey={refreshKey} onChanged={() => load()} />}
      {m.status !== 'scheduled' && tab === 'scorecard' && <ScoringPanel matchId={m.id} mode="scorecard" refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'commentary' && <CommentaryPanel matchId={m.id} live={m.status === 'live'} refreshKey={refreshKey} />}
      {m.status !== 'scheduled' && tab === 'analysis' && <MatchAnalysisPanel matchId={m.id} matchStatus={m.status} canScore={data.can_score} refreshKey={refreshKey} onNavigate={onNavigate} />}
      {m.status !== 'scheduled' && tab === 'rules' && <PlayingConditionsPanel matchId={m.id} />}
      {m.status !== 'scheduled' && tab === 'history' && <MatchHistoryPanel matchId={m.id} refreshKey={refreshKey} />}
    </div>
  );
}

export default MatchCentreView;
