/**
 * #381 Multilingual local match story generation.
 * Writes a short match report from the scorecard in English, Bengali (বাংলা) or Hindi (हिन्दी).
 * It uses fixed sentence templates, not an AI model: every number and name comes straight from the scorecard,
 * so the story can never invent facts. Team and player names stay exactly as they were typed.
 */
export const STORY_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'hi', label: 'हिन्दी' }
];

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर']
};
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** A number written in the digits of the chosen language (Bengali uses its own digits; English and Hindi use 0-9). */
export function num(x, lang) {
  const s = String(x ?? 0);
  return lang === 'bn' ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s;
}
/** Balls to overs text: 62 balls -> "10.2". */
export function oversText(balls) { const b = Math.max(0, Number(balls) || 0); return `${Math.floor(b / 6)}.${b % 6}`; }

/** "16 November 2026" in the chosen language, using Indian time. */
export function dateText(iso, lang) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + 5.5 * 3600 * 1000);
  const day = num(d.getUTCDate(), lang); const month = MONTHS[lang][d.getUTCMonth()]; const year = num(d.getUTCFullYear(), lang);
  return `${day} ${month} ${year}`;
}

/** Read the result line the scorer saved: who won and by how much. Falls back to the saved text when it cannot be understood. */
export function parseResult(m) {
  const s = String(m?.result_summary || '');
  const by = s.match(/won by (\d+) (run|wicket)/i);
  if (by) return { kind: by[2].toLowerCase() === 'run' ? 'runs' : 'wickets', n: Number(by[1]), winnerId: m.winner_team_id || null, raw: s };
  if (/\btie[d]?\b/i.test(s) || m?.result_type === 'tie') return { kind: 'tie', raw: s };
  if (/no result|abandon/i.test(s) || m?.result_type === 'no_result') return { kind: 'no_result', raw: s };
  if (/\bdraw/i.test(s) || m?.result_type === 'draw') return { kind: 'draw', raw: s };
  if (m?.winner_team_id) return { kind: 'won', winnerId: m.winner_team_id, raw: s };
  return { kind: s ? 'text' : 'none', raw: s };
}

/** Pull every fact the story uses out of the match centre and the live scorecard. */
export function storyFacts(centre, live) {
  const m = centre?.match || {};
  const teamName = (id) => [centre?.team_a, centre?.team_b].find((t) => t?.id === id)?.name || '';
  const nameOfPlayer = new Map();
  const innings = (live?.innings || []).map((i) => {
    (i.batting || []).forEach((b) => nameOfPlayer.set(b.player_id, b.name));
    (i.bowling || []).forEach((b) => nameOfPlayer.set(b.player_id, b.name));
    const topBat = [...(i.batting || [])].filter((b) => b.balls > 0 || b.runs > 0).sort((a, b) => (b.runs - a.runs) || (a.balls - b.balls))[0] || null;
    const topBowl = [...(i.bowling || [])].filter((b) => b.wickets > 0).sort((a, b) => (b.wickets - a.wickets) || (a.runs - b.runs))[0] || null;
    const per = m.players_per_side || 11;
    return {
      no: i.innings_no, superOver: !!i.is_super_over, team: i.batting_team?.name || teamName(i.batting_team?.id), runs: i.runs ?? 0, wickets: i.wickets ?? 0, balls: i.legal_balls ?? 0,
      allOut: (i.wickets ?? 0) >= Math.max(1, per - 1), target: i.target || null,
      topBat: topBat ? { name: topBat.name, runs: topBat.runs, balls: topBat.balls, out: !!topBat.out } : null,
      topBowl: topBowl ? { name: topBowl.name, wickets: topBowl.wickets, runs: topBowl.runs } : null
    };
  });
  const cur = live?.current || null;
  return {
    status: m.status || live?.status || 'scheduled',
    teamA: centre?.team_a?.name || '', teamB: centre?.team_b?.name || '',
    venue: centre?.ground_name || m.venue || '', when: m.scheduled_at || m.started_at || null,
    overs: m.overs_per_innings || live?.overs_limit || null,
    tossWinner: teamName(m.toss_winner_id), tossDecision: m.toss_decision === 'bat' || m.toss_decision === 'bowl' ? m.toss_decision : null,
    innings, result: parseResult(m), winner: teamName(m.winner_team_id),
    pom: m.player_of_match_id ? (nameOfPlayer.get(m.player_of_match_id) || null) : null,
    chase: cur && cur.target ? { need: cur.runs_needed ?? Math.max(0, cur.target - (cur.runs || 0)), balls: cur.balls_left ?? null } : null
  };
}

