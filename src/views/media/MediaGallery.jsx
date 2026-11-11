import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Image as ImageIcon, Video, Upload, Link2, X, EyeOff, Eye, Trash2, ExternalLink, Scissors } from 'lucide-react';
import { embedUrl, thumbUrl, detectSource, shrinkImage, fmtBytes } from './mediaUtils.js';

/**
 * #181 match video uploads, #182 player video profiles, #183 tournament photo galleries, #184 match photo galleries,
 * #180 highlight clips. One gallery used on match, tournament and player pages.
 * props: scope ('match'|'tournament'|'player'), scopeId, kinds (['photo','video','highlight']), title, subtitle, refreshKey
 */
const KIND_LABEL = { photo: 'Photos', video: 'Videos', highlight: 'Highlight clips' };
const inp = { padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.86rem', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' };

export function VideoBox({ item, height = 220 }) {
  const embed = embedUrl(item);
  if (item.source === 'upload' && item.url) return <video src={item.url} controls preload="metadata" playsInline style={{ width: '100%', maxHeight: height, borderRadius: '0.5rem', backgroundColor: '#000' }} />;
  if (embed) return <iframe src={embed} title={item.title || 'Video'} style={{ width: '100%', height, border: 0, borderRadius: '0.5rem', backgroundColor: '#000' }} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />;
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 120, borderRadius: '0.5rem', backgroundColor: '#0f172a', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
      <ExternalLink size={16} /> Open on {item.source === 'instagram' ? 'Instagram' : 'the website'}
    </a>
  );
}

