import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { Swords } from 'lucide-react';
import { strikeRate, dismissalText, h2hHeadline, edge } from './h2hView.js';

/** #353 Batter versus bowler: every recorded ball between two players. */
export function HeadToHeadCard({ Picker }) {
  const [bat, setBat] = useState(null);
  const [bowl, setBowl] = useState(null);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setD(null); setErr(null);
    if (bat && bowl) dataService.fetchBatterVsBowler(bat.id, bowl.id).then(setD).catch((e) => setErr(e.message));
  }, [bat, bowl]);
  const search = (q) => dataService.searchPlayers(q);
  const e = d ? edge(d) : null;
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}><Swords size={16} /> Batter versus bowler</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
        <Picker placeholder="Batter" search={search} value={bat} onChange={setBat} />
        <Picker placeholder="Bowler" search={search} value={bowl} onChange={setBowl} />
      </div>
      {err && <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{err}</div>}
      {!d && !err && <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>Pick a batter and a bowler to see how they have gone against each other.</p>}
      {d && (
        <>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.88rem' }}>{h2hHeadline(d)}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.4rem', textAlign: 'center' }}>
            {[['Balls', d.balls], ['Runs', d.runs], ['Dots', d.dots], ['4s', d.fours], ['6s', d.sixes], ['Outs', d.dismissals], ['SR', strikeRate(d.runs, d.balls)]].map(([l, v]) => (
              <div key={l} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem' }}><div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{v}</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>{l}</div></div>
            ))}
          </div>
          {d.dismissals > 0 && <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#475569' }}>{d.bowler} has got {d.batter} out: {dismissalText(d.dismissal_types)}.</div>}
          {e !== 'even' && <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', fontWeight: 700, color: '#0f172a' }}>{e === 'bowler' ? `${d.bowler} has the edge so far.` : `${d.batter} has the edge so far.`}</div>}
          {d.by_match.length > 0 && (
            <div style={{ marginTop: '0.6rem' }}>
              {d.by_match.map((m) => <div key={m.match_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', padding: '0.2rem 0', borderBottom: '1px solid #f1f5f9' }}><span>{m.title}</span><span>{m.runs} off {m.balls}{m.out ? ' · out' : ''}</span></div>)}
            </div>
          )}
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>Counts finished and live matches only. A ball is faced when it is a legal delivery; run-outs are not credited to the bowler.</p>
        </>
      )}
    </Card>
  );
}

export default HeadToHeadCard;
