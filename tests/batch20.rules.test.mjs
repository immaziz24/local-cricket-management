import test from 'node:test';
import assert from 'node:assert/strict';
import { clampDelay, delayFromSearch, pushSnapshot, pickSnapshot, waitSeconds, delayLabel, MAX_DELAY_S } from '../src/views/media/streamDelay.js';
import { cleanDomain, checkDomain, isReservedDomain, isPlatformHost, dnsSteps, VERIFY_PREFIX } from '../src/views/brand/domainRules.js';
import { generateStory, storyFacts, parseResult, dateText, num, oversText, STORY_LANGS } from '../src/views/matches/matchStory.js';

test('stream delay is a whole number of seconds from 0 to 180 (#372)', () => {
  assert.equal(clampDelay(25), 25); assert.equal(clampDelay('12.6'), 13); assert.equal(clampDelay(-5), 0);
  assert.equal(clampDelay(999), MAX_DELAY_S); assert.equal(clampDelay('abc'), 0); assert.equal(clampDelay(null), 0);
  assert.equal(delayFromSearch('?overlay=x&delay=30'), 30); assert.equal(delayFromSearch('?overlay=x'), null);
  assert.equal(delayFromSearch('?delay=abc'), null); assert.equal(delayFromSearch('?delay=500'), 180);
  assert.equal(delayLabel(0), 'No delay (score shows at once)'); assert.equal(delayLabel(1), 'Score shown 1 second late'); assert.equal(delayLabel(25), 'Score shown 25 seconds late');
});

test('overlay shows the score that is delay seconds old (#372)', () => {
  let buf = [];
  for (let s = 0; s <= 60; s += 5) buf = pushSnapshot(buf, s * 1000, { score: s });
  assert.equal(pickSnapshot(buf, 60000, 0).score, 60);
  assert.equal(pickSnapshot(buf, 60000, 20).score, 40);
  assert.equal(pickSnapshot(buf, 60000, 22).score, 35); // newest one that is at least 22 s old
  assert.equal(pickSnapshot(buf, 60000, 60).score, 0);
  assert.equal(pickSnapshot(buf, 60000, 90), null); // not old enough yet: nothing shown
  assert.equal(pickSnapshot([], 1000, 10), null);
});

test('overlay history is trimmed but always keeps something to show (#372)', () => {
  let buf = [];
  for (let s = 0; s <= 1000; s += 5) buf = pushSnapshot(buf, s * 1000, { s });
  assert.ok(buf.length < 60, `kept ${buf.length}`);
  assert.equal(pickSnapshot(buf, 1000000, 180).s, 820);
  assert.equal(waitSeconds([{ t: 0, state: {} }], 10000, 25), 15);
  assert.equal(waitSeconds([{ t: 0, state: {} }], 40000, 25), 0);
  assert.equal(waitSeconds([], 0, 25), 25); assert.equal(waitSeconds([], 0, 0), 0);
});

test('web addresses are cleaned and checked (#377)', () => {
  assert.equal(cleanDomain('HTTPS://Cup.MyClub.com/path?x=1'), 'cup.myclub.com'); assert.equal(cleanDomain(' cup.myclub.com. '), 'cup.myclub.com');
  assert.equal(cleanDomain('cup.myclub.com:8080'), 'cup.myclub.com'); assert.equal(cleanDomain(null), '');
  assert.equal(checkDomain('').ok, false); assert.equal(checkDomain('abc').ok, false); assert.equal(checkDomain('my club.com').ok, false);
  assert.equal(checkDomain('-bad.com').ok, false); assert.equal(checkDomain('a..com').ok, false);
  assert.equal(checkDomain('cup.myclub.com').ok, true); assert.equal(checkDomain('myclub.in').domain, 'myclub.in');
  assert.equal(checkDomain('x.plateria.in').ok, false); assert.match(checkDomain('localhost').reason, /does not look|platform/);
  assert.equal(isReservedDomain('a.supabase.co'), true); assert.equal(isReservedDomain('myclub.com'), false);
});

test('platform addresses are left alone, everything else is looked up (#377)', () => {
  assert.equal(isPlatformHost('localhost'), true); assert.equal(isPlatformHost('127.0.0.1'), true);
  assert.equal(isPlatformHost('localcricket.plateria.in'), true); assert.equal(isPlatformHost('plateria.in'), true);
  assert.equal(isPlatformHost('cup.myclub.com'), false); assert.equal(isPlatformHost('cup.myclub.com', ['myclub.com']), true);
  assert.equal(isPlatformHost('evilplateria.in'), false);
  const s = dnsSteps('cup.myclub.com', 'abc123');
  assert.equal(s.txtName, `${VERIFY_PREFIX}cup.myclub.com`); assert.equal(s.txtValue, 'abc123'); assert.equal(s.isSubdomain, true); assert.equal(dnsSteps('myclub.com', 'x').isSubdomain, false);
});

