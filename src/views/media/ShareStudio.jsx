import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Share2, Download, MessageCircle, Film, Image as ImageIcon, Upload } from 'lucide-react';
import { loadImage, roundRect, fitText, wrapText, drawBackdrop, drawFooter, canvasToFile, downloadBlob, shareFile, whatsappLink, siteLink } from './mediaUtils.js';

/**
 * #185 Promotional video creation, #186 Tournament posters, #187 Shareable scorecards and player cards,
 * #188 Shareable match results. Everything is drawn in the browser from data already on the website,
 * then shared through the phone's share sheet (WhatsApp, Instagram…) or downloaded.
 */
const W = 1080; const H = 1350;
const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const PALETTES = { green: ['#064e3b', '#10b981'], blue: ['#1e3a8a', '#3b82f6'], red: ['#7f1d1d', '#ef4444'], purple: ['#3b0764', '#a855f7'], dark: ['#020617', '#334155'] };
const overs = (b) => `${Math.floor((b || 0) / 6)}.${(b || 0) % 6}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function Preview({ canvasRef, busy }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 340 }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', height: 'auto', borderRadius: '0.6rem', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', backgroundColor: '#e2e8f0' }} />
      {busy && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '0.85rem' }}>Drawing…</div>}
    </div>
  );
}

function ShareButtons({ canvasRef, fileName, text, link }) {
  const [msg, setMsg] = useState(null);
  const share = async () => { const f = await canvasToFile(canvasRef.current, fileName); const r = await shareFile(f, `${text}${link ? `\n${link}` : ''}`); setMsg(r === 'downloaded' ? 'Saved to your downloads – attach it in WhatsApp / Instagram.' : null); };
  const download = async () => { const f = await canvasToFile(canvasRef.current, fileName); downloadBlob(f, fileName); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <Button size="sm" variant="primary" onClick={share} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Share2 size={13} /> Share image</Button>
        <Button size="sm" variant="secondary" onClick={download} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Download size={13} /> Download</Button>
        {text && <a href={whatsappLink(`${text}${link ? `\n${link}` : ''}`)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: '0.82rem', fontWeight: 700, color: '#15803d', textDecoration: 'none', padding: '0.3rem 0.6rem', border: '1px solid #bbf7d0', borderRadius: '0.4rem' }}><MessageCircle size={13} /> WhatsApp text</a>}
      </div>
      {msg && <span style={{ fontSize: '0.76rem', color: '#64748b' }}>{msg}</span>}
    </div>
  );
}

/* ---------------- #187 / #188 match cards ---------------- */
async function drawResultCard(ctx, centre, live) {
  const m = centre.match; const A = centre.team_a || {}; const B = centre.team_b || {};
  drawBackdrop(ctx, W, H, '#064e3b', '#10b981');
  ctx.fillStyle = '#d1fae5'; ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText((centre.tournament?.name || (m.stage === 'friendly' ? 'Friendly match' : 'Match')).toUpperCase(), W / 2, 110);
  ctx.fillStyle = '#fff'; ctx.font = `600 28px ${FONT}`; ctx.fillText(fmtDate(m.completed_at || m.started_at || m.scheduled_at) + (m.venue ? ` · ${m.venue}` : ''), W / 2, 160);
  const logos = await Promise.all([loadImage(A.logo_url), loadImage(B.logo_url)]);
  const teamRow = (t, logo, y, runs, wk, balls, won) => {
    ctx.fillStyle = won ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'; roundRect(ctx, 90, y, W - 180, 190, 28); ctx.fill();
    if (logo) { ctx.save(); ctx.beginPath(); ctx.arc(190, y + 95, 62, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, 128, y + 33, 124, 124); ctx.restore(); }
    else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(190, y + 95, 62, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#065f46'; ctx.font = `900 54px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText((t.short_name || t.name || '?').slice(0, 2).toUpperCase(), 190, y + 114); }
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; fitText(ctx, t.name || '', 420, 50); ctx.fillText(t.name || '', 285, y + 85);
    if (won) { ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#fde68a'; ctx.fillText('WINNER', 285, y + 130); }
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = `900 70px ${FONT}`;
    ctx.fillText(runs == null ? '–' : `${runs}/${wk ?? 0}`, W - 130, y + 100);
    ctx.font = `600 28px ${FONT}`; ctx.fillText(balls == null ? 'Yet to bat' : `${overs(balls)} overs`, W - 130, y + 145); ctx.textAlign = 'left';
  };
  teamRow(A, logos[0], 230, m.team_a_runs, m.team_a_wickets, m.team_a_balls, m.winner_team_id && m.winner_team_id === A.id);
  teamRow(B, logos[1], 450, m.team_b_runs, m.team_b_wickets, m.team_b_balls, m.winner_team_id && m.winner_team_id === B.id);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 44px ${FONT}`;
  const result = m.status === 'completed' ? (m.result_summary || live?.result_summary || 'Match finished') : m.status === 'live' ? 'LIVE NOW' : 'Match scheduled';
  wrapText(ctx, result, W / 2, 720, W - 200, 54, 2);
  // stars of the match
  const inns = live?.innings || [];
  const bats = inns.flatMap((i) => (i.batting || []).map((b) => ({ ...b, team: i.batting_team?.name }))).filter((b) => b.balls > 0).sort((a, b) => b.runs - a.runs).slice(0, 2);
  const bowls = inns.flatMap((i) => (i.bowling || []).map((b) => ({ ...b, team: i.bowling_team?.name }))).filter((b) => b.legal_balls > 0).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 2);
  const pom = m.player_of_match_id && [...inns.flatMap((i) => i.batting || []), ...inns.flatMap((i) => i.bowling || [])].find((p) => p.player_id === m.player_of_match_id);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; roundRect(ctx, 90, 850, W - 180, pom ? 380 : 320, 28); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = '#a7f3d0'; ctx.font = `700 28px ${FONT}`; ctx.fillText('TOP BATTERS', 130, 905); ctx.fillText('TOP BOWLERS', 570, 905);
  ctx.fillStyle = '#fff'; ctx.font = `600 32px ${FONT}`;
  bats.forEach((b, i) => { ctx.fillText(`${b.name.slice(0, 14)}  ${b.runs}${b.out ? '' : '*'} (${b.balls})`, 130, 960 + i * 50); });
  bowls.forEach((b, i) => { ctx.fillText(`${b.name.slice(0, 14)}  ${b.wickets}/${b.runs} (${overs(b.legal_balls)})`, 570, 960 + i * 50); });
  if (pom) { ctx.fillStyle = '#fde68a'; ctx.font = `800 34px ${FONT}`; ctx.fillText(`🏅 Player of the Match: ${pom.name}`, 130, 1160); }
  drawFooter(ctx, W, H);
}

async function drawScorecard(ctx, centre, live) {
  const m = centre.match;
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#065f46'; ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; fitText(ctx, `${centre.team_a?.name} vs ${centre.team_b?.name}`, W - 100, 46); ctx.fillText(`${centre.team_a?.name} vs ${centre.team_b?.name}`, 50, 75);
  ctx.font = `500 26px ${FONT}`; ctx.fillText(`${centre.tournament?.name ? `${centre.tournament.name} · ` : ''}${fmtDate(m.started_at || m.scheduled_at)}${live?.overs_limit ? ` · ${live.overs_limit} overs` : ''}`, 50, 120);
  let y = 200;
  const inns = (live?.innings || []).slice(0, 2);
  inns.forEach((inn) => {
    ctx.fillStyle = '#d1fae5'; ctx.fillRect(40, y - 40, W - 80, 60);
    ctx.fillStyle = '#064e3b'; ctx.font = `800 32px ${FONT}`; ctx.fillText(inn.batting_team?.name || `Innings ${inn.innings_no}`, 60, y);
    ctx.textAlign = 'right'; ctx.fillText(`${inn.runs}/${inn.wickets} (${overs(inn.legal_balls)})`, W - 60, y); ctx.textAlign = 'left';
    y += 50;
    const bat = (inn.batting || []).filter((b) => b.balls > 0 || b.out).sort((a, b) => b.runs - a.runs).slice(0, 5);
    ctx.font = `600 27px ${FONT}`;
    bat.forEach((b) => { ctx.fillStyle = '#0f172a'; ctx.fillText(b.name.slice(0, 18) + (b.out ? '' : ' *'), 60, y); ctx.fillStyle = '#475569'; ctx.textAlign = 'right'; ctx.fillText(`${b.runs} (${b.balls})  4s ${b.fours}  6s ${b.sixes}`, W - 60, y); ctx.textAlign = 'left'; y += 40; });
    const bowl = (inn.bowling || []).filter((b) => b.legal_balls > 0).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 3);
    y += 6; ctx.fillStyle = '#64748b'; ctx.font = `700 22px ${FONT}`; ctx.fillText('BOWLING', 60, y); y += 36; ctx.font = `600 27px ${FONT}`;
    bowl.forEach((b) => { ctx.fillStyle = '#0f172a'; ctx.fillText(b.name.slice(0, 18), 60, y); ctx.fillStyle = '#475569'; ctx.textAlign = 'right'; ctx.fillText(`${overs(b.legal_balls)}-${b.maidens}-${b.runs}-${b.wickets}`, W - 60, y); ctx.textAlign = 'left'; y += 40; });
    y += 60;
  });
  if (!inns.length) { ctx.fillStyle = '#64748b'; ctx.font = `600 32px ${FONT}`; ctx.fillText('Scorecard appears once play starts.', 60, 260); }
  ctx.fillStyle = '#065f46'; ctx.fillRect(0, H - 150, W, 150);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 36px ${FONT}`;
  wrapText(ctx, m.status === 'completed' ? (m.result_summary || 'Match finished') : m.status === 'live' ? 'LIVE – follow ball by ball' : '', W / 2, H - 95, W - 100, 42, 1);
  ctx.font = `500 24px ${FONT}`; ctx.fillText('localcricket.plateria.in', W / 2, H - 40); ctx.textAlign = 'left';
}

