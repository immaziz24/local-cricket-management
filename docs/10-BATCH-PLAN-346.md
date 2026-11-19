# Batch plan for the 346 partly-finished features

Date: 19 November 2026. Source: `09-FEATURE-AUDIT-400-2026-11-19.csv` (feature numbers and names unchanged). Batches 1-3 are already built; they are marked **built, owner check pending** below. Batch 4 onward are the plan.

How to read the tags: **Check** = built earlier, only needs your browser check. **Build** = real work still missing (from the audit notes). A feature becomes Completed only after your browser check. The Check/Build tag is a first guess from the audit wording (mentions an owner check = Check, otherwise Build); I confirm each one when its batch starts.

**Batches 1-3 (done in code, tested, waiting for your check):** #20 #26 #27 #46 #48 #56 #216-#232 #311-#314 #321-#323 #327-#329 #331 #332 #333-#337 #349-#352 #382 (those that are partly-finished ones are listed again in their category below with a ✔).


## Batch 4 - 17 features


**Category N, Phase 1** (17)

- #256 Password recovery — Build
- #258 Admin dashboard — Check
- #259 Organiser permissions — Check
- #260 Team owner permissions — Check
- #261 Captain permissions — Check
- #262 Scorer permissions — Check
- #263 Umpire permissions — Check
- #264 Player permissions — Check
- #265 User verification — Check
- #266 User reporting and suspension — Check
- #267 Activity and audit logs — Check
- #268 Database backup — Check
- #269 Security and privacy management — Check
- #270 Notifications management — Check
- #383 Granular scorer permissions by match — Build
- #385 Role-specific audit log viewer — Build
- #386 Session and device management — Build

## Batch 5 - 34 features


**Category B, Phase 2** (28)

- #31 Create a tournament — Check
- #32 Tournament name and branding — Check
- #33 Tournament logo and banner — Check
- #34 Tournament start and end dates — Check
- #35 Tournament location — Check
- #36 Tournament registration — Check
- #37 Registration fees — Check
- #38 Prize money details — Check
- #39 Tournament rules and regulations — Check
- #40 Team registration — Check
- #41 Team approval and rejection — Check
- #42 Group creation — Check
- #43 League format — Check
- #44 Knockout format — Check
- #45 Round-robin format — Check
- #46 Double-elimination format — ✔ built, owner check pending
- #47 Custom tournament formats — Check
- #48 Automatic fixture generation — ✔ built, owner check pending
- #49 Manual fixture creation — Check
- #50 Match scheduling — Check
- #51 Match rescheduling — Check
- #52 Tournament calendar — Check
- #53 Points table — Check
- #54 Net Run Rate calculation — Check
- #55 Qualification management — Check
- #56 Knockout brackets — ✔ built, owner check pending
- #57 Tournament leaderboards — Build
- #58 Tournament completion and winner declaration — Check

**Category B, Phase 2** (6)

- #326 Automatic playoff seeding from standings — Build
- #333 Tournament template duplication — ✔ built, owner check pending
- #334 Tournament public registration status tracker — ✔ built, owner check pending
- #335 Standalone series creation and independent lifecycle — ✔ built, owner check pending
- #336 Series match count and best-of-N configuration — ✔ built, owner check pending
- #337 Public series directory with live/upcoming/completed filters — ✔ built, owner check pending

## Batch 6 - 13 features


**Category C, Phase 2** (13)

- #60 Player profile — Check
- #61 Player profile photograph — Check
- #66 Age and date of birth — Check
- #67 Contact information and privacy settings — Check
- #69 Team logo — Check
- #72 Playing XI management — Check
- #73 Substitute management — Check
- #74 Player replacements — Check
- #75 Player transfers — Check
- #77 Player career statistics — Build
- #78 Player awards and achievements — Build
- #338 Player identity duplicate detection and merging — Build
- #341 Historical team membership effective dates — Build

## Batch 7 - 28 features


**Category A, Phase 3** (28)