// A completed match shaped like the real database answer (Hamja 11 v Raj 11, 10 overs).
const centre = {
  team_a: { id: 'A', name: 'Hamja 11' }, team_b: { id: 'B', name: 'Raj 11' }, ground_name: 'Titahipara cricket ground',
  match: { status: 'completed', scheduled_at: '2026-11-16T08:00:00+00:00', overs_per_innings: 10, players_per_side: 11, toss_winner_id: 'B', toss_decision: 'bowl',
           winner_team_id: 'B', result_type: 'win', result_summary: 'Raj 11 won by 5 wickets', player_of_match_id: 'p3' }
};
const live = {
  status: 'completed',
  innings: [
    { innings_no: 1, batting_team: { id: 'A', name: 'Hamja 11' }, runs: 67, wickets: 7, legal_balls: 60,
      batting: [{ player_id: 'p1', name: 'Karim', runs: 31, balls: 20, out: null }, { player_id: 'p2', name: 'Salam', runs: 12, balls: 9 }],
      bowling: [] },
    { innings_no: 2, batting_team: { id: 'B', name: 'Raj 11' }, runs: 70, wickets: 5, legal_balls: 52, target: 68,
      batting: [{ player_id: 'p3', name: 'Raj Kumar', runs: 40, balls: 26, out: null }],
      bowling: [{ player_id: 'p9', name: 'Jamal', runs: 18, wickets: 3, legal_balls: 24 }, { player_id: 'p8', name: 'Babu', runs: 20, wickets: 1, legal_balls: 24 }] }
  ]
};

test('result line is read from the saved summary (#381)', () => {
  assert.deepEqual(parseResult({ result_summary: 'Raj 11 won by 5 wickets', winner_team_id: 'B' }), { kind: 'wickets', n: 5, winnerId: 'B', raw: 'Raj 11 won by 5 wickets' });
  assert.equal(parseResult({ result_summary: 'X won by 1 run', winner_team_id: 'A' }).kind, 'runs');
  assert.equal(parseResult({ result_summary: 'Match tied' }).kind, 'tie'); assert.equal(parseResult({ result_summary: 'No result' }).kind, 'no_result');
  assert.equal(parseResult({ result_summary: 'Match drawn' }).kind, 'draw'); assert.equal(parseResult({}).kind, 'none');
  assert.equal(parseResult({ result_summary: 'Something odd' }).kind, 'text');
});

test('numbers and dates follow the language (#381)', () => {
  assert.equal(num(1950, 'bn'), '১৯৫০'); assert.equal(num(67, 'hi'), '67'); assert.equal(num(null, 'en'), '0');
  assert.equal(oversText(62), '10.2'); assert.equal(oversText(0), '0.0');
  assert.equal(dateText('2026-11-16T08:00:00+00:00', 'en'), '16 November 2026');
  assert.equal(dateText('2026-11-16T08:00:00+00:00', 'bn'), '১৬ নভেম্বর ২০২৬');
  assert.equal(dateText('2026-11-16T08:00:00+00:00', 'hi'), '16 नवंबर 2026');
  assert.equal(dateText('2026-11-16T20:00:00+00:00', 'en'), '17 November 2026'); // Indian time
  assert.equal(dateText(null, 'en'), ''); assert.equal(dateText('nonsense', 'en'), '');
});

test('story facts come straight from the scorecard (#381)', () => {
  const f = storyFacts(centre, live);
  assert.equal(f.tossWinner, 'Raj 11'); assert.equal(f.tossDecision, 'bowl'); assert.equal(f.winner, 'Raj 11'); assert.equal(f.pom, 'Raj Kumar');
  assert.equal(f.innings[0].topBat.name, 'Karim'); assert.equal(f.innings[0].topBat.runs, 31); assert.equal(f.innings[0].topBat.out, false);
  assert.equal(f.innings[1].topBowl.name, 'Jamal'); assert.equal(f.innings[0].allOut, false);
});

test('English story (#381)', () => {
  const s = generateStory(centre, live, 'en');
  assert.equal(s.title, 'Hamja 11 v Raj 11');
  assert.match(s.paragraphs[0], /Hamja 11 and Raj 11 met at Titahipara cricket ground on 16 November 2026 in a 10-over match\. Raj 11 won the toss and chose to bowl first\./);
  assert.match(s.paragraphs[1], /Hamja 11 scored 67 for 7 in 10\.0 overs\. Karim was the top scorer with 31 off 20 balls \(not out\)\./);
  assert.match(s.paragraphs[2], /Raj 11 scored 70 for 5 in 8\.4 overs\..*Jamal took 3 wickets for 18 runs\./);
  assert.match(s.paragraphs[3], /Raj 11 won by 5 wickets\. Raj Kumar was named Player of the Match\./);
  assert.ok(s.text.startsWith('Hamja 11 v Raj 11'));
});

