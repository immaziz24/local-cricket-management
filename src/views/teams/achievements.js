// #395 Player achievement cards with their own link. The link opens the player's profile and highlights one card.
export function achievementLink(origin, playerId, badgeKey) {
  const q = new URLSearchParams({ page: 'player-profile', id: playerId });
  if (badgeKey) q.set('badge', badgeKey);
  return `${String(origin).replace(/\/$/, '')}/?${q.toString()}`;
}

export function badgeFromSearch(search) {
  const b = new URLSearchParams(search || '').get('badge');
  return b && /^[a-z0-9_]{2,40}$/.test(b) ? b : null;
}

/** Text a player can post with the link. */
export function achievementShareText(name, badge) {
  return `${name} – ${badge.title} (${badge.detail}) on Cricnotch`;
}

/** Puts the highlighted card first so the shared link opens on it. */
export function orderBadges(badges, highlight) {
  const list = [...(badges || [])];
  if (!highlight) return list;
  return list.sort((a, b) => (b.key === highlight) - (a.key === highlight));
}
