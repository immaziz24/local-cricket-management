import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Flag, UserPlus, X, Scale, Star } from 'lucide-react';
import { Stars } from './OfficialsView.jsx';

/**
 * On the match page: #139 official assignments (invite / cancel), #145 payment records,
 * #142 feedback after the match, #143 disputes.
 */
const ROLE = { umpire: 'Umpire', scorer: 'Scorer', third_umpire: 'Third umpire', match_referee: 'Match referee' };
const STATUS = { invited: ['Invited', '#b45309', '#fffbeb'], accepted: ['Confirmed', '#15803d', '#f0fdf4'], declined: ['Declined', '#94a3b8', '#f8fafc'], cancelled: ['Cancelled', '#94a3b8', '#f8fafc'] };
const DSTATUS = { open: 'Open', under_review: 'Under review', resolved: 'Resolved', rejected: 'Rejected' };
const inp = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.84rem', backgroundColor: '#fff' };

export function MatchOfficialsPanel({ match, onNavigate }) {
  const [d, setD] = useState(null);
  const [disp, setDisp] = useState(null);
  const [inv, setInv] = useState(null); // { role, list, fee }
  const [pay, setPay] = useState(null); // { id, fee, paid, note }
  const [rate, setRate] = useState(null); // { id, rating, comment }
  const [newDisp, setNewDisp] = useState(null);
  const [decide, setDecide] = useState(null); // { id, status, resolution }
  const [msg, setMsg] = useState(null);
  const load = () => {
    dataService.listMatchOfficials(match.id).then(setD).catch((e) => setMsg(e.message));
    dataService.listMatchDisputes(match.id).then(setDisp).catch(() => setDisp(null));
  };
  useEffect(() => { load(); }, [match.id]);
  const run = async (fn, after) => { setMsg(null); try { await fn(); after && after(); load(); } catch (e) { setMsg(e.message); } };
  const openInvite = async (role) => {
    const day = match.scheduled_at ? new Date(match.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';
    const list = await dataService.searchOfficials({ kind: role === 'scorer' ? 'scorer' : 'umpire', date: day, city: '' }).catch(() => []);
    setInv({ role, list, fee: '', query: '' });
  };
  const over = ['completed', 'abandoned'].includes(match.status);
  if (!d) return <Card title="Match officials"><p style={{ margin: 0, fontSize: '0.84rem', color: msg ? '#b91c1c' : '#64748b' }}>{msg || 'Loading…'}</p></Card>;

  return (
    <>
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Flag size={16} /> Match officials</span>}
        subtitle={d.can_manage ? 'Invite umpires and scorers. An accepted scorer can score this match.' : null}>
        {msg && <div style={{ marginBottom: '0.6rem', fontSize: '0.83rem', color: '#b91c1c' }}>{msg}</div>}
        {d.officials.length === 0 ? <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>No umpires or scorers added yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {d.officials.map((o) => {
              const [sl, sc, sb] = STATUS[o.status];
              return (
                <div key={o.id} style={{ padding: '0.55rem 0.7rem', borderRadius: '0.5rem', backgroundColor: sb, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => onNavigate && onNavigate('official-profile', o.user_id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>{o.name}</button>
                    <span style={{ fontSize: '0.78rem', color: '#475569' }}>{ROLE[o.role]}</span>
                    <span style={{ fontSize: '0.7rem', color: sc, fontWeight: 700 }}>{sl}</span>
                    {o.rating != null && <Stars value={o.rating} />}
                    <span style={{ flex: 1 }} />
                    {o.fee != null && <span style={{ fontSize: '0.78rem', color: o.paid ? '#15803d' : '#b45309' }}>₹{Number(o.fee).toLocaleString('en-IN')} {o.paid ? 'paid' : 'unpaid'}</span>}
                    {d.can_manage && o.status === 'accepted' && <Button size="sm" variant="secondary" onClick={() => setPay({ id: o.id, fee: o.fee ?? '', paid: !!o.paid, note: o.payment_note || '' })}>Payment</Button>}
                    {d.can_rate && o.status === 'accepted' && !o.is_me && <Button size="sm" variant="secondary" onClick={() => setRate({ id: o.id, rating: o.my_rating || 5, comment: '' })} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Star size={12} /> {o.my_rating ? 'Change rating' : 'Rate'}</Button>}
                    {!over && (d.can_manage || o.is_me) && ['invited', 'accepted'].includes(o.status) && (
                      <button title="Cancel" onClick={() => window.confirm(o.is_me ? 'Withdraw from this match?' : `Cancel ${o.name} as ${ROLE[o.role].toLowerCase()}?`) && run(() => dataService.cancelOfficial(o.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={15} /></button>
                    )}
                    {o.is_me && o.status === 'invited' && <>
                      <Button size="sm" variant="primary" onClick={() => run(() => dataService.respondOfficialInvite(o.id, true))}>Accept</Button>
                      <Button size="sm" variant="secondary" onClick={() => run(() => dataService.respondOfficialInvite(o.id, false))}>Decline</Button>
                    </>}
                  </div>
                  {pay?.id === o.id && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input type="number" min="0" placeholder="Fee ₹" value={pay.fee} onChange={(e) => setPay({ ...pay, fee: e.target.value })} style={{ ...inp, width: 100 }} />
                      <label style={{ fontSize: '0.82rem' }}><input type="checkbox" checked={pay.paid} onChange={(e) => setPay({ ...pay, paid: e.target.checked })} /> Paid</label>
                      <input placeholder="Note (e.g. cash, UPI)" maxLength={200} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} style={{ ...inp, flex: 1, minWidth: 140 }} />
                      <Button size="sm" variant="primary" onClick={() => run(() => dataService.setOfficialPayment(pay.id, pay.fee, pay.paid, pay.note), () => setPay(null))}>Save</Button>
                      <Button size="sm" variant="secondary" onClick={() => setPay(null)}>Cancel</Button>
                    </div>
                  )}
                  {rate?.id === o.id && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setRate({ ...rate, rating: n })} aria-label={`${n} stars`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <Star size={20} color="#ca8a04" fill={n <= rate.rating ? '#facc15' : 'none'} />
                        </button>
                      ))}
                      <input placeholder="Comment (optional)" maxLength={500} value={rate.comment} onChange={(e) => setRate({ ...rate, comment: e.target.value })} style={{ ...inp, flex: 1, minWidth: 160 }} />
                      <Button size="sm" variant="primary" onClick={() => run(() => dataService.rateOfficial(rate.id, rate.rating, rate.comment), () => setRate(null))}>Send</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {d.can_manage && !over && !inv && (
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
            {['umpire', 'scorer', 'third_umpire', 'match_referee'].map((r) => (
              <Button key={r} size="sm" variant="secondary" onClick={() => openInvite(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><UserPlus size={13} /> {ROLE[r]}</Button>
            ))}
          </div>
        )}
        {inv && (
          <div style={{ marginTop: '0.8rem', padding: '0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.88rem' }}>Invite a {ROLE[inv.role].toLowerCase()}</strong>
              <input placeholder="Filter by name or city" value={inv.query} onChange={(e) => setInv({ ...inv, query: e.target.value })} style={{ ...inp, flex: 1, minWidth: 140 }} />
              <input type="number" min="0" placeholder="Fee ₹ (optional)" value={inv.fee} onChange={(e) => setInv({ ...inv, fee: e.target.value })} style={{ ...inp, width: 140 }} />
              <button onClick={() => setInv(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 260, overflowY: 'auto' }}>
              {inv.list.filter((o) => !inv.query || `${o.name} ${o.city || ''}`.toLowerCase().includes(inv.query.toLowerCase())).map((o) => (
                <div key={o.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: '0.4rem', backgroundColor: '#f8fafc', fontSize: '0.84rem' }}>
                  <span style={{ flex: 1 }}><strong>{o.name}</strong> <span style={{ color: '#64748b' }}>{o.city || ''}{o.fee_note ? ` · ${o.fee_note}` : ''} · {o.matches} matches</span>{o.busy_that_day && <span style={{ color: '#b45309' }}> · busy that day</span>}</span>
                  <Stars value={o.rating} />
                  <Button size="sm" variant="primary" onClick={() => run(() => dataService.inviteOfficial(match.id, o.user_id, inv.role, inv.fee), () => setInv(null))}>Invite</Button>
                </div>
              ))}
              {inv.list.length === 0 && <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No free {inv.role === 'scorer' ? 'scorers' : 'umpires'} found for this date. Officials sign up on the Umpires & Scorers page.</span>}
            </div>
          </div>
        )}
      </Card>

      {/* #143 Disputes */}
      {disp && disp.can_see && (
        <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Scale size={16} /> Disputes</span>}
          action={disp.can_raise && !newDisp ? <Button size="sm" variant="secondary" onClick={() => setNewDisp({ subject: '', details: '', assignment_id: '' })}>Raise a dispute</Button> : null}>
          {newDisp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.8rem' }}>
              <input placeholder="Subject (e.g. wrong run-out decision in over 8)" maxLength={120} value={newDisp.subject} onChange={(e) => setNewDisp({ ...newDisp, subject: e.target.value })} style={inp} />
              <textarea rows={3} placeholder="Details" maxLength={2000} value={newDisp.details} onChange={(e) => setNewDisp({ ...newDisp, details: e.target.value })} style={{ ...inp, resize: 'vertical' }} />
              <select value={newDisp.assignment_id} onChange={(e) => setNewDisp({ ...newDisp, assignment_id: e.target.value })} style={inp}>
                <option value="">About an official? (optional)</option>
                {d.officials.filter((o) => o.status === 'accepted').map((o) => <option key={o.id} value={o.id}>{o.name} ({ROLE[o.role]})</option>)}
              </select>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <Button size="sm" variant="primary" disabled={newDisp.subject.trim().length < 3} onClick={() => run(() => dataService.raiseDispute(match.id, newDisp), () => setNewDisp(null))}>Submit</Button>
                <Button size="sm" variant="secondary" onClick={() => setNewDisp(null)}>Cancel</Button>
              </div>
            </div>
          )}
          {disp.disputes.length === 0 ? <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>No disputes.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {disp.disputes.map((x) => (
                <div key={x.id} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', backgroundColor: ['resolved', 'rejected'].includes(x.status) ? '#f8fafc' : '#fffbeb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{x.subject}</strong>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{DSTATUS[x.status]}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{[x.raised_by && `by ${x.raised_by}`, x.team, x.official].filter(Boolean).join(' · ')}</div>
                  {x.details && <div style={{ fontSize: '0.84rem', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{x.details}</div>}
                  {x.resolution && <div style={{ fontSize: '0.84rem', marginTop: '0.3rem', color: '#065f46' }}><strong>Decision:</strong> {x.resolution}</div>}
                  {disp.can_decide && (decide?.id === x.id ? (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                      <select value={decide.status} onChange={(e) => setDecide({ ...decide, status: e.target.value })} style={inp}>{Object.entries(DSTATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                      <input placeholder="Decision / note" maxLength={1000} value={decide.resolution} onChange={(e) => setDecide({ ...decide, resolution: e.target.value })} style={{ ...inp, flex: 1, minWidth: 160 }} />
                      <Button size="sm" variant="primary" onClick={() => run(() => dataService.updateDispute(x.id, decide.status, decide.resolution), () => setDecide(null))}>Save</Button>
                    </div>
                  ) : <button onClick={() => setDecide({ id: x.id, status: x.status === 'open' ? 'under_review' : x.status, resolution: x.resolution || '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '0.3rem', fontSize: '0.78rem', color: '#2563eb' }}>Update status</button>)}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export default MatchOfficialsPanel;
