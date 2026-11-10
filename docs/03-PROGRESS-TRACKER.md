# Progress Tracker: Local Cricket Management Platform

> **Last Updated:** 2026-11-10  
> **Feature list:** see `01-MASTER-BLUEPRINT.md` (310 features, A–Q, 6 phases)  

## 1. Status definitions

| Symbol | Meaning |
| :---: | :--- |
| ⬜ | Not started |
| 🟨 | Screen built with **mock (fake) data** — nothing is saved, no real login |
| 🟩 | Working with the **real database** (Supabase) |
| ✅ | Verified by the project owner in the browser and pushed to GitHub |

## 2. Overall

| Status | Features |
| :--- | :---: |
| ✅ Verified | 0 / 310 |
| 🟩 Working (real database) | 3 / 310 |
| 🟨 Screen only (mock data) | 15 / 310 |
| ⬜ Not started | 292 / 310 |

**Honest summary (2026-11-10, end of Phase 1 build):** all 17 Phase 1 features are connected to the real database; #254, #255, #257 checked by owner, the rest await a quick owner check.

**Earlier summary:** #254 and #255 work end-to-end on the real database (owner tested). #256 password recovery is connected and awaiting test. All other screens still use sample data.

## 3. By phase

| Phase | Categories | Total | ⬜ | 🟨 | 🟩 | ✅ |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | N | 17 | 0 | 14 | 3 | 0 |
| 2 | B, C | 48 | 47 | 1 | 0 | 0 |
| 3 | A, D, E, L | 103 | 103 | 0 | 0 | 0 |
| 4 | F, G, Q | 37 | 37 | 0 | 0 | 0 |
| 5 | H, I, J, K | 56 | 56 | 0 | 0 | 0 |
| 6 | M, O, P | 49 | 49 | 0 | 0 | 0 |

## 4. Supporting screens (not numbered features)

