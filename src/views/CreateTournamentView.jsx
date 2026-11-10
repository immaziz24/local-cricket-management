import React, { useState } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Button } from '../components/common/Button.jsx';
import { dataService } from '../services/dataService.js';
import { Trophy, CheckCircle2, AlertCircle, ArrowLeft, Users, MapPin } from 'lucide-react';

/**
 * #31 Create a tournament — built for local / grassroots cricket (reference: CricHeroes).
 * Overs are just a number (4, 6, 8, 10 …), ball type is tennis / tape / leather, plus pitch type,
 * category and players a side. Teams are added afterwards on the tournament page.
 */

const OVERS_QUICK = [4, 5, 6, 8, 10, 12, 15, 20];
const PLAYERS_QUICK = [6, 7, 8, 9, 11];
const MATCH_TYPES = [
  { value: 'limited_overs', label: 'Limited overs' },
  { value: 'box_cricket', label: 'Box cricket' },
  { value: 'two_innings', label: 'Two innings (Test style)' }
];
const BALL_TYPES = ['Tennis', 'Tape ball', 'Leather (red)', 'Leather (white)', 'Rubber', 'Other'];
const PITCH_TYPES = ['Rough / mud', 'Cement', 'Matting', 'Turf', 'Astroturf'];
const CATEGORIES = ['Open', 'Village / community', 'Corporate', 'School', 'College', 'Under-14', 'Under-16', 'Under-19', 'Women', 'Veterans', 'Other'];
const PENALTIES = [
  { value: 'none', label: 'No late-arrival penalty' },
  { value: 'overs_deduction', label: 'Overs cut (e.g. 1 over per 10 minutes late)' },
  { value: 'penalty_runs', label: 'Penalty runs to the other team (e.g. 5 runs per 10 minutes)' },
  { value: 'fielding_restriction', label: 'Fielding restriction for the late team' }
];
const COLORS = ['#059669', '#1E3A8A', '#D97706', '#7C3AED', '#DC2626', '#0D9488'];

const INITIAL = {
  name: '', code: '', city: '', venue: '', organizer_name: '',
  start_date: '', end_date: '', teams_count: '',
  match_type: 'limited_overs', overs_per_innings: 10, players_per_side: 11,
  ball_type: 'Tennis', pitch_type: '', category: 'Open',
  entry_fee: '', prize_pool: '', penalty_policy: 'none', rules_summary: '', banner_color: '#059669'
};

const input = { width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.92rem' };
const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' };
const hint = { fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' };

function Chips({ options, value, onChange, render = (o) => o }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const active = String(value) === String(v);
        return (
          <button key={v} type="button" onClick={() => onChange(v)}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '999px', fontSize: '0.83rem', cursor: 'pointer', fontWeight: active ? 700 : 500,
                     border: `1px solid ${active ? '#059669' : '#cbd5e1'}`, backgroundColor: active ? '#ecfdf5' : '#fff', color: active ? '#065f46' : '#334155' }}>
            {typeof o === 'object' ? o.label : render(o)}
          </button>
        );
      })}
    </div>
  );
}

const suggestCode = (name) => {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const initials = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 6) : words[0].slice(0, 6);
  return `${initials}-${String(new Date().getFullYear()).slice(2)}`;
};

