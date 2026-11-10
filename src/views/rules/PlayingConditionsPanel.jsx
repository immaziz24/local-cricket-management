import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Gavel, Lock, History, Pencil, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Category E – playing conditions for a tournament (defaults for all its matches) or one match.
 * #105 rule configuration, #106 batting, #107 #108 bowling, #109 wides, #110 no-balls, #111 free hit,
 * #112 LBW, #114 byes/leg-byes, #118 boundary, #119 powerplay, #129 ball, #130 pitch/ground,
 * #131 fielding restrictions, #132 local playing conditions, #133 substitutes, #134 publishing + versions.
 * The scorer's ball-by-ball entry follows these rules.
 */

const NOTE_LABELS = {
  batting: 'Batting rules', bowling: 'Bowling rules', boundary: 'Boundary rules', fielding: 'Fielding rules',
  ground: 'Ground & pitch', substitutes: 'Substitutes', general: 'Other local rules'
};
const yesNo = (v) => (v ? 'Yes' : 'No');
const label = { fontSize: '0.75rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' };
const input = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', backgroundColor: '#fff' };

function summaryRows(r, facts) {
  return [
    ['Format', [facts?.overs_per_innings && `${facts.overs_per_innings} overs`, facts?.players_per_side && `${facts.players_per_side} a side`,
                facts?.ball_type && `${facts.ball_type.replace(/_/g, ' ')} ball`, facts?.pitch_type && `${facts.pitch_type.replace(/_/g, ' ')} pitch`].filter(Boolean).join(' · ') || '–'],
    ['Max overs per bowler', r.max_overs_per_bowler ? `${r.max_overs_per_bowler} overs` : 'No limit'],
    ['Batter must retire at', r.retire_at ? `${r.retire_at} runs` : 'No retirement rule'],
    ['Wide', `${r.wide_runs} run${r.wide_runs === 1 ? '' : 's'} + re-bowled`],
    ['No-ball', `${r.no_ball_runs} run${r.no_ball_runs === 1 ? '' : 's'} + re-bowled${r.free_hit ? ', next ball is a free hit' : ''}`],
    ['LBW', r.lbw ? 'Yes' : 'Not used'],
    ['Byes / leg-byes', `${yesNo(r.byes)} / ${yesNo(r.leg_byes)}`],
    ['Powerplay', r.powerplay_overs ? `Overs 1–${r.powerplay_overs}, max ${r.fielders_outside_powerplay} fielders outside the circle` : 'None'],
    ['Fielders outside the circle', `Max ${r.fielders_outside} after the powerplay`],
    ['Boundary size', r.boundary_size_m ? `About ${r.boundary_size_m} m` : 'Not set'],
    ...(facts?.match_type === 'two_innings' ? [['Follow-on', `Lead of ${r.follow_on_lead || 75} runs or more`]] : []),
    ...(facts?.max_substitutes != null ? [['Substitutes', `Up to ${facts.max_substitutes} per team`]] : [])
  ];
}

