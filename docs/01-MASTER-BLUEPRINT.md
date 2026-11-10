# Master Blueprint: Local Cricket Management Platform

> **Document Version:** 2.0.0  
> **Last Updated:** 2026-11-10  
> **Source of truth:** *Local Cricket Platform – Master Feature Blueprint v2.0* (PDF, 5 Nov 2026)  
> **Repository:** https://github.com/immaziz24/local-cricket-management  
> **Temporary domain:** https://localcricket.plateria.in/  

This file holds the **complete, numbered list of all 310 features**. Feature numbers never change. Every screen, commit and tracker entry must use these exact numbers and names.

## 1. Project in one paragraph

A website (and later Android apps) for **local and grassroots cricket**: village, school, club, academy and district competitions. Organisers run tournaments, teams and players register, scorers score matches ball by ball, officials and grounds are managed, and late-arriving teams can be penalised. ICC/MCC rules are used as references; local playing conditions are configurable per tournament.

## 2. Six-phase plan

| Phase | Name | Categories | Features |
| :---: | :--- | :--- | :---: |
| 1 | Foundation and User Management | N | 17 |
| 2 | Core Cricket Platform | B, C | 48 |
| 3 | Cricket Scoring and Intelligence Engine | A, D, E, L | 103 |
| 4 | Cricket Operations and Match Management | F, G, Q | 37 |
| 5 | Cricket Community and Media Ecosystem | H, I, J, K | 56 |
| 6 | Business, International References and Mobile Expansion | M, O, P | 49 |
| | **Total** | **17 categories (A–Q)** | **310** |

## 3. Category directory

| Cat | Name | Feature numbers | Count | Phase |
| :---: | :--- | :--- | :---: | :---: |
| **A** | Local live scoring | #1–30 | 30 | 3 |
| **B** | Tournament management | #31–58 | 28 | 2 |
| **C** | Player and team management | #59–78 | 20 | 2 |
| **D** | Cricket statistics and analytics | #79–102 | 24 | 3 |
| **E** | Cricket laws, playing conditions and rules | #103–134 | 32 | 3 |
| **F** | Umpire, scorer and officials management | #135–146 | 12 | 4 |
| **G** | Ground and venue management | #147–159 | 13 | 4 |
| **H** | Cricket community and marketplace | #160–176 | 17 | 5 |
| **I** | Live streaming and media | #177–188 | 12 | 5 |
| **J** | Branding, sponsorship and promotion | #189–199 | 11 | 5 |
| **K** | Local cricket news and learning | #200–215 | 16 | 5 |
| **L** | Cricket calculators and tools | #216–232 | 17 | 3 |
| **M** | International cricket rules and reference | #233–253 | 21 | 6 |
| **N** | Administration, security and user management | #254–270 | 17 | 1 |
| **O** | Revenue and business management | #271–283 | 13 | 6 |
| **P** | Android app and future expansion | #284–298 | 15 | 6 |
| **Q** | Team punctuality, attendance and match delay management | #299–310 | 12 | 4 |

## 4. Complete feature list (by phase)

### Phase 1 – Foundation and User Management

#### Category N – Administration, security and user management (#254–270, 17 features)

- **#254** User registration
- **#255** User login and logout
- **#256** Password recovery
- **#257** Super-admin dashboard
- **#258** Admin dashboard
- **#259** Organiser permissions
- **#260** Team owner permissions
- **#261** Captain permissions
- **#262** Scorer permissions
- **#263** Umpire permissions
- **#264** Player permissions
- **#265** User verification
- **#266** User reporting and suspension
- **#267** Activity and audit logs
- **#268** Database backup
- **#269** Security and privacy management
- **#270** Notifications management

### Phase 2 – Core Cricket Platform

#### Category B – Tournament management (#31–58, 28 features)

- **#31** Create a tournament
- **#32** Tournament name and branding
- **#33** Tournament logo and banner
- **#34** Tournament start and end dates
- **#35** Tournament location
- **#36** Tournament registration
- **#37** Registration fees
- **#38** Prize money details
- **#39** Tournament rules and regulations
- **#40** Team registration
- **#41** Team approval and rejection
- **#42** Group creation
- **#43** League format
- **#44** Knockout format
- **#45** Round-robin format
- **#46** Double-elimination format
- **#47** Custom tournament formats
- **#48** Automatic fixture generation
- **#49** Manual fixture creation
- **#50** Match scheduling
- **#51** Match rescheduling
- **#52** Tournament calendar
- **#53** Points table
- **#54** Net Run Rate calculation
- **#55** Qualification management
- **#56** Knockout brackets
- **#57** Tournament leaderboards
- **#58** Tournament completion and winner declaration