- #1 Create a new cricket match — Check
- #2 Select participating teams — Check (name per master blueprint; PDF title differs, see decision log)
- #3 Add playing XI — Check (name per master blueprint; PDF title differs, see decision log)
- #4 Add substitute players — Check
- #5 Toss winner selection — Check
- #6 Toss decision: bat or bowl — Check
- #7 Ball-by-ball scoring — Check
- #8 Record runs: 0, 1, 2, 3, 4, 6 — Check
- #9 Record extras: wides, no-balls, byes and leg-byes — Check
- #10 Record wickets and dismissal types — Check
- #11 Handle retired hurt and retired out — Check
- #12 Automatic strike rotation — Check
- #13 Automatic end-of-over strike changes — Check
- #14 Bowler selection and bowler changes — Check
- #15 Over and innings management — Check
- #16 Target calculation — Check
- #17 Match result calculation — Check
- #18 Score correction and undo — Check
- #19 Abandoned and tied match handling — Check
- #20 Live commentary — ✔ built, owner check pending
- #21 Full batting scorecard — Check
- #22 Full bowling scorecard — Check
- #23 Match summary — Check
- #24 Save incomplete matches — Check
- #25 Resume a saved match — Check
- #26 Offline scoring support — ✔ built, owner check pending
- #27 Automatic synchronisation after internet returns — ✔ built, owner check pending
- #28 Live score sharing — Check

## Batch 8 - 15 features


**Category A, Phase 3** (15)

- #29 Live score updates for spectators — Check
- #30 Scoring history and audit trail — Check
- #311 Correct live striker selection without resetting innings — ✔ built, owner check pending
- #312 Correct live non-striker selection without resetting innings — ✔ built, owner check pending
- #313 Correct opening bowler after match starts — ✔ built, owner check pending
- #314 Replace injured bowler mid-over with eligibility validation — ✔ built, owner check pending
- #315 Correct historical delivery batter attribution — Build
- #316 Correct historical delivery bowler attribution — Build
- #317 Recompute scorecard after historical corrections — Build
- #318 Scoring correction reason and approval workflow — Build
- #319 Delivery-level immutable correction revisions — Build
- #320 Scorer conflict detection across devices — Build
- #321 Super Over scoring workflow — ✔ built, owner check pending
- #322 Partial-over replacement bowler statistical split — ✔ built, owner check pending
- #323 Delivery timeline replay after corrections — ✔ built, owner check pending

## Batch 9 - 32 features


**Category D, Phase 3** (28)

- #79 Total runs — Build
- #80 Batting average — Build
- #81 Batting strike rate — Build
- #82 Fours and sixes — Build
- #83 Highest individual score — Build
- #84 Half-centuries — Build
- #85 Centuries — Build
- #86 Bowling wickets — Build
- #87 Bowling average — Build
- #88 Bowling economy — Build
- #89 Bowling strike rate — Build
- #90 Best bowling figures — Build
- #91 Maiden overs — Build
- #92 Dot balls — Build
- #93 Catches — Build
- #94 Run-outs — Build
- #95 Stumpings — Build
- #96 Player of the Match — Build
- #97 Most Valuable Player — Build
- #98 Player comparison — Build
- #99 Team comparison — Build
- #100 Performance charts — Build
- #101 Match analysis — Build
- #102 Tournament statistics and leaderboards — Build
- #345 Manhattan over-by-over graph — Build
- #346 Innings worm comparison graph — Build
- #347 Wagon wheel capture and chart — Build
- #349 Partnership breakdown analytics — ✔ built, owner check pending

**Category D, Phase 3** (4)

- #350 Fall-of-wickets visual timeline — ✔ built, owner check pending
- #354 Career form trend and filters — Build
- #355 Boundary tracker across competition — Build
- #356 Statistics provenance and correction refresh — Build

## Batch 10 - 28 features


**Category E, Phase 3** (28)

- #103 MCC Laws of Cricket reference library — Build
- #104 ICC playing conditions reference library — Build
- #105 Match-specific rule configuration — Build
- #106 Batting and innings rules — Build
- #107 Bowling restrictions — Build
- #108 Maximum overs per bowler — Build
- #109 Wide-ball rules — Build
- #110 No-ball rules — Build
- #111 Free-hit rules — Build
- #112 LBW applicability — Build
- #113 Dismissal rules — Build
- #114 Byes and leg-byes — Build
- #115 Dead-ball rules — Build
- #116 Overthrow rules — Build
- #117 Short-run rules — Build
- #118 Boundary rules — Build
- #119 Powerplay configuration — Build
- #120 Follow-on rules — Build
- #121 Super Over rules — Build
- #122 DLS reference and calculation support — Build
- #123 Penalty-run rules — Build
- #124 Time-wasting regulations — Build
- #125 Umpire signals and decisions — Build
- #126 Match decision log — Build
- #127 Incident reports — Build
- #128 Disciplinary reports — Build
- #129 Ball type configuration — Build
- #130 Pitch and ground conditions — Build

