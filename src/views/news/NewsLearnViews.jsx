import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { Newspaper, GraduationCap, PenLine, Search, Flag, EyeOff, Check } from 'lucide-react';
import { ArticleCard, cardGrid, LEARN_KINDS, KIND_LABEL, LEVELS } from './newsShared.jsx';
import { ArticleEditor } from './ArticleEditor.jsx';
import { QuizList, QUIZ_CATS } from './QuizViews.jsx';
import { chip } from '../brand/brandShared.jsx';

const NEWS_FILTERS = [['', 'All'], ['news', 'Local news'], ['announcement', 'Announcements'], ['preview,match_report', 'Previews & reports'],
  ['interview,story,success_story', 'Interviews & stories'], ['academy_update,community_update', 'Academy & community']];
const PAGE = 18;

/** Shared list with search, "my articles" and load-more. */
function Feed({ group, kinds, level, mine, query, onNavigate, tick }) {
  const [items, setItems] = useState(null);
  const [more, setMore] = useState(false);
  const p = { group, kinds: kinds ? kinds.split(',') : undefined, level: level || undefined, mine, query: query || undefined, featured_first: !mine && !query && !kinds };
  const key = JSON.stringify(p);
  useEffect(() => {
    setItems(null);
    const t = setTimeout(() => dataService.listArticles({ ...p, limit: PAGE }).then((r) => { setItems(r || []); setMore((r || []).length === PAGE); }).catch(() => setItems([])), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [key, tick]);
  const loadMore = () => dataService.listArticles({ ...p, limit: PAGE, offset: items.length }).then((r) => { setItems((x) => [...x, ...(r || [])]); setMore((r || []).length === PAGE); }).catch(() => {});
  if (items === null) return <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span>;
  if (!items.length) return <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>{mine ? 'You have not written anything here yet.' : 'Nothing here yet.'}</span>;
  return (
    <>
      <div style={cardGrid}>{items.map((a) => <ArticleCard key={a.id} a={a} onOpen={() => onNavigate('article', a.id)} />)}</div>
      {more && <button type="button" className="btn btn-outline btn-sm" onClick={loadMore} style={{ alignSelf: 'center', marginTop: '0.8rem' }}>Show more</button>}
    </>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', borderRadius: 999, padding: '0.3rem 0.75rem', backgroundColor: '#fff', minWidth: 200, flex: '0 1 280px' }}>
      <Search size={15} color="#94a3b8" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ border: 'none', outline: 'none', fontSize: '0.86rem', width: '100%', background: 'transparent' }} />
    </label>
  );
}

/** #200–#205, #213–#215 News: local news, announcements, previews, reports, interviews, stories, academy and community updates. */
export function NewsView({ currentUser, onNavigate }) {
  const [kinds, setKinds] = useState('');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [writing, setWriting] = useState(false);
  const [tick, setTick] = useState(0);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super-Admin';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Newspaper size={22} /> Cricket news</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Local news, tournament announcements, match previews and reports, player interviews and success stories.</p>
        </div>
        {currentUser ? (!writing && <button type="button" className="btn btn-primary btn-sm" onClick={() => setWriting(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PenLine size={14} /> Write news</button>)
          : <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate('login')}>Log in to write</button>}
      </div>
      {writing && (
        <Card>
          <ArticleEditor kinds={['news', 'story', 'community_update']} isAdmin={isAdmin} onCancel={() => setWriting(false)}
            onSaved={(a) => { setWriting(false); setTick((t) => t + 1); if (a?.status === 'published') onNavigate('article', a.id); else setMine(true); }} />
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>Match previews and reports are written from the match page, announcements from the tournament page, interviews from the player's profile and academy updates from your listing in Community.</p>
        </Card>
      )}
      <Card>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: '1 1 auto' }}>
            {NEWS_FILTERS.map(([k, l]) => <button key={k || 'all'} type="button" onClick={() => setKinds(k)} style={chip(kinds === k)}>{l}</button>)}
            {currentUser && <button type="button" onClick={() => setMine((v) => !v)} style={chip(mine)}>My articles</button>}
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search news" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Feed group="news" kinds={kinds} mine={mine} query={query} onNavigate={onNavigate} tick={tick} />
        </div>
      </Card>
    </div>
  );
}

