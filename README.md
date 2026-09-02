# Ladder

Long-term LinkedIn games leaderboard for a friend group. LinkedIn only shows today's connections board; this app snapshots Queens, Patches, Wend, Mini Sudoku, and Zip, then shows stats for the 5–10 people you mark as friends.

Capture still stores every connection. The home board only renders tracked names.

You create the free Supabase and Vercel projects. This repo is the local app + Mac collector.

## 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. SQL Editor → paste and run `supabase/migrations/20260813120000_init.sql`, then `supabase/migrations/20260831160000_avatars_bucket.sql`, then `supabase/migrations/20260902120000_seasons.sql`.
3. Project Settings → API: copy **Project URL**, **anon/publishable key**, and **service role** key.

## 2. Local env

```bash
cp .env.example .env.local
```

Fill in the Supabase values, a long `CAPTURE_SECRET`, and an optional `SITE_PASSWORD`.

```bash
npm install
npx playwright install chromium
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 3. Capture today's board

First run (headed, so you can log into LinkedIn):

```bash
npm run capture:login
```

A browser window opens on the LinkedIn sign-in page. Log in there, then **press Enter in the terminal**. The script will not continue or close until you do. Stay logged in in that Chrome profile. Later runs are **headless** (no window):

```bash
npm run capture
```

That reuses `.playwright-profile`, writes `data/<game>-YYYY-MM-DD.json` for each game, copies profile photos into a public Supabase Storage bucket, and posts rows straight to Supabase (the Next server does not need to be running). You have to have finished today's puzzle for a game or its connections board may be empty. Pass `--headed` if you want to watch the browser. To capture one game:

```bash
npm run capture -- --game=zip
```

To ingest a saved file later:

```bash
npm run ingest -- data/queens-YYYY-MM-DD.json
```

If parsing returns 0 rows:

```bash
npm run capture -- --game=queens --login --dump
```

That also saves a screenshot and HTML under `data/` so we can adjust selectors.

Then open **Friends** and toggle the 5–10 people who should appear on the ladder.

## 4. Vercel

1. Create a free Vercel project from this GitHub repo (or `vercel` from the folder).
2. Add the same env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CAPTURE_SECRET`, optional `SITE_PASSWORD`.
3. Point `CAPTURE_INGEST_URL` in `.env.local` at `https://YOUR_APP.vercel.app/api/ingest` once you want the Mac collector to write to production.

Do not run the LinkedIn collector on Vercel. It needs your logged-in Chrome profile on this Mac.

## Weekday capture job

The website runs on Vercel. The LinkedIn collector does **not** — it needs Playwright plus your logged-in Chrome profile, so it only runs on this Mac. After `capture:login` works once:

```bash
npm run schedule:install
```

That installs a LaunchAgent that runs **Monday–Friday at 4:55pm local Mac time**. Logs go to `data/capture.log`.

This Mac must be **awake and logged in** at 4:55pm. Sleep or a closed lid skips that day — re-run `npm run capture` when you are back.

Unload it with `npm run schedule:uninstall`.

### Slack reminder (free)

Slack’s built-in `/remind` is free on the Free plan and runs on Slack’s servers, so it still fires if this Mac is asleep. In the channel you want, paste:

```
/remind #channel "LinkedIn games — finish Queens, Patches, Wend, Mini Sudoku, and Zip. Scores lock at 4:55pm." every weekday at 4:00pm
```

Swap `#channel` for the real channel name. Change `4:00pm` if you want a different heads-up. Slackbot posts it; no paid plan, app, or webhook required.

To cancel later: `/remind list`, then delete that reminder.

## Scoring

Among tracked friends with a visible time, **place is the score**: 1st = 1 point, 2nd = 2, …, 10th = 10. Worse than 10th still counts as 10. Totals are the sum across games; **lowest points win**.

Ties share a place and consume the slots under them (standard competition ranking). Three people tied for first all get 1; the next person is 4th and gets 4. Hiding a time, missing a captured game, or not showing up on the board counts as 10 so sitting out cannot beat playing. Season total is the sum across games in the selected season. Seasons live in the `seasons` table: `name`, `start_date`, `end_date`, and `is_active` (only one can be active). The board uses the active season unless you pass `?season=slug`. If `end_date` is null, the season runs until the day before the next season starts. Season ranking ties break on wins, then name.

LinkedIn has no public games API. The collector uses your own session to read a page you can already see. Automated access can still get the account challenged; the Friends page has a manual score form as a fallback.