test('Bengali story uses Bengali digits and keeps names as typed (#381)', () => {
  const s = generateStory(centre, live, 'bn');
  assert.equal(s.title, 'Hamja 11 বনাম Raj 11');
  assert.match(s.paragraphs[0], /Titahipara cricket ground-এ ১৬ নভেম্বর ২০২৬ Hamja 11 ও Raj 11 মুখোমুখি হয় \(১০ ওভারের ম্যাচ\)।/);
  assert.match(s.paragraphs[0], /টস জিতে Raj 11 প্রথমে বোলিং বেছে নেয়।/);
  assert.match(s.paragraphs[1], /Hamja 11 ১০\.০ ওভারে ৬৭ রান তোলে, হারায় ৭ উইকেট।/);
  assert.match(s.paragraphs[1], /ব্যাটিংয়ে সর্বোচ্চ ৩১ রান করেন Karim \(২০ বলে, অপরাজিত\)।/);
  assert.match(s.paragraphs[3], /Raj 11 ৫ উইকেটে জিতেছে। ম্যাচসেরা হয়েছেন Raj Kumar।/);
});

test('Hindi story (#381)', () => {
  const s = generateStory(centre, live, 'hi');
  assert.equal(s.title, 'Hamja 11 बनाम Raj 11');
  assert.match(s.paragraphs[0], /16 नवंबर 2026 को Titahipara cricket ground में Hamja 11 और Raj 11 के बीच मुक़ाबला हुआ \(10 ओवर का मैच\)।/);
  assert.match(s.paragraphs[0], /Raj 11 ने टॉस जीतकर पहले गेंदबाज़ी करने का फ़ैसला किया।/);
  assert.match(s.paragraphs[1], /Hamja 11 ने 10\.0 ओवर में 67 रन बनाए और 7 विकेट गंवाए।/);
  assert.match(s.paragraphs[2], /Jamal ने 18 रन देकर 3 विकेट लिए।/);
  assert.match(s.paragraphs[3], /Raj 11 ने मैच 5 विकेट से जीत लिया। Raj Kumar को मैन ऑफ़ द मैच चुना गया।/);
});

test('stories for all-out, tie, upcoming and live matches (#381)', () => {
  const allOut = { ...live, innings: [{ ...live.innings[0], wickets: 10 }, live.innings[1]] };
  assert.match(generateStory(centre, allOut, 'en').paragraphs[1], /were all out for 67 in 10\.0 overs/);
  assert.match(generateStory(centre, allOut, 'bn').paragraphs[1], /অলআউট হয়/); assert.match(generateStory(centre, allOut, 'hi').paragraphs[1], /पूरी टीम/);
  const tie = { ...centre, match: { ...centre.match, result_summary: 'Match tied', winner_team_id: null } };
  assert.match(generateStory(tie, live, 'en').paragraphs.at(-1), /ended in a tie/); assert.match(generateStory(tie, live, 'bn').paragraphs.at(-1), /টাই/); assert.match(generateStory(tie, live, 'hi').paragraphs.at(-1), /टाई/);
  const up = { ...centre, match: { ...centre.match, status: 'scheduled' } };
  assert.equal(generateStory(up, { innings: [] }, 'en').paragraphs.length, 1);
  assert.match(generateStory(up, { innings: [] }, 'en').paragraphs[0], /will play/); assert.match(generateStory(up, { innings: [] }, 'bn').paragraphs[0], /অনুষ্ঠিত হবে/); assert.match(generateStory(up, { innings: [] }, 'hi').paragraphs[0], /खेला जाएगा/);
  const liveC = { ...centre, match: { ...centre.match, status: 'live', result_summary: null, winner_team_id: null, player_of_match_id: null } };
  const liveS = { status: 'live', innings: live.innings, current: { target: 68, runs: 50, runs_needed: 18, balls_left: 8 } };
  assert.match(generateStory(liveC, liveS, 'en').paragraphs.at(-1), /need 18 more runs from 8 balls/);
  assert.match(generateStory(liveC, liveS, 'hi').paragraphs.at(-1), /8 गेंदों में 18 रन और चाहिए/);
  assert.match(generateStory(liveC, liveS, 'bn').paragraphs.at(-1), /১৮ রান দরকার ৮ বলে/);
});

test('story copes with missing data and unknown languages (#381)', () => {
  const s = generateStory({ match: { status: 'completed' } }, { innings: [] }, 'xx');
  assert.equal(s.lang, 'en'); assert.ok(s.title.length > 0);
  assert.equal(STORY_LANGS.map((l) => l.code).join(), 'en,bn,hi');
  assert.doesNotThrow(() => generateStory(null, null, 'bn'));
});