#### Category C – Player and team management (#59–78, 20 features)

- **#59** Player registration
- **#60** Player profile
- **#61** Player profile photograph
- **#62** Player ID
- **#63** Batting style
- **#64** Bowling style
- **#65** Player role
- **#66** Age and date of birth
- **#67** Contact information and privacy settings
- **#68** Team profile
- **#69** Team logo
- **#70** Captain and vice-captain assignment
- **#71** Squad management
- **#72** Playing XI management
- **#73** Substitute management
- **#74** Player replacements
- **#75** Player transfers
- **#76** Team history
- **#77** Player career statistics
- **#78** Player awards and achievements

### Phase 3 – Cricket Scoring and Intelligence Engine

#### Category A – Local live scoring (#1–30, 30 features)

- **#1** Create a new cricket match
- **#2** Select participating teams
- **#3** Add playing XI
- **#4** Add substitute players
- **#5** Toss winner selection
- **#6** Toss decision: bat or bowl
- **#7** Ball-by-ball scoring
- **#8** Record runs: 0, 1, 2, 3, 4, 6
- **#9** Record extras: wides, no-balls, byes and leg-byes
- **#10** Record wickets and dismissal types
- **#11** Handle retired hurt and retired out
- **#12** Automatic strike rotation
- **#13** Automatic end-of-over strike changes
- **#14** Bowler selection and bowler changes
- **#15** Over and innings management
- **#16** Target calculation
- **#17** Match result calculation
- **#18** Score correction and undo
- **#19** Abandoned and tied match handling
- **#20** Live commentary
- **#21** Full batting scorecard
- **#22** Full bowling scorecard
- **#23** Match summary
- **#24** Save incomplete matches
- **#25** Resume a saved match
- **#26** Offline scoring support
- **#27** Automatic synchronisation after internet returns
- **#28** Live score sharing
- **#29** Live score updates for spectators
- **#30** Scoring history and audit trail

#### Category D – Cricket statistics and analytics (#79–102, 24 features)

- **#79** Total runs
- **#80** Batting average
- **#81** Batting strike rate
- **#82** Fours and sixes
- **#83** Highest individual score
- **#84** Half-centuries
- **#85** Centuries
- **#86** Bowling wickets
- **#87** Bowling average
- **#88** Bowling economy
- **#89** Bowling strike rate
- **#90** Best bowling figures
- **#91** Maiden overs
- **#92** Dot balls
- **#93** Catches
- **#94** Run-outs
- **#95** Stumpings
- **#96** Player of the Match
- **#97** Most Valuable Player
- **#98** Player comparison
- **#99** Team comparison
- **#100** Performance charts
- **#101** Match analysis
- **#102** Tournament statistics and leaderboards

#### Category E – Cricket laws, playing conditions and rules (#103–134, 32 features)

- **#103** MCC Laws of Cricket reference library
- **#104** ICC playing conditions reference library
- **#105** Match-specific rule configuration
- **#106** Batting and innings rules
- **#107** Bowling restrictions
- **#108** Maximum overs per bowler
- **#109** Wide-ball rules
- **#110** No-ball rules
- **#111** Free-hit rules
- **#112** LBW applicability
- **#113** Dismissal rules
- **#114** Byes and leg-byes
- **#115** Dead-ball rules
- **#116** Overthrow rules
- **#117** Short-run rules
- **#118** Boundary rules
- **#119** Powerplay configuration
- **#120** Follow-on rules
- **#121** Super Over rules
- **#122** DLS reference and calculation support
- **#123** Penalty-run rules
- **#124** Time-wasting regulations
- **#125** Umpire signals and decisions
- **#126** Match decision log
- **#127** Incident reports
- **#128** Disciplinary reports
- **#129** Ball type configuration
- **#130** Pitch and ground conditions
- **#131** Fielding restrictions
- **#132** Local tournament playing conditions
- **#133** Rules for substitutions and replacements
- **#134** Match-specific rule publishing and version history

#### Category L – Cricket calculators and tools (#216–232, 17 features)

- **#216** Run-rate calculator
- **#217** Required run-rate calculator
- **#218** Batting strike-rate calculator
- **#219** Batting average calculator
- **#220** Bowling economy calculator
- **#221** Bowling average calculator
- **#222** Net Run Rate calculator
- **#223** DLS calculation support
- **#224** Toss generator
- **#225** Team generator
- **#226** Playing XI generator
- **#227** Fixture generator
- **#228** Points table calculator
- **#229** Tournament budget calculator
- **#230** Prize distribution calculator
- **#231** Player auction calculator
- **#232** Cricket ground dimension calculator

### Phase 4 – Cricket Operations and Match Management

#### Category F – Umpire, scorer and officials management (#135–146, 12 features)

