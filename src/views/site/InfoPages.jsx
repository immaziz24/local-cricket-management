import React, { useState } from 'react';
import { ChevronDown, Mail, Phone, MapPin, MessageCircle, CheckCircle2 } from 'lucide-react';
import { dataService } from '../../services/dataService.js';
import { SITE } from '../../config/site.js';

/** Footer pages: About, Contact, Privacy, Terms, Community Guidelines, Refund Policy, FAQ. */
const Updated = () => <p className="info-sub">Last updated: {SITE.legalUpdated}</p>;
const contactLine = SITE.email ? <a href={`mailto:${SITE.email}`} style={{ color: '#047857', fontWeight: 700 }}>{SITE.email}</a> : 'the Contact us page';

export function AboutView({ onNavigate }) {
  return (
    <div className="info-page">
      <h1>About {SITE.name}</h1>
      <p className="info-sub">{SITE.tagline}.</p>
      <div className="info-box">
        <p>{SITE.name} is a free website for grassroots cricket – gully, village, school, club and corporate cricket. Anyone can register, create a team, organise a tournament and score matches ball by ball from a phone, while friends and family follow live.</p>
        <h2>What you can do</h2>
        <ul>
          <li>Score matches live with full scorecards, commentary and automatic player statistics.</li>
          <li>Run tournaments with team registration, fixtures, points tables, net run rate and knockouts.</li>
          <li>Build a player profile that keeps every run, wicket and award.</li>
          <li>Find and book grounds, hire umpires and scorers, and connect with the local cricket community.</li>
          <li>Share result cards, posters and highlights on WhatsApp and Instagram.</li>
        </ul>
        <h2>Our rules for fairness</h2>
        <p>The platform is open: every registered member can create and score. People control only what they created, and roles like organiser, team owner, captain, scorer and umpire are earned per tournament, team or match. Only administrators are appointed by hand.</p>
        <p style={{ marginTop: '1.2rem' }}><button type="button" className="hdr-btn-primary" onClick={() => onNavigate && onNavigate('register')}>Join free</button></p>
      </div>
    </div>
  );
}

