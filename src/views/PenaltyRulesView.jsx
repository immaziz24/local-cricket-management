import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { dataService } from '../services/dataService';
import { Clock, Scissors, ShieldAlert, Coins, CheckCircle, Calculator } from 'lucide-react';

/**
 * Category Q – late-arrival rules explained (owner-confirmed, blueprint section 5), a delay calculator (#302)
 * and the punctuality record of my teams (#308 #310). Each tournament / match chooses ONE method in its playing conditions.
 */
const METHODS = [
  { id: 'overs_deduction', icon: Scissors, title: '1. Overs cut', rule: 'e.g. 1 over cut per 10 minutes late',
    example: 'Team A scores 100 in 10 overs. Team B arrived 20 minutes late, so it chases 101 in 8 overs.' },
  { id: 'fielding_restriction', icon: ShieldAlert, title: '2. Fielding restriction', rule: 'e.g. for every 5 minutes late, 1 over with only 2 fielders outside the 30-yard circle',
    example: 'Team B arrived 15 minutes late: in the first 3 overs it bowls, only 2 fielders may stand outside the circle.' },
  { id: 'penalty_runs', icon: Coins, title: '3. Penalty runs', rule: 'e.g. 5 runs per 10 minutes late, given to the other team',
    example: 'Team B arrived 30 minutes late: Team A gets 15 penalty runs.' }
];

function DelayCalculator() {
  const [s, setS] = useState({ method: 'overs_deduction', minutes: 20, step: 10, perStep: 1, runs: 5, fieldStep: 5, maxOut: 2, grace: 0, overs: 10 });
  const n = (k) => Number(s[k]) || 0;
  const late = n('minutes');
  let value = 0; let text = '';
  if (late > n('grace')) {
    if (s.method === 'overs_deduction') { value = Math.min(Math.floor(late / Math.max(n('step'), 1)) * n('perStep'), Math.max(n('overs') - 1, 0)); text = `${value} over${value === 1 ? '' : 's'} cut – the late team bats ${n('overs') - value} overs.`; }
    if (s.method === 'penalty_runs') { value = Math.floor(late / Math.max(n('step'), 1)) * n('runs'); text = `${value} penalty runs to the other team.`; }
    if (s.method === 'fielding_restriction') { value = Math.min(Math.floor(late / Math.max(n('fieldStep'), 1)), n('overs')); text = `${value} over${value === 1 ? '' : 's'} with max ${n('maxOut')} fielders outside the circle.`; }
  }
  const field = (k, label) => <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>{label}<input type="number" min="0" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }} /></label>;
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Calculator size={16} /> Delay calculator</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>Method
          <select value={s.method} onChange={(e) => setS({ ...s, method: e.target.value })} style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem' }}>
            {METHODS.map((m) => <option key={m.id} value={m.id}>{m.title.slice(3)}</option>)}
          </select>
        </label>
        {field('minutes', 'Minutes late')}
        {field('grace', 'Grace (min)')}
        {field('overs', 'Overs per innings')}
        {s.method !== 'fielding_restriction' && field('step', 'Per how many minutes')}
        {s.method === 'overs_deduction' && field('perStep', 'Overs cut each time')}
        {s.method === 'penalty_runs' && field('runs', 'Runs each time')}
        {s.method === 'fielding_restriction' && field('fieldStep', '1 over per … minutes')}
        {s.method === 'fielding_restriction' && field('maxOut', 'Max fielders outside')}
      </div>
      <div style={{ marginTop: '0.7rem', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', backgroundColor: value ? '#fef2f2' : '#f0fdf4', fontSize: '0.92rem' }}>
        {value ? <strong>{text}</strong> : 'No penalty at this delay.'}
      </div>
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Only complete blocks of minutes count (25 minutes at “per 10 minutes” = 2 blocks).</p>
    </Card>
  );
}

export function PenaltyRulesView({ currentUser, onNavigate }) {
  const [records, setRecords] = useState([]);
  useEffect(() => {
    if (!currentUser) { setRecords([]); return; }
    dataService.fetchMyTeams().then(async (teams) => {
      const own = (teams || []).filter((t) => t.is_owner || t.owner_id === currentUser.id);
      const rows = await Promise.all(own.map(async (t) => ({ team: t, p: await dataService.getTeamPunctuality(t.id).catch(() => null) })));
      setRecords(rows.filter((r) => r.p));
    }).catch(() => setRecords([]));
  }, [currentUser?.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1000 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={22} /> Late-arrival rules</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
          Local rules to keep matches on time. Each tournament (or match) picks <strong>one</strong> method and its rate in its playing conditions, before the match. These are local tournament rules, not ICC sanctions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {METHODS.map(({ id, icon: Icon, title, rule, example }) => (
          <Card key={id} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Icon size={16} /> {title}</span>}>
            <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600 }}>{rule}</p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.84rem', color: '#475569' }}>{example}</p>
          </Card>
        ))}
      </div>

      <Card title="How it works on match day">
        <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.86rem', lineHeight: 1.7 }}>
          <li>The organiser sets the method, rate, grace period and approver in the tournament’s <em>About & Rules → Playing conditions</em> (or the match’s Rules).</li>
          <li>On the match page (<em>Match day</em>), each team is checked in when it arrives – by its owner, the match owner or an official. Players can be marked present, late or absent.</li>
          <li>The delay is worked out from the scheduled start. If a team is late, a penalty is <strong>proposed automatically</strong> and the organiser is notified.</li>
          <li>Nothing changes until an authorised organiser (or an umpire, if the rules say so) <strong>approves</strong> it. It is then applied to the match and logged in the match Reports.</li>
          <li>The late team’s owner can <strong>appeal</strong>. The organiser can turn the appeal down or <strong>waive</strong> the penalty (an exemption, with a reason) – waiving removes its effect.</li>
          <li>Organisers can record a <strong>fine</strong> for the late team; team owners can fine their own players. Teams with repeated late penalties are flagged.</li>
        </ol>
      </Card>

      <DelayCalculator />

      {records.length > 0 && (
        <Card title="My teams’ punctuality">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {records.map(({ team, p }) => (
              <button key={team.id} onClick={() => onNavigate && onNavigate('team-details', team.id)} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}>
                <strong style={{ flex: 1 }}>{team.name}</strong>
                <span><CheckCircle size={13} style={{ color: '#15803d', verticalAlign: '-2px' }} /> on time {p.on_time}/{p.checked_in}</span>
                <span style={{ color: p.penalties ? '#b91c1c' : '#64748b' }}>late penalties {p.penalties}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default PenaltyRulesView;
