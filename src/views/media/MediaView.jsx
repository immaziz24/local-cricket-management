import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { Radio, Clapperboard, ArrowRight } from 'lucide-react';
import { VideoBox } from './MediaGallery.jsx';

/** Category I hub: matches streaming live right now (#177/#178) and the newest videos, highlights and photos (#180–#184). */
const KINDS = [['', 'Everything'], ['video', 'Videos'], ['highlight', 'Highlights'], ['photo', 'Photos']];
const ROUTE = { match: 'match-centre', tournament: 'tournament-details', player: 'player-profile' };

export function MediaView({ onNavigate }) {
  const [kind, setKind] = useState('');
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { setFeed(null); dataService.mediaFeed({ kind }).then(setFeed).catch((e) => setErr(e.message)); }, [kind]);
  const go = (i) => onNavigate && onNavigate(ROUTE[i.scope], i.scope_id);
  const Link = ({ i }) => <button type="button" onClick={() => go(i)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{i.about || 'Open'} <ArrowRight size={12} /></button>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clapperboard size={22} /> Live & media</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Matches on live video, highlights, videos and photos from local cricket. Open any match to stream it, add photos or share the result card.</p>
      </div>
      {err && <Card><span style={{ color: '#b91c1c', fontSize: '0.86rem' }}>{err}</span></Card>}
      <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Radio size={17} color="#dc2626" /> Live now</span>}>
        {feed === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : feed.live.length === 0 ? (
          <span style={{ fontSize: '0.86rem', color: '#64748b' }}><strong style={{ color: '#92400e' }}>Coming soon.</strong> Live video of local matches will appear here. Until then, follow any live match ball-by-ball from Matches.</span>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.8rem' }}>
            {feed.live.map((i) => <div key={i.id}><VideoBox item={i} height={210} /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.84rem' }}><strong>🔴 {i.title || 'Live'}</strong><Link i={i} /></div></div>)}
          </div>
        )}
      </Card>
      <Card title="Latest">
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          {KINDS.map(([k, l]) => <button key={k || 'all'} type="button" onClick={() => setKind(k)} style={{ padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${kind === k ? '#16a34a' : '#e2e8f0'}`, backgroundColor: kind === k ? '#dcfce7' : '#fff', fontWeight: kind === k ? 700 : 500 }}>{l}</button>)}
        </div>
        {feed === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : feed.latest.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>Nothing posted yet.</span> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.8rem' }}>
            {feed.latest.map((i) => (
              <div key={i.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.5rem' }}>
                {i.kind === 'photo' ? <img src={i.url} alt={i.caption || i.title || 'Photo'} loading="lazy" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: '0.5rem', cursor: 'pointer' }} onClick={() => go(i)} /> : <VideoBox item={i} height={160} />}
                <div style={{ fontWeight: 700, fontSize: '0.86rem', marginTop: 4 }}>{i.moment ? `Over ${i.moment} · ` : ''}{i.title || (i.kind === 'photo' ? 'Photo' : 'Video')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: '0.74rem', color: '#94a3b8' }}><span>{i.uploader} · {new Date(i.created_at).toLocaleDateString('en-IN')}</span><Link i={i} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default MediaView;
