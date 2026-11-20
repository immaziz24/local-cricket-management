import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneOf, pointToPitch, ballColour, zoneSummary, coverageText } from '../src/views/matches/pitchMap.js';
import { strikeRate, dismissalText, h2hHeadline, edge } from '../src/views/stats/h2hView.js';
import { twoPersonText, twoPersonWarning, alertLabel } from '../src/views/tournaments/securityRules.js';
import { GEO_STATUS, geoLine, geoPayload, geoErrorText, CONSENT_TEXT } from '../src/views/punctuality/arrivalLocation.js';

test('pitch map zones and tap conversion (#348)', () => {
  assert.equal(zoneOf(0).key, 'yorker'); assert.equal(zoneOf(7).key, 'yorker'); assert.equal(zoneOf(8).key, 'full');
  assert.equal(zoneOf(30).key, 'good'); assert.equal(zoneOf(50).key, 'short_of_length'); assert.equal(zoneOf(100).key, 'short');
  assert.equal(ZONES.length, 5);
  assert.deepEqual(pointToPitch(50, 0, 100, 200), { x: 50, y: 100 });
  assert.deepEqual(pointToPitch(0, 200, 100, 200), { x: 0, y: 0 });
  assert.deepEqual(pointToPitch(500, -50, 100, 200), { x: 100, y: 100 });
  assert.equal(pointToPitch(5, 5, 0, 0), null);
});

test('pitch map colours, summary and coverage (#348)', () => {
  assert.equal(ballColour({ wicket: true, runs: 0 }), '#dc2626');
  assert.equal(ballColour({ runs: 6 }), '#7c3aed'); assert.equal(ballColour({ runs: 4 }), '#2563eb');
  assert.equal(ballColour({ runs: 0 }), '#64748b'); assert.equal(ballColour({ runs: 1 }), '#16a34a');
  const s = zoneSummary([{ y: 3, runs: 0 }, { y: 30, runs: 4 }, { y: 31, runs: 1, wicket: false }, { y: 90, runs: 0, wicket: true }]);
  assert.equal(s[0].balls, 1); assert.equal(s[2].balls, 2); assert.equal(s[2].runs, 5); assert.equal(s[4].wickets, 1);
  assert.equal(coverageText({ marked: 3, total: 12 }), '3 of 12 balls have a pitch mark.'); assert.equal(coverageText({ marked: 0, total: 0 }), 'No balls yet.');
});

test('batter versus bowler (#353)', () => {
  assert.equal(strikeRate(30, 20), '150.0'); assert.equal(strikeRate(0, 0), '-');
  assert.equal(dismissalText({}), 'never dismissed'); assert.equal(dismissalText({ bowled: 2, lbw: 1 }), '2 bowled, 1 lbw');
  assert.match(h2hHeadline({ batter: 'A', bowler: 'B', balls: 0, dismissals: 0, runs: 0 }), /has not faced/);
  assert.match(h2hHeadline({ batter: 'A', bowler: 'B', balls: 12, dismissals: 1, runs: 20 }), /average 20.0/);
  assert.equal(edge({ balls: 3, dismissals: 1, runs: 0 }), 'even');
  assert.equal(edge({ balls: 12, dismissals: 2, runs: 10 }), 'bowler');
  assert.equal(edge({ balls: 12, dismissals: 0, runs: 20 }), 'batter');
  assert.equal(edge({ balls: 12, dismissals: 0, runs: 6 }), 'even');
});

test('two-person approval and security alert wording (#384 #387)', () => {
  assert.match(twoPersonText(true), /cannot approve it themselves/); assert.match(twoPersonText(false), /approve their own/);
  assert.ok(twoPersonWarning(true, 1)); assert.equal(twoPersonWarning(true, 2), null); assert.equal(twoPersonWarning(false, 1), null);
  assert.equal(alertLabel('password_changed'), 'Password'); assert.equal(alertLabel('zzz'), 'Security');
});

test('location check-in with consent (#397)', () => {
  assert.equal(GEO_STATUS.at_ground.label, 'At the ground');
  assert.match(geoLine({ status: 'at_ground', distance_m: 75, accuracy_m: 15 }), /75 m from the ground/);
  assert.match(geoLine({ status: 'away', distance_m: 15058, accuracy_m: 0 }), /15.1 km/);
  assert.match(geoLine({ status: 'no_ground_location' }), /still recorded/); assert.equal(geoLine(null), '');
  assert.deepEqual(geoPayload({ coords: { latitude: 24, longitude: 88, accuracy: 12.6 } }), { consent: true, lat: 24, lng: 88, accuracy: 13 });
  assert.equal(geoPayload(null), null);
  assert.match(geoErrorText(1), /refused/); assert.match(geoErrorText(3), /too long/); assert.match(geoErrorText(2), /could not be found/);
  assert.match(CONSENT_TEXT, /once/);
});
