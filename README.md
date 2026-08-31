# Ladder

Long-term LinkedIn games leaderboard for a friend group. LinkedIn only shows today's connections board; this app snapshots Queens, Patches, Wend, Mini Sudoku, and Zip, then shows stats for the 5–10 people you mark as friends.

Capture still stores every connection. The home board only renders tracked names.

You create the free Supabase and Vercel projects. This repo is the local app + Mac collector.

## 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. SQL Editor → paste and run `supabase/migrations/20260813120000_init.sql`.
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

A browser window opens on the LinkedIn sign-in page. Log in there, then **press Enter in the terminal**. The script will not continue or close until you do. Stay logged in in that Chrome profile. Later runs:

```bash
npm run capture
```

That writes `data/<game>-YYYY-MM-DD.json` for each game and posts rows straight to Supabase (the Next server does not need to be running). You have to have finished today's puzzle for a game or its connections board may be empty. To capture one game:

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

That installs a LaunchAgent that runs **Monday–Friday at 5:00pm local Mac time**. Logs go to `data/capture.log`.

This Mac must be **awake and logged in** at 5pm. Sleep or a closed lid skips that day — re-run `npm run capture` when you are back.

Unload it with `npm run schedule:uninstall`.

## Scoring

Among tracked friends with a visible time: **3 / 2 / 1** for 1st / 2nd / 3rd, scored separately for each game (up to 15 points in a day). Season total is the sum across games. Ties break on wins, then name.

LinkedIn has no public games API. The collector uses your own session to read a page you can already see. Automated access can still get the account challenged; the Friends page has a manual score form as a fallback.
