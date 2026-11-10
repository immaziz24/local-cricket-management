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
| 🟩 Working (real database) | 71 / 310 |
| 🟨 Built / connected, awaiting check | 80 / 310 |
| ⬜ Not started | 159 / 310 |

**Honest summary (2026-11-10, Phase 3):** Phase 1 done (17). Phase 2 all 48 built. Phase 3: Category A scoring (30) built; Category D statistics (#79–#102) connected to the real database, together with Phase 2 #57, #77, #78. Category E (32) complete: playing conditions, laws reference, Super Over, follow-on, penalty runs, DLS helper, decision/incident/disciplinary reports. Next: Category L calculators (#216–232) – the last 17 features of Phase 3.

**Phase 2 summary:** 45 of 48 built; #57, #77, #78 waited for ball-by-ball scoring.

**Phase 1 summary:** all 17 Phase 1 features are connected to the real database; #254, #255, #257 checked by owner, the rest await a quick owner check.

**Earlier summary:** #254 and #255 work end-to-end on the real database (owner tested). #256 password recovery is connected and awaiting test. All other screens still use sample data.

## 3. By phase

| Phase | Categories | Total | ⬜ | 🟨 | 🟩 | ✅ |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | N | 17 | 0 | 14 | 3 | 0 |
| 2 | B, C | 48 | 0 | 36 | 12 | 0 |
| 3 | A, D, E, L | 103 | 17 | 30 | 56 | 0 |
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
| 31 | Create a tournament | 🟨 | **connected 2026-11-10** – CreateTournamentView.jsx on real database; creator becomes Organiser of that tournament. Awaiting owner check Reworked 2026-11-10 for local cricket (owner feedback, CricHeroes reference): overs as a number, match type, ball, pitch, category, players a side; no made-up defaults. |
| 32 | Tournament name and branding | 🟨 | **connected 2026-11-10** – name + short code + colour theme (logo/banner #33 later). Awaiting owner check |
| 33 | Tournament logo and banner | 🟨 | **connected 2026-11-10** – organiser uploads logo and banner (JPG/PNG/WEBP ≤ 2 MB) and picks the colour on the tournament page; logo shown on tournament cards; outsiders blocked (tested). Awaiting owner check |
| 34 | Tournament start and end dates | 🟨 | **connected 2026-11-10** – start/end dates. Awaiting owner check |
| 35 | Tournament location | 🟨 | **connected 2026-11-10** – venue (+ city). Awaiting owner check |
| 36 | Tournament registration | 🟨 | **connected 2026-11-10** – registration open/closed per tournament. Awaiting owner check |
| 37 | Registration fees | 🟨 | **connected 2026-11-10** – entry fee shown (paid offline; online payments in Phase 6). Awaiting owner check |
| 38 | Prize money details | 🟨 | **connected 2026-11-10** – prize money text. Awaiting owner check |
| 39 | Tournament rules and regulations | 🟨 | **connected 2026-11-10** – rules & regulations text. Awaiting owner check |
| 40 | Team registration | 🟨 | **connected 2026-11-10** – tournament page → Teams tab: team owner applies with their team; organiser notified. Awaiting owner check Organiser can also add an existing team directly or create a new team on the spot (2026-11-10). |
| 41 | Team approval and rejection | 🟨 | **connected 2026-11-10** – organiser approves / rejects with reason; team owner notified; capacity enforced. Awaiting owner check |
| 42 | Group creation | 🟨 | **connected 2026-11-10** – tournament → Fixtures tab: create 2–8 groups (random draw), move teams between groups. Awaiting owner check |
| 43 | League format | 🟨 | **connected 2026-11-10** – league: everyone plays everyone once. Awaiting owner check |
| 44 | Knockout format | 🟨 | **connected 2026-11-10** – knockout first round with byes (full brackets with #56). Awaiting owner check |
| 45 | Round-robin format | 🟨 | **connected 2026-11-10** – round-robin home & away. Awaiting owner check |
| 46 | Double-elimination format | 🟨 | **connected 2026-11-10** – out after 2 defeats; winners and losers brackets, grand final; rounds created from results (simulated 4–8 teams: 2N−2 matches). Awaiting owner check |
| 47 | Custom tournament formats | 🟨 | **connected 2026-11-10** – custom: organiser adds matches by hand. Awaiting owner check |
| 48 | Automatic fixture generation | 🟨 | **connected 2026-11-10** – automatic fixture generation (round-robin per group / league / knockout pairings), tested 3–6 teams. Awaiting owner check |
| 49 | Manual fixture creation | 🟨 | **connected 2026-11-10** – add a match by hand (teams can be TBD). Awaiting owner check |
| 50 | Match scheduling | 🟨 | **connected 2026-11-10** – automatic dates/times: first day, first time, matches per day, gap. Awaiting owner check |
| 51 | Match rescheduling | 🟨 | **connected 2026-11-10** – reschedule date/time/ground with reason; both team owners notified. Awaiting owner check |
| 52 | Tournament calendar | 🟨 | **connected 2026-11-10** – fixtures listed by day (tournament calendar). Awaiting owner check |
| 53 | Points table | 🟨 | **connected 2026-11-10** – Points table tab: P/W/L/T/NR/Pts per group, points per win/tie/no result set by organiser; results entered by hand on each fixture until Phase 3 scoring. Awaiting owner check |
| 54 | Net Run Rate calculation | 🟨 | **connected 2026-11-10** – NRR from entered scores; bowled-out team counts full overs; walkovers/no-results left out; tested (+0.500/−0.500). Awaiting owner check |
| 55 | Qualification management | 🟨 | **connected 2026-11-10** – top N per group marked Q (N set by organiser); ties broken by points, NRR, wins. Awaiting owner check |
| 56 | Knockout brackets | 🟨 | **connected 2026-11-10** – bracket view by round; "Create next round" seeds from the table (A1 v B2, 1 v 4) or pairs winners, byes for odd numbers. Awaiting owner check |
| 57 | Tournament leaderboards | 🟩 | **connected 2026-11-10** – Points Table tab: leaderboards (runs, wickets, MVP, highest scores, best bowling, sixes, SR, economy, fielding) from scored balls |
| 58 | Tournament completion and winner declaration | 🟨 | **connected 2026-11-10** – Finish tournament: winner/runner-up (filled from the final), all matches must be done, teams notified, champion banner. Awaiting owner check |

**Category C – Player and team management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 59 | Player registration | 🟩 | **connected 2026-11-10** – teams/TeamDetailView.jsx — every user is a player automatically; team owners add players by mobile number, or by name if not registered; claim on sign-up with same mobile. Owner checked 2026-11-10 |
| 60 | Player profile | 🟨 | **connected 2026-11-10** – teams/PlayerProfileView.jsx — public profile: ID, photo, role, styles, age, badges, teams; privacy respected. Awaiting owner check |
| 61 | Player profile photograph | 🟨 | **connected 2026-11-10** – photo upload (2 MB JPG/PNG/WEBP, Supabase Storage 'media' bucket) — own photo, or players you added who aren't registered. Awaiting owner check |
| 62 | Player ID | 🟩 | **connected 2026-11-10** – automatic Player ID LC-000001…. Owner checked 2026-11-10 |
| 63 | Batting style | 🟩 | **connected 2026-11-10** – My player profile + add-player form. Owner checked 2026-11-10 |
| 64 | Bowling style | 🟩 | **connected 2026-11-10** – My player profile + add-player form. Owner checked 2026-11-10 |
| 65 | Player role | 🟩 | **connected 2026-11-10** – My player profile + add-player form. Owner checked 2026-11-10 |
| 66 | Age and date of birth | 🟨 | **connected 2026-11-10** – date of birth in My player profile; others see only age. Awaiting owner check |
| 67 | Contact information and privacy settings | 🟨 | **connected 2026-11-10** – contact shown on profile only if player allows (Security & Privacy settings); profile visibility everyone/members/only me. Awaiting owner check |
| 68 | Team profile | 🟩 | **connected 2026-11-10** – teams/TeamsView.jsx + TeamDetailView.jsx — create team (name, short name, city); creator becomes team owner. Logo later (#69). Owner checked 2026-11-10 |
| 69 | Team logo | 🟨 | **connected 2026-11-10** – team owner uploads logo on team page. Awaiting owner check |
| 70 | Captain and vice-captain assignment | 🟩 | **connected 2026-11-10** – teams/TeamDetailView.jsx — captain, vice-captain and icon player; registered captain gets Captain role for that team. Owner checked 2026-11-10 |
| 71 | Squad management | 🟩 | **connected 2026-11-10** – teams/TeamDetailView.jsx — squad list, add by mobile / by name, remove (max 40). Owner checked 2026-11-10 |
| 72 | Playing XI management | 🟨 | **connected 2026-11-10** – tournament → Fixtures → Playing XI: team owner (or organiser) picks the playing side from the squad, batting order, captain and wicket-keeper; players a side set by organiser (default 11); everyone can view. Tested in DB. Awaiting owner check |
| 73 | Substitute management | 🟨 | **connected 2026-11-10** – substitutes picked with the lineup (default up to 4, organiser can change). Tested in DB. Awaiting owner check |
| 74 | Player replacements | 🟨 | **connected 2026-11-10** – in a match, swap a playing player for a substitute or squad player with a reason (injury, concussion, illness); other team notified; shown in team history. Tested in DB. Awaiting owner check |
| 75 | Player transfers | 🟨 | **connected 2026-11-10** – team page → Player transfers: ask another team for a player; that team's owner accepts (player moves) or declines with a reason; requests can be withdrawn; completed transfers in team history. Tested in DB. Awaiting owner check |
| 76 | Team history | 🟩 | **connected 2026-11-10** – team page timeline: created, joined/left, leadership, logo changes. Owner checked 2026-11-10 |
| 77 | Player career statistics | 🟩 | **connected 2026-11-10** – player profile: career batting/bowling/fielding + match-by-match list |
| 78 | Player awards and achievements | 🟩 | **connected 2026-11-10** – player profile: Player of the Match, titles, 50s/100s, 3w/5w hauls |

### Phase 3 – Cricket Scoring and Intelligence Engine

**Category A – Local live scoring**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 1 | Create a new cricket match | 🟨 | **connected 2026-11-10** – Matches page → Start a match: friendly match between any two teams; tournament fixtures also open here; creator becomes scorer. Tested in DB. Awaiting owner check |
| 2 | Select participating teams | 🟨 | **connected 2026-11-10** – pick any two teams (yours or found by search). Tested in DB. Awaiting owner check |
| 3 | Add playing XI | 🟨 | **connected 2026-11-10** – match page → Playing XI (same lineup tool as #72; size follows the match's players a side). Tested in DB. Awaiting owner check |
| 4 | Add substitute players | 🟨 | **connected 2026-11-10** – substitutes picked with the lineup (#73). Tested in DB. Awaiting owner check |
| 5 | Toss winner selection | 🟨 | **connected 2026-11-10** – match page → Toss: who won the toss. Tested in DB. Awaiting owner check |
| 6 | Toss decision: bat or bowl | 🟨 | **connected 2026-11-10** – bat or bowl first; match goes live, batting side set, team owners notified. Tested in DB. Awaiting owner check |
| 7 | Ball-by-ball scoring | 🟨 | **connected 2026-11-10** – match page → scoring pad: one tap per ball; every ball saved with who batted/bowled. Tested in DB. Awaiting owner check |
| 8 | Record runs: 0, 1, 2, 3, 4, 6 | 🟨 | **connected 2026-11-10** – buttons 0,1,2,3,4,6 (+5,7 for overthrows). Tested in DB. Awaiting owner check |
| 9 | Record extras: wides, no-balls, byes and leg-byes | 🟨 | **connected 2026-11-10** – wide, no-ball (+1 run each), bye, leg-bye; extras shown on the scorecard. Tested in DB. Awaiting owner check |
| 10 | Record wickets and dismissal types | 🟨 | **connected 2026-11-10** – wicket button: bowled, caught, c&b, lbw, run out (either batter), stumped, hit wicket, obstructing, timed out; fielder recorded. Tested in DB. Awaiting owner check |
| 11 | Handle retired hurt and retired out | 🟨 | **connected 2026-11-10** – retired hurt (can bat again) and retired out. Tested in DB. Awaiting owner check |
| 12 | Automatic strike rotation | 🟨 | **connected 2026-11-10** – strike changes on odd runs automatically. Tested in DB. Awaiting owner check |
| 13 | Automatic end-of-over strike changes | 🟨 | **connected 2026-11-10** – batters change ends at the end of each over; new bowler asked for. Tested in DB. Awaiting owner check |
| 14 | Bowler selection and bowler changes | 🟨 | **connected 2026-11-10** – pick openers, next batter after a wicket, and bowler each over; same bowler cannot bowl two overs in a row. Tested in DB. Awaiting owner check |
| 15 | Over and innings management | 🟨 | **connected 2026-11-10** – overs counted (legal balls only); innings ends when all out (players a side − 1), overs done or target reached; next innings opens automatically. Tested in DB. Awaiting owner check |
| 16 | Target calculation | 🟨 | **connected 2026-11-10** – target = first innings + 1; runs needed, balls left, current and required run rate. Tested in DB. Awaiting owner check |
| 17 | Match result calculation | 🟨 | **connected 2026-11-10** – result worked out: won by X runs / won by N wickets / tied; feeds points table and NRR. Tested in DB. Awaiting owner check |
| 18 | Score correction and undo | 🟨 | **connected 2026-11-10** – Undo the last ball (also re-opens a finished innings or match). Tested in DB. Awaiting owner check |
| 19 | Abandoned and tied match handling | 🟨 | **connected 2026-11-10** – abandon with a reason (no result); tie detected automatically. Tested in DB. Awaiting owner check |
| 20 | Live commentary | 🟨 | **connected 2026-11-10** – match page → Commentary tab: every ball written out (FOUR!, SIX!, OUT! c X b Y 7(3)), scorer's note, end-of-over summary; refreshes every 10 s. Awaiting owner check |
| 21 | Full batting scorecard | 🟨 | **connected 2026-11-10** – Scorecard tab: R, B, 4s, 6s, SR, M (minutes at the crease), how out, extras, fall of wickets; partnership and yet-to-bat on the live screen. Awaiting owner check |
| 22 | Full bowling scorecard | 🟨 | **connected 2026-11-10** – Scorecard tab: O, M, R, W, Wd, Nb, Econ. Awaiting owner check |
| 23 | Match summary | 🟨 | **connected 2026-11-10** – Scorecard tab → Match summary: result, each innings total, top 2 batters and bowlers. Awaiting owner check |
| 24 | Save incomplete matches | 🟨 | **connected 2026-11-10** – every ball is saved the moment it is scored; scorer can Pause with a reason (rain, break) – spectators see "Play stopped". Awaiting owner check |
| 25 | Resume a saved match | 🟨 | **connected 2026-11-10** – Matches page → "Your matches in progress" → Continue scoring; Resume play button; scoring a ball resumes automatically. Awaiting owner check |
| 26 | Offline scoring support | 🟨 | **connected 2026-11-10** – no internet on the ground: keep scoring; balls and player changes saved on the device, screen keeps updating with the same rules (tested); page opens offline on the published site (service worker). Awaiting owner check |
| 27 | Automatic synchronisation after internet returns | 🟨 | **connected 2026-11-10** – when the connection returns the saved balls upload by themselves in order; each ball has a device id so it is never counted twice (tested); Upload now / Discard unsent buttons. Awaiting owner check |
| 28 | Live score sharing | 🟨 | **connected 2026-11-10** – match page → Share / WhatsApp / Copy link; link ?match=<id> opens the match directly (also ?tournament=<id>). Awaiting owner check |
| 29 | Live score updates for spectators | 🟨 | **connected 2026-11-10** – Supabase Realtime: score, scorecard and commentary update the moment a ball is scored (tested); 20 s polling as fallback. Awaiting owner check |
| 30 | Scoring history and audit trail | 🟨 | **connected 2026-11-10** – match page → History tab: who scored how many balls, every undo, innings ended, pauses, lineups, replacements, with times. Awaiting owner check |

**Category D – Cricket statistics and analytics**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 79 | Total runs | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 80 | Batting average | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 81 | Batting strike rate | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 82 | Fours and sixes | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 83 | Highest individual score | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 84 | Half-centuries | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 85 | Centuries | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 86 | Bowling wickets | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 87 | Bowling average | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 88 | Bowling economy | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 89 | Bowling strike rate | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 90 | Best bowling figures | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 91 | Maiden overs | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 92 | Dot balls | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 93 | Catches | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 94 | Run-outs | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 95 | Stumpings | 🟩 | **connected 2026-11-10** – worked out from scored balls (player profile, Statistics page, leaderboards) |
| 96 | Player of the Match | 🟩 | **connected 2026-11-10** – picked automatically (most MVP points) when a match finishes; scorer can change it (Analysis tab) |
| 97 | Most Valuable Player | 🟩 | **connected 2026-11-10** – MVP points system; MVP leaderboard |
| 98 | Player comparison | 🟩 | **connected 2026-11-10** – Statistics page: compare two players side by side |
| 99 | Team comparison | 🟩 | **connected 2026-11-10** – Statistics page: compare two teams + head-to-head; team record card on team page |
| 100 | Performance charts | 🟩 | **connected 2026-11-10** – form bar chart (profile), runs-per-over and worm charts (match Analysis tab) |
| 101 | Match analysis | 🟩 | **connected 2026-11-10** – match Analysis tab: runs per over, worm, partnerships, boundaries, top performers |
| 102 | Tournament statistics and leaderboards | 🟩 | **connected 2026-11-10** – tournament leaderboards + totals; whole-site leaderboards on Statistics page |

**Category E – Cricket laws, playing conditions and rules**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 103 | MCC Laws of Cricket reference library | 🟩 | **connected 2026-11-10** – Laws & Rules page: link to the official MCC Laws + own plain-language guides |
| 104 | ICC playing conditions reference library | 🟩 | **connected 2026-11-10** – Laws & Rules page: link to ICC playing conditions |
| 105 | Match-specific rule configuration | 🟩 | **connected 2026-11-10** – tournament default rules + per-match changes until the match starts; frozen when the match goes live |
| 106 | Batting and innings rules | 🟩 | **connected 2026-11-10** – retire-at runs (scorer warned), batting notes; overs/players a side from match setup |
| 107 | Bowling restrictions | 🟩 | **connected 2026-11-10** – bowling notes; no two overs in a row (already enforced) |
| 108 | Maximum overs per bowler | 🟩 | **connected 2026-11-10** – max overs per bowler – enforced when picking the bowler |
| 109 | Wide-ball rules | 🟩 | **connected 2026-11-10** – wide runs 0/1/2 – used by scoring |
| 110 | No-ball rules | 🟩 | **connected 2026-11-10** – no-ball runs 0/1/2 – used by scoring |
| 111 | Free-hit rules | 🟩 | **connected 2026-11-10** – free hit after a no-ball (continues after wide/no-ball) – only run-out allowed; FREE HIT banner |
| 112 | LBW applicability | 🟩 | **connected 2026-11-10** – LBW on/off – LBW hidden and refused when off |
| 113 | Dismissal rules | 🟩 | **connected 2026-11-10** – dismissal guide (10 ways out, which are possible on a no-ball/free hit); scoring offers only valid dismissals |
| 114 | Byes and leg-byes | 🟩 | **connected 2026-11-10** – byes / leg-byes on/off – buttons hidden and refused when off |
| 115 | Dead-ball rules | 🟩 | **connected 2026-11-10** – dead-ball guide; logged as a Decision report |
| 116 | Overthrow rules | 🟩 | **connected 2026-11-10** – overthrow guide (enter total runs for the ball) |
| 117 | Short-run rules | 🟩 | **connected 2026-11-10** – short-run guide; logged as a Decision report |
| 118 | Boundary rules | 🟩 | **connected 2026-11-10** – boundary size + boundary rules notes |
| 119 | Powerplay configuration | 🟩 | **connected 2026-11-10** – powerplay overs – Powerplay banner while scoring |
| 120 | Follow-on rules | 🟩 | **connected 2026-11-10** – Enforce follow-on button (two-innings matches, start of innings 3); lead set in Playing conditions (default 75) |
| 121 | Super Over rules | 🟩 | **connected 2026-11-10** – Start Super Over after a tie (1 over, 1–3 wickets); repeat if tied; Super Over runs excluded from totals, NRR and stats |
| 122 | DLS reference and calculation support | 🟩 | **connected 2026-11-10** – revised-target helper: average run-rate method + resources (DLS-style) method using official table values |
| 123 | Penalty-run rules | 🟩 | **connected 2026-11-10** – scorer awards penalty runs to batting/fielding side (pending until a side bats); kept on undo; logged |
| 124 | Time-wasting regulations | 🟩 | **connected 2026-11-10** – time-wasting guide; warnings via Incident/Disciplinary reports |
| 125 | Umpire signals and decisions | 🟩 | **connected 2026-11-10** – umpire signals described in words |
| 126 | Match decision log | 🟩 | **connected 2026-11-10** – match Reports tab: decision log (public); penalty runs and Super Overs logged automatically |
| 127 | Incident reports | 🟩 | **connected 2026-11-10** – incident reports (officials, organiser, team owners can see); open/close with note |
| 128 | Disciplinary reports | 🟩 | **connected 2026-11-10** – disciplinary reports with warning/suspension/referred; team owner, organiser and player notified |
| 129 | Ball type configuration | 🟩 | **connected 2026-11-10** – ball type from match/tournament setup shown with the rules |
| 130 | Pitch and ground conditions | 🟩 | **connected 2026-11-10** – pitch type + ground notes |
| 131 | Fielding restrictions | 🟩 | **connected 2026-11-10** – fielders outside the circle (powerplay / after) – shown while scoring |
| 132 | Local tournament playing conditions | 🟩 | **connected 2026-11-10** – free-text local rules (batting, bowling, boundary, fielding, ground, substitutes, other) |
| 133 | Rules for substitutions and replacements | 🟩 | **connected 2026-11-10** – max substitutes shown; substitute rules notes; in-match replacements (#74) |
| 134 | Match-specific rule publishing and version history | 🟩 | **connected 2026-11-10** – Save & publish creates a new version with a change note; version history; approved teams notified |

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