## Batch 11 - 25 features


**Category E, Phase 3** (7)

- #131 Fielding restrictions — Build
- #132 Local tournament playing conditions — Build
- #133 Rules for substitutions and replacements — Build
- #134 Match-specific rule publishing and version history — Build
- #358 Local-rule override approval and audit — Build
- #359 Bowling eligibility checks for replacement bowler — Build
- #360 Versioned ruleset snapshot at match start — Build

**Category L, Phase 3** (18)

- #216 Run-rate calculator — ✔ built, owner check pending
- #217 Required run-rate calculator — ✔ built, owner check pending
- #218 Batting strike-rate calculator — ✔ built, owner check pending
- #219 Batting average calculator — ✔ built, owner check pending
- #220 Bowling economy calculator — ✔ built, owner check pending
- #221 Bowling average calculator — ✔ built, owner check pending
- #222 Net Run Rate calculator — ✔ built, owner check pending
- #223 DLS calculation support — ✔ built, owner check pending
- #224 Toss generator — ✔ built, owner check pending
- #225 Team generator — ✔ built, owner check pending
- #226 Playing XI generator — ✔ built, owner check pending
- #227 Fixture generator — ✔ built, owner check pending
- #228 Points table calculator — ✔ built, owner check pending
- #229 Tournament budget calculator — ✔ built, owner check pending
- #230 Prize distribution calculator — ✔ built, owner check pending
- #231 Player auction calculator — ✔ built, owner check pending
- #232 Cricket ground dimension calculator — ✔ built, owner check pending
- #382 Cricket ball-count and legal-delivery validator — ✔ built, owner check pending

## Batch 12 - 29 features


**Category F, Phase 4** (14)

- #135 Umpire registration — Build
- #136 Umpire profiles — Build
- #137 Scorer registration — Build
- #138 Scorer profiles — Build
- #139 Official assignments — Build
- #140 Official availability — Build
- #141 Official schedules — Build
- #142 Umpire and scorer feedback — Build
- #143 Dispute management — Build
- #144 Incident reporting — Build
- #145 Official payment records — Build
- #146 Officials' performance history — Build
- #361 Official digital assignment acceptance — Build
- #363 Scorer handover authorization — Build

**Category G, Phase 4** (15)

- #147 Ground registration — Build
- #148 Ground profile — Build
- #149 Ground photographs — Build
- #150 Ground location and map — Build
- #151 Pitch information — Build
- #152 Boundary dimensions — Build
- #153 Ground facilities — Build
- #154 Ground booking — Build
- #155 Ground availability calendar — Build
- #156 Ground rental charges — Build
- #157 Pitch preparation records — Build
- #158 Ground inspection reports — Build
- #159 Ground match history — Build
- #365 Ground availability conflict alerts — Build
- #366 Ground conditions inspection checklist — Build

## Batch 13 - 34 features


**Category Q, Phase 4** (15)

- #299 Team arrival check-in — Build
- #300 Player attendance tracking — Build
- #301 Match readiness status — Build
- #302 Automatic delay calculator — Build
- #303 Over deduction penalty - configurable rate (example: 1 over per 10 minutes) — Build
- #304 Fielding restriction penalty - configurable outside-circle limit (example: only 2 fielders outside the 30-yard circle) — Build
- #305 Penalty runs - configurable rate (example: 5 runs per 10 minutes awarded to the opponent) — Build
- #306 One penalty method per match - only one of the three methods can be active — Build
- #307 Penalty approval and opponent selection - select late team, benefiting opponent and authorised approver — Build
- #308 Repeat offender and owner accountability — Build
- #309 Penalty payments, appeals and exemptions — Build
- #310 Delay history and automatic notifications — Build
- #398 Arrival dispute evidence workflow — Build
- #399 Late penalty simulation before approval — Build
- #400 Penalty rollback with audit trail — Build

**Category H, Phase 5** (19)

