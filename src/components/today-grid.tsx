import { PlayerAvatar } from "@/components/player-avatar";
import { GAMES } from "@/lib/games";
import { rankTodayPlayers } from "@/lib/scoring";
import { formatMs } from "@/lib/time";
import type { GameCell, GameMeta, LadderPlayer } from "@/lib/types";
import { cn } from "@/lib/utils";

function rankClass(rank: number | null) {
  if (rank === 1) return "font-medium text-foreground";
  return "text-foreground";
}

function TimeCell({ cell }: { cell: GameCell }) {
  if (cell.visibility === "played_only") {
    return <span className="text-muted-foreground">hid</span>;
  }
  if (cell.timeMs == null) {
    return <span className="text-muted-foreground/40">—</span>;
  }
  return (
    <span className={cn("font-mono tabular-nums", rankClass(cell.friendRank))}>
      {formatMs(cell.timeMs)}
      {cell.friendRank != null && cell.friendRank <= 3 ? (
        <sup className="ml-0.5 text-[10px] font-sans font-medium text-muted-foreground">
          {cell.friendRank}
        </sup>
      ) : null}
    </span>
  );
}

export function TodayGrid({
  players,
  games,
}: {
  players: LadderPlayer[];
  games: GameMeta[];
}) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Toggle 5–10 people on the Friends page. Capture still stores everyone; only those names
        show here.
      </p>
    );
  }

  const ranked = rankTodayPlayers(players);
  const hasAverage = games.some((game) => game.globalAverageMs != null);

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
            <th className="py-2 pl-3 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((player) => {
            let rankTone = "text-muted-foreground";
            if (player.rank <= 3) rankTone = "font-medium text-foreground";

            return (
              <tr key={player.playerId} className="border-b border-border/60 last:border-0">
                <td className={cn("py-2 pr-2 tabular-nums", rankTone)}>{player.rank}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar src={player.avatarUrl} />
                    <span className="truncate">{player.displayName}</span>
                  </div>
                </td>
                {GAMES.map((game) => (
                  <td key={game.slug} className="px-2 py-2 text-right">
                    <TimeCell cell={player.today[game.slug]} />
                  </td>
                ))}
                <td className="py-2 pl-3 text-right font-medium tabular-nums">
                  {player.todayPoints}
                </td>
              </tr>
            );
          })}
        </tbody>
        {hasAverage ? (
          <tfoot>
            <tr className="border-t text-muted-foreground">
              <td className="py-2 pr-2" />
              <td className="py-2 pr-3">LinkedIn avg</td>
              {GAMES.map((game) => {
                const meta = games.find((item) => item.slug === game.slug);
                return (
                  <td key={game.slug} className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatMs(meta?.globalAverageMs ?? null)}
                  </td>
                );
              })}
              <td className="py-2 pl-3" />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