// ---- sentence templates ----
const T = {
  en: {
    title: (a, b) => `${a} v ${b}`,
    meet: (a, b, venue, date, overs) => `${a} and ${b} ${date || venue ? 'met' : 'meet'}${venue ? ` at ${venue}` : ''}${date ? ` on ${date}` : ''}${overs ? ` in a ${overs}-over match` : ''}.`,
    upcoming: (a, b, venue, date) => `${a} will play ${b}${venue ? ` at ${venue}` : ''}${date ? ` on ${date}` : ''}.`,
    toss: (w, d) => `${w} won the toss and chose to ${d === 'bat' ? 'bat' : 'bowl'} first.`,
    innings: (i, n, ov) => i.allOut ? `${i.team} were all out for ${n(i.runs)} in ${ov} overs.` : `${i.team} scored ${n(i.runs)} for ${n(i.wickets)} in ${ov} overs.`,
    superOver: (i, n) => `In the Super Over, ${i.team} made ${n(i.runs)} for ${n(i.wickets)}.`,
    topBat: (b, n) => `${b.name} was the top scorer with ${n(b.runs)} off ${n(b.balls)} balls${b.out ? '' : ' (not out)'}.`,
    topBowl: (b, n) => `${b.name} took ${n(b.wickets)} wicket${b.wickets === 1 ? '' : 's'} for ${n(b.runs)} runs.`,
    chase: (c, i, n) => `${i.team} need ${n(c.need)} more runs${c.balls != null ? ` from ${n(c.balls)} balls` : ''}.`,
    liveNow: (i, n, ov) => `${i.team} are ${n(i.runs)} for ${n(i.wickets)} after ${ov} overs.`,
    won: (w, r, n) => r.kind === 'runs' ? `${w} won by ${n(r.n)} run${r.n === 1 ? '' : 's'}.` : r.kind === 'wickets' ? `${w} won by ${n(r.n)} wicket${r.n === 1 ? '' : 's'}.` : `${w} won the match.`,
    tie: () => 'The match ended in a tie.', noResult: () => 'The match ended without a result.', draw: () => 'The match was drawn.',
    pom: (p) => `${p} was named Player of the Match.`
  },
  bn: {
    title: (a, b) => `${a} বনাম ${b}`,
    meet: (a, b, venue, date, overs) => `${venue ? `${venue}-এ ` : ''}${date ? `${date} ` : ''}${a} ও ${b} মুখোমুখি হয়${overs ? ` (${overs} ওভারের ম্যাচ)` : ''}।`,
    upcoming: (a, b, venue, date) => `${a} ও ${b} এর ম্যাচ${date ? ` ${date} তারিখে` : ''}${venue ? ` ${venue}-এ` : ''} অনুষ্ঠিত হবে।`,
    toss: (w, d) => `টস জিতে ${w} প্রথমে ${d === 'bat' ? 'ব্যাটিং' : 'বোলিং'} বেছে নেয়।`,
    innings: (i, n, ov) => i.allOut ? `${i.team} ${ov} ওভারে ${n(i.runs)} রানে অলআউট হয়।` : `${i.team} ${ov} ওভারে ${n(i.runs)} রান তোলে, হারায় ${n(i.wickets)} উইকেট।`,
    superOver: (i, n) => `সুপার ওভারে ${i.team} ${n(i.runs)} রান করে, উইকেট হারায় ${n(i.wickets)}টি।`,
    topBat: (b, n) => `ব্যাটিংয়ে সর্বোচ্চ ${n(b.runs)} রান করেন ${b.name} (${n(b.balls)} বলে${b.out ? '' : ', অপরাজিত'})।`,
    topBowl: (b, n) => `বোলিংয়ে ${b.name} ${n(b.runs)} রান দিয়ে ${n(b.wickets)} উইকেট নেন।`,
    chase: (c, i, n) => `${i.team} এর জিততে আরও ${n(c.need)} রান দরকার${c.balls != null ? ` ${n(c.balls)} বলে` : ''}।`,
    liveNow: (i, n, ov) => `${ov} ওভার শেষে ${i.team} এর স্কোর ${n(i.runs)} রানে ${n(i.wickets)} উইকেট।`,
    won: (w, r, n) => r.kind === 'runs' ? `${w} ${n(r.n)} রানে জিতেছে।` : r.kind === 'wickets' ? `${w} ${n(r.n)} উইকেটে জিতেছে।` : `${w} ম্যাচ জিতেছে।`,
    tie: () => 'ম্যাচটি টাই হয়েছে।', noResult: () => 'ম্যাচটি ফলাফল ছাড়াই শেষ হয়েছে।', draw: () => 'ম্যাচটি ড্র হয়েছে।',
    pom: (p) => `ম্যাচসেরা হয়েছেন ${p}।`
  },
  hi: {
    title: (a, b) => `${a} बनाम ${b}`,
    meet: (a, b, venue, date, overs) => `${date ? `${date} को ` : ''}${venue ? `${venue} में ` : ''}${a} और ${b} के बीच मुक़ाबला हुआ${overs ? ` (${overs} ओवर का मैच)` : ''}।`,
    upcoming: (a, b, venue, date) => `${a} और ${b} के बीच मैच${date ? ` ${date} को` : ''}${venue ? ` ${venue} में` : ''} खेला जाएगा।`,
    toss: (w, d) => `${w} ने टॉस जीतकर पहले ${d === 'bat' ? 'बल्लेबाज़ी' : 'गेंदबाज़ी'} करने का फ़ैसला किया।`,
    innings: (i, n, ov) => i.allOut ? `${i.team} की पूरी टीम ${ov} ओवर में ${n(i.runs)} रन पर आउट हो गई।` : `${i.team} ने ${ov} ओवर में ${n(i.runs)} रन बनाए और ${n(i.wickets)} विकेट गंवाए।`,
    superOver: (i, n) => `सुपर ओवर में ${i.team} ने ${n(i.runs)} रन बनाए और ${n(i.wickets)} विकेट गंवाए।`,
    topBat: (b, n) => `बल्लेबाज़ी में ${b.name} ने सबसे ज़्यादा ${n(b.runs)} रन (${n(b.balls)} गेंद) बनाए${b.out ? '' : ' और नाबाद रहे'}।`,
    topBowl: (b, n) => `गेंदबाज़ी में ${b.name} ने ${n(b.runs)} रन देकर ${n(b.wickets)} विकेट लिए।`,
    chase: (c, i, n) => `${i.team} को जीत के लिए ${c.balls != null ? `${n(c.balls)} गेंदों में ` : ''}${n(c.need)} रन और चाहिए।`,
    liveNow: (i, n, ov) => `${ov} ओवर के बाद ${i.team} का स्कोर ${n(i.runs)} रन पर ${n(i.wickets)} विकेट है।`,
    won: (w, r, n) => r.kind === 'runs' ? `${w} ने मैच ${n(r.n)} रन से जीत लिया।` : r.kind === 'wickets' ? `${w} ने मैच ${n(r.n)} विकेट से जीत लिया।` : `${w} ने मैच जीत लिया।`,
    tie: () => 'मैच टाई रहा।', noResult: () => 'मैच बेनतीजा रहा।', draw: () => 'मैच ड्रॉ रहा।',
    pom: (p) => `${p} को मैन ऑफ़ द मैच चुना गया।`
  }
};

