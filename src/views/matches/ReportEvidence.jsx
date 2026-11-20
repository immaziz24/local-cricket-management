import React, { useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Paperclip } from 'lucide-react';

/** #362 Evidence for an incident or disciplinary report: links (https only) and written statements. Officials add; it cannot be edited or removed. */
const field = { padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem', maxWidth: '100%' };

export function ReportEvidence({ reportId }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(null);
  const [kind, setKind] = useState('link');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && !d) { try { setD(await dataService.fetchReportEvidence(reportId)); } catch (e) { setErr(e.message); } }
  };
  const add = async () => {
    setBusy(true); setErr(null);
    try { setD(await dataService.addReportEvidence(reportId, kind, kind === 'link' ? text : null, kind === 'statement' ? text : null)); setText(''); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: '0.35rem' }}>
      <button type="button" onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Paperclip size={13} /> Evidence{d ? ` (${d.items.length})` : ''}
      </button>
      {open && (
        <div style={{ marginTop: '0.3rem', paddingLeft: '0.6rem', borderLeft: '2px solid #e2e8f0' }}>
          {err && <div style={{ color: '#b91c1c', fontSize: '0.78rem' }}>{err}</div>}
          {d && d.items.length === 0 && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No evidence attached.</div>}
          {d && d.items.map((e) => (
            <div key={e.id} style={{ fontSize: '0.8rem', padding: '0.15rem 0' }}>
              {e.kind === 'link' ? <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: '#2563eb', wordBreak: 'break-all' }}>{e.url}</a> : <span style={{ whiteSpace: 'pre-wrap' }}>“{e.statement}”</span>}
              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> · {e.by || 'official'}, {new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
          {d && d.can_add && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              <select value={kind} onChange={(e) => { setKind(e.target.value); setText(''); }} style={field}><option value="link">Link (photo, video, document)</option><option value="statement">Written statement</option></select>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'link' ? 'https://…' : 'What you saw or heard'} maxLength={kind === 'link' ? 500 : 1000} style={{ ...field, flex: 1, minWidth: 160 }} />
              <Button size="sm" variant="secondary" disabled={busy || text.trim().length < 5} onClick={add}>Attach</Button>
            </div>
          )}
          {d && d.can_add && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Evidence cannot be edited or removed once attached. Files are shared as links, not uploaded here.</div>}
        </div>
      )}
    </div>
  );
}

export default ReportEvidence;
