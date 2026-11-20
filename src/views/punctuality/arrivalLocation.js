/** #397 Geotagged arrival check-in with consent. */

export const GEO_STATUS = {
  at_ground: { label: 'At the ground', color: '#15803d' },
  away: { label: 'Away from the ground', color: '#b45309' },
  no_ground_location: { label: 'Ground location not set', color: '#64748b' }
};

export const CONSENT_TEXT = 'I agree to share my phone\'s location once, for this check-in only. It is shown only to the match officials, the organiser and the team owners, and I can remove it afterwards.';

export function geoLine(g) {
  if (!g || !g.status) return '';
  const s = GEO_STATUS[g.status];
  if (g.status === 'no_ground_location') return `${s.label}; the check-in time was still recorded.`;
  const d = g.distance_m == null ? '' : g.distance_m >= 1000 ? `${(g.distance_m / 1000).toFixed(1)} km from the ground` : `${g.distance_m} m from the ground`;
  return `${s.label} (${d}${g.accuracy_m ? `, GPS accuracy about ${g.accuracy_m} m` : ''})`;
}

export function geoPayload(pos) {
  const c = pos && pos.coords;
  if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return null;
  return { consent: true, lat: c.latitude, lng: c.longitude, accuracy: Math.round(c.accuracy || 0) };
}

export function geoErrorText(code) {
  return code === 1 ? 'Location permission was refused, so nothing was recorded. You can still check in without it.'
    : code === 3 ? 'Finding your location took too long. Try again outdoors, or check in without it.'
    : 'Your location could not be found. You can still check in without it.';
}