export function MatchShareCards({ matchId, refreshKey }) {
  const [data, setData] = useState(null);
  const [kind, setKind] = useState('result');
  const [busy, setBusy] = useState(true);
  const ref = useRef(null);
  useEffect(() => { Promise.all([dataService.fetchMatchCentre(matchId), dataService.fetchLiveState(matchId).catch(() => null)]).then(([c, l]) => setData({ c, l })).catch(() => setData(false)); }, [matchId, refreshKey]);
  useEffect(() => {
    if (!data || !ref.current) return;
    setBusy(true);
    const ctx = ref.current.getContext('2d'); ctx.clearRect(0, 0, W, H);
    (kind === 'result' ? drawResultCard(ctx, data.c, data.l) : drawScorecard(ctx, data.c, data.l)).finally(() => setBusy(false));
  }, [data, kind]);
  if (data === false) return null;
  const m = data?.c?.match;
  const text = m ? `🏏 ${data.c.team_a?.name} vs ${data.c.team_b?.name}: ${m.status === 'completed' ? (m.result_summary || 'match finished') : m.status === 'live' ? `LIVE ${m.team_a_runs ?? m.team_b_runs ?? ''}` : 'coming up'}` : '';
  return (
    <Card title="Share this match" subtitle="Result card (#188) and scorecard (#187) as pictures for WhatsApp, Instagram and Facebook">
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>
        {[['result', 'Result card'], ['scorecard', 'Scorecard']].map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} style={{ padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${kind === k ? '#16a34a' : '#e2e8f0'}`, backgroundColor: kind === k ? '#dcfce7' : '#fff', fontWeight: kind === k ? 700 : 500 }}>{l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Preview canvasRef={ref} busy={busy || !data} />
        {data && <ShareButtons canvasRef={ref} fileName={`${kind}-${matchId.slice(0, 8)}.png`} text={text} link={siteLink(`match=${matchId}`)} />}
      </div>
    </Card>
  );
}

/* ---------------- #187 player card ---------------- */
export function PlayerShareCard({ profile, stats }) {
  const ref = useRef(null);
  const [palette, setPalette] = useState('green');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    if (!profile || !ref.current) return;
    (async () => {
      setBusy(true);
      const ctx = ref.current.getContext('2d'); ctx.clearRect(0, 0, W, H);
      drawBackdrop(ctx, W, H, ...PALETTES[palette]);
      const photo = await loadImage(profile.photo_url);
      ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 330, 200, 0, Math.PI * 2); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); ctx.clip();
      if (photo) { const s = Math.max(400 / photo.width, 400 / photo.height); ctx.drawImage(photo, W / 2 - (photo.width * s) / 2, 330 - (photo.height * s) / 2, photo.width * s, photo.height * s); }
      else { ctx.fillStyle = PALETTES[palette][0]; ctx.font = `900 150px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText((profile.display_name || '?').slice(0, 1).toUpperCase(), W / 2, 385); }
      ctx.restore();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; fitText(ctx, profile.display_name || '', W - 160, 76, 900); ctx.fillText(profile.display_name || '', W / 2, 640);
      ctx.font = `600 32px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const team = (profile.teams || [])[0];
      ctx.fillText([String(profile.player_role || '').replace('_', '-'), team?.name, profile.player_code].filter(Boolean).join('  ·  '), W / 2, 695);
      const bt = stats?.batting || {}; const bw = stats?.bowling || {};
      const boxes = [['Matches', bt.matches ?? 0], ['Runs', bt.runs ?? 0], ['Highest', bt.highest ? `${bt.highest.runs}${bt.highest.not_out ? '*' : ''}` : '–'],
        ['Strike rate', bt.strike_rate ?? '–'], ['Wickets', bw.wickets ?? 0], ['Economy', bw.economy ?? '–'],
        ['50s / 100s', `${bt.fifties ?? 0} / ${bt.hundreds ?? 0}`], ['Catches', stats?.fielding?.catches ?? 0], ['Player of Match', stats?.player_of_match ?? 0]];
      boxes.forEach(([l, v], i) => {
        const x = 90 + (i % 3) * 310; const y = 760 + Math.floor(i / 3) * 150;
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; roundRect(ctx, x, y, 280, 130, 22); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `900 52px ${FONT}`; ctx.fillText(String(v), x + 140, y + 70);
        ctx.font = `600 24px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(l.toUpperCase(), x + 140, y + 108);
      });
      ctx.textAlign = 'left'; drawFooter(ctx, W, H);
      setBusy(false);
    })();
  }, [profile, stats, palette]);
  if (!profile) return null;
  const bt = stats?.batting || {};
  return (
    <Card title="Player card" subtitle="Share career numbers as a picture (#187)">
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>
        {Object.entries(PALETTES).map(([k, [a, b]]) => <button key={k} type="button" aria-label={k} onClick={() => setPalette(k)} style={{ width: 28, height: 28, borderRadius: 14, cursor: 'pointer', border: palette === k ? '3px solid #0f172a' : '2px solid #fff', background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: '0 0 0 1px #cbd5e1' }} />)}
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Preview canvasRef={ref} busy={busy} />
        <ShareButtons canvasRef={ref} fileName={`player-${(profile.player_code || profile.id).toString().toLowerCase()}.png`}
          text={`🏏 ${profile.display_name}: ${bt.runs ?? 0} runs, ${stats?.bowling?.wickets ?? 0} wickets in ${bt.matches ?? 0} matches`} />
      </div>
    </Card>
  );
}

