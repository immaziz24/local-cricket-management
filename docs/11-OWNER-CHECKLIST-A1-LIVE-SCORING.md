# Owner browser checklist: live scoring (#1 to #28)

Use one friendly match between two test teams with at least 5 players each. Tick a feature only when it behaves as written. Tell Claude which numbers passed; failures get fixed in the next batch.

Setup: sign in -> Matches -> Start a match.

| # | Feature | What to do | Pass when |
|---|---|---|---|
| 1 | Create a new match | Matches -> Start a match, pick two teams, save | Match appears in your list and you can open it |
| 2 | Select participating teams | In the form, pick your team, then search for another | Both teams show on the match |
| 3 | Add playing XI | Match page -> Playing XI, pick players, batting order, captain, keeper | Lineup saves and everyone can see it |
| 4 | Add substitutes | In the lineup add up to 4 substitutes | They show under the XI |
| 5 | Toss winner | Match page -> Toss, choose winner | Winner shows |
| 6 | Toss decision | Choose bat or bowl | Match goes live, batting side is correct |
| 7 | Ball-by-ball scoring | Tap a run value for 6 balls | Each ball appears and the over count moves |
| 8 | Runs 0,1,2,3,4,6 | Score each value | Totals add up; after 1 to 7 runs you can tap the wagon wheel |
| 9 | Extras | Score a wide, no-ball, bye, leg-bye | Wide and no-ball add 1 and the ball is not counted in the over |
| 10 | Wickets | Score bowled, caught (with fielder), run out | Wicket count rises and the scorecard shows how out |
| 11 | Retired hurt / out | Retire a batter | Retired hurt can bat again later |
| 12 | Strike rotation | Score 1 run | Strike swaps |
| 13 | End-of-over change | Finish an over | Batters change ends and you are asked for a new bowler |
| 14 | Bowler changes | Try the same bowler for two overs in a row | It is refused |
| 15 | Over and innings management | Play to all out or the overs limit | Innings ends and the next one opens |
| 16 | Target | In the 2nd innings | Target, runs needed, balls left and run rates show |
| 17 | Match result | Finish the match | Result text is right (runs, wickets or tie) |
| 18 | Undo / correction | Undo the last ball | Score goes back one ball |
| 19 | Abandon / tie | Abandon a second test match with a reason | Shows no result; a level score shows tied |
| 20 | Live commentary | Commentary tab | Every ball has a line; four/six/wicket stand out |
| 21 | Batting scorecard | Scorecard tab | Runs, balls, 4s, 6s, strike rate, how out, extras, fall of wickets (new timeline) |
| 22 | Bowling scorecard | Scorecard tab | Overs, maidens, runs, wickets, wides, no-balls, economy |
| 23 | Match summary | Summary tab | Result, totals, top batters and bowlers |
| 24 | Save incomplete match | Pause with a reason, close the page | Spectators see play stopped; nothing lost |
| 25 | Resume | Matches -> Continue scoring / Resume play | Scoring carries on from the same ball |
| 26 | Offline scoring | Turn off wifi on the phone, score a few balls | Scoring keeps working |
| 27 | Sync after internet returns | Turn wifi on | Balls upload by themselves, none doubled |
| 28 | Live score sharing | Share / WhatsApp / Copy link | The link opens the match |

Also try the batch 2 panel while the match is live: "Wrong player picked, or bowler hurt?" (replace the bowler mid-over).