- #160 Cricket academies directory — Build
- #161 Coaching centres directory — Build
- #162 Cricket shops directory — Build
- #163 Cricket equipment listings — Build
- #164 Bat and ball listings — Build
- #165 Cricket kit rental — Build
- #166 Net practice facilities — Build
- #167 Local cricket clubs directory — Build
- #168 Tournament organisers directory — Build
- #169 Find cricket grounds — Build
- #170 Find umpires — Build
- #171 Find scorers — Build
- #172 Find commentators — Build
- #173 Find teams — Build
- #174 Find players — Build
- #175 Find tournaments — Build
- #176 Community listings and enquiries — Build
- #368 Player recruitment postings — Build
- #370 Community moderation queue — Build

## Batch 14 - 30 features


**Category I, Phase 5** (16)

- #177 Mobile live streaming — Build
- #178 YouTube live streaming integration — Build
- #179 Live score overlays — Build
- #180 Match highlights — Build
- #181 Match video uploads — Build
- #182 Player video profiles — Build
- #183 Tournament photo galleries — Build
- #184 Match photo galleries — Build
- #185 Promotional video creation — Build
- #186 Tournament posters — Build
- #187 Shareable scorecards and player cards — Build
- #188 Shareable match results — Build
- #371 OBS-compatible live overlay endpoint — Build
- #373 Automatic highlight clip suggestion — Build
- #374 Video-to-score event linking — Build
- #375 Media rights and upload permissions — Build

**Category J, Phase 5** (14)

- #189 Tournament website — Build
- #190 Tournament QR code — Build
- #191 Sponsor registration — Build
- #192 Sponsor logos — Build
- #193 Sponsor banners — Build
- #194 Advertising placements — Build
- #195 Promotional campaigns — Build
- #196 Digital certificates — Build
- #197 Digital trophies and awards — Build
- #198 Tournament merchandise — Build
- #199 Tournament reports for sponsors — Build
- #376 Custom branded tournament microsites — Build
- #378 Sponsor placement impression analytics — Build
- #379 Automatic sponsor campaign report — Build

## Batch 15 - 34 features


**Category K, Phase 5** (17)

- #200 Local cricket news — Build
- #201 Tournament announcements — Build
- #202 Match previews — Build
- #203 Match reports — Build
- #204 Player interviews — Build
- #205 Local cricket stories — Build
- #206 Coaching tutorials — Build
- #207 Cricket learning guides — Build
- #208 Equipment guides — Build
- #209 Cricket rules guides — Build
- #210 Umpiring tutorials — Build
- #211 Scoring tutorials — Build
- #212 Cricket quizzes — Build
- #213 Player success stories — Build
- #214 Academy updates — Build
- #215 Community cricket updates — Build
- #380 AI-assisted match recap with human approval — Build

**Category M, Phase 6** (17)

- #237 Women's ODI playing conditions — Build
- #238 ICC tournament playing conditions — Build
- #239 Cricket equipment regulations — Build
- #240 Bat regulations — Build
- #241 Ball regulations — Build
- #242 Player eligibility regulations — Build
- #243 Concussion replacement regulations — Build
- #244 Substitute player regulations — Build
- #245 Over-rate regulations — Build
- #246 DRS regulations — Build
- #247 Player code of conduct — Build
- #248 Match referee regulations — Build
- #249 Anti-corruption regulations — Build
- #250 Anti-doping regulations — Build
- #251 Anti-discrimination regulations — Build
- #252 Player disciplinary regulations — Build
- #253 Umpire regulations — Build

## Batch 16 - 27 features


**Category O, Phase 6** (8)

- #271 Free membership — Build
- #272 Premium membership — Build
- #273 Tournament organiser packages — Build
- #274 Online payments — Build
- #277 Invoices and receipts — Check
- #278 Refund management — Check
- #282 Revenue dashboard — Build
- #283 Payment history — Build

**Category P, Phase 6** (19)

- #284 Android player application — Build
- #285 Android scorer application — Build
- #286 Android organiser application — Build
- #287 Push notifications — Build
- #288 Offline scoring in Android — Build
- #289 Background synchronisation — Build
- #290 Deep links — Build
- #291 Match and tournament sharing — Build
- #292 QR-based registration — Build
- #293 Camera integration — Build
- #294 Ground finder using location — Build
- #295 Bengali language support — Check
- #296 Hindi language support — Check
- #297 Future iOS application — Build
- #298 Multi-language expansion — Check
- #392 Offline sync conflict resolution — Build
- #394 Installable progressive web app — Build
- #395 Deep-linked player achievement cards — Build
- #396 Accessibility and low-bandwidth mode — Build


Total planned across batches 4-16: 346 (all 346 partly-finished features, including the ones already built in batches 1-3).
