# Current Status: Local Cricket Management Platform

> **Snapshot:** 2026-11-11  
> **Read this file first at the start of every work session.**

## 1. Where we are

| Item | Status |
| :--- | :--- |
| Plan | ✅ Complete: 310 features, A–Q, 6 phases (`01-MASTER-BLUEPRINT.md`) |
| Frontend app | React 18 + Vite, runs locally at `http://localhost:5173` (`npm run dev`) |
| Database | 🟩 Supabase project **Local Cricket Management** (`cwdkvjweuyvednvoyaum`, region us-east-1, free plan). Phase 1 tables, security rules and sign-up trigger are live. |
| Real login | 🟩 Register (#254) and login/logout (#255) tested by the owner. 🟨 Password recovery (#256): code verified, new-password login to be confirmed. |
| Super-Admin | 🟩 #257 dashboard on real data; owner's account has the **super_admin** role. |
| Admin | 🟨 #258 Admin dashboard connected (members, sign-ups, verification/report queues). Awaiting owner check. |
| Phase 2: tournaments | 🟨 #31–56, #58: double elimination; logo and banner; result entry, points table, NRR, qualification, knockout bracket, winner;  groups, formats, automatic/manual fixtures, scheduling, rescheduling, calendar; and create tournament (creator = Organiser), details, team registration + organiser approval/rejection with notifications. Awaiting owner check. |
| Phase 3: statistics | 🟩 #79–102 + #57, #77, #78: everything worked out from scored balls. Statistics page (site leaderboards, compare players, compare teams + head-to-head), career stats/awards/form chart on player profile, team record on team page, Analysis tab in each match (worm, runs per over, partnerships, Player of the Match – automatic, scorer can change), leaderboards in tournament Points Table tab. |
| Phase 3: playing conditions | 🟩 Tournament default rules + per-match rules (wide/no-ball runs, free hit, LBW on/off, byes/leg-byes, max overs per bowler, retire-at, powerplay, fielding limits, boundary, written local rules), version history with change notes, teams notified. Frozen when the match starts; the scoring screen follows them (free-hit/powerplay banners, bowler quota, LBW/leg-bye hidden when off). |
| Phase 3: laws & match reports | 🟩 Laws & Rules page (own summaries + MCC/ICC links, dismissals, dead ball, overthrows, short runs, boundaries, follow-on, Super Over, penalty runs, time-wasting, umpire signals, revised-target helper). Super Over after a tie; penalty runs; follow-on; match Reports tab (decision log public; incident and disciplinary private, with notifications). |
| Phase 3: cricket tools | 🟩 Cricket Tools page (#216–232): run rate, required rate, strike rate, averages, economy, NRR, rain target, toss, team generator, Playing XI generator, fixture generator, points table, budget, prizes, auction, ground size. Runs in the browser; generators can load a squad from my teams. |
| Phase 4: officials | 🟩 Umpires & Scorers page (sign up, find by city/free date, my schedule, earnings, public profile with performance). Match page Officials: invite/accept/decline/cancel, accepted scorer gets scoring rights for that match, umpires can file reports, payments, ratings, disputes. |
| Phase 4: grounds | 🟩 Grounds page (register, search by city/facility, my bookings, requests at my grounds). Ground page: profile, photos, map + directions, pitch, boundary, facilities, charges, weekly calendar with booking requests/confirm/block/paid, pitch-preparation records, inspections, match history + stats. Match page: link match to a ground. |
| Phase 4: punctuality | 🟩 Match day tab: readiness checklist, team check-in, player attendance, automatic delay + proposed penalty, approve/reject/waive/appeal/fine. One method per match in Playing conditions (overs cut, fielding restriction, penalty runs) with rates, grace, approver, repeat threshold. Effects applied only after approval (overs cut on the late team's innings, runs to opponent, fielding banner for scorer). Team punctuality + player fines on team page; Late-arrival rules page rewritten with real data + calculator. |
| Phase 5: community | 🟩 Community page (#160–176): directory of academies, coaching, shops, nets, clubs, commentators, organisers; marketplace to sell or rent kit; find teams/players/tournaments/grounds/officials; community board; private enquiries with replies. |
| Phase 5: live & media | 🟩 (live streaming #177/#178 switched off by owner – "coming soon", admins only) Match → Video & media tab: YouTube/Facebook live stream link, score overlay for streaming apps, automatic highlights + clips, match photos/videos, result & scorecard pictures. Tournament → Photos & Media: gallery, poster, 12-s promo video. Player profile: video profile + player card. Live & Media page. Videos bucket: 20 MB per clip, 10 uploads per person (free plan has 1 GB storage). |
| Website layout (not a blueprint feature) | 🟩 Visitors: top menu (Home, Matches, Tournaments, Players, Community, More), search with "Near me" (location asked only when tapped, 30 km), Log in / Register, visitor home page, footer (Explore, For organisers, Help, Legal) + About, Contact, FAQ, Privacy, Terms, Community Guidelines, Refund pages. Members: grouped sidebar, Create menu, notifications, profile menu, My cricket home, Settings, Admin panel (admins only). Feature numbers and developer badges removed from all pages. Contact details: fill `src/config/site.js` (empty values are hidden). |
| Phase 5: branding & sponsors | 🟩 Tournament → Sponsors & promotion tab: tournament website (?t=CODE) + QR, sponsors (invite/offer/accept, logos, banners, report), adverts, campaigns, awards + certificates (?verify=CODE), merchandise shop. Sponsors page in More menu. Admin panel → Adverts & campaigns. Player profile → Trophy cabinet. |
| Phase 5: news & learning | 🟩 News page (local news, announcements, previews, reports, interviews, stories, academy and community updates; filters, search, like, share, report). Learn page (coaching, guides, equipment, rules, umpiring, scoring; levels) + quizzes with leaderboard. Tournament → News tab (organiser announcements), match → Previews & reports (auto-draft from scorecard), player profile → Interviews & stories, Community listing → Updates. Admin panel → Reported articles. 13 starter articles + 3 quizzes by the Local Cricket Coaching Desk. |
| Owner requests 2026-11-12 | 🟩 Admin panel → Control centre (find and fix users, teams, matches, tournaments, any ball). Sign-up 6-digit email code. Cricbuzz-style scorecard + wagon wheel. Match rules asked when creating a match. Generators on Matches page, match Playing XI and tournament Generators tab. Saved player auction board (Cricket tools → Player auction, ?auction=ID). Team creator not auto-added to squad. **Owner must set Supabase Auth → URL configuration: Site URL https://localcricket.plateria.in, redirect URLs https://localcricket.plateria.in/** and http://localhost:5173/**; and add {{ .Token }} to the Confirm signup email template.** |
| Phase 2: players & teams | 🟨 #59–76: playing XI, substitutes and in-match replacements per match, player transfers between teams (#72–75); player ID, photo, DOB/age, contact privacy, team logo, team history, public player profile (#60–62, #66, #67, #69, #76) added on top of My Teams page, create team, add players by mobile number (or by name if not registered — they claim it later by registering with that number), captain / vice-captain / icon player. Awaiting owner check. |
| Security & operations | 🟨 #267 audit log, #268 backup download, #269 privacy + my-data download + sign out everywhere, #270 notification inbox + send-to-all. Awaiting owner check. |
| Reports & suspension | 🟨 #266 report a member, admin suspend/lift, notifications, audit log. Awaiting owner check. |
| Verification | 🟨 #265 optional badges (person / umpire / scorer): request + admin review, notifications, audit log. Awaiting owner check. |
| Roles | 🟨 #259–264 follow the **open-platform rule** (blueprint 6a): everyone is a Player automatically; organiser/owner/captain/scorer/umpire are earned per tournament/team/match; only Admins are appointed by hand. Awaiting owner check. |
| Other data | 🟨 Everything else (admin screens, tournaments, matches, dashboard numbers) still uses mock data from `src/services/mock/`. |
| Live website | ⬜ Not deployed. Temporary domain: https://localcricket.plateria.in/ (Hostinger Business) |
| GitHub | https://github.com/immaziz24/local-cricket-management |

## 2. How the code is wired

- Screens call only `src/services/dataService.js`.
- `dataService.js` sends **auth** calls (#254–256) to `src/services/supabase/supabaseClient.js` when `.env` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; otherwise everything falls back to the mock client.
- `.env` is ignored by git. `.env.example` shows the format. Only the publishable key is used in the frontend.
- Login and password recovery currently work **by email only**. Mobile-number login needs SMS (paid) and comes later.

### Database migrations (all applied to Supabase)

| File | What it does |
| :--- | :--- |
| `20261106105506_phase1_user_management_foundation.sql` | Phase 1 tables, row-level security, profile trigger |
| `20261106105529_phase1_security_and_fk_index_hardening.sql` | Indexes and deny-rules for audit logs and templates |
| `20261110050000_phase1_profile_mobile_number.sql` | Saves name and unique mobile number on sign-up |
| `20261112120000_scorer_edit_ball.sql` | edit_ball (scorer corrects a ball of the live innings); recent balls carry shot direction |
| `20261112111000_auction_player_details.sql` | auction player ID/LC link, role, batting hand & position, bowling style, note; update_auction_player; team short name and owner |
| `20261112110000_commentary_and_batting_hand.sql` | ball commentary up to 600 characters; live state batting_side includes batting_style |
| `20261112103000_super_admin_control.sql` | admin_search, admin_get/update/delete_user, admin team/tournament/match edit + delete, admin_list_balls, admin_update_ball / admin_delete_ball (bigint ids) with innings recompute |
| `20261112102000_player_auction.sql` | auctions, auction_teams, auction_players; save/add/remove/set current/sell/unsold/undo/finish/delete/get/list auction |
| `20261112101000_wagon_wheel.sql` | balls.shot_angle, balls.shot_dist; record_ball saves them; get_wagon_wheel |
| `20261112100000_team_owner_not_auto_in_squad.sql` | create_team no longer adds the creator to the squad |
| `20261111141000_phase5_learning_starter_content.sql` | 12 learning articles, 1 community update and 3 official quizzes (24 questions) under the Super-Admin account |
| `20261111140000_phase5_news_learning.sql` | articles, article_likes, article_reports, quizzes, quiz_questions, quiz_attempts; save/get/list/like/report/moderate articles, quizzes (answers hidden until submitted), leaderboard; upload folder articles/ |
| `20261111131000_phase5_certificates_awards_merch.sql` | tournament_awards, certificates (code + verify), merch_items, merch_orders; set/remove/list awards, player_awards, issue/revoke/verify/list certificates, merchandise and orders, sponsor_report; upload folders sponsors/, sponsorships/, ads/, merch/ |
| `20261111130000_phase5_branding_sponsors.sql` | tournaments.site, page_views, sponsors, tournament_sponsors, ad_placements, promo_campaigns; tournament website, sponsors, sponsorships, adverts, campaigns functions |
| `20261111121000_site_contact_messages.sql` | contact_messages; send_contact_message (visitors and members), list_contact_messages / set_contact_message_status (admins) |
| `20261111120000_site_global_search.sql` | private.km distance; global_search (players, teams, matches, tournaments, grounds, places, officials; optional near-me radius) |
| `20261111110000_phase5_live_coming_soon.sql` | live streams admin-only ("coming soon"); list_media.can_stream admin-only |
| `20261111100000_phase5_media.sql` | videos storage bucket (20 MB, mp4/webm/mov); media_items (match/tournament/player photos, videos, highlights, live streams); can_add/can_moderate_media; add/set_file/update/delete/list_media, media_feed; gallery/ and clips/ upload folders |
| `20261111090000_phase5_community.sql` | directory_listings, market_items, community_posts, enquiries; listing/item/post/enquiry functions, list_organisers, community_search; media uploads for listings/ and items/ |
| `20261111080000_phase4_punctuality.sql` | late-arrival keys in playing conditions; matches.late_effects; match_arrivals, match_attendance, late_penalties, team_player_fines; check-in / attendance / readiness / propose / decide / appeal / fines / team punctuality; overs-cut trigger; scorer fielding-restriction banner |
| `20261111070000_phase4_grounds.sql` | grounds, ground_photos, ground_bookings, ground_pitch_logs, ground_inspections, matches.ground_id; ground/booking/calendar/log/inspection functions; media uploads for grounds/<id>/; get_match_centre adds ground_name + can_manage (applied as phase4_grounds + phase4_match_centre_ground) |
| `20261110260000_phase4_officials.sql` | official_profiles, official_unavailability, match_officials, official_feedback, match_disputes; can_manage_match, is_match_official; can_score_match includes accepted scorers; official/dispute functions; reports open to umpires |
| `20261110250000_phase3_laws_super_over_reports.sql` | innings.is_super_over / overs_limit / wickets_limit / penalty_runs, matches.pending_penalty, match_reports; start_super_over, award_penalty_runs, enforce_follow_on, add/close/list_match_reports; close_innings, sync_match_score, undo, record_ball, get_live_state, player_match_stats updated for Super Overs and penalties (applied to the database as two steps: phase3_laws_super_over_reports + phase3_laws_patches) |
| `20261110240000_phase3_playing_conditions.sql` | tournaments.rules, matches.rules (frozen at start), balls.free_hit, rule_versions; get/save_playing_conditions, get_scoring_rules; bowler quota trigger; record_ball follows the rules |
| `20261110230100_fix_player_profile_unregistered.sql` | Player profile works for players added by name only (no account) |
| `20261110230000_phase3_statistics.sql` | player_match_stats, get_player_stats, get_leaderboards, get_team_stats, get_match_analysis, search_players; Player of the Match (auto trigger + set_player_of_match) |
| `20261110220000_phase3_offline_sync.sql` | balls.client_id (unique) so re-sent offline balls are recorded once |
| `20261110210000_phase3_pause_share_history.sql` | pause/resume, auto-resume trigger, match history, Realtime publication for matches/innings/balls |
| `20261110200000_phase3_commentary_minutes.sql` | innings_crease (minutes batted), get_commentary, partnership + yet-to-bat in live state, lineup locked after start |
| `20261110190000_phase3_ball_by_ball.sql` | innings + balls tables, record_ball, set_innings_players, undo, end innings, abandon, live state, result, all-out flags for NRR |
| `20261110180000_phase3_start_match_toss.sql` | match details (overs, ball, toss, scorer), friendly matches, start_match (toss), match centre, matches list, live count |
| `20261110170000_phase2_local_cricket_setup.sql` | local-cricket tournament fields (match type, category, pitch), new create_tournament, organiser add/create/remove team |
| `20261110160000_phase2_playing_xi_transfers.sql` | match_players (playing XI, substitutes, replacements), player_transfers, lineup/transfer functions, team search, public team history filtered |
| `20261110150000_phase2_double_elimination.sql` | double_elimination format, matches.bracket |
| `20261110140000_phase2_tournament_logo_banner.sql` | tournament images in media bucket, set_tournament_image |
| `20261110130000_phase2_results_points_table.sql` | manual results, points table + NRR, rules, qualification, complete tournament, overs-from-format trigger |
| `20261110120000_phase2_groups_fixtures.sql` | tournament_groups, matches (shared with Phase 3), groups/fixtures/reschedule functions |
| `20261110113000_phase2_tournaments.sql` | tournaments, tournament_teams; create/update tournament; register/approve/reject/withdraw team |
| `20261110110000_phase2_edit_team_player.sql` | Team owner edits unregistered players in their squad |
| `20261110103000_phase2_player_profile_media.sql` | Player ID, DOB, media bucket + upload rules, photo/logo functions, public player profile, team history |
| `20261110100000_phase2_players_teams.sql` | players, teams, team_members; mobile lookup (exact, rate-limited, numbers hidden); unregistered players; claim on sign-up; captain/vice/icon |
| `20261110093000_phase1_security_operations.sql` | Audit log list, platform snapshot, my-data export, send announcement |
| `20261110090000_phase1_reporting_suspension.sql` | Member search, report, review, suspend/lift, auto-lift on login |
| `20261110083000_phase1_user_verification.sql` | Badge types, one pending request per type, request/list/review functions with notifications + audit |
| `20261110080000_phase1_open_platform_roles.sql` | Auto Player role at sign-up; hand-appointment limited to Admin/Super-Admin |
| `20261110073000_phase1_role_permissions.sql` | Roles can be platform-wide; `role_permissions` table; assign/revoke/permission functions; `private.has_permission()` for future features |
| `20261110070000_phase1_admin_dashboard.sql` | `get_admin_dashboard()` for Admin/Super-Admin |
| `20261110063000_phase1_super_admin_dashboard.sql` | Role-check helper, `platform_settings` (maintenance + announcement), Super-Admin functions with audit logging |

## 3. Who does what

- **Claude** writes and edits the code and docs, and manages the Supabase database.
- **Antigravity** is used only to run `npm run dev` / `npm run build` and view the site. Its AI chat is not used on this project.
- **Owner (Munna Aziz)** runs `npm install`, checks each feature in the browser, and pushes to GitHub.

## 4. Next steps (in order)

0. **Phase 6 in progress:** #233–236 are owner-verified. All 17 Category M articles #237–253 are published in Supabase and ready for browser checks. Categories O and P are next.

   **Remaining order:** Category M (21 features), then O (13) and P (15). Phase 5 (Categories H, I, J, K) done 2026-11-11.
1. **Owner check of #265** (Category N → User Governance → Verification): request a badge, approve it. Push to GitHub (today's work is not on GitHub yet).
2. **Phase 3:** Category A (live scoring #1–30) complete. **Category D statistics (#79–102) complete** on the real database, together with Phase 2 #57, #77, #78 (Statistics page, player profile stats, team record, match Analysis tab, tournament leaderboards, automatic Player of the Match). **Category E batch 1 – playing conditions (#105–112, #114, #118, #119, #129–134) complete; scoring follows them.** **Category E batch 2 complete** (laws reference, Super Over, follow-on, penalty runs, DLS helper, match reports). **Category L calculators (#216–232) built – Phase 3 complete.** **Phase 4 started – Category F officials (#135–146) complete.** **Category G grounds (#147–159) complete.** **Category Q (#299–310) complete – Phase 4 complete.** **Next: Phase 5** (community and media).
3. **Phase 2** in number order: #31 Create a tournament (connect to database), #32 Tournament name and branding, #33, …

## 5. Known issues

- **Live test site:** https://localcricket.plateria.in (Hostinger, built from GitHub `main`; every push re-deploys automatically). Build settings: Node 22, Vite, `npm run build`, output `dist`. Hostinger holds VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as build variables. Supabase Auth → URL Configuration must list this address for sign-up / password-reset links.

- Offline scoring: the page itself opens offline only on the published site (service worker is off while developing). End innings / abandon / undo of uploaded balls need internet.

- Dashboard overview cards still show sample data (Matches page, header and sidebar live count are now real).

- The Tournament Details page was labelled "#32". It is a supporting screen; #32 in the master list is "Tournament name and branding". UI labels will be corrected when Phase 2 work resumes.
- Dashboard statistics (4 tournaments, 32 teams, 520 players, 2 live matches) are fake sample data.
- Maintenance mode currently shows a notice to everyone; it does not yet block any actions. Blocking will be added as write features become real.
- Recovery codes are 8 digits (Supabase default). Can be set to 6 in Supabase → Authentication → Sign In / Providers → Email.
- Supabase's built-in email service is limited to a few emails per hour. Before launch, connect a real email provider (SMTP) in Supabase.
- Database region is us-east-1 (USA). Fine for development; consider moving closer to India (Mumbai) before launch.
- Confirmation and recovery emails come from "Supabase Auth". Connect our own email provider so they come from "Local Cricket" before launch.

## 6. Test checklist for #254–256

1. `npm install` (adds `@supabase/supabase-js`), then `npm run dev`.
2. **Register** with a real email and a 10-digit mobile number → success message says a confirmation link was sent.
3. Open the email and click the confirmation link.
4. **Login** with that email and password → profile card shows your name. Refresh the page and open Login again → you are still signed in.
5. **Logout** → signed out.
6. **Register again** with the same email → error "already exists". With a different email but the same mobile → error "mobile number already exists".
7. **One-time setup for the code:** Supabase dashboard → Authentication → Emails → **Reset Password** template → add the line `Your code is: {{ .Token }}` → Save.
8. **Password recovery**: enter your email → a 6-digit code arrives by email → enter it → set a new password → log in with the new password.

## 7. Session log

| Date | Who | What |
| :--- | :--- | :--- |
| 2026-11-13 | Codex | Phase 6 #233: prepared the Learn → Rules article using the October 2026 ICC conditions. Owner ran the migration and verified the article in the browser. |
| 2026-11-13 | Codex | Phase 6 #234: prepared the Men's ODI rules article. Owner ran the migration and verified the article in the browser. |
| 2026-11-13 | Codex | Phase 6 #235: ran the Men's Test rules migration and confirmed the article is published in Supabase. Owner verified in the browser. |
| 2026-11-13 | Codex | Phase 6 #236: published the Women's T20 International rules article in Supabase. Owner confirmed the article works. |
| 2026-11-13 | Codex | Owner requested batching. Published and confirmed all 17 remaining Category M reference articles (#237–253) in Supabase. Owner browser checks pending. |
| 2026-11-05 → 11-10 | ChatGPT + Antigravity | Blueprint PDF; Phase 1 screens; #31 screen; tournament details page; Supabase project and first two migrations |
| 2026-11-10 | Claude | Took over. Full 310-feature list added to docs; tracker rewritten with honest statuses; CLAUDE.md added |
| 2026-11-11 | Claude | Phase 4 – Category Q punctuality (12 features) – Phase 4 complete |
| 2026-11-11 | Claude | Phase 5 – Category H community & marketplace (17 features) |
| 2026-11-11 | Claude | Phase 5 – Category I live streaming & media (12 features); owner set live streaming to "coming soon" |
| 2026-11-11 | Claude | Website layout: premium header with search + Near me (30 km), visitor and member layouts, home pages, footer and info pages, contact messages; feature numbers removed from pages |
| 2026-11-11 | Claude | Phase 5 – Category J branding, sponsorship & promotion (11 features) |
| 2026-11-11 | Claude | Phase 5 – Category K news & learning (16 features): News and Learn pages, articles, quizzes, starter content – Phase 5 complete |
| 2026-11-12 | Claude | Owner requests (3): every page keeps its address (refresh / Back stay on the page, ?page=…&id=…), new-version Refresh banner, scorer Edit ball, auction in four steps with player number / ID search and team result cards |
| 2026-11-12 | Claude | Owner requests (2): automatic 25+ word commentary for every ball, Undo also between overs / at innings break, wagon wheel pop-up with cancel and change-runs, full auction player details and team rows |
| 2026-11-12 | Claude | Owner requests: admin Control centre (fix any user/match/ball), sign-up email code, international scorecard + wagon wheel, match rules on creation, generators in matches/tournaments, saved auction board, no auto squad for team creator |
| 2026-11-11 | Claude | Phase 4 – Category G grounds (13 features): register, photos, map, pitch/boundary/facilities, booking + calendar + prices, pitch records, inspections, match history |
| 2026-11-10 | Claude | Phase 4 – Category F officials (12 features): sign-up, search, invitations, scoring rights, availability, schedule, payments, ratings, disputes, history |
| 2026-11-10 | Claude | Category L: Cricket Tools page (17 calculators/generators) – Phase 3 complete |
| 2026-11-10 | Claude | Category E batch 2 (15 features): Laws & Rules page, Super Over, penalty runs, follow-on, DLS helper, match Reports tab – Category E complete |
| 2026-11-10 | Claude | Category E batch 1: playing conditions (17 features) – rules editor, versions, enforced in ball-by-ball scoring |
| 2026-11-10 | Claude | Category D statistics #79–102 + #57, #77, #78 (Statistics page, MVP points, Player of the Match, comparisons, charts, match analysis). Fixed player profile error for players without an account |
| 2026-11-10 | Claude | Deployed to https://localcricket.plateria.in via Hostinger Git auto-deploy (owner connected GitHub) |
| 2026-11-10 | Claude | Offline scoring + auto sync (#26–27); live tab shows full batter/bowler tables; fixed a stale-file copy to the laptop |
| 2026-11-10 | Claude | Pause/resume, continue scoring, share link (?match=), Realtime live updates (tested), History tab (#24, #25, #28–30) |
| 2026-11-10 | Claude | Commentary tab, scorecard M (minutes) column, partnership, yet to bat, match summary; owner scored a real match |
| 2026-11-10 | Claude | Fixed blank Tournaments page (missing icon import). Ball-by-ball scoring #7–19 with scorecard |
| 2026-11-10 | Claude | Phase 3 start: real Matches page, start a match, Playing XI, toss (#1–6); real live-match count |
| 2026-11-10 | Claude | Local-cricket rework after owner feedback: new Create Tournament form (overs number, ball/pitch/category, players a side), organiser adds or creates teams, honest tournament summary |
| 2026-11-10 | Claude | Playing XI, substitutes, replacements, transfers (#72–75) |
| 2026-11-10 | Claude | Double elimination (#46); tracker summary tables refreshed |
| 2026-11-10 | Claude | Tournament logo, banner and colour (#33) |
| 2026-11-10 | Claude | Results entry, points table, NRR, qualification, knockout bracket, winner (#53–56, #58) |
| 2026-11-10 | Claude | Groups, formats, automatic fixtures, scheduling, rescheduling, calendar |
| 2026-11-10 | Claude | Tournaments on real database: create, team registration, approval |
| 2026-11-10 | Claude | Fixed empty squad bug (hidden column); added Edit player. Owner checked teams, squad, captain/VC/icon, edit |
| 2026-11-10 | Claude | Player ID, photos, logos, DOB/age, contact privacy, player profile page, team history |
| 2026-11-10 | Claude | Phase 2 started: players & teams with add-by-mobile (CricHeroes-style) |
| 2026-11-10 | Claude | #267–270 on real data — all 17 Phase 1 features connected |
| 2026-11-10 | Claude | #266 Reporting and suspension on real data |
| 2026-11-10 | Claude | #265 User verification on real data |
| 2026-11-10 | Claude | Owner confirmed open-platform rule; roles reworked: auto Player, admins-only appointment; rule added to blueprint 6a and CLAUDE.md |
| 2026-11-10 | Claude | #259–264 roles: permissions stored in database, give/remove roles, lock-out protection |
| 2026-11-10 | Claude | #258 Admin dashboard on real data; hub page shows real per-feature status |
| 2026-11-10 | Claude | #257 Super-Admin dashboard on real data; owner granted super_admin role; site-wide announcement + maintenance banner |
| 2026-11-10 | Claude | Header shows signed-in user + Sign Out; sidebar shows database status. Owner tested register + login successfully |
| 2026-11-10 | Claude | Mobile-number migration applied; real Supabase register/login/logout/password recovery wired in; mock hints hidden when real accounts are on |
