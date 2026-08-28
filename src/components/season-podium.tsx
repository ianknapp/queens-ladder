import { PlayerAvatar } from "@/components/player-avatar";
import { rankSeasonPlayers } from "@/lib/scoring";
import type { LadderPlayer } from "@/lib/types";
import { cn } from "@/lib/utils";

function placeLabel(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  return "3rd";
}

function countLabel(count: number, singular: string, pluralWord: string) {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralWord}`;
}

function PodiumCard({
  player,
}: {
  player: ReturnType<typeof rankSeasonPlayers>[number];
}) {
  const isFirst = player.rank === 1;
  let avatarSize: "md" | "lg" = "md";
  if (isFirst) avatarSize = "lg";

  return (
    <li
      value={player.rank}
      className={cn(
        "flex flex-col items-center rounded-xl bg-card px-3 text-center ring-1 ring-foreground/10",
        isFirst ? "py-5" : "mt-4 py-4",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {placeLabel(player.rank)}
      </p>
      <PlayerAvatar
        src={player.avatarUrl}
        size={avatarSize}
        className={cn("mt-2", isFirst ? "ring-2 ring-foreground/35" : "ring-1 ring-foreground/15")}
      />
      <p className="mt-2 w-full truncate text-sm font-medium">{player.displayName}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
        {player.seasonPoints}
        <span className="ml-1 text-xs font-medium text-muted-foreground">pts</span>
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {countLabel(player.seasonWins, "win", "wins")} · {countLabel(player.seasonDays, "day", "days")}
      </p>
    </li>
  );
}

export function SeasonPodium({ players }: { players: LadderPlayer[] }) {
  const top = rankSeasonPlayers(players).slice(0, 3);
  if (top.length === 0) return null;

  const first = top.find((player) => player.rank === 1);
  const second = top.find((player) => player.rank === 2);
  const third = top.find((player) => player.rank === 3);

  let columns = "mx-auto max-w-xs grid-cols-1";
  if (top.length === 2) {
    columns = "mx-auto max-w-md grid-cols-2";
  } else if (top.length >= 3) {
    columns = "grid-cols-3";
  }

  return (
    <ol aria-label="Season ranking" className={cn("grid items-end gap-2 sm:gap-3", columns)}>
      {second ? <PodiumCard player={second} /> : null}
      {first ? <PodiumCard player={first} /> : null}
      {third ? <PodiumCard player={third} /> : null}
    </ol>
  );
}
