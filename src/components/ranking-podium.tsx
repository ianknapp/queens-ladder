import { PlayerAvatar } from "@/components/player-avatar";
import { GAMES } from "@/lib/games";
import { rankSeasonPlayers, rankTodayPlayers } from "@/lib/scoring";
import type { LadderPlayer } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PodiumEntry = {
  id: string;
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  detail: string;
};

function placeLabel(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  return "3rd";
}

function countLabel(count: number, singular: string, pluralWord: string) {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralWord}`;
}

function todayWinCount(player: LadderPlayer) {
  return GAMES.filter((game) => player.today[game.slug].friendRank === 1).length;
}

function PodiumCard({ entry }: { entry: PodiumEntry }) {
  const isFirst = entry.rank === 1;
  let avatarSize: "md" | "lg" = "md";
  if (isFirst) avatarSize = "lg";

  return (
    <li
      value={entry.rank}
      className={cn(
        "flex flex-col items-center rounded-xl bg-card px-3 text-center ring-1 ring-foreground/10",
        isFirst ? "py-5" : "mt-4 py-4",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {placeLabel(entry.rank)}
      </p>
      <PlayerAvatar
        src={entry.avatarUrl}
        size={avatarSize}
        className={cn("mt-2", isFirst ? "ring-2 ring-foreground/35" : "ring-1 ring-foreground/15")}
      />
      <p className="mt-2 w-full truncate text-sm font-medium">{entry.displayName}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
        {entry.points}
        <span className="ml-1 text-xs font-medium text-muted-foreground">pts</span>
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{entry.detail}</p>
    </li>
  );
}

export function RankingPodium({
  entries,
  label,
}: {
  entries: PodiumEntry[];
  label: string;
}) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;

  const first = top.find((entry) => entry.rank === 1);
  const second = top.find((entry) => entry.rank === 2);
  const third = top.find((entry) => entry.rank === 3);

  let columns = "mx-auto max-w-xs grid-cols-1";
  if (top.length === 2) {
    columns = "mx-auto max-w-md grid-cols-2";
  } else if (top.length >= 3) {
    columns = "grid-cols-3";
  }

  return (
    <ol aria-label={label} className={cn("grid items-end gap-2 sm:gap-3", columns)}>
      {second ? <PodiumCard entry={second} /> : null}
      {first ? <PodiumCard entry={first} /> : null}
      {third ? <PodiumCard entry={third} /> : null}
    </ol>
  );
}

export function TodayPodium({ players }: { players: LadderPlayer[] }) {
  const entries = rankTodayPlayers(players)
    .filter((player) => player.todayPoints > 0 || player.todayPlayed > 0)
    .slice(0, 3)
    .map((player) => ({
      id: player.playerId,
      rank: player.rank,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      points: player.todayPoints,
      detail: `${countLabel(todayWinCount(player), "win", "wins")} · ${countLabel(player.todayPlayed, "game", "games")}`,
    }));

  return <RankingPodium entries={entries} label="Today ranking" />;
}

export function SeasonPodium({ players }: { players: LadderPlayer[] }) {
  const entries = rankSeasonPlayers(players)
    .slice(0, 3)
    .map((player) => ({
      id: player.playerId,
      rank: player.rank,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      points: player.seasonPoints,
      detail: `${countLabel(player.seasonWins, "win", "wins")} · ${countLabel(player.seasonDays, "day", "days")}`,
    }));

  return <RankingPodium entries={entries} label="Season ranking" />;
}
