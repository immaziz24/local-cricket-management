import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { ArrowLeft, Heart, Flag, Share2, Copy, Pencil, Trash2, EyeOff, Eye, Star, Clock, Trophy, Activity, User, Store } from 'lucide-react';
import { KindTag, OfficialTick, RichText, YouTubeEmbed, fmtDay, isLearning, articleLink, ArticleFeed } from './newsShared.jsx';
import { ArticleEditor } from './ArticleEditor.jsx';
import { trackOnce } from '../brand/brandShared.jsx';

/** #200–#215 one article: read, like, share, report; the writer can edit or delete; admins can hide or feature. */
export function ArticleView({ articleId, currentUser, onNavigate }) {
  const [a, setA] = useState(null);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => dataService.getArticle(articleId).then((r) => { if (!r) setErr('This article is not available.'); else setA(r); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [articleId, currentUser?.id]);
  useEffect(() => { if (a?.status === 'published') trackOnce('article', a.id, () => dataService.recordArticleView(a.id)); }, [a?.id, a?.status]);
  useEffect(() => { if (a?.title) document.title = `${a.title} · Local Cricket`; }, [a?.title]);

  if (err) return <Card><span style={{ color: '#b91c1c' }}>{err}</span><div style={{ marginTop: 8 }}><button type="button" className="btn-mini" onClick={() => onNavigate('news')}>Go to News</button></div></Card>;
  if (!a) return <div style={{ color: '#94a3b8' }}>Loading article…</div>;

  const back = isLearning(a.kind) ? 'learn' : 'news';
  const act = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (okText) setMsg({ ok: true, text: okText }); return r; }
    catch (e) { setMsg({ ok: false, text: e.message }); return null; }
    finally { setBusy(false); }
  };
  const like = async () => {
    if (!currentUser) { onNavigate('login'); return; }
    const r = await act(() => dataService.likeArticle(a.id, !a.liked));
    if (r) setA((x) => ({ ...x, liked: r.liked, likes: r.likes }));
  };
  const share = async () => {
    const url = articleLink(a.id);
    if (navigator.share) { try { await navigator.share({ title: a.title, text: a.summary || a.title, url }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy this link', url); }
  };
  const report = async () => { const r = await act(() => dataService.reportArticle(a.id, reason), 'Thank you – an admin will look at it.'); if (r) { setReporting(false); setReason(''); } };
  const remove = async () => { if (!window.confirm('Delete this article for good?')) return; const r = await act(() => dataService.deleteArticle(a.id)); if (r) onNavigate(back); };
  const moderate = async (p, text) => { const r = await act(() => dataService.moderateArticle(a.id, p), text); if (r) setA((x) => ({ ...x, ...r })); };

  const links = [
    a.tournament && { icon: Trophy, text: a.tournament.name, go: () => onNavigate('tournament-details', a.tournament.id) },
    a.match && { icon: Activity, text: a.match.title, go: () => onNavigate('match-centre', a.match.id) },
    a.player && { icon: User, text: a.player.name, go: () => onNavigate('player-profile', a.player.id) },
    a.listing && { icon: Store, text: a.listing.name, go: () => onNavigate('community') }
  ].filter(Boolean);
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 820, margin: '0 auto', width: '100%' }}>
      <button type="button" onClick={() => onNavigate(back)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', gap: '0.3rem', alignItems: 'center', color: '#334155', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
        <ArrowLeft size={16} /> {back === 'learn' ? 'Learn' : 'News'}
      </button>

      {editing ? (
        <ArticleEditor article={a} isAdmin={a.can_moderate} onCancel={() => setEditing(false)}
          onSaved={(r) => { if (!r?._stay) setEditing(false); load(); setMsg({ ok: true, text: 'Saved.' }); }} />
      ) : (
        <Card>
          <article style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <KindTag kind={a.kind} />{a.is_official && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.74rem', color: '#0369a1', fontWeight: 700 }}><OfficialTick /> Official</span>}
              {a.level && <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'capitalize' }}>{a.level}</span>}
              {a.status !== 'published' && <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#b45309' }}>{a.status === 'draft' ? 'DRAFT – only you can see this' : 'HIDDEN'}</span>}
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 900, lineHeight: 1.2, color: '#0f172a' }}>{a.title}</h1>
            {a.summary && <p style={{ margin: 0, fontSize: '1.05rem', color: '#475569', lineHeight: 1.5 }}>{a.summary}</p>}
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b', alignItems: 'center' }}>
              <strong style={{ color: '#334155' }}>{a.author}</strong>
              <span>{fmtDay(a.published_at || a.created_at)}</span>
              {a.city && <span>{a.city}</span>}
              <span style={btn}><Clock size={12} /> {a.reading_minutes} min read</span>
              <span style={btn}><Eye size={12} /> {a.views}</span>
            </div>
            {links.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {links.map((l, i) => <button key={i} type="button" onClick={l.go} className="btn-mini" style={btn}><l.icon size={13} /> {l.text}</button>)}
              </div>
            )}
            {a.cover_url && <img src={a.cover_url} alt="" style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: '0.7rem' }} />}
            {a.video_url && <YouTubeEmbed url={a.video_url} />}
            <RichText text={a.body} />
          </article>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem', marginTop: '0.4rem', alignItems: 'center' }}>
            {a.status === 'published' && (
              <button type="button" disabled={busy} onClick={like} className="btn-mini" style={{ ...btn, color: a.liked ? '#be123c' : undefined, borderColor: a.liked ? '#fecdd3' : undefined }}>
                <Heart size={14} fill={a.liked ? '#be123c' : 'none'} /> {a.likes || 0}
              </button>
            )}
            <button type="button" onClick={share} className="btn-mini" style={btn}>{copied ? <><Copy size={14} /> Link copied</> : <><Share2 size={14} /> Share</>}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${a.title}\n${articleLink(a.id)}`)}`} target="_blank" rel="noreferrer" className="btn-mini" style={{ textDecoration: 'none', color: '#15803d' }}>WhatsApp</a>
            {a.can_edit && <button type="button" onClick={() => setEditing(true)} className="btn-mini" style={btn}><Pencil size={14} /> Edit</button>}
            {a.can_edit && <button type="button" disabled={busy} onClick={remove} className="btn-mini" style={{ ...btn, color: '#b91c1c' }}><Trash2 size={14} /> Delete</button>}
            {a.can_moderate && a.status !== 'draft' && (
              <button type="button" disabled={busy} onClick={() => moderate({ status: a.status === 'hidden' ? 'published' : 'hidden' }, a.status === 'hidden' ? 'Shown again.' : 'Hidden from everyone.')} className="btn-mini" style={btn}>
                {a.status === 'hidden' ? <><Eye size={14} /> Show</> : <><EyeOff size={14} /> Hide</>}
              </button>
            )}
            {a.can_moderate && a.status === 'published' && (
              <button type="button" disabled={busy} onClick={() => moderate({ is_featured: !a.is_featured }, a.is_featured ? 'No longer featured.' : 'Featured at the top of News.')} className="btn-mini" style={btn}>
                <Star size={14} fill={a.is_featured ? '#f59e0b' : 'none'} /> {a.is_featured ? 'Unfeature' : 'Feature'}
              </button>
            )}
            {!a.can_moderate && a.is_subject && a.status === 'published' && (
              <button type="button" disabled={busy} onClick={() => window.confirm('Hide this article about you?') && moderate({ status: 'hidden' }, 'Hidden. Only the writer and admins can see it now.')} className="btn-mini" style={btn}><EyeOff size={14} /> Hide (it is about me)</button>
            )}
            {currentUser && !a.is_mine && a.status === 'published' && (
              <button type="button" onClick={() => setReporting((v) => !v)} className="btn-mini" style={{ ...btn, marginLeft: 'auto', color: '#64748b' }}><Flag size={14} /> Report</button>
            )}
          </div>
          {reporting && (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="What is wrong with this article?" style={{ flex: 1, minWidth: 200, padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem' }} />
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={report}>Send report</button>
            </div>
          )}
          {msg && <div style={{ marginTop: '0.6rem', fontSize: '0.84rem', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</div>}
        </Card>
      )}

      {!editing && (
        <ArticleFeed title={isLearning(a.kind) ? 'More to learn' : 'More news'} filter={{ group: isLearning(a.kind) ? 'learn' : 'news' }} limit={4} exclude={a.id} compact onNavigate={onNavigate} currentUser={currentUser} />
      )}
    </div>
  );
}

export default ArticleView;
