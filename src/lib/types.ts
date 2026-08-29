import type { GameSlug } from "@/lib/games";

export type { GameSlug };

export type CaptureKind = "scheduled_final" | "scheduled_midday" | "manual";

export type ScoreVisibility = "score" | "played_only";

export type LeaderboardEntry = {
  rank: number | null;
  displayName: string;
  profileUrl: string | null;
  profileId: string | null;
  linkedinUrn: string | null;
  avatarUrl: string | null;
  timeMs: number | null;
  visibility: ScoreVisibility;
  noHints: boolean | null;
  noMistakes: boolean | null;
};

export type CapturePayload = {
  game: GameSlug;
  puzzleDate: string;
  puzzleNumber: number | null;
  capturedAt: string;
  kind: CaptureKind;
  pageUrl: string;
  entries: LeaderboardEntry[];
  globalAverageMs?: number | null;
  raw?: unknown;
};

export type DailyRow = {
  playerId: string;
  displayName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  isTracked: boolean;
  linkedinRank: number | null;
  timeMs: number | null;
  visibility: ScoreVisibility;
  friendRank: number | null;
  points: number | null;
};

export type SeasonRow = {
  playerId: string;
  displayName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  points: number;
  wins: number;
  daysPlayed: number;
  averageTimeMs: number | null;
  belowAveragePct: number | null;
};

export type GameCell = {
  timeMs: number | null;
  friendRank: number | null;
  points: number | null;
  visibility: ScoreVisibility | null;
};

export type GameSeasonCell = {
  points: number;
  wins: number;
  daysPlayed: number;
  averageTimeMs: number | null;
  belowAveragePct: number | null;
};

export type GameMeta = {
  slug: GameSlug;
  puzzleDate: string | null;
  puzzleNumber: number | null;
  capturedAt: string | null;
  globalAverageMs: number | null;
};

export type LadderPlayer = {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  today: Record<GameSlug, GameCell>;
  todayPoints: number;
  todayPlayed: number;
  seasonPoints: number;
  seasonWins: number;
  seasonDays: number;
  seasonByGame: Record<GameSlug, GameSeasonCell>;
};

export type LadderPayload = {
  players: LadderPlayer[];
  games: GameMeta[];
  trackedCount: number;
};
