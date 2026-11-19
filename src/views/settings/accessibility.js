// #396 Accessibility and low-bandwidth mode. Choices are kept on this device and applied to the whole page.
export const ACCESS_KEY = 'lcm-access';
export const DEFAULT_ACCESS = { large_text: false, high_contrast: false, reduce_motion: false, low_data: false };

export function readAccess(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const raw = storage && storage.getItem(ACCESS_KEY);
    if (!raw) return { ...DEFAULT_ACCESS, chosen: false };
    const o = JSON.parse(raw);
    return { ...DEFAULT_ACCESS, ...Object.fromEntries(Object.keys(DEFAULT_ACCESS).map((k) => [k, !!o[k]])), chosen: true };
  } catch { return { ...DEFAULT_ACCESS, chosen: false }; }
}

export function saveAccess(a, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage && storage.setItem(ACCESS_KEY, JSON.stringify(Object.fromEntries(Object.keys(DEFAULT_ACCESS).map((k) => [k, !!a[k]])))); } catch { /* storage full or blocked */ }
}

/** The phone or browser asked to save data (Data Saver), or the connection is very slow. */
export function connectionIsSlow(conn = (typeof navigator !== 'undefined' ? navigator.connection : null)) {
  if (!conn) return false;
  return !!conn.saveData || /(^|-)2g$/.test(String(conn.effectiveType || ''));
}

/** What the page should carry on the <html> element for these choices. */
export function accessAttributes(a) {
  return { 'data-large-text': a.large_text ? '1' : null, 'data-contrast': a.high_contrast ? '1' : null, 'data-reduce-motion': a.reduce_motion ? '1' : null, 'data-low-data': a.low_data ? '1' : null };
}

export function describeAccess(a) {
  const on = [a.large_text && 'larger text', a.high_contrast && 'high contrast', a.reduce_motion && 'less movement', a.low_data && 'low data'].filter(Boolean);
  return on.length ? `On: ${on.join(', ')}.` : 'Everything is at the normal setting.';
}

const swapped = new WeakSet();
function holdPicture(img) {
  if (swapped.has(img) || img.hasAttribute('data-keep') || !img.getAttribute('src') || img.src.startsWith('data:')) return;
  swapped.add(img);
  img.setAttribute('data-lowdata-src', img.getAttribute('src'));
  img.removeAttribute('srcset');
  img.removeAttribute('src');
  img.setAttribute('data-lowdata', '1');
  img.title = img.title || 'Tap to load this picture';
  img.addEventListener('click', () => { const s = img.getAttribute('data-lowdata-src'); if (s) { img.src = s; img.removeAttribute('data-lowdata'); } }, { once: true });
}
function holdFrame(el) {
  if (swapped.has(el) || el.hasAttribute('data-keep')) return;
  if (el.tagName === 'VIDEO') { el.removeAttribute('autoplay'); el.setAttribute('preload', 'none'); swapped.add(el); return; }
  if (el.tagName === 'IFRAME' && el.getAttribute('src')) {
    swapped.add(el); el.setAttribute('data-lowdata-src', el.getAttribute('src')); el.removeAttribute('src'); el.setAttribute('data-lowdata', '1');
  }
}
function sweep(root) {
  root.querySelectorAll && root.querySelectorAll('img').forEach(holdPicture);
  root.querySelectorAll && root.querySelectorAll('video, iframe').forEach(holdFrame);
}
let observer = null;

/** Applies the choices to the page. Low data stops pictures, videos and embeds from downloading until tapped. */
export function applyAccess(a, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return;
  const html = doc.documentElement;
  const attrs = accessAttributes(a);
  Object.entries(attrs).forEach(([k, v]) => (v === null ? html.removeAttribute(k) : html.setAttribute(k, v)));
  if (a.low_data && typeof MutationObserver !== 'undefined') {
    sweep(doc.body || html);
    if (!observer) {
      observer = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'IMG') holdPicture(n); else if (n.tagName === 'VIDEO' || n.tagName === 'IFRAME') holdFrame(n); else sweep(n);
      })));
      observer.observe(doc.body || html, { childList: true, subtree: true });
    }
  } else if (observer) {
    observer.disconnect(); observer = null;
    doc.querySelectorAll('[data-lowdata-src]').forEach((el) => { el.setAttribute('src', el.getAttribute('data-lowdata-src')); el.removeAttribute('data-lowdata'); el.removeAttribute('data-lowdata-src'); });
  }
}

/** Called once when the app starts: applies what was saved, or suggests low data on a slow connection (never forces it). */
export function startAccess() {
  const a = readAccess();
  applyAccess(a);
  return a;
}
