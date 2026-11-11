import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { youtubeId } from '../media/mediaUtils.js';
import { Newspaper, PenLine, BadgeCheck, Eye, Heart, Clock } from 'lucide-react';
import { ArticleEditor } from './ArticleEditor.jsx';
import { RichText } from './RichText.jsx';

export { RichText };

// Category K (#200–#215): shared labels and pieces for news, articles and learning.
export const KIND_LABEL = {
  news: 'Local news', announcement: 'Announcement', preview: 'Match preview', match_report: 'Match report', interview: 'Player interview',
  story: 'Story', success_story: 'Success story', academy_update: 'Academy update', community_update: 'Community update',
  coaching: 'Coaching tips', guide: 'Guide', equipment: 'Equipment', rules: 'Rules', umpiring: 'Umpiring', scoring: 'Scoring'
};
export const NEWS_KINDS = ['news', 'announcement', 'preview', 'match_report', 'interview', 'story', 'success_story', 'academy_update', 'community_update'];
export const LEARN_KINDS = ['coaching', 'guide', 'equipment', 'rules', 'umpiring', 'scoring'];
export const isLearning = (k) => LEARN_KINDS.includes(k);
export const LEVELS = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
export const KIND_COLOR = {
  announcement: ['#fef3c7', '#92400e'], preview: ['#e0f2fe', '#075985'], match_report: ['#dcfce7', '#166534'], interview: ['#f3e8ff', '#6b21a8'],
  success_story: ['#fce7f3', '#9d174d'], academy_update: ['#ffedd5', '#9a3412'], community_update: ['#ecfeff', '#155e75']
};
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const articleLink = (id) => `${window.location.origin}${window.location.pathname}?article=${id}`;

export function KindTag({ kind, small }) {
  const [bg, fg] = KIND_COLOR[kind] || (isLearning(kind) ? ['#eef2ff', '#3730a3'] : ['#f1f5f9', '#334155']);
  return <span style={{ fontSize: small ? '0.66rem' : '0.72rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, backgroundColor: bg, color: fg, whiteSpace: 'nowrap' }}>{KIND_LABEL[kind] || kind}</span>;
}

export function OfficialTick({ size = 14 }) {
  return <span title="Official" style={{ display: 'inline-flex', color: '#0284c7' }}><BadgeCheck size={size} /></span>;
}

export function YouTubeEmbed({ url }) {
  const id = youtubeId(url || '');
  if (!id) return null;
  return (
    <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '0.7rem', overflow: 'hidden', backgroundColor: '#000' }}>
      <iframe title="Video" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
    </div>
  );
}