export function PlayingConditionsPanel({ tournamentId = null, matchId = null }) {
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const load = () => dataService.fetchPlayingConditions(tournamentId, matchId).then(setD).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [tournamentId, matchId]);

  if (!d) return <Card title="Playing conditions"><p style={{ margin: 0, fontSize: '0.85rem', color: msg ? '#b91c1c' : '#64748b' }}>{msg ? msg.text : 'Loading…'}</p></Card>;
  const r = d.rules; const facts = d.match || d.tournament;

  const startEdit = () => { setEdit(JSON.parse(JSON.stringify(r))); setNote(''); setMsg(null); };
  const set = (k, v) => setEdit((e) => ({ ...e, [k]: v }));
  const setNoteField = (k, v) => setEdit((e) => ({ ...e, notes: { ...e.notes, [k]: v } }));
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await dataService.savePlayingConditions(tournamentId, matchId, edit, note);
      setEdit(null); await load();
      setMsg({ ok: true, text: `Saved as version ${res.version}.${tournamentId ? ' Approved teams were notified.' : ''}` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const num = (k, placeholder) => (
    <input type="number" min="0" value={edit[k] ?? ''} placeholder={placeholder} onChange={(e) => set(k, e.target.value === '' ? null : Number(e.target.value))} style={input} />
  );
  const toggle = (k, text) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!edit[k]} onChange={(e) => set(k, e.target.checked)} /> {text}
    </label>
  );
  const notes = Object.entries(NOTE_LABELS).filter(([k]) => r.notes?.[k]);

  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Gavel size={17} /> Playing conditions</span>}
      subtitle={matchId ? (d.locked ? 'Fixed when the match started – the scorer follows these rules' : facts?.tournament_id ? 'From the tournament; the organiser can change them for this match until it starts' : 'The scorer follows these rules')
        : 'Default rules for every match in this tournament'}
      action={d.can_edit && !edit ? <Button size="sm" variant="secondary" onClick={startEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Pencil size={13} /> Edit rules</Button>
        : d.locked ? <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Lock size={13} /> Locked</span> : null}>
      {msg && <div style={{ marginBottom: '0.7rem', padding: '0.5rem 0.75rem', borderRadius: '0.45rem', fontSize: '0.83rem', display: 'flex', gap: '0.35rem', alignItems: 'center',
                            backgroundColor: msg.ok ? '#ecfdf5' : '#fef2f2', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />} {msg.text}</div>}

      {!edit ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, max-content) 1fr', gap: '0.35rem 1rem', fontSize: '0.85rem' }}>
            {summaryRows(r, facts).map(([k, v]) => (
              <React.Fragment key={k}><span style={{ color: '#64748b' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></React.Fragment>
            ))}
          </div>
          {notes.length > 0 && (
            <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {notes.map(([k, l]) => (
                <div key={k}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{l}</div>
                  <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{r.notes[k]}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section>
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>Batting & bowling</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.6rem' }}>
              <label style={label}>Max overs per bowler{num('max_overs_per_bowler', 'No limit')}</label>
              <label style={label}>Batter retires at (runs){num('retire_at', 'No rule')}</label>
            </div>
          </section>
          <section>
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>Extras & dismissals</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.6rem' }}>
              <label style={label}>Runs for a wide
                <select value={edit.wide_runs} onChange={(e) => set('wide_runs', Number(e.target.value))} style={input}>{[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
              <label style={label}>Runs for a no-ball
                <select value={edit.no_ball_runs} onChange={(e) => set('no_ball_runs', Number(e.target.value))} style={input}>{[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              {toggle('free_hit', 'Free hit after a no-ball')}
              {toggle('lbw', 'LBW is used')}
              {toggle('byes', 'Byes allowed')}
              {toggle('leg_byes', 'Leg-byes allowed')}
            </div>
          </section>
          <section>
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>Powerplay & fielding</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.6rem' }}>
              <label style={label}>Powerplay overs (0 = none){num('powerplay_overs', '0')}</label>
              <label style={label}>Fielders outside circle – powerplay{num('fielders_outside_powerplay', '2')}</label>
              <label style={label}>Fielders outside circle – after{num('fielders_outside', '5')}</label>
              <label style={label}>Boundary size (metres){num('boundary_size_m', 'Not set')}</label>
              {facts?.match_type === 'two_innings' && <label style={label}>Follow-on lead (runs){num('follow_on_lead', '75')}</label>}
            </div>
          </section>
          <section>
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>Your own rules (written)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
              {Object.entries(NOTE_LABELS).map(([k, l]) => (
                <label key={k} style={label}>{l}
                  <textarea rows={2} maxLength={1000} value={edit.notes?.[k] || ''} onChange={(e) => setNoteField(k, e.target.value)} style={{ ...input, resize: 'vertical' }}
                    placeholder={k === 'general' ? 'e.g. One-bounce catch is not out; ball over the wall without bouncing is out' : ''} />
                </label>
              ))}
            </div>
          </section>
          <label style={label}>What changed? (shown in the version history)
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} style={input} placeholder="e.g. Max 2 overs per bowler" />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save & publish'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setEdit(null)}>Cancel</Button>
          </div>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>Overs, players a side, ball and pitch type are set when the {matchId ? 'match' : 'tournament'} is created.</p>
        </div>
      )}

      {(d.versions || []).length > 0 && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
          <button onClick={() => setShowVersions(!showVersions)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#475569', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <History size={14} /> Version history ({d.versions.length}) {showVersions ? '▲' : '▼'}
          </button>
          {showVersions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
              {d.versions.map((v) => (
                <div key={v.version} style={{ fontSize: '0.8rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <strong>v{v.version}</strong>
                  <span style={{ color: '#64748b' }}>{new Date(v.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{v.changed_by || '–'}</span>
                  {v.note && <span style={{ color: '#334155' }}>“{v.note}”</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default PlayingConditionsPanel;
