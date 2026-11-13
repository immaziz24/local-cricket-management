// Automatic ball-by-ball commentary (#19 commentary): every ball gets at least 25 simple words –
// runs, boundaries, wides, no-balls, byes, leg-byes and wickets – with the shot direction from the wagon wheel.
// The picture is seen from behind the batter: top = straight past the bowler, right = off side for a right-hander.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const word = (n) => NUM[n] || String(n);

/** Where the ball went, in plain cricket words. leftHanded mirrors off and leg side. */
export function shotArea(angle, dist, leftHanded = false) {
  if (angle == null) return null;
  let a = ((Number(angle) % 360) + 360) % 360;
  if (leftHanded) a = (360 - a) % 360;
  const deep = dist >= 70; const rope = dist >= 98;
  const areas = [
    [22.5, deep ? 'straight down the ground towards long-off and long-on' : 'straight back past the bowler'],
    [67.5, deep ? 'through the covers into the deep' : 'through the covers'],
    [112.5, deep ? 'square on the off side towards deep point' : 'square through point'],
    [157.5, deep ? 'behind point down to third man' : 'past gully towards third man'],
    [202.5, deep ? 'fine behind the wicket-keeper' : 'just behind the wicket-keeper'],
    [247.5, deep ? 'fine down to fine leg' : 'off the pads towards fine leg'],
    [292.5, deep ? 'square on the leg side to deep square leg' : 'through square leg'],
    [337.5, deep ? 'over midwicket into the deep' : 'through midwicket'],
    [360, deep ? 'straight down the ground towards long-off and long-on' : 'straight back past the bowler']
  ];
  const area = areas.find(([to]) => a < to)[1];
  return rope ? `${area}, all the way to the rope` : area;
}

/**
 * Build the commentary for one ball.
 * b: { over, bowler, batter, nonStriker, runs, extra, extraRuns, wicket, outName, fielder, angle, dist, leftHanded,
 *      team, total, wickets, legalAfter, target, freeHit, note }
 */
export function makeCommentary(b) {
  const bowler = b.bowler || 'The bowler';
  const batter = b.batter || 'the batter';
  const where = shotArea(b.angle, b.dist, b.leftHanded);
  const head = `${b.over ? `${b.over} ` : ''}${bowler} to ${batter}.`;
  let body;
  const r = Number(b.runs || 0); const ex = Number(b.extraRuns || 0);

  if (b.wicket && b.wicket !== 'retired_hurt') {
    const out = b.outName || batter;
    const W = {
      bowled: `OUT! Bowled! The ball beats the bat and crashes into the stumps, and the bails fly. ${out} has to walk back to the pavilion.`,
      caught: `OUT! Caught! ${batter} goes for the shot${where ? ` ${where}` : ''} but ${b.fielder ? `${b.fielder} takes a safe catch` : 'the fielder takes a safe catch'}. A big moment for the fielding side.`,
      caught_and_bowled: `OUT! Caught and bowled! ${batter} hits it straight back and ${bowler} holds on to a sharp return catch. What a moment for the bowler.`,
      lbw: `OUT! LBW! The ball hits ${batter} on the pad in front of the stumps and the umpire raises the finger. The batter has to go.`,
      run_out: `OUT! Run out! The batters try for a run, but ${b.fielder ? `${b.fielder}` : 'the fielder'} gets the ball to the stumps in time. ${out} is short of the crease and has to go.`,
      stumped: `OUT! Stumped! ${batter} steps out of the crease and misses, and the wicket-keeper whips off the bails in a flash. Clever bowling.`,
      hit_wicket: `OUT! Hit wicket! ${batter} knocks the stumps with the bat while playing the shot. An unlucky way to get out.`,
      retired_out: `${out} retires out and walks off. A new batter will come in to take guard.`,
      obstructing: `OUT! Obstructing the field. The umpire decides ${out} blocked the fielders on purpose, and the batter has to leave.`,
      timed_out: `OUT! Timed out. The new batter did not get ready in time, so the umpire gives ${out} out.`
    };
    body = W[b.wicket] || `OUT! ${out} is out and walks back.`;
    if (r || ex) body += ` ${plural(r + ex, 'run')} also came from the ball.`;
  } else if (b.wicket === 'retired_hurt') {
    body = `${b.outName || batter} is hurt and leaves the field, retired hurt and not out. The batter can come back later to continue the innings.`;
  } else if (b.extra === 'wide') {
    body = `Wide called. ${plural(ex, 'extra run')} to the batting side. This delivery does not count toward the over.`;
  } else if (b.extra === 'no_ball') {
    body = `No ball! ${r ? plural(r, 'run') + ' off the bat' : 'No runs off the bat'}. ${plural(ex, 'extra run')} added.${b.freeHitNext ? ' Free hit next.' : ''}`;
  } else if (b.extra === 'bye' || b.extra === 'leg_bye') {
    body = `${plural(ex, b.extra === 'bye' ? 'bye' : 'leg bye')} added to the team score.`;
  } else if (r === 6) {
    body = pick([
      `SIX! What a hit! ${batter} gets under the ball and sends it high ${where || 'over the fielders'}. It clears the boundary rope easily.`,
      `SIX! Huge shot from ${batter}, who swings hard and lifts the ball ${where || 'into the crowd'}. The fielders can only watch it sail over.`
    ]);
  } else if (r === 4) {
    body = pick([
      `FOUR! Lovely shot by ${batter}, who times it beautifully ${where || 'into the gap'}. No fielder can stop it reaching the boundary.`,
      `FOUR! ${batter} finds the gap ${where || 'between the fielders'} and the ball races away to the rope. Great timing and placement.`
    ]);
  } else if (r === 0) {
    body = pick([
      `No run. ${batter} defends the ball carefully back down the pitch, and the batters stay in their crease. A good dot ball for ${bowler}.`,
      `Dot ball. ${batter} misses or blocks this one, and there is no run. Tight bowling from ${bowler}, keeping the pressure on the batters.`
    ]);
  } else if (r >= 5) {
    body = `${plural(r, 'run')}! ${batter} hits the ball ${where || 'into the field'} and the batters keep running while the fielders chase and misfield. A lucky bonus for the batting side.`;
  } else {
    const n = word(r);
    body = pick([
      `${n.charAt(0).toUpperCase() + n.slice(1)} ${r === 1 ? 'run' : 'runs'}. ${batter} pushes the ball ${where || 'into the gap'} and the batters run ${r === 1 ? 'a quick single' : `hard for ${n}`}.`,
      `${batter} plays it ${where || 'into the field'} and they take ${r === 1 ? 'an easy single' : `${n} good runs`}. Smart running between the wickets keeps the score moving.`
    ]);
  }

  if (where && b.extra) body += ' The ball went ' + where + '.';

  let tail = '';
  if (b.team && b.total != null) {
    tail = ` ${b.team} are now ${b.total} for ${b.wickets ?? 0}${b.legalAfter != null ? ` after ${Math.floor(b.legalAfter / 6)}.${b.legalAfter % 6} overs` : ''}.`;
    if (b.target) {
      const need = b.target - b.total;
      tail += need > 0 ? ` They need ${plural(need, 'more run')} to win.` : ' They have reached the target!';
    }
  }
  let text = `${head} ${body}${tail}`.replace(/\s+/g, ' ').trim();
  if (text.split(' ').length < 25) text += ' The fielders reset and the bowler walks back for the next delivery.';
  if (b.note) text += ` ${b.note.trim()}`;
  return text.slice(0, 600);
}
