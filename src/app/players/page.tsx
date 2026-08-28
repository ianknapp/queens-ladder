import { SeasonRoster } from "@/components/season-roster";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasSupabaseConfig } from "@/lib/env";
import { listTrackedPlayers } from "@/lib/queries";
import { requireSiteAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  await requireSiteAccess();

  if (!hasSupabaseConfig()) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <p className="text-sm text-muted-foreground">Connect Supabase first.</p>
        </main>
      </>
    );
  }

  const players = await listTrackedPlayers();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search captured names to add them to the season. The full connections list stays hidden,
            and people who have not shown up on a board cannot be added.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Season roster</CardTitle>
            <CardDescription>
              {players.length} {players.length === 1 ? "friend" : "friends"} on the ladder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeasonRoster players={players} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
