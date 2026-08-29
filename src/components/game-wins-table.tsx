import { PlayerAvatar } from "@/components/player-avatar";
import { GAMES } from "@/lib/games";
import { rankGameWinPlayers, totalGameWins } from "@/lib/scoring";
import { formatPct } from "@/lib/time";
import type { GameSeasonCell, LadderPlayer } from "@/lib/types";
import { cn } from "@/lib/utils";

function rankClass(rank: number) {
  if (rank <= 3) return "font-medium text-foreground";
  return "text-muted-foreground";
}

function WinCell({ cell }: { cell: GameSeasonCell }) {
  if (cell.daysPlayed === 0) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="tabular-nums text-foreground">{cell.wins}</span>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {formatPct(cell.belowAveragePct)}
      </span>
    </span>
  );
}

export function GameWinsTable({ players }: { players: LadderPlayer[] }) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        First-place counts appear after you add friends and capture a board.
      </p>
    );
  }

  const ranked = rankGameWinPlayers(players);

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
          </tr>
        </thead>
        <tbody>
          {ranked.map((player) => (
            <tr key={player.playerId} className="border-b border-border/60 last:border-0">
              <td className={cn("py-2 pr-2 tabular-nums", rankClass(player.rank))}>
                {player.rank}
              </td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <PlayerAvatar src={player.avatarUrl} />
                  <span className="truncate">{player.displayName}</span>
                </div>
              </td>
              {GAMES.map((game) => (
                <td key={game.slug} className="px-2 py-2 text-right">
                  <WinCell cell={player.seasonByGame[game.slug]} />
                </td>
              ))}
              <td className="py-2 pl-3 text-right font-medium tabular-nums">
                {totalGameWins(player)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
