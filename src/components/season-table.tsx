import { PlayerAvatar } from "@/components/player-avatar";
import { GAMES } from "@/lib/games";
import { rankSeasonPlayers } from "@/lib/scoring";
import type { LadderPlayer } from "@/lib/types";
import { cn } from "@/lib/utils";

function rankClass(rank: number) {
  if (rank <= 3) return "font-medium text-foreground";
  return "text-muted-foreground";
}

export function SeasonTable({ players }: { players: LadderPlayer[] }) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Season totals appear after you add friends and capture a board.
      </p>
    );
  }

  const ranked = rankSeasonPlayers(players);
  const leaderPoints = ranked[0]?.seasonPoints ?? 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-xl text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="w-8 py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Friend</th>
            {GAMES.map((game) => (
              <th key={game.slug} className="px-2 py-2 text-right font-medium">
                {game.short}
              </th>
            ))}
            <th className="py-2 pl-3 text-right font-medium">Total</th>
            <th className="py-2 pl-3 text-right font-medium">Days</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((player) => {
            const behind = leaderPoints - player.seasonPoints;
            let share = 0;
            if (leaderPoints > 0) {
              share = Math.round((player.seasonPoints / leaderPoints) * 100);
            }

            return (
              <tr key={player.playerId} className="border-b border-border/60 last:border-0">
                <td className={cn("py-2 pr-2 tabular-nums", rankClass(player.rank))}>
                  {player.rank}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex min-w-36 items-center gap-2">
                    <PlayerAvatar src={player.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{player.displayName}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </td>
                {GAMES.map((game) => (
                  <td
                    key={game.slug}
                    className="px-2 py-2 text-right tabular-nums text-muted-foreground"
                  >
                    {player.seasonByGame[game.slug].points}
                  </td>
                ))}
                <td className="py-2 pl-3 text-right">
                  <span className="font-medium tabular-nums">{player.seasonPoints}</span>
                  {behind > 0 ? (
                    <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">
                      −{behind}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                  {player.seasonDays}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
