/** #348 Pitch map helpers. x runs left to right across the pitch (0-100); y is the distance from the batter's stumps (0) to the bowler's stumps (100). */

export const ZONES = [
  { key: 'yorker', label: 'Yorker', from: 0, to: 8 },
  { key: 'full', label: 'Full', from: 8, to: 25 },
  { key: 'good', label: 'Good length', from: 25, to: 45 },
  { key: 'short_of_length', label: 'Short of a length', from: 45, to: 65 },
  { key: 'short', label: 'Short', from: 65, to: 100.0001 }
];

export function zoneOf(y) {
  const v = Number(y);
  return ZONES.find((z) => v >= z.from && v < z.to) || ZONES[ZONES.length - 1];
}

/** Turn a tap inside a drawn pitch (width w, height h; bowler's end at the top) into pitch coordinates. */
export function pointToPitch(px, py, w, h) {
  if (!(w > 0) || !(h > 0)) return null;
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  return { x: clamp((px / w) * 100), y: clamp(100 - (py / h) * 100) };
}

export function ballColour(b) {
  if (b.wicket) return '#dc2626';
  if (b.runs === 6) return '#7c3aed';
  if (b.runs === 4) return '#2563eb';
  if (b.runs === 0 && !b.extra) return '#64748b';
  return '#16a34a';
}

/** Balls, runs off the bat and wickets in each length zone. */
export function zoneSummary(balls) {
  const out = ZONES.map((z) => ({ ...z, balls: 0, runs: 0, wickets: 0 }));
  (balls || []).forEach((b) => {
    const row = out.find((z) => z.key === zoneOf(b.y).key);
    row.balls += 1; row.runs += b.runs || 0; if (b.wicket) row.wickets += 1;
  });
  return out;
}

export function coverageText(d) {
  if (!d) return '';
  if (!d.total) return 'No balls yet.';
  return `${d.marked} of ${d.total} balls have a pitch mark.`;
}