const TOPICS = [['general', 'General question'], ['support', 'Help with my account or scoring'], ['organiser', 'Organising a tournament'], ['ground', 'Listing a ground or academy'], ['sponsor', 'Sponsorship / advertising'], ['report', 'Report a problem or abuse'], ['privacy', 'Privacy or data request']];
const inp = { padding: '0.65rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.6rem', fontSize: '0.92rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

export function ContactView({ currentUser }) {
  const [f, setF] = useState({ name: currentUser?.full_name || '', contact: currentUser?.email || currentUser?.mobile_number || '', topic: 'general', message: '', website: '' });
  const [state, setState] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    if (f.website) { setState({ ok: true }); return; } // spam trap
    setState({ busy: true });
    try { await dataService.sendContactMessage({ name: f.name, contact: f.contact, topic: f.topic, message: f.message }); setState({ ok: true }); }
    catch (err) { setState({ error: err.message }); }
  };
  return (
    <div className="info-page" style={{ maxWidth: 1000 }}>
      <h1>Contact us</h1>
      <p className="info-sub">Questions, feedback, partnerships or problems – we read every message.</p>
      <div style={{ display: 'grid', gap: '1.2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <div className="info-box">
          {state?.ok ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
              <CheckCircle2 size={44} color="#059669" />
              <h2 style={{ marginTop: '0.6rem' }}>Message sent</h2>
              <p>Thank you! We usually reply within two working days to the email or phone number you gave.</p>
            </div>
          ) : (
            <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Your name<input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={{ ...inp, marginTop: 4 }} /></label>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Email or phone (so we can reply)<input required minLength={5} maxLength={120} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} style={{ ...inp, marginTop: 4 }} /></label>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Topic<select value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} style={{ ...inp, marginTop: 4, backgroundColor: '#fff' }}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Message<textarea required minLength={10} maxLength={2000} rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} style={{ ...inp, marginTop: 4, resize: 'vertical' }} /></label>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
              {state?.error && <div style={{ color: '#b91c1c', fontSize: '0.86rem' }}>{state.error}</div>}
              <button type="submit" className="hdr-btn-primary" disabled={state?.busy} style={{ alignSelf: 'flex-start' }}>{state?.busy ? 'Sending…' : 'Send message'}</button>
            </form>
          )}
        </div>
        <div className="info-box">
          <h2 style={{ marginTop: 0 }}>Other ways to reach us</h2>
          {SITE.email || SITE.phone || SITE.whatsapp || SITE.address ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.95rem' }}>
              {SITE.email && <a href={`mailto:${SITE.email}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Mail size={18} color="#059669" /> {SITE.email}</a>}
              {SITE.phone && <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Phone size={18} color="#059669" /> {SITE.phone}</a>}
              {SITE.whatsapp && <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MessageCircle size={18} color="#059669" /> WhatsApp us</a>}
              {SITE.address && <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MapPin size={18} color="#059669" /> {SITE.address}</span>}
            </div>
          ) : <p>Use the form – it reaches our team directly. Phone and email details will be added here soon.</p>}
          <h2>Before you write</h2>
          <ul>
            <li>Forgot your password? Use <strong>Forgot password</strong> on the login page.</li>
            <li>Scoring mistake? The match scorer can undo balls from the match page.</li>
            <li>Problem with a member? Use <strong>Report a member</strong> in Settings.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function PrivacyView() {
  return (
    <div className="info-page">
      <h1>Privacy Policy</h1>
      <Updated />
      <div className="info-box">
        <p>This policy explains what personal data {SITE.name} ("we") collects, why, and the choices you have. It is written to follow India's Digital Personal Data Protection Act, 2023.</p>
        <h2>1. What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your name, mobile number, email address and password (stored only in encrypted form).</li>
          <li><strong>Cricket data:</strong> teams, matches, ball-by-ball scores, statistics, awards and anything you enter while organising or scoring.</li>
          <li><strong>Things you upload:</strong> photos, logos, videos, listings, posts and messages.</li>
          <li><strong>Location – only when you ask:</strong> when you tap <em>Near me</em> in search, your browser asks permission and shares your approximate position. It is used for that search only and is not saved to your account. To show a city name we send the position to a reverse-lookup service (BigDataCloud).</li>
          <li><strong>Technical data:</strong> sign-in session information kept in your browser so you stay logged in.</li>
        </ul>
        <h2>2. Why we use it</h2>
        <ul>
          <li>To run your account, teams, tournaments and live scoring.</li>
          <li>To show public cricket information such as scorecards, leaderboards and player profiles.</li>
          <li>To send in-app notifications you can control in Settings.</li>
          <li>To keep the platform safe – preventing abuse, investigating reports and keeping audit records.</li>
        </ul>
        <h2>3. What is public</h2>
        <p>Scorecards, match results, team names and player statistics are public, because that is what cricket fans come for. Your mobile number and email are <strong>private by default</strong>. In <em>Settings &amp; Privacy</em> you can choose who sees your profile, phone and email, or make your profile private.</p>
        <h2>4. Sharing</h2>
        <p>We do not sell your data. We use trusted service providers to run the website – Supabase (database, login and file storage, which may store data outside India) and Hostinger (website hosting). They process data only on our instructions.</p>
        <h2>5. Your rights</h2>
        <ul>
          <li>See and download your data – <em>Settings &amp; Privacy → Download my data</em>.</li>
          <li>Correct your details at any time in your account.</li>
          <li>Ask us to delete your account and personal data, or withdraw consent, through the Contact us page. Match scores already played may stay in anonymous form so other players' records stay correct.</li>
          <li>Raise a grievance with us; if not resolved, you may approach the Data Protection Board of India.</li>
        </ul>
        <h2>6. Security and retention</h2>
        <p>Data is protected with encrypted connections, row-level access rules and audit logs. We keep data while your account is active and delete or anonymise it after a deletion request, except where the law requires us to keep it.</p>
        <h2>7. Children</h2>
        <p>Players under 18 should use the platform with a parent or guardian's consent, and their contact details are never shown publicly.</p>
        <h2>8. Contact</h2>
        <p>For privacy questions or requests, write to {contactLine} and choose “Privacy or data request”.</p>
      </div>
    </div>
  );
}

export function TermsView() {
  return (
    <div className="info-page">
      <h1>Terms of Use</h1>
      <Updated />
      <div className="info-box">
        <p>By creating an account or using {SITE.name} you agree to these terms.</p>
        <h2>1. Your account</h2>
        <p>Give your real name and your own mobile number, keep your password safe, and tell us if your account is misused. One person, one account.</p>
        <h2>2. What you create</h2>
        <p>You own the content you add (scores, photos, posts). You give {SITE.name} permission to show it on the website and in share cards so the platform can work. Only upload photos and videos you have the right to share, and do not upload other people's private information.</p>
        <h2>3. Fair play</h2>
        <ul>
          <li>Score honestly. Deliberately false scores, fake matches or fake statistics may be removed and accounts suspended.</li>
          <li>Organisers set and publish tournament rules, entry fees and prizes; {SITE.name} is not the organiser of user tournaments.</li>
          <li>Late-arrival and other penalties are local tournament rules agreed by organisers, not official ICC sanctions.</li>
        </ul>
        <h2>4. Money between users</h2>
        <p>Entry fees, ground bookings, official fees and marketplace sales are agreed and paid directly between users. {SITE.name} does not currently collect these payments and is not responsible for them – see the Refund Policy.</p>
        <h2>5. Not allowed</h2>
        <p>Abuse, harassment, hate, betting or match-fixing promotion, spam, impersonation, and attempts to break or overload the website. See the Community Guidelines.</p>
        <h2>6. Suspension</h2>
        <p>We may hide content or suspend accounts that break these terms. You can contact us if you think a decision is wrong.</p>
        <h2>7. The service</h2>
        <p>The website is provided "as is". We work to keep it running and accurate but cannot promise it will always be available or error-free, and we are not liable for losses from its use to the extent the law allows. Features may change; some features may become paid in future with clear notice.</p>
        <h2>8. Law</h2>
        <p>These terms are governed by the laws of India. Questions: {contactLine}.</p>
      </div>
    </div>
  );
}

export function GuidelinesView() {
  return (
    <div className="info-page">
      <h1>Community Guidelines</h1>
      <Updated />
      <div className="info-box">
        <p>{SITE.name} is for everyone who loves cricket. Keep it friendly, fair and safe.</p>
        <h2>Do</h2>
        <ul><li>Respect players, umpires, scorers and organisers – on the field and online.</li><li>Score accurately and fix mistakes quickly.</li><li>Use real names and real photos of yourself or your team.</li><li>Report problems with <em>Report a member</em> instead of arguing in public.</li></ul>
        <h2>Don't</h2>
        <ul><li>Abuse, threaten, bully or discriminate against anyone.</li><li>Promote betting, gambling or match-fixing.</li><li>Post other people's phone numbers, addresses or private photos.</li><li>Post fake listings, spam or misleading offers in the marketplace.</li><li>Upload copyrighted videos or music you don't have rights to.</li></ul>
        <h2>What happens if rules are broken</h2>
        <p>Content can be hidden by the organiser, the person who posted it, or an administrator. Repeated or serious problems can lead to suspension.</p>
      </div>
    </div>
  );
}

export function RefundView() {
  return (
    <div className="info-page">
      <h1>Refund Policy</h1>
      <Updated />
      <div className="info-box">
        <p>Using {SITE.name} is currently <strong>free</strong>. We do not charge members and we do not collect money on behalf of anyone.</p>
        <h2>Payments between users</h2>
        <p>Tournament entry fees, ground bookings, umpire or scorer fees and marketplace sales are paid directly to the organiser, ground owner, official or seller. Refunds for those payments are decided by them under the rules they published. Please agree the refund terms before you pay.</p>
        <h2>Future paid services</h2>
        <p>If {SITE.name} introduces paid plans or online payments, this page will be updated with the refund terms before any payment is taken.</p>
        <h2>Problems</h2>
        <p>If someone refuses a refund they promised, contact us through {contactLine} with the details – we can review the tournament or listing and act under our Terms.</p>
      </div>
    </div>
  );
}

const FAQ = [
  ['Is it really free?', 'Yes. Registering, creating teams and tournaments, and live scoring are free.'],
  ['Do players need an account to be added to a team?', 'No. Team owners add players by name and mobile number. When that player registers later with the same number, the profile and all statistics become theirs.'],
  ['Who can score a match?', 'The person who created the match, the tournament organiser, or a scorer who accepted the match invitation.'],
  ['Can I score without internet?', 'Yes – balls are kept on your phone and uploaded when the connection comes back. Some actions such as ending an innings need internet.'],
  ['How does "Near me" work?', 'Tap Near me in the search bar and allow location. You will see grounds, academies, matches and tournaments within 30 km. Your location is used for that search only and is not stored.'],
  ['How do I make my profile private?', 'Open Settings & Privacy and choose who can see your profile, phone and email.'],
  ['I made a scoring mistake. What now?', 'Open the match and use Undo on the scoring screen. The ball-by-ball history keeps a record of every change.'],
  ['How do I book a ground?', 'Open Grounds, choose a ground, pick a free slot and send a request. The ground owner confirms it.'],
  ['Is there an Android app?', 'It is coming soon. Meanwhile the website works on any phone browser.']
];

export function FaqView({ onNavigate }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="info-page">
      <h1>Frequently asked questions</h1>
      <p className="info-sub">Can't find your answer? <button type="button" className="home-link" onClick={() => onNavigate && onNavigate('contact')}>Contact us</button></p>
      <div className="info-box" style={{ padding: '0.4rem 1.4rem' }}>
        {FAQ.map(([q, a], i) => (
          <div key={q} className="faq-item" style={{ borderBottom: i === FAQ.length - 1 ? 'none' : undefined }}>
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{q}<ChevronDown size={18} style={{ flexShrink: 0, transition: 'transform .15s', transform: open === i ? 'rotate(180deg)' : 'none' }} /></button>
            {open === i && <p style={{ marginTop: 0, paddingBottom: '0.9rem' }}>{a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
