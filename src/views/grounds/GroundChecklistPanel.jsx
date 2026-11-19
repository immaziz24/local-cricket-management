import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { groupChecklist, validateChecklist, buildChecklistReport, checklistSummary } from './groundConflicts.js';
import { ClipboardList } from 'lucide-react';

const field = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.82rem' };
const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** #366 Ground conditions checklist. A failed must-have item (pitch, outfield, water, first aid, hazards) marks the ground unfit and notifies the owner. */
export function GroundChecklistPanel({ groundId, isOwner, signedIn, history = [], onChanged }) {
  const [tpl, setTpl] = useState(null);
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState({});
  const [notes, setNotes] = useState('');
  const [matchId, setMatchId] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => dataService.fetchGroundInspections(groundId).then(setList).catch(() => setList({ items: [] })), [groundId]);
  useEffect(() => { load(); }, [load]);
  const start = async () => {
    setErr(null);
    try { if (!tpl) setTpl(await dataService.fetchChecklistTemplate()); setAns({}); setOpen(true); } catch (e) { setErr(e.message); }
  };
  const v = tpl ? validateChecklist(tpl, ans) : null;
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      await dataService.addGroundChecklistInspection(groundId, buildChecklistReport(ans, { notes, matchId, fit: true }));
      setOpen(false); setNotes(''); setMatchId(''); await load(); onChanged && onChanged();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const set = (k, patch) => setAns({ ...ans, [k]: { ...(ans[k] || {}), ...patch } });
  const mine = (list?.items || []).filter((i) => i.checklist_total != null);
  if (!signedIn && mine.length === 0) return null;
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardList size={16} /> Ground conditions checklist</span>}
      subtitle="Quick yes/no checks before a match. Must-have items marked * make the ground unfit if they fail."
      action={signedIn && !open ? <Button size="sm" variant="secondary" onClick={start}>Fill in the checklist</Button> : null}>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{err}</div>}
      {open && tpl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '0.8rem', padding: '0.6rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
          {groupChecklist(tpl).map((g) => (
            <div key={g.key}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{g.label}</div>
              {g.items.map((t) => {
                const a = ans[t.key] || {};
                return (
                  <div key={t.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.2rem 0', fontSize: '0.83rem' }}>
                    <span style={{ flex: 1, minWidth: 190 }}>{t.label}{t.critical ? ' *' : ''}</span>
                    {[['true', 'Yes'], ['false', 'No'], ['na', 'N/A']].map(([val, label]) => (
                      <label key={val} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                        <input type="radio" name={`c-${t.key}`} checked={a.ok === val} onChange={() => set(t.key, { ok: val })} /> {label}
                      </label>
                    ))}
                    {a.ok === 'false' && <input style={{ ...field, flex: 1, minWidth: 140 }} maxLength={200} placeholder={t.critical ? 'What is wrong? (required)' : 'Note (optional)'} value={a.note || ''} onChange={(e) => set(t.key, { note: e.target.value })} />}
                  </div>
                );
              })}
            </div>
          ))}
          {!isOwner && (
            <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Match played here (needed if you are not the owner)<br />
              <select style={field} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                <option value="">Choose</option>{history.map((h) => <option key={h.match_id} value={h.match_id}>{h.teams}</option>)}
              </select>
            </label>
          )}
          <textarea rows={2} style={{ ...field, resize: 'vertical' }} maxLength={1500} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div style={{ fontSize: '0.8rem', color: v.errors.length ? '#b45309' : '#15803d' }}>
            {v.errors.length ? v.errors[0] : v.fit ? 'Looks fit for play.' : `This will mark the ground unfit: ${v.failedCritical.join(', ')}.`}
            <span style={{ color: '#94a3b8' }}> · {v.answered} of {tpl.length} answered</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <Button size="sm" variant="primary" disabled={busy || v.errors.length > 0} onClick={send}>Submit</Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {mine.length === 0 ? <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No checklist inspections yet.</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {mine.slice(0, 8).map((i) => (
            <div key={i.id} style={{ fontSize: '0.84rem', padding: '0.45rem 0.6rem', borderRadius: '0.45rem', backgroundColor: i.fit_for_play ? '#f0fdf4' : '#fef2f2' }}>
              <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                <strong>{when(i.inspected_on)}</strong>
                <span style={{ fontWeight: 700, color: i.fit_for_play ? '#15803d' : '#b91c1c' }}>{i.fit_for_play ? 'Fit for play' : 'Unfit'}</span>
                <span style={{ color: '#475569' }}>{checklistSummary(i)}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>by {i.inspector || '-'}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
export default GroundChecklistPanel;