- **#135** Umpire registration
- **#136** Umpire profiles
- **#137** Scorer registration
- **#138** Scorer profiles
- **#139** Official assignments
- **#140** Official availability
- **#141** Official schedules
- **#142** Umpire and scorer feedback
- **#143** Dispute management
- **#144** Incident reporting
- **#145** Official payment records
- **#146** Officials' performance history

#### Category G – Ground and venue management (#147–159, 13 features)

- **#147** Ground registration
- **#148** Ground profile
- **#149** Ground photographs
- **#150** Ground location and map
- **#151** Pitch information
- **#152** Boundary dimensions
- **#153** Ground facilities
- **#154** Ground booking
- **#155** Ground availability calendar
- **#156** Ground rental charges
- **#157** Pitch preparation records
- **#158** Ground inspection reports
- **#159** Ground match history

#### Category Q – Team punctuality, attendance and match delay management (#299–310, 12 features)

- **#299** Team arrival check-in
- **#300** Player attendance tracking
- **#301** Match readiness status
- **#302** Automatic delay calculator
- **#303** Over deduction penalty – configurable rate (example: 1 over per 10 minutes)
- **#304** Fielding restriction penalty – configurable outside-circle limit (example: only 2 fielders outside the 30-yard circle)
- **#305** Penalty runs – configurable rate (example: 5 runs per 10 minutes awarded to the opponent)
- **#306** One penalty method per match – only one of the three methods can be active
- **#307** Penalty approval and opponent selection – select late team, benefiting opponent and authorised approver
- **#308** Repeat offender and owner accountability
- **#309** Penalty payments, appeals and exemptions
- **#310** Delay history and automatic notifications

### Phase 5 – Cricket Community and Media Ecosystem

#### Category H – Cricket community and marketplace (#160–176, 17 features)

- **#160** Cricket academies directory
- **#161** Coaching centres directory
- **#162** Cricket shops directory
- **#163** Cricket equipment listings
- **#164** Bat and ball listings
- **#165** Cricket kit rental
- **#166** Net practice facilities
- **#167** Local cricket clubs directory
- **#168** Tournament organisers directory
- **#169** Find cricket grounds
- **#170** Find umpires
- **#171** Find scorers
- **#172** Find commentators
- **#173** Find teams
- **#174** Find players
- **#175** Find tournaments
- **#176** Community listings and enquiries

#### Category I – Live streaming and media (#177–188, 12 features)

- **#177** Mobile live streaming
- **#178** YouTube live streaming integration
- **#179** Live score overlays
- **#180** Match highlights
- **#181** Match video uploads
- **#182** Player video profiles
- **#183** Tournament photo galleries
- **#184** Match photo galleries
- **#185** Promotional video creation
- **#186** Tournament posters
- **#187** Shareable scorecards and player cards
- **#188** Shareable match results

#### Category J – Branding, sponsorship and promotion (#189–199, 11 features)

- **#189** Tournament website
- **#190** Tournament QR code
- **#191** Sponsor registration
- **#192** Sponsor logos
- **#193** Sponsor banners
- **#194** Advertising placements
- **#195** Promotional campaigns
- **#196** Digital certificates
- **#197** Digital trophies and awards
- **#198** Tournament merchandise
- **#199** Tournament reports for sponsors

#### Category K – Local cricket news and learning (#200–215, 16 features)

- **#200** Local cricket news
- **#201** Tournament announcements
- **#202** Match previews
- **#203** Match reports
- **#204** Player interviews
- **#205** Local cricket stories
- **#206** Coaching tutorials
- **#207** Cricket learning guides
- **#208** Equipment guides
- **#209** Cricket rules guides
- **#210** Umpiring tutorials
- **#211** Scoring tutorials
- **#212** Cricket quizzes
- **#213** Player success stories
- **#214** Academy updates
- **#215** Community cricket updates

### Phase 6 – Business, International References and Mobile Expansion

#### Category M – International cricket rules and reference (#233–253, 21 features)

- **#233** Men's T20 International playing conditions
- **#234** Men's ODI playing conditions
- **#235** Men's Test playing conditions
- **#236** Women's T20 International playing conditions
- **#237** Women's ODI playing conditions
- **#238** ICC tournament playing conditions
- **#239** Cricket equipment regulations
- **#240** Bat regulations
- **#241** Ball regulations
- **#242** Player eligibility regulations
- **#243** Concussion replacement regulations
- **#244** Substitute player regulations
- **#245** Over-rate regulations
- **#246** DRS regulations
- **#247** Player code of conduct
- **#248** Match referee regulations
- **#249** Anti-corruption regulations
- **#250** Anti-doping regulations
- **#251** Anti-discrimination regulations
- **#252** Player disciplinary regulations
- **#253** Umpire regulations

