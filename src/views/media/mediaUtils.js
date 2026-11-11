// Category I helpers: video links, photo shrinking, and canvas drawing for posters / cards (#177–#188).

export function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|shorts\/|embed\/))([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

// Address to put inside an <iframe>, or null when the link can only be opened in a new tab.
export function embedUrl(item) {
  if (!item?.url) return null;
  if (item.source === 'youtube') {
    const id = youtubeId(item.url);
    return id ? `https://www.youtube.com/embed/${id}?rel=0&playsinline=1${item.is_live ? '&autoplay=1&mute=1' : ''}` : null;
  }
  if (item.source === 'facebook') return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(item.url)}&show_text=false`;
  return null;
}

export function thumbUrl(item) {
  if (item?.source === 'youtube') { const id = youtubeId(item.url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null; }
  if (item?.kind === 'photo') return item.url;
  return null;
}

export function detectSource(url) {
  const u = (url || '').trim();
  if (/youtu\.?be/i.test(u)) return 'youtube';
  if (/facebook\.com|fb\.watch/i.test(u)) return 'facebook';
  if (/instagram\.com/i.test(u)) return 'instagram';
  return 'link';
}

// Phone photos are often 4–8 MB: shrink to max 1600 px JPEG so they fit the 2 MB limit.
export async function shrinkImage(file, maxSide = 1600, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.size <= 900 * 1024 && file.type !== 'image/heic') return file;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
  return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export const fmtBytes = (n) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/* ---------- canvas drawing ---------- */
export function loadImage(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function fitText(ctx, text, maxWidth, size, weight = 800, family = 'system-ui, -apple-system, Segoe UI, sans-serif') {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxWidth && s > 12);
  return s + 2;
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || '').split(/\s+/); let line = ''; let n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(n === maxLines - 1 ? `${line}…` : line, x, y + n * lineHeight); n++; line = words[i];
      if (n >= maxLines) return n;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y + n * lineHeight); n++; }
  return n;
}

// Drawn with a fixed palette so cards look the same everywhere.
export function drawBackdrop(ctx, w, h, colorA = '#064e3b', colorB = '#10b981') {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, colorA); g.addColorStop(1, colorB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(w * (0.15 + i * 0.17), h * (i % 2 ? 0.2 : 0.85), w * 0.18, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

export function drawFooter(ctx, w, h, text = 'localcricket.plateria.in') {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, h - 56, w, 56);
  ctx.fillStyle = '#fff'; ctx.font = '600 22px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h - 20); ctx.textAlign = 'left';
}

export async function canvasToFile(canvas, name) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Uses the phone's share sheet (WhatsApp, Instagram…) when it can share files; otherwise downloads.
export async function shareFile(file, text) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  downloadBlob(file, file.name); return 'downloaded';
}

export const whatsappLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export const siteLink = (q) => `${window.location.origin}${window.location.pathname}?${q}`;