| Screen | File | Notes |
| :--- | :--- | :--- |
| Dashboard overview | `views/DashboardOverview.jsx` | Shows mock statistics. Numbers are fake until the database is connected. |
| Tournaments list | `views/TournamentsView.jsx` | Lists tournaments from the mock store. |
| Tournament details page | `views/TournamentDetailsView.jsx` | Was labelled "#32" by mistake. **#32 is "Tournament name and branding"** in the master list. This page is a supporting screen. |
| Live match centre | `views/MatchesView.jsx` | Mock scoreboards only. Real scoring is Category A (Phase 3). |
| Late-arrival rules info | `views/PenaltyRulesView.jsx` | Information page. Category Q features (#299–310) are not built yet. |
| Category N hub | `views/CategoryNView.jsx` | Navigation hub for Phase 1 admin screens. |

## 5. Feature-by-feature status

### Phase 1 – Foundation and User Management

**Category N – Administration, security and user management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 254 | User registration | 🟩 | RegisterView.jsx — real Supabase account; owner tested 2026-11-10 (email confirmed, name + mobile saved) |
| 255 | User login and logout | 🟩 | LoginView.jsx + Header — real Supabase login; owner tested 2026-11-10. Header shows user + Sign Out |
| 256 | Password recovery | 🟨 | auth/PasswordRecoveryView.jsx — connected; code email + verification confirmed in database 2026-11-10. Awaiting owner confirmation that new-password login works |
| 257 | Super-admin dashboard | 🟩 | admin/SuperAdminDashboardView.jsx — real data, maintenance mode, site-wide announcement; owner checked 2026-11-10 |
| 258 | Admin dashboard | 🟨 | admin/AdminDashboardView.jsx — **connected 2026-11-10**: members, recent sign-ups, verification + report queues (Admin or Super-Admin). Tournament/team/dispute queues arrive with Phases 2 and 4. Awaiting owner check |
| 259 | Organiser permissions | 🟨 | admin/RolePermissionsView.jsx — open-platform rule: earned by creating a tournament (built in Phase 2). Permission rules stored in database (Super-Admin can switch off). Awaiting owner check |
| 260 | Team owner permissions | 🟨 | admin/RolePermissionsView.jsx — open-platform rule: earned by creating a team (Phase 2). Permission rules stored in database (Super-Admin can switch off). Awaiting owner check |
| 261 | Captain permissions | 🟨 | admin/RolePermissionsView.jsx — open-platform rule: chosen by team owner (Phase 2). Permission rules stored in database (Super-Admin can switch off). Awaiting owner check |
| 262 | Scorer permissions | 🟨 | admin/RolePermissionsView.jsx — open-platform rule: match/tournament owner + added scorers (Phase 3). Permission rules stored in database (Super-Admin can switch off). Awaiting owner check |
| 263 | Umpire permissions | 🟨 | admin/RolePermissionsView.jsx — open-platform rule: chosen by match owner (Phase 3/4). Permission rules stored in database (Super-Admin can switch off). Awaiting owner check |
| 264 | Player permissions | 🟨 | admin/RolePermissionsView.jsx — open-platform rule: automatic for every user at sign-up — live now. Permission rules stored in database (Super-Admin can switch off). Awaiting owner check |
| 265 | User verification | 🟨 | admin/UserVerificationView.jsx — **connected 2026-11-10**: any user requests a badge (Verified person / umpire / scorer); Admin/Super-Admin approve or reject with reason; user notified; audit-logged. Awaiting owner check |
| 266 | User reporting and suspension | 🟨 | admin/UserReportingSuspensionView.jsx — **connected 2026-11-10**: any user reports a member (name search); Admin/Super-Admin resolve/dismiss, suspend for N days or indefinitely, lift; member notified; login blocked while suspended; expired suspensions lift automatically; audit-logged. Awaiting owner check |
| 267 | Activity and audit logs | 🟨 | admin/AuditLogsView.jsx — **connected 2026-11-10**: real log of every admin/user action, search, CSV export (Admin/Super-Admin). Awaiting owner check |
| 268 | Database backup | 🟨 | admin/DatabaseBackupView.jsx — **connected 2026-11-10**: Super-Admin downloads full JSON snapshot (audited). Automatic daily backups need Supabase paid plan. Awaiting owner check |
| 269 | Security and privacy management | 🟨 | admin/SecurityPrivacyView.jsx — **connected 2026-11-10**: privacy settings, download my data (DPDP), sign out of all devices. 2FA later. Awaiting owner check |
| 270 | Notifications management | 🟨 | admin/NotificationsManagementView.jsx — **connected 2026-11-10**: inbox, mark read, preferences, admin send-to-all. Email/push/SMS delivery later. Awaiting owner check |

### Phase 2 – Core Cricket Platform

**Category B – Tournament management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 31 | Create a tournament | 🟨 | CreateTournamentView.jsx — saves to mock store only |
| 32 | Tournament name and branding | ⬜ |  |
| 33 | Tournament logo and banner | ⬜ |  |
| 34 | Tournament start and end dates | ⬜ |  |
| 35 | Tournament location | ⬜ |  |
| 36 | Tournament registration | ⬜ |  |
| 37 | Registration fees | ⬜ |  |
| 38 | Prize money details | ⬜ |  |
| 39 | Tournament rules and regulations | ⬜ |  |
| 40 | Team registration | ⬜ |  |
| 41 | Team approval and rejection | ⬜ |  |
| 42 | Group creation | ⬜ |  |
| 43 | League format | ⬜ |  |
| 44 | Knockout format | ⬜ |  |
| 45 | Round-robin format | ⬜ |  |
| 46 | Double-elimination format | ⬜ |  |
| 47 | Custom tournament formats | ⬜ |  |
| 48 | Automatic fixture generation | ⬜ |  |
| 49 | Manual fixture creation | ⬜ |  |
| 50 | Match scheduling | ⬜ |  |
| 51 | Match rescheduling | ⬜ |  |
| 52 | Tournament calendar | ⬜ |  |
| 53 | Points table | ⬜ |  |
| 54 | Net Run Rate calculation | ⬜ |  |
| 55 | Qualification management | ⬜ |  |
| 56 | Knockout brackets | ⬜ |  |
| 57 | Tournament leaderboards | ⬜ |  |
| 58 | Tournament completion and winner declaration | ⬜ |  |

**Category C – Player and team management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 59 | Player registration | 🟨 | **connected 2026-11-10** – teams/TeamDetailView.jsx — every user is a player automatically; team owners add players by mobile number, or by name if not registered; claim on sign-up with same mobile. Awaiting owner check |
| 60 | Player profile | 🟨 | **connected 2026-11-10** – teams/PlayerProfileView.jsx — public profile: ID, photo, role, styles, age, badges, teams; privacy respected. Awaiting owner check |
| 61 | Player profile photograph | 🟨 | **connected 2026-11-10** – photo upload (2 MB JPG/PNG/WEBP, Supabase Storage 'media' bucket) — own photo, or players you added who aren't registered. Awaiting owner check |
| 62 | Player ID | 🟨 | **connected 2026-11-10** – automatic Player ID LC-000001…. Awaiting owner check |
| 63 | Batting style | 🟨 | **connected 2026-11-10** – My player profile + add-player form. Awaiting owner check |
| 64 | Bowling style | 🟨 | **connected 2026-11-10** – My player profile + add-player form. Awaiting owner check |
| 65 | Player role | 🟨 | **connected 2026-11-10** – My player profile + add-player form. Awaiting owner check |
| 66 | Age and date of birth | 🟨 | **connected 2026-11-10** – date of birth in My player profile; others see only age. Awaiting owner check |
| 67 | Contact information and privacy settings | 🟨 | **connected 2026-11-10** – contact shown on profile only if player allows (Security & Privacy settings); profile visibility everyone/members/only me. Awaiting owner check |
| 68 | Team profile | 🟨 | **connected 2026-11-10** – teams/TeamsView.jsx + TeamDetailView.jsx — create team (name, short name, city); creator becomes team owner. Logo later (#69). Awaiting owner check |
| 69 | Team logo | 🟨 | **connected 2026-11-10** – team owner uploads logo on team page. Awaiting owner check |
| 70 | Captain and vice-captain assignment | 🟨 | **connected 2026-11-10** – teams/TeamDetailView.jsx — captain, vice-captain and icon player; registered captain gets Captain role for that team. Awaiting owner check |
| 71 | Squad management | 🟨 | **connected 2026-11-10** – teams/TeamDetailView.jsx — squad list, add by mobile / by name, remove (max 40). Awaiting owner check |
| 72 | Playing XI management | ⬜ | Waiting: needs matches — built with scoring (Phase 3) |
| 73 | Substitute management | ⬜ | Waiting: needs matches — Phase 3 |
| 74 | Player replacements | ⬜ | Waiting: needs matches — Phase 3 |
| 75 | Player transfers | ⬜ | Waiting: needs tournament transfer rules — built with tournaments |
| 76 | Team history | 🟨 | **connected 2026-11-10** – team page timeline: created, joined/left, leadership, logo changes. Awaiting owner check |
| 77 | Player career statistics | ⬜ | Waiting: needs scored matches — Phase 3 |
| 78 | Player awards and achievements | ⬜ | Waiting: needs matches/tournaments — Phase 3 |

### Phase 3 – Cricket Scoring and Intelligence Engine

**Category A – Local live scoring**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 1 | Create a new cricket match | ⬜ |  |
| 2 | Select participating teams | ⬜ |  |
| 3 | Add playing XI | ⬜ |  |
| 4 | Add substitute players | ⬜ |  |
| 5 | Toss winner selection | ⬜ |  |
| 6 | Toss decision: bat or bowl | ⬜ |  |
| 7 | Ball-by-ball scoring | ⬜ |  |
| 8 | Record runs: 0, 1, 2, 3, 4, 6 | ⬜ |  |
| 9 | Record extras: wides, no-balls, byes and leg-byes | ⬜ |  |
| 10 | Record wickets and dismissal types | ⬜ |  |
| 11 | Handle retired hurt and retired out | ⬜ |  |
| 12 | Automatic strike rotation | ⬜ |  |
| 13 | Automatic end-of-over strike changes | ⬜ |  |
| 14 | Bowler selection and bowler changes | ⬜ |  |
| 15 | Over and innings management | ⬜ |  |
| 16 | Target calculation | ⬜ |  |
| 17 | Match result calculation | ⬜ |  |
| 18 | Score correction and undo | ⬜ |  |
| 19 | Abandoned and tied match handling | ⬜ |  |
| 20 | Live commentary | ⬜ |  |
| 21 | Full batting scorecard | ⬜ |  |
| 22 | Full bowling scorecard | ⬜ |  |
| 23 | Match summary | ⬜ |  |
| 24 | Save incomplete matches | ⬜ |  |
| 25 | Resume a saved match | ⬜ |  |
| 26 | Offline scoring support | ⬜ |  |
| 27 | Automatic synchronisation after internet returns | ⬜ |  |
| 28 | Live score sharing | ⬜ |  |
| 29 | Live score updates for spectators | ⬜ |  |
| 30 | Scoring history and audit trail | ⬜ |  |

**Category D – Cricket statistics and analytics**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 79 | Total runs | ⬜ |  |
| 80 | Batting average | ⬜ |  |
| 81 | Batting strike rate | ⬜ |  |
| 82 | Fours and sixes | ⬜ |  |
| 83 | Highest individual score | ⬜ |  |
| 84 | Half-centuries | ⬜ |  |
| 85 | Centuries | ⬜ |  |
| 86 | Bowling wickets | ⬜ |  |
| 87 | Bowling average | ⬜ |  |
| 88 | Bowling economy | ⬜ |  |
| 89 | Bowling strike rate | ⬜ |  |
| 90 | Best bowling figures | ⬜ |  |
| 91 | Maiden overs | ⬜ |  |
| 92 | Dot balls | ⬜ |  |
| 93 | Catches | ⬜ |  |
| 94 | Run-outs | ⬜ |  |
| 95 | Stumpings | ⬜ |  |
| 96 | Player of the Match | ⬜ |  |
| 97 | Most Valuable Player | ⬜ |  |
| 98 | Player comparison | ⬜ |  |
| 99 | Team comparison | ⬜ |  |
| 100 | Performance charts | ⬜ |  |
| 101 | Match analysis | ⬜ |  |
| 102 | Tournament statistics and leaderboards | ⬜ |  |

**Category E – Cricket laws, playing conditions and rules**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 103 | MCC Laws of Cricket reference library | ⬜ |  |
| 104 | ICC playing conditions reference library | ⬜ |  |
| 105 | Match-specific rule configuration | ⬜ |  |
| 106 | Batting and innings rules | ⬜ |  |
| 107 | Bowling restrictions | ⬜ |  |
| 108 | Maximum overs per bowler | ⬜ |  |
| 109 | Wide-ball rules | ⬜ |  |
| 110 | No-ball rules | ⬜ |  |
| 111 | Free-hit rules | ⬜ |  |
| 112 | LBW applicability | ⬜ |  |
| 113 | Dismissal rules | ⬜ |  |
| 114 | Byes and leg-byes | ⬜ |  |
| 115 | Dead-ball rules | ⬜ |  |
| 116 | Overthrow rules | ⬜ |  |
| 117 | Short-run rules | ⬜ |  |
| 118 | Boundary rules | ⬜ |  |
| 119 | Powerplay configuration | ⬜ |  |
| 120 | Follow-on rules | ⬜ |  |
| 121 | Super Over rules | ⬜ |  |
| 122 | DLS reference and calculation support | ⬜ |  |
| 123 | Penalty-run rules | ⬜ |  |
| 124 | Time-wasting regulations | ⬜ |  |
| 125 | Umpire signals and decisions | ⬜ |  |
| 126 | Match decision log | ⬜ |  |
| 127 | Incident reports | ⬜ |  |
| 128 | Disciplinary reports | ⬜ |  |
| 129 | Ball type configuration | ⬜ |  |
| 130 | Pitch and ground conditions | ⬜ |  |
| 131 | Fielding restrictions | ⬜ |  |
| 132 | Local tournament playing conditions | ⬜ |  |
| 133 | Rules for substitutions and replacements | ⬜ |  |
| 134 | Match-specific rule publishing and version history | ⬜ |  |

**Category L – Cricket calculators and tools**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 216 | Run-rate calculator | ⬜ |  |
| 217 | Required run-rate calculator | ⬜ |  |
| 218 | Batting strike-rate calculator | ⬜ |  |
| 219 | Batting average calculator | ⬜ |  |
| 220 | Bowling economy calculator | ⬜ |  |
| 221 | Bowling average calculator | ⬜ |  |
| 222 | Net Run Rate calculator | ⬜ |  |
| 223 | DLS calculation support | ⬜ |  |
| 224 | Toss generator | ⬜ |  |
| 225 | Team generator | ⬜ |  |
| 226 | Playing XI generator | ⬜ |  |
| 227 | Fixture generator | ⬜ |  |
| 228 | Points table calculator | ⬜ |  |
| 229 | Tournament budget calculator | ⬜ |  |
| 230 | Prize distribution calculator | ⬜ |  |
| 231 | Player auction calculator | ⬜ |  |
| 232 | Cricket ground dimension calculator | ⬜ |  |

### Phase 4 – Cricket Operations and Match Management

**Category F – Umpire, scorer and officials management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 135 | Umpire registration | ⬜ |  |
| 136 | Umpire profiles | ⬜ |  |
| 137 | Scorer registration | ⬜ |  |
| 138 | Scorer profiles | ⬜ |  |
| 139 | Official assignments | ⬜ |  |
| 140 | Official availability | ⬜ |  |
| 141 | Official schedules | ⬜ |  |
| 142 | Umpire and scorer feedback | ⬜ |  |
| 143 | Dispute management | ⬜ |  |
| 144 | Incident reporting | ⬜ |  |
| 145 | Official payment records | ⬜ |  |
| 146 | Officials' performance history | ⬜ |  |

**Category G – Ground and venue management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 147 | Ground registration | ⬜ |  |
| 148 | Ground profile | ⬜ |  |
| 149 | Ground photographs | ⬜ |  |
| 150 | Ground location and map | ⬜ |  |
| 151 | Pitch information | ⬜ |  |
| 152 | Boundary dimensions | ⬜ |  |
| 153 | Ground facilities | ⬜ |  |
| 154 | Ground booking | ⬜ |  |
| 155 | Ground availability calendar | ⬜ |  |
| 156 | Ground rental charges | ⬜ |  |
| 157 | Pitch preparation records | ⬜ |  |
| 158 | Ground inspection reports | ⬜ |  |
| 159 | Ground match history | ⬜ |  |

**Category Q – Team punctuality, attendance and match delay management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 299 | Team arrival check-in | ⬜ |  |
| 300 | Player attendance tracking | ⬜ |  |
| 301 | Match readiness status | ⬜ |  |
| 302 | Automatic delay calculator | ⬜ |  |
| 303 | Over deduction penalty – configurable rate (example: 1 over per 10 minutes) | ⬜ |  |
| 304 | Fielding restriction penalty – configurable outside-circle limit (example: only 2 fielders outside the 30-yard circle) | ⬜ |  |
| 305 | Penalty runs – configurable rate (example: 5 runs per 10 minutes awarded to the opponent) | ⬜ |  |
| 306 | One penalty method per match – only one of the three methods can be active | ⬜ |  |
| 307 | Penalty approval and opponent selection – select late team, benefiting opponent and authorised approver | ⬜ |  |
| 308 | Repeat offender and owner accountability | ⬜ |  |
| 309 | Penalty payments, appeals and exemptions | ⬜ |  |
| 310 | Delay history and automatic notifications | ⬜ |  |

### Phase 5 – Cricket Community and Media Ecosystem

**Category H – Cricket community and marketplace**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 160 | Cricket academies directory | ⬜ |  |
| 161 | Coaching centres directory | ⬜ |  |
| 162 | Cricket shops directory | ⬜ |  |
| 163 | Cricket equipment listings | ⬜ |  |
| 164 | Bat and ball listings | ⬜ |  |
| 165 | Cricket kit rental | ⬜ |  |
| 166 | Net practice facilities | ⬜ |  |
| 167 | Local cricket clubs directory | ⬜ |  |
| 168 | Tournament organisers directory | ⬜ |  |
| 169 | Find cricket grounds | ⬜ |  |
| 170 | Find umpires | ⬜ |  |
| 171 | Find scorers | ⬜ |  |
| 172 | Find commentators | ⬜ |  |
| 173 | Find teams | ⬜ |  |
| 174 | Find players | ⬜ |  |
| 175 | Find tournaments | ⬜ |  |
| 176 | Community listings and enquiries | ⬜ |  |

**Category I – Live streaming and media**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 177 | Mobile live streaming | ⬜ |  |
| 178 | YouTube live streaming integration | ⬜ |  |
| 179 | Live score overlays | ⬜ |  |
| 180 | Match highlights | ⬜ |  |
| 181 | Match video uploads | ⬜ |  |
| 182 | Player video profiles | ⬜ |  |
| 183 | Tournament photo galleries | ⬜ |  |
| 184 | Match photo galleries | ⬜ |  |
| 185 | Promotional video creation | ⬜ |  |
| 186 | Tournament posters | ⬜ |  |
| 187 | Shareable scorecards and player cards | ⬜ |  |
| 188 | Shareable match results | ⬜ |  |

**Category J – Branding, sponsorship and promotion**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 189 | Tournament website | ⬜ |  |
| 190 | Tournament QR code | ⬜ |  |
| 191 | Sponsor registration | ⬜ |  |
| 192 | Sponsor logos | ⬜ |  |
| 193 | Sponsor banners | ⬜ |  |
| 194 | Advertising placements | ⬜ |  |
| 195 | Promotional campaigns | ⬜ |  |
| 196 | Digital certificates | ⬜ |  |
| 197 | Digital trophies and awards | ⬜ |  |
| 198 | Tournament merchandise | ⬜ |  |
| 199 | Tournament reports for sponsors | ⬜ |  |

**Category K – Local cricket news and learning**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 200 | Local cricket news | ⬜ |  |
| 201 | Tournament announcements | ⬜ |  |
| 202 | Match previews | ⬜ |  |
| 203 | Match reports | ⬜ |  |
| 204 | Player interviews | ⬜ |  |
| 205 | Local cricket stories | ⬜ |  |
| 206 | Coaching tutorials | ⬜ |  |
| 207 | Cricket learning guides | ⬜ |  |
| 208 | Equipment guides | ⬜ |  |
| 209 | Cricket rules guides | ⬜ |  |
| 210 | Umpiring tutorials | ⬜ |  |
| 211 | Scoring tutorials | ⬜ |  |
| 212 | Cricket quizzes | ⬜ |  |
| 213 | Player success stories | ⬜ |  |
| 214 | Academy updates | ⬜ |  |
| 215 | Community cricket updates | ⬜ |  |

### Phase 6 – Business, International References and Mobile Expansion

**Category M – International cricket rules and reference**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 233 | Men's T20 International playing conditions | ⬜ |  |
| 234 | Men's ODI playing conditions | ⬜ |  |
| 235 | Men's Test playing conditions | ⬜ |  |
| 236 | Women's T20 International playing conditions | ⬜ |  |
| 237 | Women's ODI playing conditions | ⬜ |  |
| 238 | ICC tournament playing conditions | ⬜ |  |
| 239 | Cricket equipment regulations | ⬜ |  |
| 240 | Bat regulations | ⬜ |  |
| 241 | Ball regulations | ⬜ |  |
| 242 | Player eligibility regulations | ⬜ |  |
| 243 | Concussion replacement regulations | ⬜ |  |
| 244 | Substitute player regulations | ⬜ |  |
| 245 | Over-rate regulations | ⬜ |  |
| 246 | DRS regulations | ⬜ |  |
| 247 | Player code of conduct | ⬜ |  |
| 248 | Match referee regulations | ⬜ |  |
| 249 | Anti-corruption regulations | ⬜ |  |
| 250 | Anti-doping regulations | ⬜ |  |
| 251 | Anti-discrimination regulations | ⬜ |  |
| 252 | Player disciplinary regulations | ⬜ |  |
| 253 | Umpire regulations | ⬜ |  |

**Category O – Revenue and business management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 271 | Free membership | ⬜ |  |
| 272 | Premium membership | ⬜ |  |
| 273 | Tournament organiser packages | ⬜ |  |
| 274 | Online payments | ⬜ |  |
| 275 | Online tournament registration payments | ⬜ |  |
| 276 | Sponsorship payments | ⬜ |  |
| 277 | Invoices and receipts | ⬜ |  |
| 278 | Refund management | ⬜ |  |
| 279 | Subscription renewals | ⬜ |  |
| 280 | Advertising revenue | ⬜ |  |
| 281 | Platform commission | ⬜ |  |
| 282 | Revenue dashboard | ⬜ |  |
| 283 | Payment history | ⬜ |  |

**Category P – Android app and future expansion**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 284 | Android player application | ⬜ |  |
| 285 | Android scorer application | ⬜ |  |
| 286 | Android organiser application | ⬜ |  |
| 287 | Push notifications | ⬜ |  |
| 288 | Offline scoring in Android | ⬜ |  |
| 289 | Background synchronisation | ⬜ |  |
| 290 | Deep links | ⬜ |  |
| 291 | Match and tournament sharing | ⬜ |  |
| 292 | QR-based registration | ⬜ |  |
| 293 | Camera integration | ⬜ |  |
| 294 | Ground finder using location | ⬜ |  |
| 295 | Bengali language support | ⬜ |  |
| 296 | Hindi language support | ⬜ |  |
| 297 | Future iOS application | ⬜ |  |
| 298 | Multi-language expansion | ⬜ |  |
