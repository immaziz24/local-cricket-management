# Local Cricket Management Platform

Website for local/grassroots cricket (React 18 + Vite frontend, Supabase backend). Android apps come later and share the same backend.

## Start of every session
1. Read `docs/08-CURRENT-STATUS.md` (where we are, next step).
2. Feature numbers and names come only from `docs/01-MASTER-BLUEPRINT.md` (310 features, A–Q, 6 phases). Never renumber, rename or invent features.
3. Status lives in `docs/03-PROGRESS-TRACKER.md`.

## Rules
- **Open platform:** every registered user can create tournaments, teams and matches and score them. Owners control what they created. Organiser / team owner / captain / scorer / umpire are earned per tournament, team or match — never handed out by the owner. Only Admin and Super-Admin are appointed by hand. See section 6a of the master blueprint.
- One feature at a time, in phase order. Finish, test and record it before starting the next.
- A feature counts as done only when it works with the real database and the owner has checked it in the browser.
- All data access goes through `src/services/dataService.js`. Views never call Supabase directly.
- Never commit secrets. `.env` holds only the Supabase URL and publishable/anon key; the service-role key never goes in the frontend.
- Only one AI assistant edits the code. Antigravity is used to run the dev server only.
- At the end of each session update `03-PROGRESS-TRACKER.md` and the session log in `08-CURRENT-STATUS.md`, then commit and push.

## Commands
- `npm run dev` – local dev server at http://localhost:5173
- `npm run build` – production build into `dist/`
