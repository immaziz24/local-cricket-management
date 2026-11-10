import React, { useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { BookOpen, ExternalLink, Calculator, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Category E reference library (plain-language summaries written for local cricket – not the official text):
 * #103 MCC Laws reference, #104 ICC playing conditions reference, #113 dismissals, #115 dead ball, #116 overthrows,
 * #117 short runs, #118 boundaries, #120 follow-on, #121 Super Over, #122 DLS support, #123 penalty runs,
 * #124 time-wasting, #125 umpire signals. Always check the official Laws for the exact wording.
 */

const MCC_URL = 'https://www.lords.org/mcc/all-laws';
const ICC_URL = 'https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions';

const DISMISSALS = [
  ['Bowled', 'The ball from the bowler hits the stumps and a bail falls.', 'No'],
  ['Caught', 'A fielder catches the ball off the bat (or glove holding the bat) before it touches the ground.', 'No'],
  ['Leg before wicket (LBW)', 'The ball would have hit the stumps but hits the batter’s body first. Many tennis-ball games switch LBW off.', 'No'],
  ['Run out', 'The batters are running and a fielder breaks the wicket while the batter is out of the crease.', 'Yes'],
  ['Stumped', 'The keeper breaks the wicket while the striker is out of the crease and not trying a run.', 'No (yes on a wide)'],
  ['Hit wicket', 'The striker breaks their own wicket with bat or body while playing or setting off for a run.', 'No (yes on a wide)'],
  ['Hit the ball twice', 'The striker deliberately hits the ball a second time, other than to protect the wicket.', 'Yes'],
  ['Obstructing the field', 'A batter deliberately gets in the way of a fielder by word or action.', 'Yes'],
  ['Timed out', 'The next batter takes too long to be ready to face (usually 3 minutes; local rules may change this).', '—'],
  ['Retired out', 'A batter leaves without the umpire’s permission (or at a local retire-at score) and counts as out.', '—']
];

const SIGNALS = [
  ['Out', 'Index finger raised above the head.'],
  ['Four', 'Arm waved from side to side across the chest, finishing across the body.'],
  ['Six', 'Both arms raised straight above the head.'],
  ['No-ball', 'One arm held out horizontally to the side.'],
  ['Wide', 'Both arms held out horizontally to the sides.'],
  ['Bye', 'One open hand raised above the head.'],
  ['Leg-bye', 'Touching a raised knee with the hand.'],
  ['Dead ball', 'Wrists crossed and uncrossed below the waist, repeatedly.'],
  ['Short run', 'Bending one arm upward and touching the nearer shoulder with the fingertips.'],
  ['Free hit', 'One arm raised, moving the hand in a circle (after signalling the no-ball).'],
  ['Penalty runs to the batting side', 'Repeated tapping of one shoulder with the opposite hand.'],
  ['Penalty runs to the fielding side', 'One hand placed on the opposite shoulder.'],
  ['Revoke last signal', 'Touching both shoulders, each with the opposite hand.'],
  ['New ball', 'Holding the ball above the head.']
];

const SECTIONS = [
  { id: 'dismissals', title: 'Ways to get out (#113)', body: (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
        <thead><tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.72rem' }}><th style={{ padding: '0.3rem' }}>How out</th><th style={{ padding: '0.3rem' }}>What it means</th><th style={{ padding: '0.3rem' }}>Possible on a free hit / no-ball?</th></tr></thead>
        <tbody>{DISMISSALS.map(([a, b, c]) => <tr key={a} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '0.35rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{a}</td><td style={{ padding: '0.35rem' }}>{b}</td><td style={{ padding: '0.35rem' }}>{c}</td></tr>)}</tbody>
      </table>
      <p style={{ marginBottom: 0 }}>The scoring screen only offers the dismissals that are possible for the ball being recorded (for example, only a run-out on a free hit).</p>
    </>
  ) },
  { id: 'extras', title: 'Wides, no-balls, free hits, byes and leg-byes', body: (
    <ul>
      <li><strong>Wide</strong> – too far from the batter to hit with a normal shot. Usually 1 run plus any runs taken, and the ball is bowled again.</li>
      <li><strong>No-ball</strong> – for example overstepping the crease, a full toss above waist height, or a throw. Usually 1 run plus runs off the bat, and the ball is bowled again.</li>
      <li><strong>Free hit</strong> – in many short formats the ball after a no-ball is a free hit: the batter can only be out in ways like run out.</li>
      <li><strong>Byes / leg-byes</strong> – runs taken when the ball misses the bat (bye) or hits the body (leg-bye). Many local games do not allow leg-byes.</li>
    </ul>
  ), note: 'Your tournament or match can change all of these in its Playing conditions.' },
  { id: 'dead', title: 'Dead ball (#115)', body: (
    <p>The ball becomes dead once it is settled with the keeper or bowler, goes for a boundary, a batter is out, or the umpire calls it dead (for example a serious injury, the ball lodging in clothing, or a batter distracted before the delivery). No runs or wickets can come from a dead ball after that moment. In the scorer’s app, record only what happened before the ball became dead; use a Decision report if the umpire called dead ball.</p>
  ) },
  { id: 'overthrow', title: 'Overthrows (#116)', body: (
    <p>If a fielder’s throw goes past the stumps and the batters run again, those extra runs are added to the runs off the bat (or to byes / leg-byes if that is what the ball was). If an overthrow reaches the boundary, the batting side gets the boundary plus the runs already completed – and the run in progress if the batters had crossed when the throw was made. In the app, enter the total runs for the ball (e.g. 1 run + 4 overthrows = 5).</p>
  ) },
  { id: 'short', title: 'Short runs (#117)', body: (
    <p>A run is short if a batter turns back without grounding the bat or body behind the crease. That run does not count; the others do. If the umpire believes it was deliberate, no runs count and penalty runs may be given to the fielding side. In the app, enter only the runs that count and add a Decision report “Short run”.</p>
  ) },
  { id: 'boundary', title: 'Boundaries (#118)', body: (
    <p>Four when the ball crosses the boundary after touching the ground; six when it lands over the boundary without bouncing. A fielder touching the ball while in contact with the ground beyond the boundary makes it a boundary. Many local grounds use special rules (one side short, a wall that counts as out, etc.) – write those in the tournament’s Playing conditions under Boundary rules.</p>
  ) },
  { id: 'followon', title: 'Follow-on (#120)', body: (
    <p>Only in two-innings matches. If the side batting first leads by at least the agreed number of runs after both first innings, it can ask the other side to bat again straight away. The Laws link the figure to the length of the match (75 runs for a one-day match). Set your own figure in Playing conditions; the scorer gets an <em>Enforce follow-on</em> button at the start of the third innings.</p>
  ) },
  { id: 'superover', title: 'Super Over (#121)', body: (
    <p>When a limited-overs match is tied, each side can play one more over to decide the winner. In this app the team that batted second bats first in the Super Over, each side has 1 over and (by default) 2 wickets, and the higher score wins. If the Super Over is also tied the scorer can start another. Super Over runs never count toward team totals, net run rate or player statistics.</p>
  ) },
  { id: 'penalty', title: 'Penalty runs (#123)', body: (
    <p>Umpires can award penalty runs (usually 5) for things like the ball hitting a fielder’s helmet left on the ground, deliberate fake fielding, damaging the pitch, deliberate short runs or repeated time-wasting. Runs to the batting side are added straight away; runs to the fielding side are added to their innings. The scorer adds them from <em>More options → Penalty runs</em>; each award is logged in the match Reports tab.</p>
  ) },
  { id: 'time', title: 'Time-wasting (#124)', body: (
    <p>Both sides must keep the game moving. Usually the umpires first give a warning; if it continues, penalty runs can be awarded and the matter reported. In the app, log a warning as an Incident report (action: Warning) and repeated cases as a Disciplinary report. Many local tournaments also use the Late-arrival rules page.</p>
  ) },
  { id: 'signals', title: 'Umpire signals (#125)', body: (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
      <tbody>{SIGNALS.map(([a, b]) => <tr key={a} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '0.35rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{a}</td><td style={{ padding: '0.35rem' }}>{b}</td></tr>)}</tbody>
    </table>
  ), note: 'The MCC Laws app has videos of every signal.' }
];

export function DlsHelper() {
  const [m, setM] = useState({ t1: '', o1: '', o2: '', r1: '', r2: '' });
  const n = (v) => (v === '' ? NaN : Number(v));
  const t1 = n(m.t1); const o1 = n(m.o1); const o2 = n(m.o2); const r1 = n(m.r1); const r2 = n(m.r2);
  const arr = t1 >= 0 && o1 > 0 && o2 > 0 ? Math.floor((t1 * o2) / o1) + 1 : null;
  const res = t1 >= 0 && r1 > 0 && r2 > 0 && r2 <= r1 ? Math.floor((t1 * r2) / r1) + 1 : null;
  const input = { padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' };
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Calculator size={16} /> Rain-shortened match – revised target (#122)</span>}
      subtitle="Two ways to set a target when the second innings is cut short">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
        <label style={lbl}>Team 1 score<input type="number" min="0" value={m.t1} onChange={(e) => setM({ ...m, t1: e.target.value })} style={input} /></label>
        <label style={lbl}>Team 1 overs available<input type="number" min="1" value={m.o1} onChange={(e) => setM({ ...m, o1: e.target.value })} style={input} /></label>
        <label style={lbl}>Team 2 overs available<input type="number" min="1" value={m.o2} onChange={(e) => setM({ ...m, o2: e.target.value })} style={input} /></label>
      </div>
      <div style={{ marginTop: '0.7rem', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>1. Average run-rate method (simple, common in local cricket)</div>
        <div style={{ fontSize: '0.9rem', marginTop: '0.2rem' }}>{arr != null ? <>Target: <strong>{arr}</strong> in {m.o2} overs</> : 'Enter the score and overs above.'}</div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Team 1’s run rate × Team 2’s overs, plus one. Ignores wickets lost.</div>
      </div>
      <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>2. Resources method (how DLS works)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem', marginTop: '0.4rem' }}>
          <label style={lbl}>Team 1 resources %<input type="number" min="0" max="100" step="0.1" value={m.r1} onChange={(e) => setM({ ...m, r1: e.target.value })} style={input} /></label>
          <label style={lbl}>Team 2 resources %<input type="number" min="0" max="100" step="0.1" value={m.r2} onChange={(e) => setM({ ...m, r2: e.target.value })} style={input} /></label>
        </div>
        <div style={{ fontSize: '0.9rem', marginTop: '0.4rem' }}>
          {res != null ? <>Target: <strong>{res}</strong></> : r2 > r1 ? 'When Team 2 has more resources than Team 1, the official method adds runs using a standard score – use the official DLS tool for that case.' : 'Enter both resource percentages.'}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
          DLS gives each side a percentage of “resources” (overs and wickets left). Read the two percentages from the official DLS table or app, then
          target = Team 1 score × (Team 2 resources ÷ Team 1 resources), rounded down, plus one. This tool does not contain the official table.
        </div>
      </div>
    </Card>
  );
}

export function LawsView() {
  const [open, setOpen] = useState({ dismissals: true });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={22} /> Laws & rules</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Short, plain-language guides for local cricket. Each tournament can set its own playing conditions on its About & Rules tab.</p>
      </div>

      {/* #103 #104 */}
      <Card title="Official rule books">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
          <a href={MCC_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', color: '#0f172a', textDecoration: 'none' }}>
            <ExternalLink size={15} style={{ marginTop: 2, color: '#16a34a' }} />
            <span><strong>MCC Laws of Cricket</strong> – the Laws used in every form of cricket, kept by MCC at Lord’s. A new edition came into force in October 2026; the MCC website and app always have the latest version.</span>
          </a>
          <a href={ICC_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', color: '#0f172a', textDecoration: 'none' }}>
            <ExternalLink size={15} style={{ marginTop: 2, color: '#16a34a' }} />
            <span><strong>ICC playing conditions</strong> – how international Test, ODI and T20 matches change the Laws (powerplays, free hits, DLS, Super Overs…). Useful when copying a professional rule into your tournament.</span>
          </a>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>The guides below are our own short summaries to help local players and scorers. They are not the official text – if there is a dispute, the official Laws and your tournament’s playing conditions decide.</p>
        </div>
      </Card>

      {SECTIONS.map((s) => (
        <Card key={s.id}>
          <button onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '1rem', fontWeight: 700, color: '#0f172a', textAlign: 'left' }}>
            {open[s.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />} {s.title}
          </button>
          {open[s.id] && (
            <div style={{ fontSize: '0.86rem', lineHeight: 1.55, color: '#334155', marginTop: '0.5rem' }}>
              {s.body}
              {s.note && <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{s.note}</p>}
            </div>
          )}
        </Card>
      ))}

      <DlsHelper />
    </div>
  );
}

export default LawsView;
