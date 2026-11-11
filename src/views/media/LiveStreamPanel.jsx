import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Radio, Copy, Smartphone, Monitor, StopCircle, PlayCircle, Trash2 } from 'lucide-react';
import { VideoBox } from './MediaGallery.jsx';
import { detectSource, siteLink } from './mediaUtils.js';

/**
 * #177 Mobile live streaming, #178 YouTube live integration, #179 live score overlays.
 * The video itself is streamed from a phone to YouTube or Facebook (free, no limits); this page plays it next to the
 * live score and gives a score overlay page that streaming apps can put on top of the camera picture.
 */
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box' };

export function LiveStreamPanel({ matchId, matchStatus }) {
  const [data, setData] = useState(null);
  const [f, setF] = useState({ url: '', title: '' });
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(null);
  const [guide, setGuide] = useState(false);
  const load = () => dataService.listMedia('match', matchId, 'stream').then(setData).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [matchId]);
  const streams = data?.items || [];
  const live = streams.filter((s) => s.is_live);
  // Owner decision 2026-11-11: streaming is "coming soon"; only admins see the tools until it is switched on.
  const open = !!data?.streaming_open || !!data?.can_stream;
  const copy = async (key, text) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { window.prompt('Copy this link:', text); } };
  const overlay = (style) => siteLink(`overlay=${matchId}${style ? `&style=${style}` : ''}`);
  const add = async () => {
    setMsg(null);
    try { await dataService.addMedia({ scope: 'match', scope_id: matchId, kind: 'stream', source: detectSource(f.url), url: f.url.trim(), title: f.title, is_live: true }); setF({ url: '', title: '' }); load(); setMsg({ ok: true, text: 'Stream added. Team owners were notified.' }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const act = async (fn) => { try { await fn(); load(); } catch (e) { setMsg({ ok: false, text: e.message }); } };

  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Radio size={17} color={live.length ? '#dc2626' : '#64748b'} /> Live video {live.length > 0 ? <span style={{ fontSize: '0.7rem', color: '#fff', backgroundColor: '#dc2626', padding: '0.1rem 0.45rem', borderRadius: 999 }}>LIVE</span>
        : !open && <span style={{ fontSize: '0.7rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.1rem 0.5rem', borderRadius: 999 }}>COMING SOON</span>}</span>}
      subtitle={open ? 'Watch the match on video next to the live score' : 'Watch matches on live video with the score on screen – coming soon'}>
      {data === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {streams.length === 0 && (open
            ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No live video for this match{matchStatus === 'completed' ? '.' : ' yet.'}</span>
            : <span style={{ fontSize: '0.86rem', color: '#64748b' }}>Live video streaming is coming soon. Until then, follow ball-by-ball on the Live tab and share the match with the WhatsApp button.</span>)}
          {data.can_stream && !data.streaming_open && <span style={{ fontSize: '0.76rem', color: '#92400e' }}>Admin preview: streaming is switched off for everyone else.</span>}
          {streams.map((s) => (
            <div key={s.id}>
              <VideoBox item={s} height={340} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap', fontSize: '0.84rem' }}>
                <strong style={{ flex: 1 }}>{s.is_live ? '🔴 ' : ''}{s.title || (s.source === 'youtube' ? 'YouTube live' : 'Live stream')}</strong>
                {!s.is_live && <span style={{ color: '#64748b' }}>Replay</span>}
                {s.can_edit && (s.is_live
                  ? <Button size="sm" variant="secondary" onClick={() => act(() => dataService.updateMedia(s.id, { is_live: false }))} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><StopCircle size={13} /> Mark as ended</Button>
                  : <Button size="sm" variant="secondary" onClick={() => act(() => dataService.updateMedia(s.id, { is_live: true }))} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><PlayCircle size={13} /> Live again</Button>)}
                {s.can_edit && <button type="button" title="Remove" onClick={() => window.confirm('Remove this stream link?') && act(() => dataService.deleteMedia(s))} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}><Trash2 size={15} /></button>}
              </div>
            </div>
          ))}

          {data.can_stream && matchStatus !== 'completed' && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.8rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Add the live stream link</strong>
              <input placeholder="YouTube live link (youtube.com/live/… or youtu.be/…) or Facebook live link" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} style={inp} />
              <input placeholder="Title (optional), e.g. Main camera" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={inp} />
              <div><Button size="sm" variant="primary" disabled={f.url.trim().length < 12} onClick={add}>Go live on this page</Button></div>
            </div>
          )}
          {msg && <div style={{ fontSize: '0.82rem', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.text}</div>}

          {/* #179 overlays */}
          {open && <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.7rem' }}>
            <strong style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Monitor size={15} /> Live score overlay</strong>
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.8rem', color: '#64748b' }}>A see-through score bar that updates by itself every few seconds. Add it as a “web page / browser source” overlay in your streaming app (Larix, Prism Live, StreamYard, OBS).</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[['', 'Score bar (bottom)'], ['box', 'Score box (corner)']].map(([st, l]) => (
                <span key={st || 'bar'} style={{ display: 'inline-flex', gap: '0.3rem' }}>
                  <Button size="sm" variant="secondary" onClick={() => copy(st || 'bar', overlay(st))} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Copy size={13} /> {copied === (st || 'bar') ? 'Copied!' : `Copy ${l} link`}</Button>
                  <a href={overlay(st)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb', alignSelf: 'center' }}>preview</a>
                </span>
              ))}
            </div>
          </div>}

          {/* #177 how to go live from a phone */}
          {open && <div>
            <button type="button" onClick={() => setGuide(!guide)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Smartphone size={14} /> {guide ? 'Hide' : 'How to stream from your phone'}</button>
            {guide && (
              <ol style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <li><strong>Easiest:</strong> open the YouTube app → <em>Create (+)</em> → <em>Go live</em>. (YouTube needs your channel verified once; it can take up to 24 hours the first time.) Or use Facebook → <em>Live video</em>.</li>
                <li>Copy the live link from the share button and paste it above. Everyone on this match page can now watch.</li>
                <li><strong>With the score on the video:</strong> use a free streaming app such as Larix Broadcaster or Prism Live, stream to YouTube with your stream key, and add the overlay link above as a web overlay.</li>
                <li>Use a phone stand or tripod behind the bowler's arm, keep the phone charging, and use Wi-Fi or a strong 4G/5G signal.</li>
                <li>When the match ends tap <em>Mark as ended</em>. YouTube keeps the recording, so the link becomes the replay.</li>
              </ol>
            )}
          </div>}
        </div>
      )}
    </Card>
  );
}

export default LiveStreamPanel;
