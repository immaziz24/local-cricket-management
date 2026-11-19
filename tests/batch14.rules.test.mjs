// Batch 14: media rights, video-to-score links, clip suggestions, overlay endpoint, placement numbers, sponsor reports, microsites
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtClock, parseClock, toLocalInput, fromLocalInput, withStart, timeLink, linkLabel, rightsError, ctrText, seriesBars,
  slugify, SLUG_RE, COLOR_RE, brandGradient, overlayUrl, overlayJsonUrl, overlayOptions, POLICY_WHO
} from '../src/views/media/mediaExtras.js';
import { normalizeOverlay, parseOverlayRequest, ballText, overs, isUuid } from '../supabase/functions/overlay/normalize.js';

test('clock text goes both ways and rejects nonsense', () => {
  assert.equal(fmtClock(65), '1:05');
  assert.equal(fmtClock(3725), '1:02:05');
  assert.equal(fmtClock(-4), '0:00');
  assert.equal(parseClock('1:02:05'), 3725);
  assert.equal(parseClock('95'), 95);
  assert.equal(parseClock('2:75'), null);
  assert.equal(parseClock('a:b'), null);
  assert.equal(parseClock(''), null);
});

test('start time moves to and from the date box without changing the minute', () => {
  const iso = '2026-11-16T09:08:00.000Z';
  assert.equal(fromLocalInput(toLocalInput(iso)), iso);
  assert.equal(toLocalInput(null), '');
  assert.equal(fromLocalInput('not a date'), null);
});

test('a YouTube embed can start at a second without doubling its options', () => {
  const e = 'https://www.youtube.com/embed/abc123?rel=0&playsinline=1&autoplay=1&mute=1';
  const out = withStart(e, 42.9);
  assert.ok(out.includes('start=42'));
  assert.equal((out.match(/autoplay=/g) || []).length, 1);
  assert.equal(withStart(null, 5), null);
  assert.equal(timeLink({ source: 'youtube', url: 'https://youtu.be/abc123' }, 90), 'https://youtu.be/abc123?t=90s');
  assert.equal(timeLink({ source: 'facebook', url: 'https://fb.watch/x' }, 90), null);
});

test('moment links read clearly', () => {
  assert.equal(linkLabel({ offset_s: 125, innings_no: 2, over: '8.4', label: 'Six by Asgar' }), '2:05 · Inns 2 · 8.4 · Six by Asgar');
  assert.equal(linkLabel({ kind: 'clip', clip_start_s: 60, clip_end_s: 85, offset_s: 60, over: '3.1', label: 'Wicket' }), '1:00–1:25 · 3.1 · Wicket');
});

test('rights form needs an owner, a licence, the people answer and a tick', () => {
  const ok = { holder: 'Rahim Studio', licence: 'own_work', people: 'none', confirmed: true };
  assert.equal(rightsError(ok), null);
  assert.match(rightsError({ ...ok, holder: 'R' }), /who owns/);
  assert.match(rightsError({ ...ok, licence: 'x' }), /how you may use/);
  assert.match(rightsError({ ...ok, people: '' }), /people in it/);
  assert.match(rightsError({ ...ok, confirmed: false }), /Tick the box/);
  assert.equal(POLICY_WHO[0][0], 'participants');
});

test('click rate and day bars are safe with no data', () => {
  assert.equal(ctrText(0, 0), '–');
  assert.equal(ctrText(200, 5), '2.5%');
  assert.deepEqual(seriesBars([], 300, 60), []);
  const bars = seriesBars([{ day: 'a', impressions: 10, clicks: 1 }, { day: 'b', impressions: 5, clicks: 0 }, { day: 'c', impressions: 0, clicks: 0 }], 300, 60);
  assert.equal(bars[0].h, 60);
  assert.equal(bars[1].h, 30);
  assert.equal(bars[2].h, 0);
  assert.ok(bars.every((b) => b.y + b.h === 60));
});

test('microsite names and colours follow the same rules as the database', () => {
  assert.equal(slugify('Dhaka Premier Cup 2026!'), 'dhaka-premier-cup-2026');
  assert.equal(slugify('  --A--  '), 'a');
  assert.ok(SLUG_RE.test('dhaka-cup'));
  assert.ok(!SLUG_RE.test('-bad'));
  assert.ok(!SLUG_RE.test('ab'));
  assert.ok(!SLUG_RE.test('x'.repeat(41)));
  assert.ok(COLOR_RE.test('#1A7F37'));
  assert.ok(!COLOR_RE.test('red'));
  assert.deepEqual(brandGradient('#1a7f37', ['x', 'y']), ['#1a7f37', '#135b28']);
  assert.deepEqual(brandGradient('nope', ['x', 'y']), ['x', 'y']);
});

