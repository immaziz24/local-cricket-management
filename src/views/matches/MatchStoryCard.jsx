import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { STORY_LANGS, generateStory } from './matchStory.js';

/** #381 Match story in English, Bengali or Hindi, written from the scorecard with fixed sentence templates. */
const LANG_KEY = 'lcm.story.lang';
const readLang = () => { try { const v = window.localStorage.getItem(LANG_KEY); return STORY_LANGS.some((l) => l.code === v) ? v : 'en'; } catch { return 'en'; } };

export function MatchStoryCard({ centre, refreshKey }) {
  const matchId = centre?.match?.id;
  const [live, setLive] = useState(null);
  const [lang, setLang] = useState(readLang);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (matchId) dataService.fetchLiveState(matchId).then(setLive).catch(() => setLive(null)); }, [matchId, refreshKey]);
  const story = useMemo(() => (live ? generateStory(centre, live, lang) : null), [centre, live, lang]);
  const pick = (code) => { setLang(code); try { window.localStorage.setItem(LANG_KEY, code); } catch { /* optional */ } };
  const copy = async () => { try { await navigator.clipboard.writeText(story.text); setMsg('Copied. Paste it into WhatsApp, Facebook or a message.'); } catch { window.prompt('Copy this story:', story.text); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: story.title, text: story.text }); } catch { /* cancelled */ } } else copy(); };
  if (!story) return null;
  const font = lang === 'en' ? undefined : '"Noto Sans Bengali","Noto Sans Devanagari",system-ui,sans-serif';
  return (
    <Card title="Match story" subtitle="Written from the scorecard. Choose a language and share it.">
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        {STORY_LANGS.map((l) => <Button key={l.code} size="sm" variant={lang === l.code ? 'primary' : 'secondary'} onClick={() => pick(l.code)}>{l.label}</Button>)}
      </div>
      <div lang={lang} style={{ fontFamily: font, lineHeight: 1.65, fontSize: '0.95rem' }}>
        <h4 style={{ margin: '0 0 0.4rem' }}>{story.title}</h4>
        {story.paragraphs.map((p, i) => <p key={i} style={{ margin: '0 0 0.5rem' }}>{p}</p>)}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" onClick={copy}>Copy story</Button>
        <Button size="sm" variant="secondary" onClick={share}>Share</Button>
        {msg && <span style={{ fontSize: '0.8rem', color: '#059669' }}>{msg}</span>}
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>Team and player names are shown as they were typed. The story is made from fixed sentences, so every number comes from the scorecard.</p>
    </Card>
  );
}

export default MatchStoryCard;
