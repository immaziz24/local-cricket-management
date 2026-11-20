import React, { useEffect, useRef, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { overlayOptions } from './mediaExtras.js';
import { delayFromSearch, pushSnapshot, pickSnapshot } from './streamDelay.js';

/**
 * #179 Live score overlay – opened as  ?overlay=<match id>  (optional &style=box).
 * A transparent page with no menus, refreshed every 5 seconds, for streaming apps (Larix, Prism, StreamYard, OBS).
 * #372 Stream synchronization delay: the score is shown late by the match's saved delay (or &delay=seconds in the address),
 * so it appears when the delayed video picture does.
 */
const overs = (b) => `${Math.floor((b || 0) / 6)}.${(b || 0) % 6}`;
const ballText = (b) => {
  if (b.wicket) return 'W';
  if (b.extra === 'wide') return `${(b.extra_runs || 1) > 1 ? b.extra_runs : ''}wd`;
  if (b.extra === 'no_ball') return `${b.runs ? b.runs : ''}nb`;
  if (b.extra === 'bye' || b.extra === 'leg_bye') return `${b.extra_runs || 0}${b.extra === 'bye' ? 'b' : 'lb'}`;
  return String(b.runs ?? 0);
};
const ballColour = (b) => (b.wicket ? '#dc2626' : b.runs === 6 ? '#7c3aed' : b.runs === 4 ? '#2563eb' : b.extra ? '#d97706' : '#334155');

export function ScoreOverlay({ matchId, style = 'bar' }) {
  const opt = overlayOptions(typeof window !== 'undefined' ? window.location.search : '');
  const [centre, setCentre] = useState(null);
  const [live, setLive] = useState(null);
  const [err, setErr] = useState(null);
  const buf = useRef([]);
  const delayRef = useRef(0);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    let stop = false; let haveCentre = false; let timer = null;
    const urlDelay = delayFromSearch(typeof window !== 'undefined' ? window.location.search : '');
    if (urlDelay !== null) delayRef.current = urlDelay;
    const show = () => { const s = pickSnapshot(buf.current, Date.now(), delayRef.current); if (s) setLive(s); };
    const tick = async () => {
      try {
        const [c, l, d] = await Promise.all([
          haveCentre ? Promise.resolve(null) : dataService.fetchMatchCentre(matchId),
          dataService.fetchLiveState(matchId),
          urlDelay === null ? dataService.fetchStreamDelay(matchId).catch(() => delayRef.current) : Promise.resolve(urlDelay)
        ]);
        if (stop) return;
        if (c) { setCentre(c); haveCentre = true; }
        delayRef.current = Number(d) || 0;
        buf.current = pushSnapshot(buf.current, Date.now(), l);
        setErr(null); show();
      } catch (e) { if (!stop) setErr(e.message); }
      // with a delay, look more often so the picture and score line up within about two seconds
      if (!stop) timer = setTimeout(tick, delayRef.current > 0 ? 2000 : 5000);
    };
    tick();
    const clock = setInterval(show, 1000);
    return () => { stop = true; clearTimeout(timer); clearInterval(clock); };
  }, [matchId]);

  if (err && !live) return <div style={{ color: '#fff', font: '600 16px system-ui', padding: 10, textShadow: '0 1px 3px #000' }}>Score unavailable: {err}</div>;
  if (!live || !centre) return null;

  const teamName = (id) => { const t = [centre.team_a, centre.team_b].find((x) => x?.id === id); return t ? (t.short_name || t.name) : ''; };
  const cur = live.current || {};
  const inns = (live.innings || []).find((i) => i.id === cur.innings_id) || (live.innings || [])[live.innings?.length - 1];
  const batters = (inns?.batting || []).filter((b) => b.at_crease || b.player_id === cur.striker_id || b.player_id === cur.non_striker_id).slice(0, 2);
  const bowler = (inns?.bowling || []).find((b) => b.player_id === cur.bowler_id) || (inns?.bowling || []).find((b) => b.player_id === cur.last_over_bowler_id);
  const runs = cur.runs ?? inns?.runs ?? 0; const wk = cur.wickets ?? inns?.wickets ?? 0; const lb = cur.legal_balls ?? inns?.legal_balls ?? 0;
  const batTeam = teamName(cur.batting_team_id || inns?.batting_team?.id);
  const bowlTeam = teamName(cur.bowling_team_id || inns?.bowling_team?.id);
  const finished = live.status === 'completed' || centre.match?.status === 'completed';
  const info = finished ? (live.result_summary || centre.match?.result_summary || 'Match finished')
    : cur.target ? `Need ${cur.runs_needed ?? Math.max(0, cur.target - runs)} from ${cur.balls_left ?? '?'} balls`
    : live.overs_limit ? `${inns?.is_super_over ? 'Super Over' : `Innings ${cur.innings_no || inns?.innings_no || 1}`} · ${live.overs_limit} overs`
    : live.status === 'paused' ? 'Play paused' : '';
  const rr = lb ? (runs / (lb / 6)).toFixed(2) : '0.00';
  const font = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

  if (style === 'box') {
    return (
      <div style={{ position: 'fixed', top: opt.pos === 'bottom' ? 'auto' : 16, bottom: opt.pos === 'bottom' ? 16 : 'auto', left: 16, transform: `scale(${opt.scale})`, transformOrigin: opt.pos === 'bottom' ? 'bottom left' : 'top left', minWidth: 260, fontFamily: font, color: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 18px rgba(0,0,0,0.45)' }}>
        <div style={{ background: opt.accent, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 18 }}>{batTeam}</span>
          <span style={{ fontWeight: 900, fontSize: 26 }}>{runs}/{wk} <span style={{ fontSize: 15, fontWeight: 600 }}>({overs(lb)})</span></span>
        </div>
        <div style={{ background: 'rgba(15,23,42,0.88)', padding: '6px 12px', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {batters.map((b) => <div key={b.player_id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{b.name}{b.on_strike ? ' *' : ''}</span><span style={{ fontWeight: 700 }}>{b.runs} ({b.balls})</span></div>)}
          {bowler && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a7f3d0' }}><span>{bowler.name}</span><span>{bowler.wickets}-{bowler.runs} ({overs(bowler.legal_balls)})</span></div>}
          {info && <div style={{ color: '#fde68a', fontWeight: 700, marginTop: 2 }}>{info}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, ...(opt.pos === 'top' ? { top: 18, transformOrigin: 'top center' } : { bottom: 18, transformOrigin: 'bottom center' }), transform: `scale(${opt.scale})`, display: 'flex', justifyContent: 'center', fontFamily: font, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', color: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 18px rgba(0,0,0,0.5)', maxWidth: '96vw' }}>
        <div style={{ background: opt.accent, padding: '8px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{batTeam} v {bowlTeam}</span>
          <span style={{ fontWeight: 900, fontSize: 28, lineHeight: 1.05 }}>{runs}-{wk} <span style={{ fontSize: 16, fontWeight: 600 }}>{overs(lb)} ov</span></span>
        </div>
        <div style={{ background: 'rgba(15,23,42,0.9)', padding: '6px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 15, minWidth: 190 }}>
          {batters.map((b) => <span key={b.player_id} style={{ whiteSpace: 'nowrap' }}>{b.on_strike ? '▶ ' : ' '}{b.name} <strong>{b.runs}</strong> <span style={{ opacity: 0.75 }}>({b.balls})</span></span>)}
        </div>
        <div style={{ background: 'rgba(30,41,59,0.9)', padding: '6px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 15 }}>
          {bowler && <span style={{ whiteSpace: 'nowrap' }}>{bowler.name} <strong>{bowler.wickets}-{bowler.runs}</strong> <span style={{ opacity: 0.75 }}>({overs(bowler.legal_balls)})</span></span>}
          <span style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            {(cur.this_over || []).slice(-8).map((b, i) => <span key={i} style={{ minWidth: 22, height: 22, borderRadius: 11, background: ballColour(b), fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{ballText(b)}</span>)}
          </span>
        </div>
        <div style={{ background: finished ? '#b45309' : 'rgba(6,95,70,0.92)', padding: '6px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 14, maxWidth: 260 }}>
          {info && <strong>{info}</strong>}
          {!finished && <span style={{ opacity: 0.85 }}>RR {rr}{cur.target ? ` · Target ${cur.target}` : ''}</span>}
        </div>
      </div>
    </div>
  );
}

export default ScoreOverlay;