export function CreateTournamentView(props) {
  const { onNavigate = () => {} } = props || {};
  const [f, setF] = useState(INITIAL);
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [created, setCreated] = useState(null);

  const set = (k, v) => {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'name' && !codeTouched) next.code = suggestCode(v);
      if (k === 'match_type' && v === 'box_cricket' && prev.players_per_side === 11) { next.players_per_side = 8; next.overs_per_innings = 5; }
      return next;
    });
    setErrors((e) => ({ ...e, [k]: null }));
    setSubmitError(null);
  };

  const validate = () => {
    const e = {};
    if (f.name.trim().length < 3) e.name = 'At least 3 characters.';
    if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(f.code)) e.code = '2–16 letters, numbers or dashes.';
    if (f.venue.trim().length < 3) e.venue = 'Enter the ground name.';
    if (!f.start_date) e.start_date = 'Required.';
    if (!f.end_date) e.end_date = 'Required.';
    if (f.start_date && f.end_date && f.end_date < f.start_date) e.end_date = 'Cannot be before the start date.';
    const tc = Number(f.teams_count);
    if (!tc || tc < 2 || tc > 64) e.teams_count = 'Between 2 and 64.';
    if (f.match_type !== 'two_innings') {
      const ov = Number(f.overs_per_innings);
      if (!ov || ov < 1 || ov > 100) e.overs_per_innings = 'Between 1 and 100.';
    }
    const pps = Number(f.players_per_side);
    if (!pps || pps < 2 || pps > 15) e.players_per_side = 'Between 2 and 15.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) { setSubmitError('Please fix the highlighted fields.'); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const payload = {
        ...f,
        teams_count: Number(f.teams_count),
        overs_per_innings: f.match_type === 'two_innings' ? null : Number(f.overs_per_innings),
        players_per_side: Number(f.players_per_side)
      };
      setCreated(await dataService.createTournament(payload));
    } catch (err) {
      setSubmitError(err.message || 'Could not create the tournament.');
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <CheckCircle2 size={48} color="#059669" />
            <h2 style={{ margin: 0 }}>{created.name} is created</h2>
            <p style={{ margin: 0, color: '#475569' }}>
              {created.format} · {created.ball_type || 'Ball not set'} · {created.players_per_side} a side · {created.venue}
            </p>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
              Next: open the tournament, go to <strong>Teams</strong> and add the teams. Then make the fixtures.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => onNavigate('tournament-details', created.id)}>Open tournament & add teams</Button>
              <Button variant="secondary" onClick={() => { setCreated(null); setF(INITIAL); setCodeTouched(false); }}>Create another</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const err = (k) => errors[k] && <div style={{ ...hint, color: '#b91c1c' }}>{errors[k]}</div>;
  const box = (k) => ({ ...input, borderColor: errors[k] ? '#f87171' : '#cbd5e1' });

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button type="button" onClick={() => onNavigate('tournaments')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex' }} aria-label="Back"><ArrowLeft size={20} /></button>
        <Trophy size={26} color="#059669" />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Create a tournament</h1>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Takes a minute. You add teams and fixtures afterwards.</div>
        </div>
      </div>

      {/* 1. Basics */}
      <Card title="1. Tournament details">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Tournament name *</label>
            <input style={box('name')} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Titahipara Premier League" />
            {err('name')}
          </div>
          <div>
            <label style={labelStyle}>Short code *</label>
            <input style={{ ...box('code'), fontFamily: 'monospace' }} value={f.code}
              onChange={(e) => { setCodeTouched(true); set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')); }} placeholder="e.g. TPL-26" />
            <div style={hint}>Filled in from the name; used in match numbers.</div>
            {err('code')}
          </div>
          <div>
            <label style={labelStyle}>City / village</label>
            <input style={input} value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Silchar" />
          </div>
          <div>
            <label style={labelStyle}>Ground *</label>
            <input style={box('venue')} value={f.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. Titahipara cricket ground" />
            {err('venue')}
          </div>
          <div>
            <label style={labelStyle}>Start date *</label>
            <input type="date" style={box('start_date')} value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
            {err('start_date')}
          </div>
          <div>
            <label style={labelStyle}>End date *</label>
            <input type="date" style={box('end_date')} value={f.end_date} min={f.start_date || undefined} onChange={(e) => set('end_date', e.target.value)} />
            {err('end_date')}
          </div>
          <div>
            <label style={labelStyle}><Users size={13} /> Number of teams *</label>
            <input type="number" min={2} max={64} style={box('teams_count')} value={f.teams_count} onChange={(e) => set('teams_count', e.target.value)} placeholder="e.g. 8" />
            <div style={hint}>The most teams that can take part. You can change it later.</div>
            {err('teams_count')}
          </div>
          <div>
            <label style={labelStyle}>Organiser name</label>
            <input style={input} value={f.organizer_name} onChange={(e) => set('organizer_name', e.target.value)} placeholder="Your name or club (default: your name)" />
          </div>
        </div>
      </Card>

      {/* 2. Cricket */}
      <Card title="2. How the matches are played">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={labelStyle}>Match type</label>
            <Chips options={MATCH_TYPES} value={f.match_type} onChange={(v) => set('match_type', v)} />
          </div>
          {f.match_type !== 'two_innings' && (
            <div>
              <label style={labelStyle}>Overs per innings *</label>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Chips options={OVERS_QUICK} value={f.overs_per_innings} onChange={(v) => set('overs_per_innings', v)} />
                <input type="number" min={1} max={100} value={f.overs_per_innings} onChange={(e) => set('overs_per_innings', e.target.value)} style={{ ...box('overs_per_innings'), width: 90 }} aria-label="Other number of overs" />
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>or type any number</span>
              </div>
              {err('overs_per_innings')}
            </div>
          )}
          <div>
            <label style={labelStyle}>Players a side *</label>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Chips options={PLAYERS_QUICK} value={f.players_per_side} onChange={(v) => set('players_per_side', v)} />
              <input type="number" min={2} max={15} value={f.players_per_side} onChange={(e) => set('players_per_side', e.target.value)} style={{ ...box('players_per_side'), width: 90 }} aria-label="Other number of players" />
            </div>
            {err('players_per_side')}
          </div>
          <div>
            <label style={labelStyle}>Ball type</label>
            <Chips options={BALL_TYPES} value={f.ball_type} onChange={(v) => set('ball_type', v)} />
          </div>
          <div>
            <label style={labelStyle}>Pitch type</label>
            <Chips options={PITCH_TYPES} value={f.pitch_type} onChange={(v) => set('pitch_type', f.pitch_type === v ? '' : v)} />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <Chips options={CATEGORIES} value={f.category} onChange={(v) => set('category', v)} />
          </div>
        </div>
      </Card>

      {/* 3. Extras */}
      <Card title="3. Fees, prizes & rules (optional)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Entry fee per team</label>
            <input style={input} value={f.entry_fee} onChange={(e) => set('entry_fee', e.target.value)} placeholder="e.g. ₹1,500" />
          </div>
          <div>
            <label style={labelStyle}>Prizes</label>
            <input style={input} value={f.prize_pool} onChange={(e) => set('prize_pool', e.target.value)} placeholder="e.g. ₹11,000 + trophy" />
          </div>
          <div>
            <label style={labelStyle}>Late-arrival rule</label>
            <select style={input} value={f.penalty_policy} onChange={(e) => set('penalty_policy', e.target.value)}>
              {PENALTIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Colour</label>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set('banner_color', c)} aria-label={`Colour ${c}`}
                  style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: f.banner_color === c ? '3px solid #0f172a' : '2px solid #fff', boxShadow: '0 0 0 1px #cbd5e1' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle}>Rules</label>
          <textarea style={{ ...input, minHeight: 110, fontFamily: 'inherit' }} value={f.rules_summary} onChange={(e) => set('rules_summary', e.target.value)}
            placeholder={'e.g.\n1. Teams must reach the ground 15 minutes before the match.\n2. Each bowler can bowl at most 2 overs.\n3. Umpire\'s decision is final.'} />
        </div>
      </Card>

      {submitError && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.88rem' }}>
          <AlertCircle size={16} /> {submitError}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <MapPin size={13} /> {f.match_type === 'two_innings' ? 'Two innings' : `${f.overs_per_innings || '?'} overs`} · {f.players_per_side} a side · {f.ball_type}
        </span>
        <Button type="button" variant="secondary" onClick={() => onNavigate('tournaments')}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create tournament'}</Button>
      </div>
    </form>
  );
}

export default CreateTournamentView;
