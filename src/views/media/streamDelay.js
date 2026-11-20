/**
 * #372 Stream synchronization delay.
 * Live video reaches viewers some seconds after it happens. The overlay keeps a short history of the score and shows
 * the version that is `delay` seconds old, so the score appears when the picture does.
 */
export const MAX_DELAY_S = 180;

/** A whole number of seconds from 0 to 180; anything else becomes 0. */
export function clampDelay(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_DELAY_S);
}

/** &delay=25 in the overlay address; null when it is absent or not a number (then the match's saved delay is used). */
export function delayFromSearch(search) {
  const raw = new URLSearchParams(search || '').get('delay');
  if (raw === null || raw === '' || !Number.isFinite(Number(raw))) return null;
  return clampDelay(raw);
}

/** Add a snapshot taken at time `t` (ms). Old ones are dropped, keeping one older than the window so there is always something to show. */
export function pushSnapshot(buf, t, state, maxDelayMs = MAX_DELAY_S * 1000) {
  const next = [...(buf || []), { t, state }];
  const cutoff = t - maxDelayMs - 15000;
  let first = 0;
  while (first + 1 < next.length && next[first + 1].t <= cutoff) first += 1;
  return next.slice(first);
}

/** The newest snapshot that is at least `delaySec` old at time `now`; null while the delay has not passed yet. */
export function pickSnapshot(buf, now, delaySec) {
  const limit = now - clampDelay(delaySec) * 1000;
  let best = null;
  for (const s of buf || []) { if (s.t <= limit) best = s; else break; }
  return best ? best.state : null;
}

/** Seconds until the first picture can be shown (0 when no wait). */
export function waitSeconds(buf, now, delaySec) {
  const d = clampDelay(delaySec) * 1000;
  if (!d || !buf || !buf.length) return clampDelay(delaySec);
  const oldest = buf[0].t;
  return Math.max(0, Math.ceil((oldest + d - now) / 1000));
}

export function delayLabel(sec) {
  const n = clampDelay(sec);
  return n === 0 ? 'No delay (score shows at once)' : `Score shown ${n} second${n === 1 ? '' : 's'} late`;
}
