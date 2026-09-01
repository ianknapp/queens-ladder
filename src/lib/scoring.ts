import { GAMES } from "@/lib/games";
import type { DailyRow, LadderPlayer, LeaderboardEntry, SeasonRow } from "@/lib/types";
import { percentBelowAverage } from "@/lib/time";

export const MAX_PLACE_POINTS = 10;

export type TrackedPlayerRef = {
  playerId: string;
  displayName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
};

function timeSort(a: { timeMs: number | null; noHints: boolean | null; noMistakes: boolean | null }, b: typeof a) {
  if (a.timeMs == null && b.timeMs == null) return 0;
  if (a.timeMs == null) return 1;
  if (b.timeMs == null) return -1;
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  if (Boolean(a.noHints) !== Boolean(b.noHints)) return a.noHints ? -1 : 1;
  if (Boolean(a.noMistakes) !== Boolean(b.noMistakes)) return a.noMistakes ? -1 : 1;
  return 0;
}

function entryKey(entry: { profileId?: string | null; profileUrl?: string | null; displayName: string }) {
  return entry.profileId ?? entry.profileUrl ?? entry.displayName;
}

export function pointsForPlace(place: number) {
  if (place < 1) return MAX_PLACE_POINTS;
  return Math.min(place, MAX_PLACE_POINTS);
}

export function formatPlace(place: number) {
  const remainder100 = place % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${place}th`;
  const remainder10 = place % 10;
  if (remainder10 === 1) return `${place}st`;
  if (remainder10 === 2) return `${place}nd`;
  if (remainder10 === 3) return `${place}rd`;
  return `${place}th`;
}

export function hasVisibleScore(row: {
  visibility: DailyRow["visibility"];
  timeMs: number | null;
}): row is { visibility: "score"; timeMs: number } {
  return row.visibility === "score" && row.timeMs != null;
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
    const points = pointsForPlace(place);
    for (let j = i; j < groupEnd; j++) {
      const entry = ranked[j];
      result.set(entryKey(entry), { friendRank: place, points });
    }
    place += groupEnd - i;
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
      const friend = row.isTracked ? friendRanks.get(entryKey(row)) : undefined;
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
      if (a.friendRank != null) return -1;
      if (b.friendRank != null) return 1;
      if (a.timeMs != null && b.timeMs != null) return a.timeMs - b.timeMs;
      return (a.linkedinRank ?? 9999) - (b.linkedinRank ?? 9999);
    });
}

export function ensureTrackedPlaceScores(
  rows: DailyRow[],
  tracked: TrackedPlayerRef[],
  captured: boolean,
): DailyRow[] {
  if (!captured) return rows.filter((row) => row.isTracked);

  const byId = new Map<string, DailyRow>();
  for (const row of rows) {
    if (!row.isTracked) continue;
    byId.set(row.playerId, row);
  }

  for (const player of tracked) {
    const existing = byId.get(player.playerId);
    if (existing) {
      if (existing.friendRank == null) {
        byId.set(player.playerId, { ...existing, points: MAX_PLACE_POINTS });
      }
      continue;
    }
    byId.set(player.playerId, {
      playerId: player.playerId,
      displayName: player.displayName,
      profileUrl: player.profileUrl,
      avatarUrl: player.avatarUrl,
      isTracked: true,
      linkedinRank: null,
      timeMs: null,
      visibility: null,
      friendRank: null,
      points: MAX_PLACE_POINTS,
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.friendRank != null && b.friendRank != null) return a.friendRank - b.friendRank;
    if (a.friendRank != null) return -1;
    if (b.friendRank != null) return 1;
    return a.displayName.localeCompare(b.displayName);
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
      current.points += row.points ?? 0;
      if (hasVisibleScore(row)) {
        current.daysPlayed += 1;
        current.times.push(row.timeMs);
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
      if (a.points !== b.points) return a.points - b.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.averageTimeMs == null) return 1;
      if (b.averageTimeMs == null) return -1;
      return a.averageTimeMs - b.averageTimeMs;
    });
}

export type RankedPlayer = LadderPlayer & { rank: number };

export function countTodayWins(player: LadderPlayer) {
  return GAMES.filter((game) => player.today[game.slug].friendRank === 1).length;
}

export function compareTodayPlayers(a: LadderPlayer, b: LadderPlayer) {
  const aScored = a.todayPlayed > 0 || a.todayPoints > 0;
  const bScored = b.todayPlayed > 0 || b.todayPoints > 0;
  if (aScored !== bScored) return aScored ? -1 : 1;
  if (a.todayPoints !== b.todayPoints) return a.todayPoints - b.todayPoints;
  const winDiff = countTodayWins(b) - countTodayWins(a);
  if (winDiff !== 0) return winDiff;
  if (b.todayPlayed !== a.todayPlayed) return b.todayPlayed - a.todayPlayed;
  return a.displayName.localeCompare(b.displayName);
}

export function rankTodayPlayers(players: LadderPlayer[]): RankedPlayer[] {
  return [...players]
    .sort(compareTodayPlayers)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function compareSeasonPlayers(a: LadderPlayer, b: LadderPlayer) {
  const aScored = a.seasonDays > 0 || a.seasonPoints > 0;
  const bScored = b.seasonDays > 0 || b.seasonPoints > 0;
  if (aScored !== bScored) return aScored ? -1 : 1;
  if (a.seasonPoints !== b.seasonPoints) return a.seasonPoints - b.seasonPoints;
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
