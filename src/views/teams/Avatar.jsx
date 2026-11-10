import React, { useRef } from 'react';
import { Camera } from 'lucide-react';

/** Round photo / logo with initials fallback. If onPick is given, shows a camera button to upload. */
export function Avatar({ url, name = '?', size = 40, square = false, onPick, busy = false, dark = false }) {
  const input = useRef(null);
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      {url ? (
        <img src={url} alt={name} style={{ width: size, height: size, borderRadius: square ? '0.6rem' : '50%', objectFit: 'cover', display: 'block', backgroundColor: '#e2e8f0' }} />
      ) : (
        <span style={{ width: size, height: size, borderRadius: square ? '0.6rem' : '50%', backgroundColor: dark ? '#10b981' : '#e2e8f0', color: dark ? '#fff' : '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.max(11, size / 3) }}>
          {initials}
        </span>
      )}
      {onPick && (
        <>
          <button
            type="button"
            title="Upload image"
            disabled={busy}
            onClick={() => input.current && input.current.click()}
            style={{ position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: '50%', border: '2px solid #fff', backgroundColor: '#0f172a', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <Camera size={13} />
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onPick(f); }}
          />
        </>
      )}
    </span>
  );
}

export default Avatar;