/* ---------- cards ---------- */
export function ArticleCard({ a, onOpen, compact = false }) {
  const cover = a.cover_url || (a.video_url && youtubeId(a.video_url) ? `https://i.ytimg.com/vi/${youtubeId(a.video_url)}/hqdefault.jpg` : null);
  return (
    <button type="button" onClick={() => onOpen(a)}
      style={{ textAlign: 'left', display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? '0.7rem' : 0, width: '100%', padding: compact ? '0.55rem' : 0, border: '1px solid #e2e8f0', borderRadius: '0.7rem', overflow: 'hidden', backgroundColor: '#fff', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
      {cover ? <img src={cover} alt="" loading="lazy" style={compact ? { width: 92, height: 68, objectFit: 'cover', borderRadius: '0.45rem', flexShrink: 0 } : { width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
        : !compact && <div style={{ width: '100%', aspectRatio: '16/6', background: isLearning(a.kind) ? 'linear-gradient(135deg,#312e81,#6366f1)' : 'linear-gradient(135deg,#064e3b,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.85)' }}><Newspaper size={34} /></div>}
      <div style={{ padding: compact ? 0 : '0.7rem 0.8rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <KindTag kind={a.kind} small />{a.is_official && <OfficialTick size={13} />}
          {a.status !== 'published' && <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#b45309' }}>{a.status === 'draft' ? 'DRAFT' : 'HIDDEN'}</span>}
          {a.is_featured && <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#be123c' }}>FEATURED</span>}
        </div>
        <div style={{ fontWeight: 800, fontSize: compact ? '0.9rem' : '1rem', lineHeight: 1.3, color: '#0f172a' }}>{a.title}</div>
        {!compact && a.summary && <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.45 }}>{a.summary}</div>}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.72rem', color: '#94a3b8', alignItems: 'center' }}>
          <span>{a.author}</span><span>{fmtDay(a.published_at || a.created_at)}</span>
          <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}><Clock size={11} /> {a.reading_minutes} min</span>
          {a.views > 0 && <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}><Eye size={11} /> {a.views}</span>}
          {a.likes > 0 && <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}><Heart size={11} /> {a.likes}</span>}
        </div>
      </div>
    </button>
  );
}

export const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.9rem' };

/**
 * A list of articles about one thing (tournament, match, player, listing), with a Write button.
 * writeKinds: the kinds this reader may start here (the database still checks every rule).
 */
export function ArticleFeed({ title, subtitle, filter, writeKinds = [], defaults = {}, currentUser, onNavigate, limit = 6, compact = false, hideWhenEmpty = false, emptyText, refreshKey, exclude }) {
  const [items, setItems] = useState(null);
  const [me, setMe] = useState(currentUser);
  const [writing, setWriting] = useState(false);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(filter);
  useEffect(() => { setItems(null); dataService.listArticles({ ...filter, limit: exclude ? limit + 1 : limit }).then((r) => setItems((r || []).filter((x) => x.id !== exclude).slice(0, limit))).catch(() => setItems([])); }, [key, limit, tick, refreshKey]);
  useEffect(() => { if (currentUser === undefined) dataService.getCurrentUser().then((u) => setMe(u || null)).catch(() => setMe(null)); else setMe(currentUser); }, [currentUser]);
  const open = (a) => onNavigate && onNavigate('article', a.id);
  if (hideWhenEmpty && !writing && (!items || items.length === 0) && !(me && writeKinds.length)) return null;
  const canWrite = me && writeKinds.length > 0;
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Newspaper size={17} /> {title}</span>} subtitle={subtitle}
      action={canWrite && !writing ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setWriting(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PenLine size={14} /> Write</button> : null}>
      {writing && (
        <div style={{ marginBottom: '0.9rem' }}>
          <ArticleEditor kinds={writeKinds} defaults={defaults} isAdmin={me?.role === 'Admin' || me?.role === 'Super-Admin'}
            onCancel={() => setWriting(false)} onSaved={(a) => { setWriting(false); setTick((t) => t + 1); if (a?.status === 'published' && onNavigate) onNavigate('article', a.id); }} />
        </div>
      )}
      {items === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span>
        : items.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>{emptyText || 'Nothing written yet.'}</span>
        : compact ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{items.map((a) => <ArticleCard key={a.id} a={a} onOpen={open} compact />)}</div>
        : <div style={cardGrid}>{items.map((a) => <ArticleCard key={a.id} a={a} onOpen={open} />)}</div>}
    </Card>
  );
}

/** Home page: the newest news and learning articles (featured first). Hidden when there is nothing yet. */
export function HomeNewsSection({ go }) {
  const [items, setItems] = useState(null);
  useEffect(() => { dataService.listArticles({ featured_first: true, limit: 3 }).then((r) => setItems(r || [])).catch(() => setItems([])); }, []);
  if (!items || !items.length) return null;
  return (
    <section className="home-section">
      <div className="home-section-head">
        <div><h2>News & learning</h2><p>Local cricket news, match reports and coaching tips</p></div>
        <span style={{ display: 'inline-flex', gap: '0.8rem' }}>
          <button type="button" className="home-link" onClick={() => go('news')}>All news</button>
          <button type="button" className="home-link" onClick={() => go('learn')}>Learn & quizzes</button>
        </span>
      </div>
      <div style={cardGrid}>{items.map((a) => <ArticleCard key={a.id} a={a} onOpen={() => go('article', a.id)} />)}</div>
    </section>
  );
}
