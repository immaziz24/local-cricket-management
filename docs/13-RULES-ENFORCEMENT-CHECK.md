# Playing-conditions check (batch 10, #103–#130)

Checked on 2026-11-19 against the live database. Each case was run as a scorer on a real match inside a transaction that was rolled back, so nothing was saved.

| # | Rule | Result |
|---|---|---|
| 1 | No-ball and bowled | Refused: a batter cannot be out that way on a no-ball (#110, #113) |
| 2 | Wide and LBW | Refused (#109, #113) |
| 3 | Runs off the bat on a wide | Refused (#109) |
| 4 | Bye with no runs entered | Refused (#114) |
| 5 | More than 7 runs on a ball | Refused (#116) |
| 6 | Non-striker bowled | Refused: only a run out or retirement (#113) |
| 7 | Fielder from the batting side | Refused (#113) |
| 8 | LBW switched off for the match | Refused (#112) |
| 9 | Byes switched off | Refused (#114) |
| 10 | Leg-byes switched off | Refused (#114) |
| 11 | Bowled on a free hit | Refused (#111) |
| 12 | Run out on a free hit | Allowed (#111) |

Also confirmed in the database code: maximum overs per bowler (#108), no two overs in a row and no injured bowler coming back (#107), rules frozen when the match goes live (#105), penalty runs (#123), Super Over (#121), follow-on (#120).

Guides only (nothing to enforce): MCC Laws and ICC conditions links (#103, #104), umpire signals (#125), overthrow guide (#116), boundary rules (#118), ball type and pitch notes (#129, #130). Retire-at (#106) warns the scorer; it does not block. DLS (#122) is a helper using the standard resource table, not the official DLS software, so it can differ from an official result.

New in batch 10: a one-tap "Umpire decision" box on the scoring screen (dead ball, short run, overthrow, no-ball or wide called, decision changed, time-wasting warning, other). Each tap writes into the public match decision log with the innings and over. Time-wasting warnings are counted per team: first warning, final warning, then a prompt to consider 5 penalty runs.
