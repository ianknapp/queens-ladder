import type { DailyRow, LadderPlayer, LeaderboardEntry, SeasonRow } from "@/lib/types";

const PODIUM_POINTS = [3, 2, 1] as const;

function timeSort(a: { timeMs: number | null; noHints: boolean | null; noMistakes: boolean | null }, b: typeof a) {
  if (a.timeMs == null && b.timeMs == null) return 0;
  if (a.timeMs == null) return 1;
  if (b.timeMs == null) return -1;
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  if (Boolean(a.noHints) !== Boolean(b.noHints)) return a.noHints ? -1 : 1;
  if (Boolean(a.noMistakes) !== Boolean(b.noMistakes)) return a.noMistakes ? -1 : 1;
  return 0;
}

export function rankFriends(entries: LeaderboardEntry[]): Map<string, { friendRank: number; points: number }> {
  const ranked = entries
    .filter((entry) => entry.visibility === "score" && entry.timeMs != null)
    .sort(timeSort);

  const result = new Map<string, { friendRank: number; points: number }>();
  ranked.forEach((entry, index) => {
    const key = entry.profileId ?? entry.profileUrl ?? entry.displayName;
    result.set(key, {
      friendRank: index + 1,
      points: PODIUM_POINTS[index] ?? 0,
    });
  });
  return result;
}

export function buildDailyRows(
  rows: Array<
    LeaderboardEntry & {
      playerId: string;
      isTracked: boolean;
      avatarUrl: string | null;
      profileUrl: string | null;
    }
  >,
): DailyRow[] {
  const tracked = rows.filter((row) => row.isTracked);
  const friendRanks = rankFriends(tracked);

  return rows
    .map((row) => {
      const key = row.profileId ?? row.profileUrl ?? row.displayName;
      const friend = row.isTracked ? friendRanks.get(key) : undefined;
      return {
        playerId: row.playerId,
        displayName: row.displayName,
        profileUrl: row.profileUrl,
        avatarUrl: row.avatarUrl,
        isTracked: row.isTracked,
        linkedinRank: row.rank,
        timeMs: row.timeMs,
        visibility: row.visibility,
        friendRank: friend?.friendRank ?? null,
        points: friend?.points ?? null,
      };
    })
    .sort((a, b) => {
      if (a.isTracked !== b.isTracked) return a.isTracked ? -1 : 1;
      if (a.friendRank != null && b.friendRank != null) return a.friendRank - b.friendRank;
      if (a.timeMs != null && b.timeMs != null) return a.timeMs - b.timeMs;
      return (a.linkedinRank ?? 9999) - (b.linkedinRank ?? 9999);
    });
}

export function buildSeason(days: DailyRow[][]): SeasonRow[] {
  const byPlayer = new Map<
    string,
    {
      displayName: string;
      profileUrl: string | null;
      avatarUrl: string | null;
      points: number;
      wins: number;
      daysPlayed: number;
      times: number[];
    }
  >();

  for (const day of days) {
    for (const row of day.filter((item) => item.isTracked)) {
      const current = byPlayer.get(row.playerId) ?? {
        displayName: row.displayName,
        profileUrl: row.profileUrl,
        avatarUrl: row.avatarUrl,
        points: 0,
        wins: 0,
        daysPlayed: 0,
        times: [],
      };
      if (row.visibility === "score" && row.timeMs != null) {
        current.daysPlayed += 1;
        current.times.push(row.timeMs);
        current.points += row.points ?? 0;
        if (row.friendRank === 1) current.wins += 1;
      }
      byPlayer.set(row.playerId, current);
    }
  }

  return [...byPlayer.entries()]
    .map(([playerId, value]) => ({
      playerId,
      displayName: value.displayName,
      profileUrl: value.profileUrl,
      avatarUrl: value.avatarUrl,
      points: value.points,
      wins: value.wins,
      daysPlayed: value.daysPlayed,
      averageTimeMs:
        value.times.length === 0
          ? null
          : Math.round(value.times.reduce((sum, time) => sum + time, 0) / value.times.length),
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.averageTimeMs == null) return 1;
      if (b.averageTimeMs == null) return -1;
      return a.averageTimeMs - b.averageTimeMs;
    });
}

export type SeasonRankedPlayer = LadderPlayer & { rank: number };

export function compareSeasonPlayers(a: LadderPlayer, b: LadderPlayer) {
  if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
  if (b.seasonWins !== a.seasonWins) return b.seasonWins - a.seasonWins;
  return a.displayName.localeCompare(b.displayName);
}

export function rankSeasonPlayers(players: LadderPlayer[]): SeasonRankedPlayer[] {
  return [...players]
    .sort(compareSeasonPlayers)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}