function AddForm({ scope, scopeId, kind, onDone, onCancel }) {
  const [mode, setMode] = useState(kind === 'photo' ? 'upload' : 'link');
  const [f, setF] = useState({ url: '', title: '', caption: '', moment: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const save = async () => {
    setMsg(null);
    try {
      if (mode === 'link') {
        await dataService.addMedia({ scope, scope_id: scopeId, kind, source: detectSource(f.url), url: f.url.trim(), title: f.title, caption: f.caption, moment: f.moment });
      } else {
        if (!files.length) throw new Error('Choose a file first.');
        for (let i = 0; i < files.length; i++) {
          setBusy(`Uploading ${i + 1} of ${files.length}…`);
          const file = kind === 'photo' ? await shrinkImage(files[i]) : files[i];
          await dataService.uploadMedia({ scope, scopeId, kind, title: f.title, caption: f.caption, moment: f.moment, file });
        }
      }
      onDone();
    } catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.8rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {kind !== 'photo' && (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[['link', 'YouTube / Facebook / Instagram link', Link2], ['upload', 'Upload a short clip (max 20 MB)', Upload]].map(([v, l, I]) => (
            <button key={v} type="button" onClick={() => setMode(v)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '0.35rem 0.7rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${mode === v ? '#16a34a' : '#e2e8f0'}`, backgroundColor: mode === v ? '#dcfce7' : '#fff', fontWeight: mode === v ? 700 : 500 }}><I size={13} /> {l}</button>
          ))}
        </div>
      )}
      {mode === 'link'
        ? <input placeholder="https://youtu.be/…  or a Facebook / Instagram video link" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} style={inp} />
        : <input type="file" multiple={kind === 'photo'} accept={kind === 'photo' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm,video/quicktime'} onChange={(e) => setFiles([...e.target.files].slice(0, 20))} style={{ fontSize: '0.84rem' }} />}
      <div style={{ display: 'grid', gridTemplateColumns: kind === 'highlight' ? '2fr 1fr' : '1fr', gap: '0.5rem' }}>
        <input placeholder={kind === 'photo' ? 'Title (optional)' : 'Title, e.g. "Raju hits 3 sixes in a row"'} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={inp} />
        {kind === 'highlight' && <input placeholder="Over, e.g. 12.3" maxLength={40} value={f.moment} onChange={(e) => setF({ ...f, moment: e.target.value })} style={inp} />}
      </div>
      <input placeholder="Caption (optional)" maxLength={500} value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} style={inp} />
      {kind === 'photo' && <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Up to 20 photos at once. Large phone photos are made smaller automatically.</span>}
      {kind !== 'photo' && mode === 'upload' && <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Short clips only (max 20 MB, up to 10 uploads per person). For full matches upload to YouTube and paste the link.</span>}
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Button size="sm" variant="primary" disabled={!!busy || (mode === 'link' ? f.url.trim().length < 10 : !files.length)} onClick={save}>{busy || 'Add'}</Button>
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function ItemActions({ item, onChanged, onError }) {
  if (!item.can_edit) return null;
  const run = async (fn) => { try { await fn(); onChanged(); } catch (e) { onError(e.message); } };
  return (
    <div style={{ display: 'flex', gap: '0.3rem' }}>
      <button type="button" title={item.status === 'hidden' ? 'Show' : 'Hide'} onClick={() => run(() => dataService.updateMedia(item.id, { status: item.status === 'hidden' ? 'visible' : 'hidden' }))} style={iconBtn}>{item.status === 'hidden' ? <Eye size={14} /> : <EyeOff size={14} />}</button>
      <button type="button" title="Delete" onClick={() => window.confirm('Delete this?') && run(() => dataService.deleteMedia(item))} style={{ ...iconBtn, color: '#b91c1c' }}><Trash2 size={14} /></button>
    </div>
  );
}
const iconBtn = { background: 'rgba(255,255,255,0.92)', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.2rem 0.35rem', cursor: 'pointer', display: 'inline-flex' };

export function MediaGallery({ scope, scopeId, kinds = ['photo', 'video'], title, subtitle, refreshKey, emptyText }) {
  const [kind, setKind] = useState(kinds[0]);
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => dataService.listMedia(scope, scopeId).then(setData).catch((e) => setMsg(e.message));
  useEffect(() => { if (scopeId) load(); }, [scope, scopeId, refreshKey]);
  const items = (data?.items || []).filter((i) => i.kind === kind);
  const photos = items.filter((i) => i.url);
  const Icon = kind === 'photo' ? ImageIcon : kind === 'highlight' ? Scissors : Video;
  return (
    <Card title={title || 'Photos & videos'} subtitle={subtitle}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.7rem' }}>
        {kinds.length > 1 && kinds.map((k) => {
          const n = (data?.items || []).filter((i) => i.kind === k).length;
          return <button key={k} type="button" onClick={() => { setKind(k); setAdding(false); }} style={{ padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.8rem', border: `1px solid ${kind === k ? '#16a34a' : '#e2e8f0'}`, backgroundColor: kind === k ? '#dcfce7' : '#fff', fontWeight: kind === k ? 700 : 500 }}>{KIND_LABEL[k]}{n ? ` (${n})` : ''}</button>;
        })}
        <span style={{ flex: 1 }} />
        {data?.can_add && !adding && <Button size="sm" variant="primary" onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon size={14} /> Add {kind === 'photo' ? 'photos' : kind === 'highlight' ? 'highlight' : 'video'}</Button>}
      </div>
      {adding && <div style={{ marginBottom: '0.8rem' }}><AddForm scope={scope} scopeId={scopeId} kind={kind} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} /></div>}
      {msg && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{msg}</div>}
      {data === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : items.length === 0 ? (
        <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>{emptyText || `No ${KIND_LABEL[kind].toLowerCase()} yet.${data.can_add ? '' : scope === 'player' ? ' The player or their team owner can add them.' : scope === 'tournament' ? ' The organiser and owners of teams in this tournament can add them.' : ' Organisers, officials, team owners and players of this match can add them.'}`}</span>
      ) : kind === 'photo' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
          {items.map((i) => (
            <div key={i.id} style={{ position: 'relative', opacity: i.status === 'hidden' ? 0.45 : 1 }}>
              {i.url ? <button type="button" onClick={() => setOpen(photos.indexOf(i))} style={{ padding: 0, border: 'none', cursor: 'zoom-in', display: 'block', width: '100%' }}>
                <img src={i.url} alt={i.caption || i.title || 'Photo'} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '0.5rem', display: 'block' }} />
              </button> : <div style={{ aspectRatio: '1', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>Upload not finished</div>}
              <div style={{ position: 'absolute', top: 4, right: 4 }}><ItemActions item={i} onChanged={load} onError={setMsg} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.8rem' }}>
          {items.map((i) => (
            <div key={i.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.5rem', opacity: i.status === 'hidden' ? 0.5 : 1 }}>
              {i.url ? <VideoBox item={i} height={190} /> : <div style={{ height: 120, borderRadius: '0.5rem', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>Upload not finished – delete and try again</div>}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', marginTop: '0.4rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{i.moment ? <span style={{ color: '#059669' }}>Over {i.moment} · </span> : ''}{i.title || (i.source === 'upload' ? 'Video clip' : 'Video')}</div>
                  {i.caption && <div style={{ fontSize: '0.8rem', color: '#475569' }}>{i.caption}</div>}
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>by {i.uploader || '—'} · {new Date(i.created_at).toLocaleDateString('en-IN')}{i.file_bytes ? ` · ${fmtBytes(i.file_bytes)}` : ''}{i.status === 'hidden' ? ' · hidden' : ''}</div>
                </div>
                <ItemActions item={i} onChanged={load} onError={setMsg} />
              </div>
            </div>
          ))}
        </div>
      )}
      {open !== null && photos[open] && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <button type="button" aria-label="Close" onClick={() => setOpen(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={26} /></button>
          <img src={photos[open].url} alt={photos[open].caption || 'Photo'} onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % photos.length); }} style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: '0.4rem', cursor: 'pointer' }} />
          <div style={{ color: '#e2e8f0', fontSize: '0.86rem', marginTop: '0.6rem', textAlign: 'center' }}>
            {[photos[open].title, photos[open].caption].filter(Boolean).join(' – ')} <span style={{ color: '#94a3b8' }}>({open + 1}/{photos.length} · tap photo for next · by {photos[open].uploader})</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export default MediaGallery;
