// Batch 14 helpers for video links, clip suggestions, rights and sponsor numbers (#373, #374, #375, #378, #379).
// Pure functions only (no React, no network) so they can be tested with plain node.

/** 3725 -> "1:02:05", 65 -> "1:05". */
export function fmtClock(total) {
  const s = Math.max(0, Math.round(Number(total) || 0));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const two = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** "1:02:05" | "2:05" | "95" -> seconds. Returns null when it cannot be read. */
export function parseClock(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d{1,5}$/.test(p.trim()))) return null;
  const nums = parts.map((p) => Number(p));
  if (parts.length > 1 && nums.slice(1).some((v) => v > 59)) return null;
  return nums.reduce((acc, v) => acc * 60 + v, 0);
}

/** Value for <input type="datetime-local"> from an ISO time (browser local time). */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** ISO time from a datetime-local value, or null. */
export function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The address of a YouTube embed that starts at a given second. */
export function withStart(embed, seconds) {
  if (!embed) return embed;
  const base = embed.replace(/([?&])(start|autoplay)=[^&]*/g, '$1').replace(/[?&]+$/, '').replace(/\?&/, '?').replace(/&&+/g, '&');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}start=${Math.max(0, Math.floor(seconds || 0))}&autoplay=1`;
}

/** A link a person can open to watch from a given second (YouTube only; null otherwise). */
export function timeLink(item, seconds) {
  if (!item?.url || item.source !== 'youtube') return null;
  const s = Math.max(0, Math.floor(seconds || 0));
  try {
    const u = new URL(item.url);
    u.searchParams.set('t', `${s}s`);
    return u.toString();
  } catch { return null; }
}

export const KIND_ICON = { wicket: '☝️', six: '🚀', four: '🏏', fifty: '⭐', hundred: '💯', haul: '🔥' };

/** How far a link sits from the end of the video's known length, used to hide impossible links. */
export function linkLabel(l) {
  const where = `${l.innings_no ? `Inns ${l.innings_no} · ` : ''}${l.over || ''}`.trim();
  return `${fmtClock(l.clip_start_s ?? l.offset_s)}${l.clip_end_s != null ? `–${fmtClock(l.clip_end_s)}` : ''} · ${where} · ${l.label}`;
}

export const POLICY_WHO = [
  ['participants', 'Everyone who is allowed to add media (default)'],
  ['organisers_officials', 'Organiser and match officials only'],
  ['organiser_only', 'Organiser only']
];
export const LICENCE = [
  ['own_work', 'I took it myself'],
  ['permission', 'I have the owner’s permission'],
  ['public_licence', 'It is free to reuse (public licence)']
];
export const PEOPLE = [
  ['none', 'Nobody can be recognised in it'],
  ['consented', 'People shown have agreed (parents agreed for children)'],
  ['unsure', 'I am not sure']
];

/** What the rights form may send. Returns an error text or null. */
export function rightsError(f) {
  if (!f || String(f.holder || '').trim().length < 2) return 'Say who owns the photo or video.';
  if (!LICENCE.some(([k]) => k === f.licence)) return 'Choose how you may use it.';
  if (!PEOPLE.some(([k]) => k === f.people)) return 'Say whether the people in it have agreed.';
  if (!f.confirmed) return 'Tick the box to confirm that what you say is true.';
  return null;
}

/** Click rate in percent with one decimal ("–" when nothing was shown). */
export function ctrText(impressions, clicks) {
  const i = Number(impressions || 0); const c = Number(clicks || 0);
  return i > 0 ? `${((c / i) * 100).toFixed(1)}%` : '–';
}

/** Points for a small bar chart: [{x,y,h,day,impressions}] scaled to width/height. */
export function seriesBars(series, width = 300, height = 60) {
  const list = Array.isArray(series) ? series : [];
  if (!list.length) return [];
  const max = Math.max(1, ...list.map((s) => Number(s.impressions || 0)));
  const w = width / list.length;
  return list.map((s, i) => {
    const h = Math.round((Number(s.impressions || 0) / max) * height);
    return { x: Math.round(i * w), y: height - h, h, w: Math.max(1, Math.floor(w) - 2), day: s.day, impressions: Number(s.impressions || 0), clicks: Number(s.clicks || 0) };
  });
}

export const SNAPSHOT_LABEL = { weekly: 'Weekly report', final: 'Final report', manual: 'Saved by you' };

/** Name used in a microsite address: lower-case letters, numbers, hyphens. */
export function slugify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Colours for the microsite hero: a brand colour makes a gradient; falls back to the theme. */
export function brandGradient(color, fallback) {
  if (!COLOR_RE.test(color || '')) return fallback;
  const n = parseInt(color.slice(1), 16);
  const dark = (v) => Math.max(0, Math.round(v * 0.72));
  const r = dark((n >> 16) & 255); const g = dark((n >> 8) & 255); const b = dark(n & 255);
  return [color, `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`];
}

/** #371 address of the see-through overlay page, with the look options. origin = page address without ?query. */
export function overlayUrl(origin, matchId, o = {}) {
  const q = new URLSearchParams({ overlay: matchId });
  if (o.style && o.style !== 'bar') q.set('style', o.style);
  if (o.pos === 'top') q.set('pos', 'top');
  if (o.scale && Number(o.scale) !== 1) q.set('scale', String(o.scale));
  if (o.accent && /^[0-9a-fA-F]{6}$/.test(o.accent) && o.accent.toLowerCase() !== '065f46') q.set('accent', o.accent.toLowerCase());
  return `${origin}?${q.toString()}`;
}
/** #371 address of the JSON data endpoint (empty when the project address is unknown). */
export function overlayJsonUrl(projectUrl, matchId) {
  const base = String(projectUrl || '').replace(/\/+$/, '');
  return base ? `${base}/functions/v1/overlay?match=${matchId}` : '';
}

/** #371 look options read from the address: &pos=top|bottom, &scale=0.6..2, &accent=rrggbb (no #). */
export function overlayOptions(search) {
  const q = new URLSearchParams(search || '');
  const scale = Number(q.get('scale'));
  const accent = q.get('accent') || '';
  return {
    pos: q.get('pos') === 'top' ? 'top' : 'bottom',
    scale: Number.isFinite(scale) && scale >= 0.6 && scale <= 2 ? scale : 1,
    accent: /^[0-9a-fA-F]{6}$/.test(accent) ? `#${accent}` : '#065f46'
  };
}

