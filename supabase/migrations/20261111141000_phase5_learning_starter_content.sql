-- Phase 5 – Category K starter content: learning articles (#206–#211), three quizzes (#212) and one platform update (#215).
-- Written for Local Cricket, following the MCC Laws of Cricket; ICC playing conditions are named where they differ.
-- Published under the Super-Admin account with the byline "Local Cricket Coaching Desk". Safe to run twice.

do $$
declare
  admin_id uuid := (select user_id from public.user_role_assignments where role = 'super_admin' and is_active order by granted_at limit 1);
  r record;
begin
  if admin_id is null then raise notice 'No super admin – starter content skipped'; return; end if;

  for r in select * from (values
  -- ---------------- coaching (#206) ----------------
  ('coaching', 'beginner', 'Batting basics: grip, stance and backlift',
   'Three simple habits that make every batter more solid – whether you play with a tennis ball or a leather ball.',
$b$Good batting starts before the ball is bowled. Get these three basics right and everything else becomes easier.

## 1. The grip
- Hold the bat with both hands close together, near the top of the handle.
- For a right-hander, the left hand is on top and the right hand below it.
- The "V" shapes made by your thumbs and first fingers should point down the back of the bat, roughly between the edge and the splice.
- Grip firmly with the top hand and lightly with the bottom hand. A tight bottom hand makes the bat close too early and sends the ball in the air.

## 2. The stance
- Stand side-on with feet about shoulder-width apart, either side of the popping crease.
- Knees slightly bent, weight evenly on the balls of both feet.
- Head still and level, eyes looking straight down the pitch at the bowler.
- Rest the bat lightly near your back toe.

## 3. The backlift
- As the bowler runs in, lift the bat back towards the stumps (or towards second slip) – not towards gully.
- Keep the face of the bat slightly open and your top hand in control.
- Be still when the ball is released. Moving late is better than moving early.

## Practice drill
Ask a friend to throw 20 balls from 10 metres. Do not hit them – just get into your stance, pick up the bat and leave or block each ball. Watch the ball all the way into the bat. Then repeat and play gentle front-foot drives.

**Remember:** watch the ball, keep your head still, and let the top hand lead.$b$),

  ('coaching', 'beginner', 'Bowling basics: run-up, action and line & length',
   'How to build a repeatable run-up and action, and why line and length matter more than pace.',
$b$Accurate bowling wins more local matches than fast bowling. Start with a run-up and action you can repeat every ball.

## The run-up
- Mark your run-up: start at the bowling crease and walk back 8–12 steps for medium pace. Mark the spot.
- Run in smoothly and build speed gradually. You should be at your fastest in the last few strides, not at the start.
- Keep your eyes on the target – the top of off stump – throughout.

## The action
- **Gather:** jump lightly off one foot so that you land side-on (or chest-on – choose one and stay with it).
- **Front arm:** point your front arm up towards the target, then pull it down and in to your side.
- **Bowling arm:** keep it straight and bring it over close to your head. The elbow must not straighten during delivery – a bent-then-straightened arm is a no-ball (a "throw").
- **Follow through:** keep moving towards the batter and then away from the pitch, so you do not run on the danger area.

## Line and length
- **Line** is the direction: aim at or just outside off stump. Balls on leg stump are easy to hit.
- **Length** is where the ball bounces. A "good length" makes the batter unsure whether to go forward or back. For medium pace, it is usually about 5–7 metres in front of the batter.
- Too full and it becomes a half-volley; too short and it can be pulled.

## Practice drill
Put a cone or a cap on a good length just outside off stump. Bowl six-ball overs at it. Count how many land within one metre. Aim to improve that number every week.

**Front-foot no-balls:** some part of your front foot (on the ground or in the air) must be behind the popping crease when you land. Practise your run-up so you never lose runs and free hits.$b$),

  -- ---------------- learning guides (#207) ----------------
  ('guide', 'beginner', 'Cricket explained in five minutes',
   'New to cricket? The whole game in plain words – teams, overs, runs, wickets and how a winner is decided.',
$b$## The teams
Two teams play. Each team bats once (or twice in two-innings matches) and fields once. In local cricket teams are often 8, 9 or 11 a side.

## Overs and balls
An **over** is six legal balls bowled by one bowler from one end. Wides and no-balls do not count as one of the six. After each over a different bowler bowls from the other end. Limited-overs matches set how many overs each side gets – for example 10, 20 or 50.

## Scoring runs
- The two batters run between the wickets. Each time they cross and reach the other end, one run is scored.
- If the ball reaches the boundary after bouncing, it is **four**. If it clears the boundary without bouncing, it is **six**.
- **Extras** are runs not scored off the bat: wides, no-balls, byes and leg byes (and penalty runs).

## Getting out
A batter is out, for example, when the ball hits the stumps (**bowled**), a fielder catches the ball before it bounces (**caught**), or the stumps are broken while the batters are out of their ground (**run out**). When all but one batter are out – 10 wickets in an 11-a-side match – the innings is over (**all out**).

## Winning
- The team batting second chases a **target**: one more than the first team's score.
- If they reach it, they win "by X wickets" (the wickets they still had in hand).
- If they fall short, the first team wins "by X runs".
- Equal scores at the end is a **tie**. Some tournaments then play a Super Over.

## Where to start
Join a team on Local Cricket, play a friendly, and look at the scorecard afterwards – it makes all of this easy to see.$b$),

  ('guide', 'intermediate', 'How to plan a local tournament',
   'A practical checklist for organisers – from rules and fees to fixtures, scoring and prizes.',
$b$## Six weeks before
- **Decide the format:** league, knockout or groups followed by knockouts. With 8 teams, two groups of four and then semi-finals works well over two weekends.
- **Fix the rules:** overs per side, players per side, ball type, powerplay and bowler limits, and what happens to a team that arrives late. Write them in Playing conditions so everyone sees the same rules.
- **Book the ground:** use Grounds to find and request a slot. Confirm water, toilets and parking.
- **Set the entry fee and prizes** and say clearly what the fee covers (balls, umpires, trophies).

## Four weeks before
- Create the tournament on Local Cricket and open **team registration**.
- Share the tournament website and **QR code** on WhatsApp groups and print it on a poster.
- Invite **sponsors** – local shops are often happy to give balls or a trophy in return for their logo on the tournament page.
- Book **umpires and scorers** under Umpires & Scorers.

## One week before
- Close registration and approve teams.
- Generate **fixtures** automatically and publish them.
- Post an **announcement** with reporting time, dress code and the late-arrival rule.

## Match days
- Start every match on the website so scores, the points table and player stats update live.
- Keep a spare ball, a first-aid kit, drinking water and the rule sheet at the ground.
- Note each team's arrival time so the late-arrival rule is applied fairly.

## After the final
- Give **awards** – they appear in each winner's trophy cabinet and come with a certificate.
- Issue **participation certificates** to every player.
- Send each sponsor their **sponsor report**.

A well-run tournament brings teams back next year. Clear rules, fixtures on time and fair umpiring matter more than big prizes.$b$),

  -- ---------------- equipment (#208) ----------------
  ('equipment', 'beginner', 'Choosing your first cricket bat',
   'Size, weight and willow explained – and why a leather-ball bat needs knocking-in.',
$b$## Pick the right size
Stand straight with the bat beside your leg, toe on the ground. The top of the handle should reach roughly your hip bone.
- Junior bats come in sizes 0 to 6, then Harrow for older juniors. Each maker publishes a height chart – check it before buying.
- **Short Handle (SH)** fits most adults.
- **Long Handle (LH)** is for tall adults.

## Pick a weight you can control
Lift the bat with only your top hand and play a few shots. If your wrist bends or the bat drops, it is too heavy. Most adults use between 1.1 and 1.25 kg. A lighter bat you can swing quickly beats a heavy bat you cannot control.

## Willow
- **Kashmir willow:** harder and heavier, cheaper, very durable. Good for beginners, practice and tennis or tape ball.
- **English willow:** softer and lighter for the same size, better "ping", more expensive. Made for leather balls and needs care.

## Tennis-ball bats
Tennis and tape-ball bats are lighter, often with a thinner blade. Never use a tennis-ball bat with a leather ball – it can crack.

## Knocking-in (leather-ball bats)
A new English willow bat must be prepared before facing a hard ball:
- Apply a light coat of raw linseed oil to the face and edges (not the splice), and let it dry for a day.
- Tap the face and edges with an old ball or bat mallet for several hours over a few days, gently at first and harder later.
- Then face throw-downs with old balls before using it in a match.

## Look after it
Keep it dry, store it at room temperature, and do not use it to hit yorkers into the ground or tap the pitch hard. Small cracks on the face are normal; deep cracks in the toe or splice need repair.$b$),

  ('equipment', 'beginner', 'Tennis, tape or leather? Balls and safety gear explained',
   'Which ball suits your game, and the protective gear every player should use with a hard ball.',
$b$## The three common balls
- **Tennis ball:** soft, cheap and safe. Great for gully cricket, children and night matches. Little or no protective gear needed.
- **Tape ball:** a tennis ball wrapped in electrical tape. It swings and skids more and hurts more than a plain tennis ball. Gloves and a box (abdominal guard) are sensible.
- **Leather ball:** hard cork-and-leather ball used in club and professional cricket. Full protective gear is essential. White balls are used in most limited-overs matches; red balls in longer matches; pink in some day-night matches.

## Protective gear for leather-ball cricket
- **Helmet** with a face grille – always when batting against pace, and for close fielders and wicket-keepers standing up to the stumps.
- **Abdominal guard (box)** – every batter and wicket-keeper, every time.
- **Batting pads** covering the knee and shin.
- **Batting gloves** with finger protection.
- **Thigh guard** and **arm guard** – recommended against fast bowling.
- **Wicket-keeping gloves and inner gloves**, and keeping pads for the wicket-keeper.

## Fit matters
- A helmet should sit snugly and not move when you shake your head. Replace it after a big hit.
- Pads should cover from the top of the foot to above the knee, with the knee roll centred on your knee.
- Gloves should allow you to grip the bat comfortably without gaps at the fingertips.

## Shoes
Rubber-studded shoes are fine for tennis-ball cricket and artificial pitches. On grass with a leather ball, spikes help bowlers and fielders keep their footing.

**Safety first:** never face a leather ball without a helmet and a box – most serious cricket injuries happen when this rule is broken.$b$),

  -- ---------------- rules (#209) ----------------
  ('rules', 'beginner', 'Every way a batter can be out',
   'All the dismissals in the Laws of Cricket, in plain words – from bowled to timed out.',
$b$Under the MCC Laws of Cricket a batter can be out in these ways:

## The common ones
1. **Bowled** – the ball bowled hits the stumps and a bail falls, even if it touched the bat or body first.
2. **Caught** – a fielder or the wicket-keeper catches the ball off the bat (or the glove holding the bat) before it bounces.
3. **Leg before wicket (LBW)** – the ball would have hit the stumps but hits the batter's body first. There are conditions: see our umpiring guide.
4. **Run out** – while the ball is in play, a fielder breaks the wicket and the batter at that end is out of their ground.
5. **Stumped** – the batter is out of the crease, not attempting a run, and the wicket-keeper breaks the wicket.

## The rarer ones
6. **Hit wicket** – the batter breaks their own stumps with bat or body while playing a shot or setting off for the first run.
7. **Hit the ball twice** – the batter deliberately hits the ball a second time, other than to protect their wicket.
8. **Obstructing the field** – the batter wilfully obstructs or distracts the fielding side by word or action. (Handling the ball on purpose now counts as this.)
9. **Timed out** – a new batter is not ready to face the next ball within 3 minutes of the previous dismissal (many competitions use a shorter time).
10. **Retired out** – a batter retires without the umpire's consent and without injury or illness, and does not come back.

## Off a no-ball
A batter cannot be bowled, caught, LBW, stumped or out hit wicket off a no-ball. They can still be run out, out for hitting the ball twice, or out for obstructing the field.

## Who gets the credit?
The bowler is credited with bowled, caught, LBW, stumped and hit wicket. Run out and the other dismissals are not credited to the bowler.$b$),

  ('rules', 'beginner', 'Wides, no-balls and free hits explained',
   'When a delivery is a wide or a no-ball, how many runs it costs, and how the free hit works.',
$b$## Wide ball
The umpire calls **wide** if the ball passes too wide of the striker to hit with a normal cricket shot, judged from where the striker is standing and from a normal guard position.
- A wide is not a wide if the striker moves and brings the ball within reach.
- **Cost:** a one-run penalty, plus any runs the batters run or any boundary (byes off a wide count as wides).
- A wide does **not** count as one of the six balls in the over.

## No-ball
The most common reasons:
- **Front foot:** some part of the front foot, grounded or raised, must be behind the popping crease when it lands.
- **Back foot:** the back foot must land inside the return crease and not touch it.
- **Height:** a ball that, without bouncing, passes or would have passed above waist height of the striker standing upright at the crease.
- **Throwing:** the bowling arm straightens during delivery.
- **Cost:** a one-run penalty plus any runs scored off the bat or run. Like a wide, it does not count in the over.

## Free hit
The ball after a no-ball is a **free hit** in many limited-overs competitions. This comes from ICC playing conditions and local rules, not the Laws themselves – so check your tournament's playing conditions.
- On a free hit the batter can only be out the ways allowed off a no-ball: run out, hit the ball twice or obstructing the field.
- If the free hit is itself a wide or no-ball, the next ball is also a free hit.

## For organisers
Write your wide, no-ball and free-hit rules in the tournament's playing conditions, so every team knows them before the first ball.$b$),

  -- ---------------- umpiring (#210) ----------------
  ('umpiring', 'beginner', 'Umpire signals every player should know',
   'The standard umpire signals from the Laws of Cricket, so scorers and players can follow every decision.',
$b$Umpires signal decisions to the players and, most importantly, to the scorers. The scorer should acknowledge each signal. The main signals are:

## Signals made while the ball is in play
- **No ball:** one arm extended horizontally.
- **Wide:** both arms extended horizontally.

## Signals made when the ball is dead
- **Out:** raising the index finger above the head. (If not out, the umpire calls "Not out".)
- **Boundary four:** waving an arm from side to side, finishing with the arm across the chest.
- **Boundary six:** raising both arms above the head.
- **Bye:** raising an open hand above the head.
- **Leg bye:** touching a raised knee with the hand.
- **Dead ball:** crossing and re-crossing the wrists below the waist.
- **Short run:** bending one arm upwards and touching the nearer shoulder with the tips of the fingers.
- **Revoke last signal:** touching both shoulders, each with the opposite hand.
- **Five penalty runs to the batting side:** repeated tapping of one shoulder with the opposite hand.
- **Five penalty runs to the fielding side:** placing one hand on the opposite shoulder.
- **New ball:** holding the ball above the head.

## Competition signals
Some signals come from competition playing conditions rather than the Laws – for example the **free hit** signal, where the umpire raises one arm and circles it above the head. Check what your competition uses.

## Tips for local umpires
- Make signals clear and hold them until the scorer acknowledges.
- Give the out decision calmly – take a moment to think.
- When a wide or no-ball also goes for four, signal the extra first, then the boundary.$b$),

  ('umpiring', 'intermediate', 'Standing as an umpire: positioning and the LBW checklist',
   'Where to stand at both ends, and the questions to ask yourself before giving someone out LBW.',
$b$## At the bowler's end
- Stand behind the stumps, far enough back that the bowler has room to run in, and in line with middle stump so you can judge LBW.
- Watch the bowler's front foot for no-balls as the ball is delivered, then lift your eyes quickly to the batter.
- After the ball is played, move to the side of the pitch to judge run outs at your end – never stand in the fielders' throwing line.

## At square leg
- Stand roughly 15–20 metres from the striker, in line with the popping crease, usually on the leg side.
- You judge run outs and stumpings at the striker's end, and above-waist full tosses.
- If a fielder is in your way, you may move to the off side ("point") – tell the captain and the batters.

## The LBW checklist
Before you give LBW, every one of these must be true:
1. The delivery is **not a no-ball**.
2. The ball **did not pitch outside leg stump**. (Pitching outside off stump is fine.)
3. The ball **did not hit the bat first** (bat or glove holding the bat).
4. The ball hit the pad or body **in line between wicket and wicket** – or outside off stump if the batter **made no genuine attempt to play** the ball.
5. The ball **would have gone on to hit the stumps**.
If you are not sure about any one of them, the answer is not out. The benefit of the doubt goes to the batter.

## Good habits
- Count the balls – use six coins or a clicker, moving one from one pocket to the other each legal ball.
- Agree with your partner umpire before the match on who watches what.
- Stay neutral and polite. Explain decisions only to the captain, briefly, after the ball is dead.$b$),

  -- ---------------- scoring (#211) ----------------
  ('scoring', 'beginner', 'How to score a match on Local Cricket',
   'Step by step: from creating the match to the last ball – including extras, wickets, undo and playing without internet.',
$b$## Before the match
1. Go to **Matches → New match** (or open the fixture in your tournament).
2. Pick both teams, the overs and players per side.
3. Choose each team's **Playing XI** and the captain and wicket-keeper.
4. Record the **toss**: who won and whether they chose to bat or bowl.

## Starting the innings
5. Choose the two opening batters (striker first) and the opening bowler.
6. Tap **Start**. The match now shows as LIVE and anyone can follow it.

## Every ball
- Tap the runs off the bat: **0, 1, 2, 3, 4, 6**.
- For extras tap **Wide, No ball, Bye** or **Leg bye**, then the runs. The app adds the penalty run for you.
- For a wicket tap **Wicket**, choose how, the batter who is out and the fielder if any, then choose the new batter.
- At the end of each over the app asks for the next bowler. Under the Laws, the same bowler cannot bowl two overs in a row.

## Mistakes
Tap **Undo** to remove the last ball. You can undo several balls one by one. Every change is kept in the match history.

## No internet at the ground?
Keep scoring. Balls are saved on the phone and uploaded automatically when the connection returns. Do not clear the browser while offline.

## After the innings and the match
- When the overs are done or the side is all out, end the innings and start the chase – the target is shown automatically.
- When the match ends, the result, scorecard, player stats and Player of the Match are worked out for you.
- Share the result card and scorecard from the **Video & media** tab.

**Tip:** agree with the umpires at the start who the scorer is, and check the score with the umpires at every drinks break.$b$),

  ('scoring', 'intermediate', 'Reading a scorecard: strike rate, economy and net run rate',
   'What the numbers on a scorecard mean and how they are worked out – with simple examples.',
$b$## Overs
Overs are written as completed overs and balls: **4.3** means 4 overs and 3 balls, which is 27 balls – not four and a third overs.

## Batting numbers
- **Runs (balls):** 45 (30) means 45 runs off 30 balls faced.
- **Strike rate** = runs ÷ balls faced × 100. 45 off 30 balls = 150.
- **Batting average** = total runs ÷ number of times out. A batter with 300 runs who was out 6 times averages 50. Not-out innings add runs but not dismissals.
- **4s and 6s:** boundaries hit.

## Bowling numbers
Bowling figures read **Overs – Maidens – Runs – Wickets**, for example 4-1-22-3.
- **Maiden:** an over in which the bowler concedes no runs that count against them (byes and leg byes do not count against the bowler).
- **Economy rate** = runs conceded ÷ overs bowled. 22 runs in 4 overs = 5.50 per over.
- **Bowling average** = runs conceded ÷ wickets. 22 ÷ 3 = 7.33.
- **Bowling strike rate** = balls bowled ÷ wickets. 24 ÷ 3 = 8 balls per wicket.

## Team numbers
- **Run rate** = runs ÷ overs. 150 in 20 overs = 7.50.
- **Required run rate** = runs still needed ÷ overs left.

## Net run rate (NRR)
Used to separate teams level on points in a table:
**NRR = (total runs scored ÷ total overs faced) − (total runs conceded ÷ total overs bowled)**
- Overs are converted to real numbers first: 18.3 overs = 18.5 overs.
- If a team is **all out**, it is counted as having faced its full quota of overs (for example 20), not the overs it actually batted.

Local Cricket works all of these out automatically – look at the Statistics page and the points table.$b$)
  ) as t(kind, level, title, summary, body)
  loop
    if not exists (select 1 from public.articles where title = r.title) then
      insert into public.articles (kind, level, title, summary, body, author_id, byline, status, is_official, published_at, reading_minutes)
      values (r.kind, r.level, r.title, r.summary, r.body, admin_id, 'Local Cricket Coaching Desk', 'published', true, now(),
              greatest(1, round(array_length(regexp_split_to_array(r.body, '\s+'), 1) / 200.0)::int));
    end if;
  end loop;

  -- ---------------- platform update (#215) ----------------
  if not exists (select 1 from public.articles where title = 'News & Learn is now open on Local Cricket') then
    insert into public.articles (kind, title, summary, body, author_id, byline, status, is_official, is_featured, published_at)
    values ('community_update', 'News & Learn is now open on Local Cricket',
      'Every member can now write local cricket news, match previews and reports, player stories and coaching tips.',
$b$Local Cricket now has a home for cricket news and learning.

## What you can write
- **Local news and stories** from your town or village.
- **Match previews and reports** – open a match and tap Write. Reports start with an automatic draft from the scorecard that you can edit.
- **Player interviews and success stories** – the player is told when an article about them is published.
- **Tournament announcements** (organisers) and **academy updates** (academies, coaching centres, clubs and nets).
- **Coaching tips and guides** for other players.

## Learn
The Learn section has tutorials on batting, bowling, equipment, rules, umpiring and scoring, plus quizzes to test yourself.

## Keep it fair
Write about real events, be respectful, and do not share anyone's phone number or address. Any member can report an article; admins review reports.$b$,
      admin_id, 'Local Cricket team', 'published', true, true, now());
  end if;
end $$;

-- ---------------- quizzes (#212) ----------------
do $$
declare
  admin_id uuid := (select user_id from public.user_role_assignments where role = 'super_admin' and is_active order by granted_at limit 1);
  q record; qid uuid;
begin
  if admin_id is null then return; end if;
  for q in select * from (values
    ('Laws of cricket: the basics', 'rules', 'beginner', 'Eight questions on overs, extras and dismissals.',
     $j$[
      {"question":"How many legal balls make one over?","options":["4","5","6","8"],"correct":2,"explanation":"An over is six legal balls. Wides and no-balls are bowled again."},
      {"question":"A ball goes to the boundary after bouncing once. How many runs?","options":["2","4","5","6"],"correct":1,"explanation":"A ball that reaches the boundary after touching the ground scores four."},
      {"question":"Can a batter be bowled off a no-ball?","options":["Yes","No"],"correct":1,"explanation":"Off a no-ball a batter can only be run out, out for hitting the ball twice, or for obstructing the field."},
      {"question":"The ball pitches outside leg stump and would hit the stumps. Can it be LBW?","options":["Yes, if it would hit the stumps","No, never","Only if the batter did not play a shot"],"correct":1,"explanation":"A ball that pitches outside leg stump can never give an LBW."},
      {"question":"Does a wide count as one of the six balls of the over?","options":["Yes","No"],"correct":1,"explanation":"Wides and no-balls are not counted in the over."},
      {"question":"A fielder catches the ball after it has bounced once. Is the batter out?","options":["Yes","No"],"correct":1,"explanation":"For a catch the ball must not touch the ground before the fielder controls it."},
      {"question":"Under the Laws, how long does a new batter have to be ready to face the next ball?","options":["1 minute","2 minutes","3 minutes","5 minutes"],"correct":2,"explanation":"The Laws give 3 minutes (many competitions use less, e.g. 2 minutes). Otherwise the batter can be timed out."},
      {"question":"In an 11-a-side match, how many wickets end an innings?","options":["9","10","11"],"correct":1,"explanation":"When 10 batters are out there is no partner left, so the side is all out."}
     ]$j$),
    ('Know your umpire signals', 'umpiring', 'beginner', 'Can you read the umpire like a scorer?',
     $j$[
      {"question":"The umpire raises both arms above the head. What does it mean?","options":["Four","Six","Wide","Dead ball"],"correct":1,"explanation":"Both arms raised above the head signals a boundary six."},
      {"question":"Both arms held out horizontally means…","options":["No ball","Wide","Bye","Out"],"correct":1,"explanation":"Both arms extended horizontally is a wide; one arm is a no-ball."},
      {"question":"One arm held out horizontally means…","options":["No ball","Wide","Leg bye","Short run"],"correct":0,"explanation":"One arm out horizontally is the no-ball signal."},
      {"question":"An open hand raised above the head signals…","options":["Out","Six","Bye","New ball"],"correct":2,"explanation":"An open hand raised above the head is a bye."},
      {"question":"The umpire touches a raised knee. What is it?","options":["Leg bye","Short run","Dead ball","Penalty runs"],"correct":0,"explanation":"Touching a raised knee is the leg-bye signal."},
      {"question":"Crossing and re-crossing the wrists below the waist means…","options":["Revoke last signal","Dead ball","Free hit","Out"],"correct":1,"explanation":"That is the dead-ball signal."},
      {"question":"Touching both shoulders, each with the opposite hand, means…","options":["Five penalty runs","Revoke last signal","Short run","New ball"],"correct":1,"explanation":"It cancels the umpire's last signal."},
      {"question":"Waving an arm side to side and finishing across the chest signals…","options":["Four","Six","Wide","Dead ball"],"correct":0,"explanation":"That is the boundary-four signal."}
     ]$j$),
    ('Scoring and statistics', 'scoring', 'intermediate', 'Strike rate, economy, overs and net run rate.',
     $j$[
      {"question":"How many balls is 4.3 overs?","options":["24","27","43","30"],"correct":1,"explanation":"4 overs × 6 balls + 3 balls = 27 balls."},
      {"question":"A batter scores 45 runs off 30 balls. What is the strike rate?","options":["66.7","120","150","15"],"correct":2,"explanation":"45 ÷ 30 × 100 = 150."},
      {"question":"A bowler concedes 22 runs in 4 overs. What is the economy rate?","options":["4.40","5.50","8.80","22"],"correct":1,"explanation":"22 ÷ 4 = 5.50 runs per over."},
      {"question":"Bowling figures 4-1-22-3 – what does the 1 mean?","options":["1 wide","1 maiden","1 catch","1 no-ball"],"correct":1,"explanation":"Figures are Overs – Maidens – Runs – Wickets."},
      {"question":"300 runs, out 6 times. What is the batting average?","options":["30","50","60","300"],"correct":1,"explanation":"Average = runs ÷ dismissals = 300 ÷ 6 = 50."},
      {"question":"For net run rate, how is 18.3 overs written as a number?","options":["18.3","18.5","18.25","19"],"correct":1,"explanation":"3 balls is half an over, so 18.3 overs = 18.5 overs."},
      {"question":"A team is all out in 16 overs of a 20-over match. For NRR, what overs faced are used?","options":["16","20","18"],"correct":1,"explanation":"An all-out team is counted as having faced its full quota of overs."},
      {"question":"Do byes count against the bowler's figures?","options":["Yes","No"],"correct":1,"explanation":"Byes and leg byes are extras that are not charged to the bowler."}
     ]$j$)
  ) as t(title, category, level, description, questions)
  loop
    if not exists (select 1 from public.quizzes where title = q.title) then
      insert into public.quizzes (title, description, category, level, author_id, byline, status, is_official)
      values (q.title, q.description, q.category, q.level, admin_id, 'Local Cricket Coaching Desk', 'published', true) returning id into qid;
      insert into public.quiz_questions (quiz_id, position, question, options, correct, explanation)
      select qid, ord::int, x->>'question', x->'options', (x->>'correct')::int, x->>'explanation'
        from jsonb_array_elements(q.questions::jsonb) with ordinality as t2(x, ord);
    end if;
  end loop;
end $$;