/** #206–#212 Learn: coaching, guides, equipment, rules, umpiring and scoring tutorials, plus quizzes. */
export function LearnView({ currentUser, onNavigate }) {
  const [kind, setKind] = useState('');
  const [level, setLevel] = useState('');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [writing, setWriting] = useState(false);
  const [tick, setTick] = useState(0);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super-Admin';
  const quizCat = QUIZ_CATS.some(([k]) => k === kind) ? kind : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><GraduationCap size={24} /> Learn cricket</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Coaching tips, guides, equipment advice and tutorials on the rules, umpiring and scoring – and quizzes to test yourself.</p>
        </div>
        {currentUser ? (!writing && <button type="button" className="btn btn-primary btn-sm" onClick={() => setWriting(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PenLine size={14} /> Write a tutorial</button>)
          : <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate('login')}>Log in to write</button>}
      </div>
      {writing && (
        <Card>
          <ArticleEditor kinds={LEARN_KINDS} defaults={{ kind: LEARN_KINDS.includes(kind) ? kind : 'coaching' }} isAdmin={isAdmin} onCancel={() => setWriting(false)}
            onSaved={(a) => { setWriting(false); setTick((t) => t + 1); if (a?.status === 'published') onNavigate('article', a.id); else setMine(true); }} />
        </Card>
      )}
      <Card>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: '1 1 auto' }}>
            <button type="button" onClick={() => setKind('')} style={chip(kind === '')}>All topics</button>
            {LEARN_KINDS.map((k) => <button key={k} type="button" onClick={() => setKind(k)} style={chip(kind === k)}>{KIND_LABEL[k]}</button>)}
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search tutorials" />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <button type="button" onClick={() => setLevel('')} style={chip(level === '')}>Any level</button>
          {LEVELS.map(([k, l]) => <button key={k} type="button" onClick={() => setLevel(k)} style={chip(level === k)}>{l}</button>)}
          {currentUser && <button type="button" onClick={() => setMine((v) => !v)} style={chip(mine)}>My tutorials</button>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Feed group="learn" kinds={kind} level={level} mine={mine} query={query} onNavigate={onNavigate} tick={tick} />
        </div>
      </Card>
      <QuizList category={quizCat} currentUser={currentUser} onNavigate={onNavigate} />
    </div>
  );
}

/** #215 moderation: reported articles for Admin / Super-Admin. */
export function ReportedArticlesPanel({ onNavigate }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => dataService.listReportedArticles().then((r) => setItems(r || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = async (a, p) => { try { await dataService.moderateArticle(a.id, p); load(); } catch (e) { setErr(e.message); } };
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flag size={17} /> Reported articles</span>} subtitle="Hide an article, or keep it published – either closes the reports">
      {err && <div style={{ color: '#b91c1c', fontSize: '0.84rem', marginBottom: 6 }}>{err}</div>}
      {items === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : items.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No open reports.</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map((a) => (
            <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" onClick={() => onNavigate('article', a.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: 800, color: '#0f172a', font: 'inherit' }}>{a.title}</button>
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>{KIND_LABEL[a.kind]} · by {a.author} · {a.reports} report{a.reports === 1 ? '' : 's'} · {a.status}</span>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: '#334155' }}>{(a.reasons || []).slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}</ul>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-mini" onClick={() => act(a, { status: 'hidden' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b91c1c' }}><EyeOff size={13} /> Hide</button>
                <button type="button" className="btn-mini" onClick={() => act(a, { status: 'published' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={13} /> Keep published</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