/* ---------------- #186 poster and #185 promo video ---------------- */
// Fees are typed freely ("₹5,000", "5000", "Free"): format plain numbers, keep anything else as written.
const rupees = (v) => (/^\s*\d+(\.\d+)?\s*$/.test(String(v)) ? `₹${Number(v).toLocaleString('en-IN')}` : String(v).trim());

function posterLines(t) {
  return {
    title: t.name || 'Cricket Tournament',
    when: [fmtDate(t.start_date), t.end_date && t.end_date !== t.start_date ? fmtDate(t.end_date) : null].filter(Boolean).join(' – '),
    where: [t.venue, t.city].filter(Boolean).join(', '),
    facts: [t.overs_per_innings ? `${t.overs_per_innings} overs` : null, t.ball_type ? (/ball/i.test(t.ball_type) ? t.ball_type : `${t.ball_type} ball`) : null, t.teams_count ? `${t.teams_count} teams` : null, t.category || null].filter(Boolean),
    money: [t.entry_fee ? `Entry ${rupees(t.entry_fee)}` : null, t.prize_pool ? `Prize ${rupees(t.prize_pool)}` : null].filter(Boolean),
    cta: t.registration_open ? `Register your team · code ${t.code}` : `Tournament code ${t.code || ''}`,
    by: t.organizer_name ? `Organised by ${t.organizer_name}` : ''
  };
}

