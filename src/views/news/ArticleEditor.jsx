import React, { useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { shrinkImage } from '../media/mediaUtils.js';
import { inp, lbl } from '../brand/brandShared.jsx';
import { RichText } from './RichText.jsx';
import { Wand2, Eye, PenLine, ImagePlus, Trash2 } from 'lucide-react';

// #200–#211 writing and editing an article. The database decides who may write each kind.
const LABEL = {
  news: 'Local news', announcement: 'Tournament announcement', preview: 'Match preview', match_report: 'Match report', interview: 'Player interview',
  story: 'Story', success_story: 'Success story', academy_update: 'Academy update', community_update: 'Community update',
  coaching: 'Coaching tips', guide: 'Guide', equipment: 'Equipment', rules: 'Rules', umpiring: 'Umpiring', scoring: 'Scoring'
};
const LEARN = ['coaching', 'guide', 'equipment', 'rules', 'umpiring', 'scoring'];
const pl = (n, w) => `${n} ${w}${String(n) === '1' ? '' : (w === 'six' ? 'es' : 's')}`;
const ov = (b) => `${Math.floor((b || 0) / 6)}${(b || 0) % 6 ? `.${(b || 0) % 6}` : ''}`;
const day = (d) => (d ? new Date(d).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');

/** Builds a first draft from the real match data (#202 preview, #203 report). */
export async function draftFromMatch(matchId, kind) {
  const [c, l] = await Promise.all([dataService.fetchMatchCentre(matchId), dataService.fetchLiveState(matchId).catch(() => null)]);
  const m = c.match; const A = c.team_a?.name || 'Team A'; const B = c.team_b?.name || 'Team B';
  const t = c.tournament?.name; const where = [m.venue, m.city].filter(Boolean).join(', ');
  const overs = m.overs_per_innings || c.tournament?.overs_per_innings; const perSide = m.players_per_side || c.tournament?.players_per_side;
  if (kind === 'preview') {
    return {
      title: `Preview: ${A} vs ${B}`,
      summary: `${A} take on ${B}${t ? ` in ${t}` : ''}${m.scheduled_at ? ` on ${new Date(m.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}.`,
      body: [`## The match`, `${A} take on ${B}${t ? ` in ${t}${m.match_no ? ` (match ${m.match_no})` : ''}` : ''}.`,
        [m.scheduled_at && `- **When:** ${day(m.scheduled_at)}`, where && `- **Where:** ${where}`, overs && `- **Format:** ${overs} overs a side${perSide ? `, ${perSide} players` : ''}`, (m.ball_type || c.tournament?.ball_type) && `- **Ball:** ${m.ball_type || c.tournament.ball_type}`].filter(Boolean).join('\n'),
        `## Players to watch`, `Write about the players in form for each side.`, `## Our prediction`, `Who do you think will win, and why?`].join('\n\n')
    };
  }
  const inns = l?.innings || [];
  const bats = inns.flatMap((i) => (i.batting || []).map((b) => ({ ...b, team: i.batting_team?.name }))).filter((b) => b.balls > 0).sort((x, y) => y.runs - x.runs).slice(0, 3);
  const bowls = inns.flatMap((i) => (i.bowling || []).map((b) => ({ ...b, team: i.bowling_team?.name }))).filter((b) => b.legal_balls > 0).sort((x, y) => y.wickets - x.wickets || x.runs - y.runs).slice(0, 3);
  const pom = m.player_of_match_id && [...inns.flatMap((i) => i.batting || []), ...inns.flatMap((i) => i.bowling || [])].find((p) => p.player_id === m.player_of_match_id);
  const result = m.result_summary || l?.result_summary || (m.status === 'live' ? 'The match is still in progress.' : '');
  const toss = m.toss_winner_id ? `${m.toss_winner_id === c.team_a?.id ? A : B} won the toss and chose to ${m.toss_decision === 'bat' ? 'bat' : 'bowl'} first.` : '';
  return {
    title: result && m.status === 'completed' ? `${A} vs ${B}: ${result}` : `${A} vs ${B}: match report`,
    summary: [result, t].filter(Boolean).join(' · ').slice(0, 290),
    body: [`## Result`, result || 'Write the result here.', toss,
      inns.length ? `## Scores\n${inns.map((i) => `- **${i.batting_team?.name || `Innings ${i.innings_no}`}:** ${i.runs}/${i.wickets} (${pl(ov(i.legal_balls), 'over')})`).join('\n')}` : '',
      bats.length ? `## Top batters\n${bats.map((b) => `- ${b.name} – ${b.runs}${b.out ? '' : '*'} off ${pl(b.balls, 'ball')}${b.fours ? `, ${pl(b.fours, 'four')}` : ''}${b.sixes ? `, ${pl(b.sixes, 'six')}` : ''} (${b.team})`).join('\n')}` : '',
      bowls.length ? `## Top bowlers\n${bowls.map((b) => `- ${b.name} – ${b.wickets}/${b.runs} in ${pl(ov(b.legal_balls), 'over')} (${b.team})`).join('\n')}` : '',
      pom ? `## Player of the Match\n**${pom.name}**` : '',
      `## How the match went`, `Describe the turning points of the match.`].filter(Boolean).join('\n\n')
  };
}

export function ArticleEditor({ article = null, kinds = ['news'], defaults = {}, isAdmin = false, onCancel, onSaved }) {
  const [f, setF] = useState(() => ({
    kind: article?.kind || defaults.kind || kinds[0], title: article?.title || '', summary: article?.summary || '', body: article?.body || '',
    level: article?.level || 'beginner', city: article?.city || '', video_url: article?.video_url || '', byline: article?.byline || ''
  }));
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const kindList = article ? [article.kind] : kinds;
  const matchId = article?.match_id || defaults.match_id;
  const learning = LEARN.includes(f.kind);

  const autoDraft = async () => {
    setBusy(true); setErr(null);
    try { const d = await draftFromMatch(matchId, f.kind); setF((x) => ({ ...x, ...d })); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const save = async (status) => {
    setBusy(true); setErr(null);
    try {
      const p = { ...f, status, tournament_id: article?.tournament_id || defaults.tournament_id || null, match_id: matchId || null,
        player_id: article?.player_id || defaults.player_id || null, listing_id: article?.listing_id || defaults.listing_id || null, team_id: article?.team_id || defaults.team_id || null };
      let a = await dataService.saveArticle(article?.id || null, p);
      if (cover) {
        try { a = await dataService.setArticleCover({ articleId: a.id, file: await shrinkImage(cover) }); }
        catch (e) { setErr(`Saved, but the picture could not be added: ${e.message}`); setBusy(false); onSaved && onSaved({ ...a, status: 'draft' }); return; }
      }
      onSaved && onSaved(a);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const removeCover = async () => {
    setBusy(true); setErr(null);
    try { await dataService.removeArticleCover(article.id); onSaved && onSaved({ ...article, cover_url: null, _stay: true }); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.7rem', padding: '0.9rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}><PenLine size={16} /> {article ? 'Edit article' : 'Write an article'}</strong>
        <button type="button" onClick={() => setPreview((v) => !v)} className="btn-mini" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{preview ? <><PenLine size={13} /> Edit</> : <><Eye size={13} /> Preview</>}</button>
      </div>
      {preview ? (
        <div style={{ backgroundColor: '#fff', borderRadius: '0.5rem', padding: '0.8rem 1rem', border: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.35rem' }}>{f.title || 'Headline'}</h2>
          {f.summary && <p style={{ margin: '0 0 0.6rem', color: '#475569' }}>{f.summary}</p>}
          <RichText text={f.body} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.6rem' }}>
            {kindList.length > 1 && (
              <label style={lbl}>Kind of article
                <select value={f.kind} onChange={set('kind')} style={inp}>{kindList.map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</select>
              </label>
            )}
            {learning && <label style={lbl}>Level<select value={f.level} onChange={set('level')} style={inp}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>}
            {!learning && <label style={lbl}>Town or city (optional)<input value={f.city} onChange={set('city')} maxLength={80} style={inp} /></label>}
            {isAdmin && <label style={lbl}>Byline (optional)<input value={f.byline} onChange={set('byline')} maxLength={80} placeholder="e.g. Cricnotch Coaching Desk" style={inp} /></label>}
          </div>
          {(f.kind === 'preview' || f.kind === 'match_report') && matchId && (
            <button type="button" disabled={busy} onClick={autoDraft} className="btn-mini" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Wand2 size={13} /> Fill in from the match {f.body ? '(replaces the text)' : ''}
            </button>
          )}
          <label style={lbl}>Headline<input value={f.title} onChange={set('title')} maxLength={140} style={{ ...inp, fontWeight: 700 }} /></label>
          <label style={lbl}>Short summary (shown on cards, optional)<input value={f.summary} onChange={set('summary')} maxLength={300} style={inp} /></label>
          <label style={lbl}>Article
            <textarea value={f.body} onChange={set('body')} rows={12} maxLength={20000} style={{ ...inp, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
            <span style={{ color: '#94a3b8' }}>Tips: start a line with ## for a heading, - for a list, 1. for steps. Use **bold** and *italic*. Links: [text](https://…)</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
            <label style={lbl}>YouTube video (optional)<input value={f.video_url} onChange={set('video_url')} placeholder="https://youtu.be/…" style={inp} /></label>
            <label style={lbl}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ImagePlus size={13} /> Cover picture (JPG, PNG, WEBP)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCover(e.target.files?.[0] || null)} style={{ fontSize: '0.8rem' }} />
            </label>
          </div>
          {article?.cover_url && !cover && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={article.cover_url} alt="" style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 6 }} />
              <button type="button" disabled={busy} onClick={removeCover} className="btn-mini" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Trash2 size={13} /> Remove picture</button>
            </div>
          )}
        </>
      )}
      {err && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => save('published')}>{busy ? 'Saving…' : article?.status === 'published' ? 'Save changes' : 'Publish'}</button>
        {article?.status !== 'published' && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => save('draft')}>Save as draft</button>}
        {onCancel && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

export default ArticleEditor;
