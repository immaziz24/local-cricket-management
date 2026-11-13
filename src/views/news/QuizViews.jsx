import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { inp, lbl } from '../brand/brandShared.jsx';
import { OfficialTick } from './newsShared.jsx';
import { ArrowLeft, ListChecks, Plus, Trash2, Pencil, CheckCircle, XCircle, Trophy, RotateCcw, EyeOff, Eye, Share2 } from 'lucide-react';

// #212 quizzes: anyone can play; members' scores are saved and shown on a leaderboard.
export const QUIZ_CATS = [['rules', 'Rules'], ['umpiring', 'Umpiring'], ['scoring', 'Scoring'], ['skills', 'Skills'], ['history', 'History'], ['general', 'General']];
const CAT = Object.fromEntries(QUIZ_CATS);

export function QuizList({ category = '', currentUser, onNavigate, refreshKey }) {
  const [items, setItems] = useState(null);
  const [mine, setMine] = useState(false);
  const [making, setMaking] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { setItems(null); dataService.listQuizzes({ category, mine }).then((r) => setItems(r || [])).catch(() => setItems([])); }, [category, mine, tick, refreshKey]);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super-Admin';
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ListChecks size={17} /> Quizzes</span>} subtitle="Test yourself – answers and explanations come after you finish"
      action={currentUser && !making ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button type="button" className="btn-mini" onClick={() => setMine((v) => !v)}>{mine ? 'All quizzes' : 'My quizzes'}</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setMaking(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Make a quiz</button>
        </span>
      ) : null}>
      {making && <div style={{ marginBottom: '0.9rem' }}><QuizEditor isAdmin={isAdmin} onCancel={() => setMaking(false)} onSaved={(q) => { setMaking(false); setTick((t) => t + 1); onNavigate && onNavigate('quiz', q.id); }} /></div>}
      {items === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : items.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No quizzes here yet.</span> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.7rem' }}>
          {items.map((q) => (
            <button key={q.id} type="button" onClick={() => onNavigate('quiz', q.id)}
              style={{ textAlign: 'left', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '0.7rem', background: 'linear-gradient(135deg,#eef2ff,#fff)', cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#4338ca' }}>{CAT[q.category] || q.category} · <span style={{ textTransform: 'capitalize' }}>{q.level}</span>{q.is_official && <OfficialTick size={12} />}{q.status !== 'published' && <span style={{ color: '#b45309' }}>{q.status.toUpperCase()}</span>}</span>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{q.title}</strong>
              {q.description && <span style={{ fontSize: '0.8rem', color: '#475569' }}>{q.description}</span>}
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{q.questions} questions · played {q.plays} {q.plays === 1 ? 'time' : 'times'}{q.my_best != null ? ` · your best ${q.my_best}/${q.questions}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function QuizView({ quizId, currentUser, onNavigate }) {
  const [q, setQ] = useState(null);
  const [err, setErr] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => dataService.getQuiz(quizId).then((r) => { if (!r) setErr('This quiz is not available.'); else { setQ(r); setAnswers(new Array(r.questions.length).fill(null)); } }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [quizId, currentUser?.id]);
  useEffect(() => { if (q?.title) document.title = `${q.title} · Quiz · Cricnotch`; }, [q?.title]);
  if (err) return <Card><span style={{ color: '#b91c1c' }}>{err}</span></Card>;
  if (!q) return <div style={{ color: '#94a3b8' }}>Loading quiz…</div>;
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super-Admin';
  const total = q.questions.length; const cur = q.questions[step];
  const submit = async () => {
    setBusy(true); setMsg(null);
    try { setResult(await dataService.submitQuiz(q.id, answers)); load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const restart = () => { setResult(null); setStep(0); setAnswers(new Array(total).fill(null)); };
  const remove = async () => { if (!window.confirm('Delete this quiz?')) return; try { await dataService.deleteQuiz(q.id); onNavigate('learn'); } catch (e) { setMsg(e.message); } };
  const hide = async () => { try { const r = await dataService.moderateQuiz(q.id, q.status === 'hidden' ? 'published' : 'hidden'); setQ((x) => ({ ...x, status: r.status })); } catch (e) { setMsg(e.message); } };
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?quiz=${q.id}`;
    const text = result ? `I scored ${result.score}/${result.total} in "${q.title}" on Cricnotch. Can you beat me?` : `Try the "${q.title}" cricket quiz on Cricnotch`;
    if (navigator.share) { try { await navigator.share({ title: q.title, text, url }); return; } catch { /* cancelled */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
  };
  const pick = (i) => setAnswers((a) => a.map((x, j) => (j === step ? i : x)));
  const optStyle = (on) => ({ textAlign: 'left', padding: '0.7rem 0.85rem', borderRadius: '0.6rem', border: `2px solid ${on ? '#4f46e5' : '#e2e8f0'}`, backgroundColor: on ? '#eef2ff' : '#fff', cursor: 'pointer', font: 'inherit', fontSize: '0.92rem', fontWeight: on ? 700 : 500 });
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <button type="button" onClick={() => onNavigate('learn')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', gap: '0.3rem', alignItems: 'center', color: '#334155', fontSize: '0.85rem', alignSelf: 'flex-start' }}><ArrowLeft size={16} /> Learn</button>
      {editing ? (
        <QuizEditor quiz={q} isAdmin={isAdmin} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); restart(); load(); }} />
      ) : (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.9rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4338ca', display: 'inline-flex', gap: 6, alignItems: 'center' }}>QUIZ · {CAT[q.category] || q.category} · <span style={{ textTransform: 'capitalize' }}>{q.level}</span>{q.is_official && <OfficialTick size={13} />}{q.status !== 'published' && <span style={{ color: '#b45309' }}>{q.status.toUpperCase()}</span>}</span>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>{q.title}</h1>
            {q.description && <p style={{ margin: 0, color: '#475569' }}>{q.description}</p>}
            <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>By {q.author} · {total} questions · played {q.plays} {q.plays === 1 ? 'time' : 'times'}{q.my_best != null ? ` · your best ${q.my_best}/${total}` : ''}</span>
          </div>

          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', borderRadius: '0.8rem', background: 'linear-gradient(135deg,#312e81,#6366f1)', color: '#fff' }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 900 }}>{result.score}/{result.total}</div>
                <div style={{ fontWeight: 700 }}>{result.score === result.total ? 'Perfect score!' : result.score >= result.total * 0.7 ? 'Well played!' : 'Good try – read the answers below.'}</div>
                {!result.saved && <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 4 }}>Log in to save your score on the leaderboard.</div>}
              </div>
              {result.results.map((r, i) => (
                <div key={i} style={{ border: `1px solid ${r.right ? '#bbf7d0' : '#fecaca'}`, backgroundColor: r.right ? '#f0fdf4' : '#fef2f2', borderRadius: '0.6rem', padding: '0.65rem 0.8rem', fontSize: '0.88rem' }}>
                  <div style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'flex-start' }}>{r.right ? <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />} {i + 1}. {r.question}</div>
                  <div style={{ marginTop: 4, color: '#334155' }}>Answer: <strong>{r.options[r.correct]}</strong>{!r.right && <> · you chose {r.chosen == null ? 'nothing' : <em>{r.options[r.chosen]}</em>}</>}</div>
                  {r.explanation && <div style={{ marginTop: 3, color: '#475569' }}>{r.explanation}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={restart} style={btn}><RotateCcw size={14} /> Play again</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={share} style={btn}><Share2 size={14} /> Challenge a friend</button>
              </div>
            </div>
          ) : total === 0 ? <span style={{ color: '#94a3b8' }}>This quiz has no questions.</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden' }}><div style={{ height: '100%', width: `${((step + 1) / total) * 100}%`, backgroundColor: '#6366f1', transition: 'width .2s' }} /></div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Question {step + 1} of {total}</div>
              <div style={{ fontSize: '1.08rem', fontWeight: 800 }}>{cur.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {cur.options.map((o, i) => <button key={i} type="button" onClick={() => pick(i)} style={optStyle(answers[step] === i)}>{String.fromCharCode(65 + i)}. {o}</button>)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline btn-sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
                {step < total - 1
                  ? <button type="button" className="btn btn-primary btn-sm" disabled={answers[step] == null} onClick={() => setStep((s) => s + 1)}>Next</button>
                  : <button type="button" className="btn btn-primary btn-sm" disabled={busy || answers.some((x) => x == null)} onClick={submit}>{busy ? 'Checking…' : 'See my score'}</button>}
              </div>
            </div>
          )}
          {(q.can_edit || isAdmin) && (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '0.7rem', marginTop: '0.9rem' }}>
              {q.can_edit && <button type="button" className="btn-mini" onClick={() => setEditing(true)} style={btn}><Pencil size={13} /> Edit</button>}
              {q.can_edit && <button type="button" className="btn-mini" onClick={remove} style={{ ...btn, color: '#b91c1c' }}><Trash2 size={13} /> Delete</button>}
              {isAdmin && q.status !== 'draft' && <button type="button" className="btn-mini" onClick={hide} style={btn}>{q.status === 'hidden' ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}</button>}
            </div>
          )}
          {msg && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: '0.84rem' }}>{msg}</div>}
        </Card>
      )}
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trophy size={17} color="#d97706" /> Leaderboard</span>} subtitle="Best score of each member">
        {q.leaderboard.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No scores yet – be the first.</span> : (
          <ol style={{ margin: 0, paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {q.leaderboard.map((l, i) => <li key={i} style={{ fontSize: '0.9rem' }}><strong>{l.name || 'Member'}</strong> – {l.score}/{l.total}</li>)}
          </ol>
        )}
      </Card>
    </div>
  );
}

const blankQ = () => ({ question: '', options: ['', '', '', ''], correct: 0, explanation: '' });

export function QuizEditor({ quiz = null, isAdmin = false, onCancel, onSaved }) {
  const [f, setF] = useState(() => ({ title: quiz?.title || '', description: quiz?.description || '', category: quiz?.category || 'rules', level: quiz?.level || 'beginner', byline: quiz?.byline || '' }));
  const [qs, setQs] = useState(() => (quiz?.questions?.length ? quiz.questions.map((x) => ({ question: x.question, options: [...x.options], correct: x.correct ?? 0, explanation: x.explanation || '' })) : [blankQ(), blankQ(), blankQ()]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const setQ = (i, patch) => setQs((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setOpt = (i, k, v) => setQs((a) => a.map((x, j) => (j === i ? { ...x, options: x.options.map((o, n) => (n === k ? v : o)) } : x)));
  const save = async (status) => {
    setBusy(true); setErr(null);
    try {
      const questions = qs.map((x) => {
        const opts = x.options.map((o) => o.trim()); const keep = opts.map((o, n) => [o, n]).filter(([o]) => o);
        return { question: x.question, options: keep.map(([o]) => o), correct: Math.max(0, keep.findIndex(([, n]) => n === x.correct)), explanation: x.explanation, _ok: keep.some(([, n]) => n === x.correct) };
      });
      const bad = questions.findIndex((x) => !x._ok);
      if (bad >= 0) throw new Error(`Question ${bad + 1}: the right answer is empty.`);
      onSaved(await dataService.saveQuiz(quiz?.id || null, { ...f, status, questions: questions.map(({ _ok, ...x }) => x) }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.7rem', padding: '0.9rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <strong style={{ fontSize: '0.95rem' }}>{quiz ? 'Edit quiz' : 'Make a quiz'}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} style={inp} /></label>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Description (optional)<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={400} style={inp} /></label>
        <label style={lbl}>Topic<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} style={inp}>{QUIZ_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label style={lbl}>Level<select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} style={inp}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        {isAdmin && <label style={lbl}>Byline (optional)<input value={f.byline} onChange={(e) => setF({ ...f, byline: e.target.value })} maxLength={80} style={inp} /></label>}
      </div>
      {qs.map((x, i) => (
        <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.65rem', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.82rem' }}>Question {i + 1}</strong>
            {qs.length > 3 && <button type="button" className="btn-mini" onClick={() => setQs((a) => a.filter((_, j) => j !== i))} style={{ color: '#b91c1c' }}>Remove</button>}
          </div>
          <input value={x.question} onChange={(e) => setQ(i, { question: e.target.value })} maxLength={300} placeholder="Question" style={inp} />
          {x.options.map((o, k) => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem' }}>
              <input type="radio" name={`correct-${i}`} checked={x.correct === k} onChange={() => setQ(i, { correct: k })} title="Right answer" />
              <input value={o} onChange={(e) => setOpt(i, k, e.target.value)} maxLength={150} placeholder={`Answer ${String.fromCharCode(65 + k)}${k >= 2 ? ' (optional)' : ''}`} style={{ ...inp, borderColor: x.correct === k ? '#16a34a' : '#cbd5e1' }} />
            </label>
          ))}
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Tick the right answer.</span>
          <input value={x.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} maxLength={500} placeholder="Why is it right? (shown after playing)" style={inp} />
        </div>
      ))}
      {qs.length < 30 && <button type="button" className="btn-mini" onClick={() => setQs((a) => [...a, blankQ()])} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={13} /> Add a question</button>}
      {err && <div style={{ color: '#b91c1c', fontSize: '0.84rem' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => save('published')}>{busy ? 'Saving…' : 'Publish quiz'}</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => save('draft')}>Save as draft</button>
        {onCancel && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
