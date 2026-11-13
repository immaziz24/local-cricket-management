# Progress Tracker: Cricnotch

> **Last Updated:** 2026-11-13
> **Feature list:** see `01-MASTER-BLUEPRINT.md` (310 features, A–Q, 6 phases)  

## 1. Status definitions

| Symbol | Meaning |
| :---: | :--- |
| ⬜ | Not started |
| 🟨 | Built or prepared, awaiting database or owner browser verification |
| 🟩 | Working with the **real database** (Supabase) |
| ✅ | Verified by the project owner in the browser and pushed to GitHub |

## 2. Overall

| Status | Features |
| :--- | :---: |
| ✅ Verified | 4 / 310 |
| 🟩 Working (real database) | 179 / 310 |
| 🟨 Built or prepared, awaiting verification | 115 / 310 |
| ⬜ Not started | 12 / 310 |

**Honest summary (2026-11-10, Phase 3):** Phase 1 done (17). Phase 2 all 48 built. Phase 3: Category A scoring (30) built; Category D statistics (#79–#102) connected to the real database, together with Phase 2 #57, #77, #78. Category E (32) complete: playing conditions, laws reference, Super Over, follow-on, penalty runs, DLS helper, decision/incident/disciplinary reports. Category L (17) built – **Phase 3 complete (103/103 built)**. **Phase 4 complete (37/37 connected)**: officials, grounds, punctuality & late-arrival rules. **Phase 5: Category H community & marketplace (17) Category I live streaming & media (12) Category J branding, sponsorship & promotion (11) and Category K news & learning (16) connected – Phase 5 complete (56/56 built).** Next: Phase 6, Category M.

**Phase 2 summary:** 45 of 48 built; #57, #77, #78 waited for ball-by-ball scoring.

**Phase 1 summary:** all 17 Phase 1 features are connected to the real database; #254, #255, #257 checked by owner, the rest await a quick owner check.

**Earlier summary:** #254 and #255 work end-to-end on the real database (owner tested). #256 password recovery is connected and awaiting test. All other screens still use sample data.

## 3. By phase

| Phase | Categories | Total | ⬜ | 🟨 | 🟩 | ✅ |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | N | 17 | 0 | 14 | 3 | 0 |
| 2 | B, C | 48 | 0 | 36 | 12 | 0 |
| 3 | A, D, E, L | 103 | 0 | 30 | 73 | 0 |
| 4 | F, G, Q | 37 | 0 | 0 | 37 | 0 |
| 5 | H, I, J, K | 56 | 0 | 2 | 54 | 0 |
| 6 | M, O, P | 49 | 12 | 33 | 0 | 4 |

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
| 254 | User registration | 🟩 | RegisterView.jsx — real Supabase account; owner tested 2026-11-10 (email confirmed, name + mobile saved) **updated 2026-11-12** – sign-up shows a 6-digit code box (code from the email) plus the link; resend code; login offers the code box if the email is not confirmed. |
| 255 | User login and logout | 🟩 | LoginView.jsx + Header — real Supabase login; owner tested 2026-11-10. Header shows user + Sign Out |
| 256 | Password recovery | 🟨 | auth/PasswordRecoveryView.jsx — connected; code email + verification confirmed in database 2026-11-10. Awaiting owner confirmation that new-password login works |
| 257 | Super-admin dashboard | 🟩 | admin/SuperAdminDashboardView.jsx — real data, maintenance mode, site-wide announcement; owner checked 2026-11-10 **updated 2026-11-12** – Control centre: search any user/team/match/tournament; edit name, mobile, status, confirm email; Super-Admin deletes accounts (teams/tournaments move to Super-Admin); fix match results and balls. |
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
| 71 | Squad management | 🟩 | **connected 2026-11-10** – teams/TeamDetailView.jsx — squad list, add by mobile / by name, remove (max 40). Owner checked 2026-11-10 **updated 2026-11-12** – creating a team no longer puts the creator in the squad; "Add me to the squad" button instead. |
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
| 8 | Record runs: 0, 1, 2, 3, 4, 6 | 🟨 | **connected 2026-11-10** – buttons 0,1,2,3,4,6 (+5,7 for overthrows). Tested in DB. Awaiting owner check **updated 2026-11-12** – wagon wheel: after tapping 1–7 runs the scorer taps where the ball went (can be switched off); shown on scorecard and Analysis. **updated 2026-11-12 (2)** – wagon wheel opens as a pop-up: tap outside or Cancel to close without saving, change the runs inside it; off/leg side shown for right- and left-handers. |
| 9 | Record extras: wides, no-balls, byes and leg-byes | 🟨 | **connected 2026-11-10** – wide, no-ball (+1 run each), bye, leg-bye; extras shown on the scorecard. Tested in DB. Awaiting owner check |
| 10 | Record wickets and dismissal types | 🟨 | **connected 2026-11-10** – wicket button: bowled, caught, c&b, lbw, run out (either batter), stumped, hit wicket, obstructing, timed out; fielder recorded. Tested in DB. Awaiting owner check |
| 11 | Handle retired hurt and retired out | 🟨 | **connected 2026-11-10** – retired hurt (can bat again) and retired out. Tested in DB. Awaiting owner check |
| 12 | Automatic strike rotation | 🟨 | **connected 2026-11-10** – strike changes on odd runs automatically. Tested in DB. Awaiting owner check |
| 13 | Automatic end-of-over strike changes | 🟨 | **connected 2026-11-10** – batters change ends at the end of each over; new bowler asked for. Tested in DB. Awaiting owner check |
| 14 | Bowler selection and bowler changes | 🟨 | **connected 2026-11-10** – pick openers, next batter after a wicket, and bowler each over; same bowler cannot bowl two overs in a row. Tested in DB. Awaiting owner check |
| 15 | Over and innings management | 🟨 | **connected 2026-11-10** – overs counted (legal balls only); innings ends when all out (players a side − 1), overs done or target reached; next innings opens automatically. Tested in DB. Awaiting owner check |
| 16 | Target calculation | 🟨 | **connected 2026-11-10** – target = first innings + 1; runs needed, balls left, current and required run rate. Tested in DB. Awaiting owner check |
| 17 | Match result calculation | 🟨 | **connected 2026-11-10** – result worked out: won by X runs / won by N wickets / tied; feeds points table and NRR. Tested in DB. Awaiting owner check |
| 18 | Score correction and undo | 🟨 | **connected 2026-11-10** – Undo the last ball (also re-opens a finished innings or match). Tested in DB. Awaiting owner check **updated 2026-11-12** – Admin panel → Control centre: admins can fix or delete any ball of any match; totals, over numbers, scorecard and stats rebuild; audited. **updated 2026-11-12 (2)** – Undo also shows between overs and at the innings break. **updated 2026-11-12 (3)** – the scorer can tap Edit on any recent ball of the live innings and correct runs / byes / leg byes / wide or no-ball runs; totals, figures and commentary rebuild; recorded in History. |
| 19 | Abandoned and tied match handling | 🟨 | **connected 2026-11-10** – abandon with a reason (no result); tie detected automatically. Finish match is available in the live and paused match header. Tested in DB. Awaiting owner check |
| 20 | Live commentary | 🟨 | **connected 2026-11-10** – match page → Commentary tab: every ball written out (FOUR!, SIX!, OUT! c X b Y 7(3)), scorer's note, end-of-over summary; refreshes every 10 s. Awaiting owner check **updated 2026-11-12** – every ball gets automatic commentary of 25+ simple words (runs, boundaries, wides, no-balls, byes, leg-byes, every wicket type) with the shot direction from the wagon wheel and the score; the scorer can add a note.. Added Over tab with horizontal, colour-coded delivery chips and commentary fallback for older deliveries. |
| 21 | Full batting scorecard | 🟨 | **connected 2026-11-10** – Scorecard tab: R, B, 4s, 6s, SR, M (minutes at the crease), how out, extras, fall of wickets; partnership and yet-to-bat on the live screen. Awaiting owner check **updated 2026-11-12** – international-style scorecard: innings tabs, coloured innings bar, (c)/(wk), batting/yet to bat, extras, total with RR, fall of wickets, partnerships, wagon wheel per batter. |
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
| 132 | Local tournament playing conditions | 🟩 | **connected 2026-11-10** – free-text local rules (batting, bowling, boundary, fielding, ground, substitutes, other) **updated 2026-11-12** – new match form asks the main rules (bowler overs, wide/no-ball runs, free hit) with presets and optional rules (LBW, byes, powerplay, retire, boundary, local rules). |
| 133 | Rules for substitutions and replacements | 🟩 | **connected 2026-11-10** – max substitutes shown; substitute rules notes; in-match replacements (#74) |
| 134 | Match-specific rule publishing and version history | 🟩 | **connected 2026-11-10** – Save & publish creates a new version with a change note; version history; approved teams notified |

**Category L – Cricket calculators and tools**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 216 | Run-rate calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – run rate |
| 217 | Required run-rate calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – required run rate, runs/balls needed |
| 218 | Batting strike-rate calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – batting strike rate |
| 219 | Batting average calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – batting average |
| 220 | Bowling economy calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – bowling economy |
| 221 | Bowling average calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – bowling average + bowling strike rate |
| 222 | Net Run Rate calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – multi-match NRR, all-out counts full quota |
| 223 | DLS calculation support | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – rain target helper (run-rate + DLS-style resources) |
| 224 | Toss generator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – fair digital coin toss (secure random) |
| 225 | Team generator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – balanced teams from a list or one of my teams (ratings, keepers spread) **updated 2026-11-12** – also on the Matches page and the tournament Generators tab. |
| 226 | Playing XI generator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – suggested XI with keeper and bowling options + batting order; can load my team squad **updated 2026-11-12** – also "Suggest a Playing XI" in the match Playing XI picker, Matches page and tournament Generators tab.. Added 12 lineup graphic styles and direct Android Downloads saving on Android 10+. Owner check pending. |
| 227 | Fixture generator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – league / home-away / knockout fixtures with optional dates; copy list **updated 2026-11-12** – also on the tournament Generators tab with its teams filled in. |
| 228 | Points table calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – points table with NRR from entered results |
| 229 | Tournament budget calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – costs vs entry fees + sponsorship, break-even fee |
| 230 | Prize distribution calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – prize split by %, rounding |
| 231 | Player auction calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – auction purse: remaining, max bid keeping base price for open slots **updated 2026-11-12** – saved auction board (like the GCPL sheet): purses, base price, bid step, numbered players, on the block, sold/unsold/undo, totals (budget, used, remaining, bought, places left, average, max next bid, minimum required), live link, CSV, print; tournament auctions. **updated 2026-11-12 (2)** – players have auction number, player ID (an LC- ID links the registered player and fills name, role, batting, bowling), role, batting hand, batting position, bowling style, base price, note; add one by one or paste many; edit any player; teams have short name, owner/captain and can be added from your own teams. **updated 2026-11-12 (3)** – auction page in four steps (Teams, Players, Live auction, Results); type a player number, LC ID or name to bring the player up, sell to a team at a price; team cards with every bought player and details; old calculator removed. |
| 232 | Cricket ground dimension calculator | 🟩 | **built 2026-11-10** – Cricket Tools page (runs in the browser, nothing saved, no database needed) – ground size from boundary distances (yards, rope length, area) |

### Phase 4 – Cricket Operations and Match Management

**Category F – Umpire, scorer and officials management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 135 | Umpire registration | 🟩 | **connected 2026-11-10** – Umpires & Scorers page: anyone signs up as umpire (open platform, no approval) |
| 136 | Umpire profiles | 🟩 | **connected 2026-11-10** – public official profile (city, experience, languages, fee, bio, verified badge, stats) |
| 137 | Scorer registration | 🟩 | **connected 2026-11-10** – sign up as scorer (same profile; umpire and/or scorer) |
| 138 | Scorer profiles | 🟩 | **connected 2026-11-10** – public scorer profile |
| 139 | Official assignments | 🟩 | **connected 2026-11-10** – match owner invites umpire/scorer/third umpire/referee; official accepts/declines; accepted scorer can score that match; cancel/withdraw; notifications |
| 140 | Official availability | 🟩 | **connected 2026-11-10** – usual weekdays + blocked dates; search by free date; invite refused on a blocked day |
| 141 | Official schedules | 🟩 | **connected 2026-11-10** – My schedule: invitations (accept/decline), upcoming and past matches |
| 142 | Umpire and scorer feedback | 🟩 | **connected 2026-11-10** – match owner and both team owners rate officials 1–5 with comment after the match |
| 143 | Dispute management | 🟩 | **connected 2026-11-10** – team owners raise disputes (optionally about an official); match owner reviews/resolves; notifications |
| 144 | Incident reporting | 🟩 | **connected 2026-11-10** – umpires (accepted officials) can file and close match reports (incidents) as well as scorers |
| 145 | Official payment records | 🟩 | **connected 2026-11-10** – fee + paid/unpaid + note per assignment; official sees paid/due earnings; fees private |
| 146 | Officials' performance history | 🟩 | **connected 2026-11-10** – performance history: matches as umpire/scorer, rating, feedback, reports filed, disputes, match list |

**Category G – Ground and venue management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 147 | Ground registration | 🟩 | **connected 2026-11-11** – Grounds page: anyone registers a ground and manages it (open platform) |
| 148 | Ground profile | 🟩 | **connected 2026-11-11** – ground profile: address, contact, description, owner, stats |
| 149 | Ground photographs | 🟩 | **connected 2026-11-11** – photo upload to storage (grounds/<id>/), cover photo, delete; max 20 |
| 150 | Ground location and map | 🟩 | **connected 2026-11-11** – latitude/longitude (or "use my location"), OpenStreetMap map, Google Maps directions |
| 151 | Pitch information | 🟩 | **connected 2026-11-11** – pitch type, number of pitches, pitch notes |
| 152 | Boundary dimensions | 🟩 | **connected 2026-11-11** – straight/square boundary (m) + boundary notes |
| 153 | Ground facilities | 🟩 | **connected 2026-11-11** – 14 facilities to tick; search by facility |
| 154 | Ground booking | 🟩 | **connected 2026-11-11** – request booking → owner confirms/rejects; owner can add bookings and block slots; cancel; mark paid; overlap checks; notifications; requests list |
| 155 | Ground availability calendar | 🟩 | **connected 2026-11-11** – weekly availability calendar (busy slots public, details only for owner/booker) |
| 156 | Ground rental charges | 🟩 | **connected 2026-11-11** – hourly / half-day / full-day rates + evening extra; price worked out per booking |
| 157 | Pitch preparation records | 🟩 | **connected 2026-11-11** – pitch preparation records (rolled, watered, mowed… + condition) |
| 158 | Ground inspection reports | 🟩 | **connected 2026-11-11** – inspection reports with 4 ratings + fit for play (owner, or organiser/officials of a match there); owner notified if unfit |
| 159 | Ground match history | 🟩 | **connected 2026-11-11** – match owner links a match to a ground; ground match history + stats (avg 1st-innings score, highest total, batting first vs chasing) |

**Category Q – Team punctuality, attendance and match delay management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 299 | Team arrival check-in | 🟩 | **connected 2026-11-11** – Match day: team check-in (now or set time, players present) by team owner, match owner or official; other team notified |
| 300 | Player attendance tracking | 🟩 | **connected 2026-11-11** – player attendance: present / late / absent from squad + Playing XI |
| 301 | Match readiness status | 🟩 | **connected 2026-11-11** – readiness checklist (both teams in, enough players, XIs, scorer, umpire, ground, no penalty waiting) |
| 302 | Automatic delay calculator | 🟩 | **connected 2026-11-11** – delay worked out from scheduled start; penalty proposed automatically at check-in; delay calculator on Late-arrival rules page |
| 303 | Over deduction penalty – configurable rate (example: 1 over per 10 minutes) | 🟩 | **connected 2026-11-11** – overs cut for the late team (e.g. 1 over / 10 min) – applied to its innings when approved |
| 304 | Fielding restriction penalty – configurable outside-circle limit (example: only 2 fielders outside the 30-yard circle) | 🟩 | **connected 2026-11-11** – fielding restriction (e.g. 1 over / 5 min, max 2 outside circle) – banner for the scorer |
| 305 | Penalty runs – configurable rate (example: 5 runs per 10 minutes awarded to the opponent) | 🟩 | **connected 2026-11-11** – penalty runs to the opponent (e.g. 5 / 10 min) – added to their innings (or when they bat) |
| 306 | One penalty method per match – only one of the three methods can be active | 🟩 | **connected 2026-11-11** – only one method per match (playing conditions; falls back to tournament penalty policy) |
| 307 | Penalty approval and opponent selection – select late team, benefiting opponent and authorised approver | 🟩 | **connected 2026-11-11** – late team + benefiting opponent recorded; approval by organiser (or umpire if allowed) before it affects the match; logged in Reports |
| 308 | Repeat offender and owner accountability | 🟩 | **connected 2026-11-11** – repeat-offender count and flag (threshold in rules); organiser fines the late team; team owner fines players |
| 309 | Penalty payments, appeals and exemptions | 🟩 | **connected 2026-11-11** – appeal by late team owner; uphold or waive (exemption with reason, effect reversed); fines paid/unpaid |
| 310 | Delay history and automatic notifications | 🟩 | **connected 2026-11-11** – team punctuality history (team page, Late-arrival rules page) + notifications at check-in, proposal, approval, appeal, waive, fines |

### Phase 5 – Cricket Community and Media Ecosystem

**Category H – Cricket community and marketplace**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 160 | Cricket academies directory | 🟩 | **connected 2026-11-11** – Community → Directory → Academies. Tested in DB |
| 161 | Coaching centres directory | 🟩 | **connected 2026-11-11** – Directory → Coaching centres. Tested in DB |
| 162 | Cricket shops directory | 🟩 | **connected 2026-11-11** – Directory → Cricket shops (shop items shown on listing). Tested in DB |
| 163 | Cricket equipment listings | 🟩 | **connected 2026-11-11** – Community → Marketplace: sell/rent equipment with photo, status, enquiries. Tested in DB |
| 164 | Bat and ball listings | 🟩 | **connected 2026-11-11** – Marketplace → Bats & balls filter. Tested in DB |
| 165 | Cricket kit rental | 🟩 | **connected 2026-11-11** – Marketplace → Kit for rent (rent per day + deposit). Tested in DB |
| 166 | Net practice facilities | 🟩 | **connected 2026-11-11** – Directory → Net practice. Tested in DB |
| 167 | Local cricket clubs directory | 🟩 | **connected 2026-11-11** – Directory → Clubs. Tested in DB |
| 168 | Tournament organisers directory | 🟩 | **connected 2026-11-11** – Directory → Tournament organisers (from real tournaments). Tested in DB |
| 169 | Find cricket grounds | 🟩 | **connected 2026-11-11** – Community → Find → Grounds page. Tested in DB |
| 170 | Find umpires | 🟩 | **connected 2026-11-11** – Find → Umpires (officials page). Tested in DB |
| 171 | Find scorers | 🟩 | **connected 2026-11-11** – Find → Scorers (officials page). Tested in DB |
| 172 | Find commentators | 🟩 | **connected 2026-11-11** – Directory → Commentators. Tested in DB |
| 173 | Find teams | 🟩 | **connected 2026-11-11** – Find → Teams (name/city). Tested in DB |
| 174 | Find players | 🟩 | **connected 2026-11-11** – Find → Players (name/ID/role/city; private profiles hidden). Tested in DB |
| 175 | Find tournaments | 🟩 | **connected 2026-11-11** – Find → Tournaments (status / registration open). Tested in DB |
| 176 | Community listings and enquiries | 🟩 | **connected 2026-11-11** – Community board (players/team/match/ground/officials wanted) + private enquiries with replies and notifications. Tested in DB |

**Category I – Live streaming and media**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 177 | Mobile live streaming | 🟨 | **built 2026-11-11, switched off by owner: "coming soon"** – only Admin/Super-Admin can add a stream until it is switched on. Match → Video & media: add a YouTube/Facebook live link streamed from a phone; plays on the match page and Live & Media page; team owners notified; step-by-step phone guide. The website does not encode video itself. Tested in DB |
| 178 | YouTube live streaming integration | 🟨 | **built 2026-11-11, switched off by owner: "coming soon"** – only Admin/Super-Admin can add a stream until it is switched on. YouTube live/replay links embedded in the match page (link-based; no YouTube account connection). Tested in DB |
| 179 | Live score overlays | 🟩 | **connected 2026-11-11** – Transparent score overlay page (?overlay=<match>, bar or corner box) refreshing every 5 s for Larix / Prism / StreamYard / OBS. Tested in DB |
| 180 | Match highlights | 🟩 | **connected 2026-11-11** – Automatic key moments from ball-by-ball (wickets, 4s, 6s, 50s, 100s, 3/5-wicket hauls) + highlight clips with over. Tested in DB |
| 181 | Match video uploads | 🟩 | **connected 2026-11-11** – Match videos: upload short clips (max 20 MB, 10 per person) or YouTube/Facebook/Instagram links; hide/delete. Tested in DB |
| 182 | Player video profiles | 🟩 | **connected 2026-11-11** – Player profile → Video profile (player or their team owner adds clips). Tested in DB |
| 183 | Tournament photo galleries | 🟩 | **connected 2026-11-11** – Tournament → Photos & Media: photo gallery (organiser + owners of approved teams), auto-shrunk uploads, lightbox. Tested in DB |
| 184 | Match photo galleries | 🟩 | **connected 2026-11-11** – Match → Video & media: match photo gallery (organiser, officials, team owners, players). Tested in DB |
| 185 | Promotional video creation | 🟩 | **connected 2026-11-11** – Tournament → 12-second vertical promo video recorded in the browser; share, download or save to tournament. Tested in DB |
| 186 | Tournament posters | 🟩 | **connected 2026-11-11** – Tournament poster picture from tournament details, 5 colour themes; share / download / WhatsApp text. Tested in DB |
| 187 | Shareable scorecards and player cards | 🟩 | **connected 2026-11-11** – Scorecard picture (match) and player card picture (player profile). Tested in DB |
| 188 | Shareable match results | 🟩 | **connected 2026-11-11** – Result card picture with scores, winner, top batters/bowlers, Player of the Match; WhatsApp text + link. Tested in DB |

**Category J – Branding, sponsorship and promotion**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 189 | Tournament website | 🟩 | **connected 2026-11-11** – Tournament website at ?t=CODE: hero, live/fixtures, results, points table, top players, teams, awards, photos, shop, contact; organiser picks theme, sections, contact and social links. Tested in DB |
| 190 | Tournament QR code | 🟩 | **connected 2026-11-11** – QR code for the tournament website (own QR generator, verified by decoding); copy, download, print, share; certificates carry a verify QR too. Tested in DB |
| 191 | Sponsor registration | 🟩 | **connected 2026-11-11** – Sponsors page: businesses register free (logo, website, phone, city), sponsor profile with tournaments sponsored; up to 5 per person. Tested in DB |
| 192 | Sponsor logos | 🟩 | **connected 2026-11-11** – Sponsor logos with tier (title, powered by, gold…) on tournament page, website and match pages; organiser invites → sponsor accepts, or sponsor offers → organiser accepts. Tested in DB |
| 193 | Sponsor banners | 🟩 | **connected 2026-11-11** – Sponsor banner per sponsorship (organiser or sponsor uploads); shown at the top of tournament page and website. Tested in DB |
| 194 | Advertising placements | 🟩 | **connected 2026-11-11** – Advert placements: admins on home page / matches / match pages / footer, organisers on their tournament page, website and match pages; dates, pause, views and clicks counted. Tested in DB |
| 195 | Promotional campaigns | 🟩 | **connected 2026-11-11** – Promotional campaigns (up to 3 at a time, max 60 days) shown in “Promoted” on the home page, local city first; views/clicks; admins can hide. Tested in DB |
| 196 | Digital certificates | 🟩 | **connected 2026-11-11** – Digital certificates (participation, winners, awards…) as printable A4 pictures with code + QR; public check page ?verify=CODE; organiser can withdraw. Tested in DB |
| 197 | Digital trophies and awards | 🟩 | **connected 2026-11-11** – Tournament awards (champions, runners-up, player of the tournament, best batter/bowler/fielder…) with suggestions from stats; trophy cabinet on player profile; certificates issued automatically. Tested in DB |
| 198 | Tournament merchandise | 🟩 | **connected 2026-11-11** – Tournament merchandise shop: items with photo, sizes, stock; order requests; organiser confirms / paid / ready / delivered; stock cannot be oversold; payment directly to organiser for now. Tested in DB |
| 199 | Tournament reports for sponsors | 🟩 | **connected 2026-11-11** – Sponsor report (organiser and sponsor only): page views, advert impressions/clicks, campaign views, photos, certificates, runs/sixes/wickets, awards; print / save as PDF. Tested in DB |

**Category K – Local cricket news and learning**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 200 | Local cricket news | 🟩 | **connected 2026-11-11** – News page: anyone writes local news; feed with filters, search, featured first; like, share, report. Tested in DB |
| 201 | Tournament announcements | 🟩 | **connected 2026-11-11** – tournament News tab + overview: only the organiser can post (marked Official). Tested in DB |
| 202 | Match previews | 🟩 | **connected 2026-11-11** – match page: write a preview, auto-filled from fixture details; official if written by the match manager/official. Tested in DB |
| 203 | Match reports | 🟩 | **connected 2026-11-11** – match page "Previews & reports": report auto-drafted from the real scorecard (top batters, bowlers, Player of the Match). Tested in DB |
| 204 | Player interviews | 🟩 | **connected 2026-11-11** – player profile: interviews; the player is notified and can hide an article about them. Tested in DB |
| 205 | Local cricket stories | 🟩 | **connected 2026-11-11** – News: stories and local news, with town/city, cover picture and YouTube video. Tested in DB |
| 206 | Coaching tutorials | 🟩 | **connected 2026-11-11** – Learn page: coaching tips (starter: batting and bowling basics), level filter. Tested in DB |
| 207 | Cricket learning guides | 🟩 | **connected 2026-11-11** – Learn: guides (starter: cricket in five minutes, planning a tournament). Tested in DB |
| 208 | Equipment guides | 🟩 | **connected 2026-11-11** – Learn: equipment (starter: choosing a bat, balls and safety gear). Tested in DB |
| 209 | Cricket rules guides | 🟩 | **connected 2026-11-11** – Learn: rules (starter: ways to be out, wides/no-balls/free hits). Tested in DB |
| 210 | Umpiring tutorials | 🟩 | **connected 2026-11-11** – Learn: umpiring (starter: signals, positioning & LBW checklist). Tested in DB |
| 211 | Scoring tutorials | 🟩 | **connected 2026-11-11** – Learn: scoring (starter: how to score on Local Cricket, reading a scorecard/NRR). Tested in DB |
| 212 | Cricket quizzes | 🟩 | **connected 2026-11-11** – quizzes: anyone plays, members' best scores on a leaderboard, answers shown after finishing; members make quizzes; 3 official starter quizzes. Tested in DB |
| 213 | Player success stories | 🟩 | **connected 2026-11-11** – player profile: success stories; player notified. Tested in DB |
| 214 | Academy updates | 🟩 | **connected 2026-11-11** – Community listing (academy, coaching centre, club, nets): only the owner posts updates (Official). Tested in DB |
| 215 | Community cricket updates | 🟩 | **connected 2026-11-11** – community updates on News; admins hide/feature; reported articles in Admin panel. Tested in DB |

### Phase 6 – Business, International References and Mobile Expansion

**Category M – International cricket rules and reference**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 233 | Men's T20 International playing conditions | ✅ | Migration ran and owner verified in the browser on 2026-11-13. |
| 234 | Men's ODI playing conditions | ✅ | Migration ran and owner verified in the browser on 2026-11-13. |
| 235 | Men's Test playing conditions | ✅ | Owner verified in the browser on 2026-11-13. |
| 236 | Women's T20 International playing conditions | ✅ | Published in Supabase and owner verified in the browser on 2026-11-13. |
| 237 | Women's ODI playing conditions | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 238 | ICC tournament playing conditions | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 239 | Cricket equipment regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 240 | Bat regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 241 | Ball regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 242 | Player eligibility regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 243 | Concussion replacement regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 244 | Substitute player regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 245 | Over-rate regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 246 | DRS regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 247 | Player code of conduct | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 248 | Match referee regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 249 | Anti-corruption regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 250 | Anti-doping regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 251 | Anti-discrimination regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 252 | Player disciplinary regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |
| 253 | Umpire regulations | 🟨 | Published in Supabase on 2026-11-13. Owner browser check pending. |

**Category O – Revenue and business management**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 271 | Free membership | 🟨 | Signed-in accounts show the default free membership in Settings. Owner browser check pending. |
| 272 | Premium membership | ⬜ |  |
| 273 | Tournament organiser packages | ⬜ |  |
| 274 | Online payments | ⬜ |  |
| 275 | Online tournament registration payments | ⬜ |  |
| 276 | Sponsorship payments | ⬜ |  |
| 277 | Invoices and receipts | 🟨 | Browser receipt download added. Invoice issuance, payment integration and owner check pending. |
| 278 | Refund management | ⬜ |  |
| 279 | Subscription renewals | ⬜ |  |
| 280 | Advertising revenue | ⬜ |  |
| 281 | Platform commission | ⬜ |  |
| 282 | Revenue dashboard | 🟨 | Admin report connected. Payment capture integration and browser check pending. |
| 283 | Payment history | 🟨 | Member history connected. Payment capture integration and browser check pending. |

**Category P – Android app and future expansion**

| # | Feature | Status | Notes |
| :---: | :--- | :---: | :--- |
| 284 | Android player application | 🟨 | Play menu opens My teams and Players & Stats on Android v0.8.0. Owner flow check pending. |
| 285 | Android scorer application | 🟨 | Android Score shortcut opens My matches for signed-in scorers. Full scoring flow check pending. |
| 286 | Android organiser application | 🟨 | Organise menu opens Tournaments and Create tournament on Android v0.8.0. Owner flow check pending. |
| 287 | Push notifications | ⬜ |  |
| 288 | Offline scoring in Android | 🟨 | Cached match page can reopen offline after an online visit. Tablet scoring check pending. |
| 289 | Background synchronisation | 🟨 | Queued scoring retries on reconnect and return to the app. Sync while closed is pending. |
| 290 | Deep links | 🟨 | Android link handling implemented. Public domain association and link checks pending. |
| 291 | Match and tournament sharing | 🟨 | Website match and tournament links can be shared. Android share sheet connected for match and tournament links. Device checks pending. |
| 292 | QR-based registration | 🟨 | Organiser can display a QR link to the tournament Teams tab. Scan and registration check pending. |
| 293 | Camera integration | 🟨 | Android image upload chooser includes camera capture. Owner upload check pending. |
| 294 | Ground finder using location | 🟨 | Android location permission wired to existing Near me search. Tablet check pending. |
| 295 | Bengali language support | 🟨 | Android navigation and signed-in web menus use Bengali when the device or browser uses Bengali. Signed-in web menu language can be selected in Settings. Page translations and owner check pending. |
| 296 | Hindi language support | 🟨 | Android navigation and signed-in web menus use Hindi when the device or browser uses Hindi. Signed-in web menu language can be selected in Settings. Page translations and owner check pending. |
| 297 | Future iOS application | ⬜ |  |
| 298 | Multi-language expansion | ⬜ |  |
