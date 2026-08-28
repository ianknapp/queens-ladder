import { PlayerAvatar } from "@/components/player-avatar";
import { GAMES } from "@/lib/games";
import { formatMs } from "@/lib/time";
import type { GameCell, LadderPlayer } from "@/lib/types";
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

export function TodayGrid({ players }: { players: LadderPlayer[] }) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Toggle 5–10 people on the Friends page. Capture still stores everyone; only those names
        show here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-xl text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
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
          {players.map((player) => (
            <tr key={player.playerId} className="border-b border-border/60 last:border-0">
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
