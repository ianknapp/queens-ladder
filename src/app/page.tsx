import { GameWinsTable } from "@/components/game-wins-table";
import { SeasonPodium, TodayPodium } from "@/components/ranking-podium";
import { SeasonTable } from "@/components/season-table";
import { SiteHeader } from "@/components/site-header";
import { TodayGrid } from "@/components/today-grid";
import { GAMES } from "@/lib/games";
import { hasSupabaseConfig } from "@/lib/env";
import { getLadder } from "@/lib/queries";
import { requireSiteAccess } from "@/lib/session";
import { formatMs } from "@/lib/time";
import type { GameMeta } from "@/lib/types";

export const dynamic = "force-dynamic";

function gameStatus(meta: GameMeta) {
  const game = GAMES.find((item) => item.slug === meta.slug);
  const label = game?.short ?? meta.slug;
  let avg = "";
  if (meta.globalAverageMs != null) {
    avg = ` · avg ${formatMs(meta.globalAverageMs)}`;
  }
  if (meta.puzzleNumber) return `${label} #${meta.puzzleNumber}${avg}`;
  if (meta.puzzleDate || meta.capturedAt) return `${label}${avg}`;
  return `${label} —`;
}

export default async function HomePage() {
  await requireSiteAccess();

  if (!hasSupabaseConfig()) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <p className="text-sm text-muted-foreground">
            Copy `.env.example` to `.env.local`, paste your Supabase URL and service role key, then
            run the SQL in `supabase/migrations`.
          </p>
        </main>
      </>
    );
  }

  const ladder = await getLadder();
  const date =
    ladder.games.find((game) => game.puzzleDate)?.puzzleDate ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Today</h1>
            <p className="text-sm text-muted-foreground">
              {date ?? "No capture yet"} · 3 / 2 / 1 per game · ties share
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {ladder.games.map(gameStatus).join(" · ")}
          </p>
          <TodayPodium players={ladder.players} />
          <TodayGrid players={ladder.players} games={ladder.games} />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Season</h2>
            <p className="text-sm text-muted-foreground">
              {ladder.trackedCount} tracked · ranked by points, then wins
            </p>
          </div>
          <SeasonPodium players={ladder.players} />
          <SeasonTable players={ladder.players} />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Game wins</h2>
            <p className="text-sm text-muted-foreground">
              ranked by firsts, then the % faster than LinkedIn average.
            </p>
          </div>
          <GameWinsTable players={ladder.players} />
        </section>
      </main>
    </>
  );
}
