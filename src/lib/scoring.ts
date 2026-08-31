import type { DailyRow, LadderPlayer, LeaderboardEntry, SeasonRow } from "@/lib/types";
import { percentBelowAverage } from "@/lib/time";

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
  let place = 1;
  let i = 0;
  while (i < ranked.length) {
    let groupEnd = i + 1;
    while (groupEnd < ranked.length && timeSort(ranked[i], ranked[groupEnd]) === 0) {
      groupEnd += 1;
    }
    const points = PODIUM_POINTS[place - 1] ?? 0;
    for (let j = i; j < groupEnd; j++) {
      const entry = ranked[j];
      const key = entry.profileId ?? entry.profileUrl ?? entry.displayName;
      result.set(key, { friendRank: place, points });
    }
    place += 1;
    i = groupEnd;
  }
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

export type SeasonDay = {
  rows: DailyRow[];
  globalAverageMs: number | null;
};

export function buildSeason(days: SeasonDay[]): SeasonRow[] {
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
      belowAverage: number[];
    }
  >();

  for (const day of days) {
    for (const row of day.rows.filter((item) => item.isTracked)) {
      const current = byPlayer.get(row.playerId) ?? {
        displayName: row.displayName,
        profileUrl: row.profileUrl,
        avatarUrl: row.avatarUrl,
        points: 0,
        wins: 0,
        daysPlayed: 0,
        times: [],
        belowAverage: [],
      };
      if (row.visibility === "score" && row.timeMs != null) {
        current.daysPlayed += 1;
        current.times.push(row.timeMs);
        current.points += row.points ?? 0;
        if (row.friendRank === 1) current.wins += 1;
        if (day.globalAverageMs != null) {
          const pct = percentBelowAverage(row.timeMs, day.globalAverageMs);
          if (pct != null) current.belowAverage.push(pct);
        }
      }
      byPlayer.set(row.playerId, current);
    }
  }

  return [...byPlayer.entries()]
    .map(([playerId, value]) => {
      let belowAveragePct: number | null = null;
      if (value.belowAverage.length > 0) {
        const total = value.belowAverage.reduce((sum, pct) => sum + pct, 0);
        belowAveragePct = total / value.belowAverage.length;
      }
      let averageTimeMs: number | null = null;
      if (value.times.length > 0) {
        averageTimeMs = Math.round(
          value.times.reduce((sum, time) => sum + time, 0) / value.times.length,
        );
      }
      return {
        playerId,
        displayName: value.displayName,
        profileUrl: value.profileUrl,
        avatarUrl: value.avatarUrl,
        points: value.points,
        wins: value.wins,
        daysPlayed: value.daysPlayed,
        averageTimeMs,
        belowAveragePct,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.averageTimeMs == null) return 1;
      if (b.averageTimeMs == null) return -1;
      return a.averageTimeMs - b.averageTimeMs;
    });
}

export type RankedPlayer = LadderPlayer & { rank: number };

export function compareTodayPlayers(a: LadderPlayer, b: LadderPlayer) {
  if (b.todayPoints !== a.todayPoints) return b.todayPoints - a.todayPoints;
  if (b.todayPlayed !== a.todayPlayed) return b.todayPlayed - a.todayPlayed;
  return a.displayName.localeCompare(b.displayName);
}

export function rankTodayPlayers(players: LadderPlayer[]): RankedPlayer[] {
  return [...players]
    .sort(compareTodayPlayers)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function compareSeasonPlayers(a: LadderPlayer, b: LadderPlayer) {
  if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
  if (b.seasonWins !== a.seasonWins) return b.seasonWins - a.seasonWins;
  return a.displayName.localeCompare(b.displayName);
}

export function rankSeasonPlayers(players: LadderPlayer[]): RankedPlayer[] {
  return [...players]
    .sort(compareSeasonPlayers)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function compareGameWinPlayers(a: LadderPlayer, b: LadderPlayer) {
  const aWins = totalGameWins(a);
  const bWins = totalGameWins(b);
  if (bWins !== aWins) return bWins - aWins;
  const aPct = meanBelowAverage(a);
  const bPct = meanBelowAverage(b);
  if (aPct != null && bPct != null && aPct !== bPct) return bPct - aPct;
  if (aPct != null && bPct == null) return -1;
  if (aPct == null && bPct != null) return 1;
  return a.displayName.localeCompare(b.displayName);
}

export function rankGameWinPlayers(players: LadderPlayer[]): RankedPlayer[] {
  return [...players]
    .sort(compareGameWinPlayers)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function totalGameWins(player: LadderPlayer) {
  return Object.values(player.seasonByGame).reduce((sum, cell) => sum + cell.wins, 0);
}

export function meanBelowAverage(player: LadderPlayer) {
  const values = Object.values(player.seasonByGame)
    .map((cell) => cell.belowAveragePct)
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
