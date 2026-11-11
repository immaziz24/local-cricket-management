import React from 'react';
import { Mail, Phone, MapPin, MessageCircle, Instagram, Facebook, Youtube, Smartphone, ArrowUp } from 'lucide-react';
import { Logo } from './SiteHeader.jsx';
import { SITE } from '../../config/site.js';

/** Site footer – shown on every page for visitors and members. Empty contact details are simply hidden. */
const COLS = [
  ['Explore', [['matches', 'Live & recent matches'], ['tournaments', 'Tournaments'], ['stats', 'Players & leaderboards'], ['community', 'Community & marketplace'], ['media', 'Live & Media'], ['news', 'Cricket news']]],
  ['For organisers', [['create-tournament', 'Create a tournament'], ['teams', 'Register a team'], ['grounds', 'Find or list a ground'], ['officials', 'Become an umpire or scorer'], ['sponsors', 'Find or become a sponsor'], ['penalties', 'Late-arrival rules']]],
  ['Help', [['about', 'About us'], ['contact', 'Contact us'], ['faq', 'FAQ'], ['learn', 'Learn cricket & quizzes'], ['laws', 'Laws & Rules'], ['tools', 'Cricket tools'], ['verify', 'Check a certificate']]],
  ['Legal', [['privacy', 'Privacy Policy'], ['terms', 'Terms of Use'], ['guidelines', 'Community Guidelines'], ['refunds', 'Refund Policy']]]
];

export function SiteFooter({ onNavigate }) {
  const go = (t) => { onNavigate && onNavigate(t); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const s = SITE.social || {};
  const socials = [
    [s.whatsapp_channel || (SITE.whatsapp ? `https://wa.me/${SITE.whatsapp}` : ''), 'WhatsApp', MessageCircle],
    [s.instagram, 'Instagram', Instagram], [s.facebook, 'Facebook', Facebook], [s.youtube, 'YouTube', Youtube]
  ].filter(([u]) => u);
  return (
    <footer className="site-footer">
      <div className="site-footer-cta">
        <div>
          <div className="sf-cta-title">Run your next tournament on {SITE.name}</div>
          <div className="sf-cta-sub">Free fixtures, live ball-by-ball scoring, points tables and player stats – from your phone.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="hdr-btn-primary" onClick={() => go('create-tournament')}>Create a tournament</button>
          <button type="button" className="sf-btn-light" onClick={() => go('matches')}>Watch live scores</button>
        </div>
      </div>

      <div className="site-footer-main">
        <div className="sf-brand">
          <Logo dark onClick={() => go('dashboard')} />
          <p>{SITE.tagline}. Built for gully, village, club and corporate cricket – free for players and organisers.</p>
          <div className="sf-contact">
            {SITE.email && <a href={`mailto:${SITE.email}`}><Mail size={15} /> {SITE.email}</a>}
            {SITE.phone && <a href={`tel:${SITE.phone.replace(/\s/g, '')}`}><Phone size={15} /> {SITE.phone}</a>}
            {SITE.address && <span><MapPin size={15} /> {SITE.address}</span>}
            {!SITE.email && !SITE.phone && <button type="button" onClick={() => go('contact')}><Mail size={15} /> Send us a message</button>}
          </div>
          {socials.length > 0 && (
            <div className="sf-social">
              {socials.map(([u, label, Icon]) => <a key={label} href={u} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}><Icon size={17} /></a>)}
            </div>
          )}
          <div className="sf-app"><Smartphone size={16} /> <span><strong>Android app</strong> – coming soon</span></div>
        </div>
        {COLS.map(([title, links]) => (
          <div key={title} className="sf-col">
            <div className="sf-col-title">{title}</div>
            {links.map(([id, label]) => <button key={id} type="button" onClick={() => go(id)}>{label}</button>)}
          </div>
        ))}
      </div>

      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</span>
        <span className="sf-bottom-links">
          <button type="button" onClick={() => go('privacy')}>Privacy</button>
          <button type="button" onClick={() => go('terms')}>Terms</button>
          <button type="button" onClick={() => go('contact')}>Contact</button>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"><ArrowUp size={14} /> Top</button>
        </span>
      </div>
    </footer>
  );
}

export default SiteFooter;