async function drawPoster(ctx, t, palette, w = W, h = H) {
  const L = posterLines(t);
  drawBackdrop(ctx, w, h, ...PALETTES[palette]);
  const logo = await loadImage(t.logo_url);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  if (logo) { const s = 220 / Math.max(logo.width, logo.height); ctx.drawImage(logo, w / 2 - (logo.width * s) / 2, 90, logo.width * s, logo.height * s); }
  else { ctx.font = `900 150px ${FONT}`; ctx.fillText('🏏', w / 2, 250); }
  ctx.font = `800 34px ${FONT}`; ctx.fillStyle = '#fde68a'; ctx.fillText('CRICKET TOURNAMENT', w / 2, 370);
  ctx.fillStyle = '#fff'; ctx.font = `900 92px ${FONT}`; fitText(ctx, L.title, w - 120, 96, 900);
  const n = wrapText(ctx, L.title, w / 2, 480, w - 120, 100, 2);
  let y = 480 + n * 100 + 20;
  ctx.font = `700 44px ${FONT}`; if (L.when) { ctx.fillText(`📅 ${L.when}`, w / 2, y); y += 70; }
  if (L.where) { ctx.font = `600 40px ${FONT}`; wrapText(ctx, `📍 ${L.where}`, w / 2, y, w - 140, 50, 2); y += 80; }
  if (L.facts.length) { ctx.font = `600 36px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(L.facts.join('  ·  '), w / 2, y); y += 70; }
  if (L.money.length) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, 110, y, w - 220, 120, 26); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.font = `900 48px ${FONT}`; fitText(ctx, L.money.join('   |   '), w - 280, 48, 900); ctx.fillText(L.money.join('   |   '), w / 2, y + 78); y += 160;
  }
  ctx.fillStyle = '#fff'; ctx.font = `800 38px ${FONT}`; ctx.fillText(L.cta, w / 2, Math.max(y + 20, h - 200));
  if (L.by) { ctx.font = `500 30px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(L.by, w / 2, Math.max(y + 70, h - 140)); }
  ctx.textAlign = 'left'; drawFooter(ctx, w, h);
}

