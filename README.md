# Maths Quiz Live – Alliance University × Infinity Club

A Kahoot-style live quiz. Participants join with only a **game code and a name** (no account).
The admin signs in at `/#admin`, generates the code, and runs the game.

## Deploy on Vercel (about 10 minutes)

1. **Put this folder on GitHub** (new repository, upload all files, keep the folder layout: `api/`, `public/`, `package.json`).
2. On vercel.com choose **Add New → Project**, import that repository, keep the defaults (Framework: *Other*) and click **Deploy**.
3. In the project open **Storage → Create Database / Marketplace → Upstash Redis** (free plan), create it and **connect it to this project**. This adds the database variables automatically.
4. In **Settings → Environment Variables** add:
   - `ADMIN_SECRET` – any long random text (recommended)
   - Optional: `ADMIN_USER` and `ADMIN_PASS` to override the built-in login (`alliance` / `infinity80929`)
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables take effect.

If you prefer the command line: install the Vercel CLI, run `vercel` in this folder, then add the storage and variables as above and run `vercel --prod`.

## Running a quiz

1. Open `https://YOUR-PROJECT.vercel.app/#admin` and sign in.
2. Press **Generate game code**. Share the code and the site address with participants.
3. Set seconds per question (default 60), wait for players, press **Start quiz**.
4. Each question has a visible countdown on every screen. Results appear when time ends or everyone has answered.
5. At the end everyone sees the final leaderboard (players do not see the full question list). The admin sees all correct answers, and results are saved under **Past results** (with CSV download).

Admin can edit questions in the lobby (**Edit questions**).

## Notes
- Scoring: 500 to 1000 points for a correct answer, more for faster answers; ties are broken by total answer time.
- Correct answers stay on the server until each question closes, so players cannot read them from the page.
- Default admin login: `alliance` / `infinity80929`. Keep the GitHub repository **private**, because the default password is written in `api/game.js`; or set `ADMIN_USER` / `ADMIN_PASS` in Vercel instead.
- Upstash's free plan has a monthly command limit; the server caches reads to keep usage low, but check your usage after a large event.
