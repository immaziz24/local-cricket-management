import React, { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.js';
import { achievementLink, achievementShareText, badgeFromSearch, orderBadges } from './achievements.js';

/** #395 Achievement cards on the player profile. Each card has its own link and a Share button. */
export function AchievementCards({ playerId }) {
  const [data, setData] = useState(null);
  const [note, setNote] = useState('');
  const highlight = typeof window !== 'undefined' ? badgeFromSearch(window.location.search) : null;
  useEffect(() => { setData(null); dataService.getPlayerAchievements(playerId).then(setData).catch(() => setData({ badges: [] })); }, [playerId]);
  if (!data || !data.badges || data.badges.length === 0) return null;
  const share = async (b) => {
    const url = achievementLink(window.location.origin, playerId, b.key);
    const text = achievementShareText(data.name, b);
    try {
      if (navigator.share) { await navigator.share({ title: 'Cricnotch', text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`); setNote('Link copied.');
    } catch { setNote(url); }
  };
  return (
    <section className="info-box" aria-label="Achievements">
      <h2>Achievements</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        {orderBadges(data.badges, highlight).map((b) => (
          <div key={b.key} id={`badge-${b.key}`} style={{ border: b.key === highlight ? '2px solid #16a34a' : '1px solid #cbd5e1', borderRadius: 10, padding: '0.6rem 0.8rem', minWidth: 150, background: b.key === highlight ? '#f0fdf4' : '#fff' }}>
            <strong>{b.title}</strong><div style={{ color: '#64748b', fontSize: '0.85rem' }}>{b.detail}</div>
            <button type="button" className="home-link" onClick={() => share(b)}>Share</button>
          </div>
        ))}
      </div>
      {note && <p role="status" style={{ overflowWrap: 'anywhere' }}>{note}</p>}
    </section>
  );
}