function pickRecorderType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

// 12-second vertical promo (720×1280) made of 4 animated scenes, recorded straight from a canvas.
async function recordPromo(t, palette, onProgress) {
  const type = pickRecorderType(); if (!type) throw new Error('This browser cannot record video. Try Chrome on Android or a computer.');
  const w = 720; const h = 1280; const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
  const L = posterLines(t); const logo = await loadImage(t.logo_url);
  const scenes = [
    { title: 'GET READY', big: L.title, small: L.by },
    { title: 'WHEN & WHERE', big: L.when || 'Dates coming soon', small: L.where },
    { title: 'THE FORMAT', big: L.facts.join(' · ') || 'Local cricket', small: L.money.join('  |  ') },
    { title: t.registration_open ? 'REGISTER NOW' : 'FOLLOW LIVE', big: L.cta, small: 'localcricket.plateria.in' }
  ];
  const SCENE = 3000; const total = SCENE * scenes.length;
  const stream = c.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 }); const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(250); const start = performance.now();
  await new Promise((resolve) => {
    const frame = () => {
      const tms = performance.now() - start; if (tms >= total) return resolve();
      const i = Math.min(scenes.length - 1, Math.floor(tms / SCENE)); const p = (tms % SCENE) / SCENE; const s = scenes[i];
      const ease = Math.min(1, p * 3); const fade = p > 0.85 ? (1 - p) / 0.15 : 1;
      drawBackdrop(ctx, w, h, ...PALETTES[palette]);
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 200 + 260 * p, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.globalAlpha = fade; ctx.textAlign = 'center';
      if (logo && i === 0) { const sc = (160 / Math.max(logo.width, logo.height)) * ease; ctx.drawImage(logo, w / 2 - (logo.width * sc) / 2, 230, logo.width * sc, logo.height * sc); }
      else if (i === 0) { ctx.font = `${Math.round(120 * ease)}px ${FONT}`; ctx.fillText('🏏', w / 2, 360); }
      ctx.fillStyle = '#fde68a'; ctx.font = `800 40px ${FONT}`; ctx.fillText(s.title, w / 2, 470 - 40 * (1 - ease));
      ctx.fillStyle = '#fff'; ctx.font = `900 64px ${FONT}`; fitText(ctx, s.big, w - 80, 70, 900);
      const n = wrapText(ctx, s.big, w / 2, 600 + 60 * (1 - ease), w - 80, 76, 3);
      if (s.small) { ctx.font = `600 34px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)'; wrapText(ctx, s.small, w / 2, 640 + n * 76, w - 100, 44, 2); }
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, h - 10, w * (tms / total), 10);
      onProgress(Math.round((tms / total) * 100));
      requestAnimationFrame(frame);
    };
    frame();
  });
  rec.stop(); await done; stream.getTracks().forEach((tr) => tr.stop());
  const mime = type.split(';')[0];
  return new File([new Blob(chunks, { type: mime })], `promo-${(t.code || 'tournament').toLowerCase()}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, { type: mime });
}

export function TournamentPromoStudio({ tournament }) {
  const ref = useRef(null);
  const [palette, setPalette] = useState('green');
  const [busy, setBusy] = useState(true);
  const [video, setVideo] = useState(null);
  const [progress, setProgress] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!tournament || !ref.current) return;
    setBusy(true); const ctx = ref.current.getContext('2d'); ctx.clearRect(0, 0, W, H);
    drawPoster(ctx, tournament, palette).finally(() => setBusy(false));
  }, [tournament, palette]);
  if (!tournament) return null;
  const L = posterLines(tournament);
  const text = `🏏 ${L.title}${L.when ? `\n📅 ${L.when}` : ''}${L.where ? `\n📍 ${L.where}` : ''}${L.money.length ? `\n💰 ${L.money.join(' | ')}` : ''}\n${L.cta}`;
  const makeVideo = async () => {
    setMsg(null); setVideo(null); setProgress(0);
    try { const f = await recordPromo(tournament, palette, setProgress); setVideo({ file: f, url: URL.createObjectURL(f) }); }
    catch (e) { setMsg(e.message); } finally { setProgress(null); }
  };
  const saveToTournament = async () => {
    setMsg(null);
    try {
      if (video.file.size > 20 * 1024 * 1024) throw new Error('The video is larger than 20 MB – download it instead.');
      await dataService.uploadMedia({ scope: 'tournament', scopeId: tournament.id, kind: 'video', title: `${L.title} – promo`, file: video.file });
      setMsg('Saved to the tournament videos.');
    } catch (e) { setMsg(e.message); }
  };
  return (
    <Card title="Poster & promo video" subtitle="Made from the tournament details – share on WhatsApp status, Instagram and Facebook (#185, #186)">
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>
        {Object.entries(PALETTES).map(([k, [a, b]]) => <button key={k} type="button" aria-label={k} onClick={() => setPalette(k)} style={{ width: 28, height: 28, borderRadius: 14, cursor: 'pointer', border: palette === k ? '3px solid #0f172a' : '2px solid #fff', background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: '0 0 0 1px #cbd5e1' }} />)}
      </div>
      <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.86rem', display: 'inline-flex', gap: 4, alignItems: 'center' }}><ImageIcon size={14} /> Poster</strong>
          <Preview canvasRef={ref} busy={busy} />
          <ShareButtons canvasRef={ref} fileName={`poster-${(tournament.code || 'tournament').toLowerCase()}.png`} text={text} link={siteLink(`tournament=${tournament.id}`)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 260 }}>
          <strong style={{ fontSize: '0.86rem', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Film size={14} /> 12-second promo video</strong>
          {video ? <video src={video.url} controls playsInline style={{ width: '100%', borderRadius: '0.6rem', backgroundColor: '#000' }} />
            : <div style={{ width: 200, aspectRatio: '9/16', borderRadius: '0.6rem', background: `linear-gradient(135deg, ${PALETTES[palette][0]}, ${PALETTES[palette][1]})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.84rem', textAlign: 'center', padding: '0.5rem' }}>{progress != null ? `Recording… ${progress}%` : 'Vertical video for status / reels'}</div>}
          <Button size="sm" variant={video ? 'secondary' : 'primary'} disabled={progress != null} onClick={makeVideo}>{progress != null ? 'Recording… keep this tab open' : video ? 'Make again' : 'Make promo video'}</Button>
          {video && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Button size="sm" variant="primary" onClick={() => shareFile(video.file, text)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Share2 size={13} /> Share</Button>
              <Button size="sm" variant="secondary" onClick={() => downloadBlob(video.file, video.file.name)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Download size={13} /> Download</Button>
              <Button size="sm" variant="secondary" onClick={saveToTournament} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Upload size={13} /> Save to tournament</Button>
            </div>
          )}
          {msg && <span style={{ fontSize: '0.78rem', color: msg.startsWith('Saved') ? '#065f46' : '#b91c1c' }}>{msg}</span>}
        </div>
      </div>
    </Card>
  );
}

export default MatchShareCards;