#### Category O – Revenue and business management (#271–283, 13 features)

- **#271** Free membership
- **#272** Premium membership
- **#273** Tournament organiser packages
- **#274** Online payments
- **#275** Online tournament registration payments
- **#276** Sponsorship payments
- **#277** Invoices and receipts
- **#278** Refund management
- **#279** Subscription renewals
- **#280** Advertising revenue
- **#281** Platform commission
- **#282** Revenue dashboard
- **#283** Payment history

#### Category P – Android app and future expansion (#284–298, 15 features)

- **#284** Android player application
- **#285** Android scorer application
- **#286** Android organiser application
- **#287** Push notifications
- **#288** Offline scoring in Android
- **#289** Background synchronisation
- **#290** Deep links
- **#291** Match and tournament sharing
- **#292** QR-based registration
- **#293** Camera integration
- **#294** Ground finder using location
- **#295** Bengali language support
- **#296** Hindi language support
- **#297** Future iOS application
- **#298** Multi-language expansion

## 5. Category Q – late-arrival penalty rules (confirmed by owner)

- Three alternative methods, each with a **configurable rate**:
  1. **Over deduction** – e.g. 1 over deducted per 10 minutes late (Team A scores 100 in 10 overs; Team B arrives 20 minutes late → chases 101 in 8 overs).
  2. **Fielding restriction** – e.g. for every 5 minutes late, 1 over in which only 2 fielders may be outside the 30-yard circle.
  3. **Penalty runs** – e.g. 5 runs per 10 minutes late awarded to the opponent (30 minutes late → 15 runs).
- **Only one method may be active in a match** (#306).
- The organiser identifies the late team and the benefiting opponent; an authorised organiser or umpire must **approve** the penalty before it affects the match (#307).
- Organisers can hold team owners accountable; team owners can fine players (#308).
- Local penalty rules must be **published before the match** and must not be presented as ICC sanctions.

## 6a. Access rule – open platform (confirmed by owner, 2026-11-10)

- **Everyone who registers can do everything a cricket person needs**: create tournaments, teams and matches, score matches, choose captain / vice-captain / icon player, add players, and so on. No approval from the platform owner is needed.
- **Ownership is the only limit.** Whoever creates a tournament, team or match controls it (and can add helpers). Everyone else can view it but not change it.
- **Roles are earned automatically**, per tournament / team / match:
  - **Player (#264)** – every registered user, automatically at sign-up.
  - **Organiser (#259)** – the creator of a tournament (plus co-organisers they add), for that tournament.
  - **Team Owner (#260)** – the creator of a team, for that team.
  - **Captain (#261)** – chosen by the team owner (also vice-captain and icon player).
  - **Scorer (#262)** – the match/tournament owner, plus anyone they add as scorer for that match.
  - **Umpire (#263)** – chosen by the match/tournament owner for that match.
- **Only Admin and Super-Admin are appointed by hand** (Super-Admin only). Their job is platform safety: suspensions (#266), verification (#265), announcements and maintenance (#257).
- The #259–#264 screen shows how each role is earned and lets the Super-Admin switch individual permissions off for everyone; it never assigns these roles to individuals.

## 6. Scope and implementation principles

- **Local cricket first.** Designed for grassroots competitions, not professional cricket.
- **Website first, Android later.** One shared backend (Supabase) serves the website now and the Android apps in Phase 6.
- **Technology:** React 18 + Vite (static frontend, deployable to Hostinger) + Supabase (PostgreSQL database, authentication, storage, realtime). Node.js hosting on Hostinger is **not** required by this design.
- **Rules and licensing.** MCC Laws and ICC playing conditions are referenced and linked, not copied wholesale.
- **Feature numbers are fixed.** Large features may be split into smaller engineering tasks, but the master IDs stay the same.
- **A feature is not "complete" because code exists.** See the status definitions in `03-PROGRESS-TRACKER.md`.

## 7. Working rules (to avoid repeated or lost work)

1. One AI assistant edits the code at a time. (Currently: Claude. Antigravity is used only to run `npm run dev`.)
2. Work on one feature number at a time, in phase order.
3. For each feature: inspect → plan → build → test → owner checks in browser → update tracker → commit and push to GitHub.
4. Update `03-PROGRESS-TRACKER.md` and `08-CURRENT-STATUS.md` at the end of every work session.
5. Never renumber, rename or invent features. Supporting screens that are not in the list are recorded as *supporting* in the tracker.

## 8. Official references

- MCC Laws of Cricket: https://www.lords.org/mcc/the-laws-of-cricket
- International Cricket Council: https://www.icc-cricket.com/