/** Build the story. Returns { lang, title, paragraphs, text }. */
export function generateStory(centre, live, lang = 'en') {
  const L = T[lang] ? lang : 'en'; const t = T[L]; const n = (x) => num(x, L); const ov = (b) => n(oversText(b));
  const f = storyFacts(centre, live);
  const title = t.title(f.teamA || '?', f.teamB || '?');
  const date = dateText(f.when, L);
  const paras = [];
  if (f.status === 'scheduled') {
    paras.push(t.upcoming(f.teamA, f.teamB, f.venue, date));
  } else {
    const intro = [t.meet(f.teamA, f.teamB, f.venue, date, f.overs ? n(f.overs) : null)];
    if (f.tossWinner && f.tossDecision) intro.push(t.toss(f.tossWinner, f.tossDecision));
    paras.push(intro.join(' '));
    const regular = f.innings.filter((i) => !i.superOver);
    regular.forEach((i) => {
      const bits = [t.innings(i, n, ov(i.balls))];
      if (i.topBat) bits.push(t.topBat(i.topBat, n));
      if (i.topBowl) bits.push(t.topBowl(i.topBowl, n));
      paras.push(bits.join(' '));
    });
    f.innings.filter((i) => i.superOver).forEach((i) => paras.push(t.superOver(i, n)));
    if (f.status === 'completed') {
      const r = f.result; const end = [];
      if (r.kind === 'runs' || r.kind === 'wickets' || r.kind === 'won') end.push(t.won(f.winner || '', r, n));
      else if (r.kind === 'tie') end.push(t.tie());
      else if (r.kind === 'no_result') end.push(t.noResult());
      else if (r.kind === 'draw') end.push(t.draw());
      else if (r.kind === 'text') end.push(r.raw);
      if (f.pom) end.push(t.pom(f.pom));
      if (end.length) paras.push(end.join(' '));
    } else if (f.status === 'live' || f.status === 'paused') {
      const last = f.innings[f.innings.length - 1];
      if (last) paras.push([t.liveNow(last, n, ov(last.balls)), f.chase ? t.chase(f.chase, last, n) : ''].filter(Boolean).join(' '));
    }
  }
  const paragraphs = paras.filter(Boolean);
  return { lang: L, title, paragraphs, text: [title, '', ...paragraphs.flatMap((p) => [p, ''])].join('\n').trim() };
}
