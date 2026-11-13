# 09 – Handover (13 Nov 2026)

Read this first, then `CLAUDE.md`, `docs/08-CURRENT-STATUS.md`, `docs/01-MASTER-BLUEPRINT.md` and `docs/03-PROGRESS-TRACKER.md`.

## The project
- Local Cricket website: React 18 + Vite frontend, Supabase backend (project id `cwdkvjweuyvednvoyaum`).
- Live site: https://localcricket.plateria.in. Hostinger auto-deploys from GitHub `immaziz24/local-cricket-management`, branch `main`, about 2–3 minutes after each push.
- Owner: Munna Aziz (super-admin account "Khan Aziz"). He wants short, plain explanations and pushes with GitHub Desktop.

## Where we are
- 310 features in 6 phases, categories A–Q.
- **179 working** (owner checked), **82 built and waiting for the owner's browser check**, **49 not started**.
- Phases 1–5 are built. Only **Phase 6** is left:
  - **Category M – International rules reference (#233–253, 21 features).** Reference pages: men's/women's T20I, ODI and Test playing conditions, ICC tournament conditions, equipment, bat, ball, eligibility, concussion, substitutes, over rate, DRS, code of conduct, match referee, anti-corruption, anti-doping, anti-discrimination, disciplinary and umpire regulations. Mostly content pages; best done as articles in the existing Learn section (category K code in `src/views/news/`), written in our own words (no copying ICC text).
  - **Category O – Revenue and business (#271–283, 13 features).** Memberships, organiser packages, online payments, registration and sponsorship payments, invoices, refunds, renewals, advertising, commission, revenue dashboard, payment history. Needs a payment gateway (Razorpay suits India). Card details and secret keys must never touch the frontend; use a Supabase Edge Function for the gateway's secret key and webhook.
  - **Category P – Android and future (#284–298, 15 features).** Player, scorer and organiser Android apps, push notifications, offline scoring, background sync, deep links, sharing and later items. Same Supabase backend.
- Suggested order: M (easiest), then O, then P.

## Rules that must be kept (from CLAUDE.md)
1. Feature numbers and names come only from `docs/01-MASTER-BLUEPRINT.md`. Never renumber, rename or invent features.
2. One feature at a time, in phase order. A feature is done only when it works with the real database and the owner has checked it in the browser.
3. Views never call Supabase directly. Every call goes through `src/services/supabase/supabaseClient.js` (returns `{data, error}`) and `src/services/dataService.js` (throws on error).
4. Open platform: any registered user can create tournaments, teams and matches. Owners control what they create; only Admin and Super-Admin are appointed by hand.
5. Never commit secrets. `.env` holds only the Supabase URL and the publishable/anon key. Check that no `.env` file is in a commit.
6. At the end of each session update `docs/03-PROGRESS-TRACKER.md` and the session log in `docs/08-CURRENT-STATUS.md`.

## How the database code is written
- Every change is a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_short_name.sql`, run in the Supabase SQL editor.
- Tables: RLS on; direct table access revoked from `anon` and `authenticated`.
- Writes go through `security definer` functions with `set search_path = ''`, then `revoke all ... from public` and `grant execute ... to authenticated` (and `anon` for public reads).
- Checks used inside functions: `private.require_active_user()`, `private.require_admin()`, `private.require_scorer(match)`, `private.can_run_auction(id)`. Important actions write a row to `audit_logs`.
- Note: `balls.id` is a bigint, not a uuid.

## Recent work (12 Nov 2026)
- Super-admin Control centre (edit or delete users, teams, tournaments, matches and single balls).
- Cricbuzz-style full scorecard, wagon wheel, 25-word ball commentary, scorer "Edit" on recent balls.
- Match rules step when creating a match; team creator no longer added to the squad automatically.
- Player auction in four steps (Teams → Players → Live → Results); it reads rows pasted from a registration sheet.
- Every page keeps its address after a refresh; a "new version" bar appears after deploys.

## Still waiting on the owner
- **6-digit code in the sign-up email:** Supabase → Authentication → Emails → "Confirm signup" template must include `{{ .Token }}`. The site already has the box to type the code.
- **Supabase → Authentication → URL Configuration:** Site URL `https://localcricket.plateria.in`; redirect URLs `https://localcricket.plateria.in/**` and `http://localhost:5173/**`.
- Browser checks of the 82 features marked as waiting in the tracker.
- Contact details for `src/config/site.js`.

## Commands
- `npm install`, then `npm run dev` (http://localhost:5173) and `npm run build`.
