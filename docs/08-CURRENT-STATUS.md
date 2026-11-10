# Current Status: Local Cricket Management Platform

> **Snapshot:** 2026-11-10  
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

1. **Owner check of #265** (Category N → User Governance → Verification): request a badge, approve it. Push to GitHub (today's work is not on GitHub yet).
2. **Phase 2** in number order: #31 Create a tournament (real database, creator becomes Organiser), #32 Tournament name and branding, …
3. **Phase 2** in number order: #31 Create a tournament (connect to database), #32 Tournament name and branding, #33, …

## 5. Known issues

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
| 2026-11-05 → 11-10 | ChatGPT + Antigravity | Blueprint PDF; Phase 1 screens; #31 screen; tournament details page; Supabase project and first two migrations |
| 2026-11-10 | Claude | Took over. Full 310-feature list added to docs; tracker rewritten with honest statuses; CLAUDE.md added |
| 2026-11-10 | Claude | #267–270 on real data — all 17 Phase 1 features connected |
| 2026-11-10 | Claude | #266 Reporting and suspension on real data |
| 2026-11-10 | Claude | #265 User verification on real data |
| 2026-11-10 | Claude | Owner confirmed open-platform rule; roles reworked: auto Player, admins-only appointment; rule added to blueprint 6a and CLAUDE.md |
| 2026-11-10 | Claude | #259–264 roles: permissions stored in database, give/remove roles, lock-out protection |
| 2026-11-10 | Claude | #258 Admin dashboard on real data; hub page shows real per-feature status |
| 2026-11-10 | Claude | #257 Super-Admin dashboard on real data; owner granted super_admin role; site-wide announcement + maintenance banner |
| 2026-11-10 | Claude | Header shows signed-in user + Sign Out; sidebar shows database status. Owner tested register + login successfully |
| 2026-11-10 | Claude | Mobile-number migration applied; real Supabase register/login/logout/password recovery wired in; mock hints hidden when real accounts are on |