test('overlay addresses keep only the options that differ from the default', () => {
  const id = 'e313455d-1ef2-4c79-8c31-06cf601a18bb';
  assert.equal(overlayUrl('https://site/app', id, {}), `https://site/app?overlay=${id}`);
  assert.equal(overlayUrl('https://site/app', id, { style: 'box', pos: 'top', scale: 1.5, accent: 'AA3300' }), `https://site/app?overlay=${id}&style=box&pos=top&scale=1.5&accent=aa3300`);
  assert.equal(overlayJsonUrl('https://x.supabase.co/', id), `https://x.supabase.co/functions/v1/overlay?match=${id}`);
  assert.equal(overlayJsonUrl('', id), '');
  assert.deepEqual(overlayOptions('?overlay=1&pos=top&scale=1.5&accent=aa3300'), { pos: 'top', scale: 1.5, accent: '#aa3300' });
  assert.deepEqual(overlayOptions('?scale=9&accent=zz&pos=left'), { pos: 'bottom', scale: 1, accent: '#065f46' });
});

const centre = { match: { id: 'm1', status: 'live' }, team_a: { id: 'a', name: 'Alpha', short_name: 'ALP' }, team_b: { id: 'b', name: 'Beta' } };
const live = {
  match_id: 'm1', status: 'live', overs_limit: 10,
  current: { runs: 45, wickets: 2, legal_balls: 32, batting_team_id: 'a', bowling_team_id: 'b', innings_id: 'i1', innings_no: 1, striker_id: 'p1', bowler_id: 'q1',
    this_over: [{ runs: 4 }, { runs: 0, wicket: 'bowled' }, { runs: 0, extra: 'wide', extra_runs: 1 }, { runs: 1, extra: 'no_ball' }, { runs: 0, extra: 'bye', extra_runs: 2 }] },
  innings: [{ id: 'i1', batting: [{ player_id: 'p1', name: 'Rafi', runs: 20, balls: 15, on_strike: true, at_crease: true }, { player_id: 'p9', name: 'Out', runs: 3, balls: 4, at_crease: false }],
    bowling: [{ player_id: 'q1', name: 'Sam', wickets: 1, runs: 12, legal_balls: 14 }] }]
};

test('overlay data is flat, small and correct', () => {
  const o = normalizeOverlay(centre, live, new Date('2026-11-19T00:00:00Z'));
  assert.equal(o.score_text, '45/2');
  assert.equal(o.overs, '5.2');
  assert.equal(o.run_rate, 8.44);
  assert.equal(o.batting_team, 'ALP');
  assert.equal(o.bowling_team, 'Beta');
  assert.deepEqual(o.batters, [{ name: 'Rafi', runs: 20, balls: 15, on_strike: true }]);
  assert.deepEqual(o.bowler, { name: 'Sam', wickets: 1, runs: 12, overs: '2.2' });
  assert.deepEqual(o.this_over.map((b) => b.text), ['4', 'W', 'wd', '1nb', '2b']);
  assert.equal(o.info, 'Innings 1 · 10 overs');
  assert.equal(o.finished, false);
  assert.equal(o.updated_at, '2026-11-19T00:00:00.000Z');
});

test('overlay shows the chase and the result', () => {
  const chase = normalizeOverlay(centre, { ...live, current: { ...live.current, target: 68, runs_needed: 8, balls_left: 12 } });
  assert.equal(chase.info, 'Need 8 from 12 balls');
  const done = normalizeOverlay({ ...centre, match: { id: 'm1', status: 'completed', result_summary: 'Alpha won by 5 wickets' } }, { ...live, status: 'completed' });
  assert.equal(done.finished, true);
  assert.equal(done.result, 'Alpha won by 5 wickets');
  assert.equal(normalizeOverlay(null, live), null);
  assert.equal(normalizeOverlay(centre, null), null);
});

test('overlay requests only accept a match id', () => {
  const id = 'E313455D-1EF2-4C79-8C31-06CF601A18BB';
  assert.deepEqual(parseOverlayRequest(`https://x/functions/v1/overlay?match=${id}`), { match: id.toLowerCase() });
  assert.ok(parseOverlayRequest('https://x/overlay?match=1;drop').error);
  assert.ok(parseOverlayRequest('https://x/overlay').error);
  assert.ok(parseOverlayRequest('not a url').error);
  assert.ok(isUuid(id));
  assert.equal(ballText({ runs: 6 }), '6');
  assert.equal(overs(50), '8.2');
});
