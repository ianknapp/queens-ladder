import { GAMES, GAME_SLUGS, type GameSlug } from "@/lib/games";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyRows, buildSeason } from "@/lib/scoring";
import type {
  DailyRow,
  GameCell,
  GameMeta,
  GameSeasonCell,
  LadderPayload,
  LadderPlayer,
  SeasonRow,
} from "@/lib/types";

type PlayerJoin = {
  id: string;
  display_name: string;
  profile_url: string | null;
  avatar_url: string | null;
  is_tracked: boolean;
  profile_id: string | null;
};

type ScoreJoin = {
  snapshot_id: string;
  linkedin_rank: number | null;
  time_ms: number | null;
  visibility: "score" | "played_only";
  no_hints: boolean | null;
  no_mistakes: boolean | null;
  player: PlayerJoin | PlayerJoin[] | null;
};

type PuzzleRow = {
  id: string;
  game: string;
  puzzle_date: string;
  puzzle_number: number | null;
};

type SnapshotRow = {
  id: string;
  puzzle_id: string;
  captured_at: string;
};

const SCORE_SELECT =
  "snapshot_id, linkedin_rank, time_ms, visibility, no_hints, no_mistakes, player:players(id, display_name, profile_url, avatar_url, is_tracked, profile_id)";

function emptyCell(): GameCell {
  return {
    timeMs: null,
    friendRank: null,
    points: null,
    visibility: null,
  };
}

function emptySeasonCell(): GameSeasonCell {
  return {
    points: 0,
    wins: 0,
    daysPlayed: 0,
    averageTimeMs: null,
  };
}

function emptyToday(): Record<GameSlug, GameCell> {
  return {
    queens: emptyCell(),
    patches: emptyCell(),
    wend: emptyCell(),
    "mini-sudoku": emptyCell(),
    zip: emptyCell(),
  };
}

function emptySeasonByGame(): Record<GameSlug, GameSeasonCell> {
  return {
    queens: emptySeasonCell(),
    patches: emptySeasonCell(),
    wend: emptySeasonCell(),
    "mini-sudoku": emptySeasonCell(),
    zip: emptySeasonCell(),
  };
}

function unwrapPlayer(player: PlayerJoin | PlayerJoin[] | null): PlayerJoin | null {
  if (!player) return null;
  return Array.isArray(player) ? (player[0] ?? null) : player;
}

function toDailyRows(scores: ScoreJoin[]): DailyRow[] {
  return buildDailyRows(
    scores.flatMap((row) => {
      const player = unwrapPlayer(row.player);
      if (!player) return [];
      return [
        {
          playerId: player.id,
          displayName: player.display_name,
          profileUrl: player.profile_url,
          profileId: player.profile_id,
          linkedinUrn: null,
          avatarUrl: player.avatar_url,
          isTracked: player.is_tracked,
          rank: row.linkedin_rank,
          timeMs: row.time_ms,
          visibility: row.visibility,
          noHints: row.no_hints,
          noMistakes: row.no_mistakes,
        },
      ];
    }),
  );
}

async function fetchInChunks<T>(
  ids: string[],
  chunkSize: number,
  fetchChunk: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    rows.push(...(await fetchChunk(ids.slice(i, i + chunkSize))));
  }
  return rows;
}

function applySeasonRow(
  player: LadderPlayer,
  game: GameSlug,
  row: SeasonRow,
) {
  player.seasonByGame[game] = {
    points: row.points,
    wins: row.wins,
    daysPlayed: row.daysPlayed,
    averageTimeMs: row.averageTimeMs,
  };
  player.seasonPoints += row.points;
  player.seasonWins += row.wins;
}

export async function getLadder(): Promise<LadderPayload> {
  const supabase = createAdminClient();

  const [{ data: tracked, error: trackedError }, { data: puzzles, error: puzzlesError }] =
    await Promise.all([
      supabase
        .from("players")
        .select("id, display_name, profile_url, avatar_url, is_tracked")
        .eq("is_tracked", true)
        .order("display_name", { ascending: true }),
      supabase
        .from("puzzles")
        .select("id, game, puzzle_date, puzzle_number")
        .in("game", [...GAME_SLUGS])
        .order("puzzle_date", { ascending: false }),
    ]);

  if (trackedError) throw new Error(trackedError.message);
  if (puzzlesError) throw new Error(puzzlesError.message);

  const trackedPlayers = tracked ?? [];
  const puzzleRows = (puzzles ?? []) as PuzzleRow[];

  const games: GameMeta[] = GAMES.map((game) => {
    const latest = puzzleRows.find((puzzle) => puzzle.game === game.slug);
    return {
      slug: game.slug,
      puzzleDate: latest?.puzzle_date ?? null,
      puzzleNumber: latest?.puzzle_number ?? null,
      capturedAt: null,
    };
  });

  if (trackedPlayers.length === 0) {
    return { players: [], games, trackedCount: 0 };
  }

  const playersById = new Map<string, LadderPlayer>();
  for (const player of trackedPlayers) {
    playersById.set(player.id, {
      playerId: player.id,
      displayName: player.display_name,
      avatarUrl: player.avatar_url,
      today: emptyToday(),
      todayPoints: 0,
      todayPlayed: 0,
      seasonPoints: 0,
      seasonWins: 0,
      seasonDays: 0,
      seasonByGame: emptySeasonByGame(),
    });
  }

  if (puzzleRows.length === 0) {
    return {
      players: [...playersById.values()],
      games,
      trackedCount: trackedPlayers.length,
    };
  }

  const snapshots = await fetchInChunks<SnapshotRow>(
    puzzleRows.map((puzzle) => puzzle.id),
    80,
    async (chunk) => {
      const { data, error } = await supabase
        .from("snapshots")
        .select("id, puzzle_id, captured_at")
        .in("puzzle_id", chunk)
        .order("captured_at", { ascending: false })
        .limit(4000);
      if (error) throw new Error(error.message);
      return (data ?? []) as SnapshotRow[];
    },
  );

  const latestByPuzzle = new Map<string, SnapshotRow>();
  for (const snapshot of snapshots) {
    if (!latestByPuzzle.has(snapshot.puzzle_id)) {
      latestByPuzzle.set(snapshot.puzzle_id, snapshot);
    }
  }

  const snapshotIds = [...latestByPuzzle.values()].map((snapshot) => snapshot.id);

  const scores =
    snapshotIds.length === 0
      ? []
      : await fetchInChunks<ScoreJoin>(snapshotIds, 80, async (chunk) => {
          const { data, error } = await supabase
            .from("scores")
            .select(SCORE_SELECT)
            .in("snapshot_id", chunk)
            .in(
              "player_id",
              trackedPlayers.map((player) => player.id),
            )
            .limit(8000);
          if (error) throw new Error(error.message);
          return (data ?? []) as ScoreJoin[];
        });

  const scoresBySnapshot = new Map<string, ScoreJoin[]>();
  for (const score of scores) {
    const list = scoresBySnapshot.get(score.snapshot_id) ?? [];
    list.push(score);
    scoresBySnapshot.set(score.snapshot_id, list);
  }

  const daysPlayed = new Map<string, Set<string>>();
  const latestPuzzleByGame = new Map<GameSlug, PuzzleRow>();

  for (const puzzle of puzzleRows) {
    if (!isTrackedGame(puzzle.game)) continue;
    if (!latestPuzzleByGame.has(puzzle.game)) {
      latestPuzzleByGame.set(puzzle.game, puzzle);
    }
  }

  for (const [gameSlug, puzzle] of latestPuzzleByGame) {
    const snapshot = latestByPuzzle.get(puzzle.id);
    const meta = games.find((item) => item.slug === gameSlug);
    if (meta) meta.capturedAt = snapshot?.captured_at ?? null;
  }

  const history: Record<GameSlug, DailyRow[][]> = {
    queens: [],
    patches: [],
    wend: [],
    "mini-sudoku": [],
    zip: [],
  };

  for (const puzzle of puzzleRows) {
    if (!isTrackedGame(puzzle.game)) continue;
    const snapshot = latestByPuzzle.get(puzzle.id);
    if (!snapshot) continue;
    const daily = toDailyRows(scoresBySnapshot.get(snapshot.id) ?? []).filter(
      (row) => row.isTracked,
    );
    history[puzzle.game].push(daily);

    for (const row of daily) {
      if (row.visibility !== "score" || row.timeMs == null) continue;
      const dates = daysPlayed.get(row.playerId) ?? new Set<string>();
      dates.add(puzzle.puzzle_date);
      daysPlayed.set(row.playerId, dates);
    }
  }

  for (const game of GAMES) {
    const latest = latestPuzzleByGame.get(game.slug);
    if (latest) {
      const snapshot = latestByPuzzle.get(latest.id);
      if (snapshot) {
        const daily = toDailyRows(scoresBySnapshot.get(snapshot.id) ?? []);
        for (const row of daily) {
          if (!row.isTracked) continue;
          const player = playersById.get(row.playerId);
          if (!player) continue;
          player.today[game.slug] = {
            timeMs: row.timeMs,
            friendRank: row.friendRank,
            points: row.points,
            visibility: row.visibility,
          };
          player.todayPoints += row.points ?? 0;
          if (row.visibility === "score" && row.timeMs != null) player.todayPlayed += 1;
        }
      }
    }

    const seasonRows = buildSeason(history[game.slug]);
    for (const row of seasonRows) {
      const player = playersById.get(row.playerId);
      if (!player) continue;
      applySeasonRow(player, game.slug, row);
    }
  }

  for (const player of playersById.values()) {
    player.seasonDays = daysPlayed.get(player.playerId)?.size ?? 0;
  }

  const players = [...playersById.values()].sort((a, b) => {
    if (b.todayPoints !== a.todayPoints) return b.todayPoints - a.todayPoints;
    if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    players,
    games,
    trackedCount: trackedPlayers.length,
  };
}

function isTrackedGame(value: string): value is GameSlug {
  return (GAME_SLUGS as readonly string[]).includes(value);
}

export type RosterPlayer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type PlayerSearchHit = RosterPlayer & {
  isTracked: boolean;
};

export async function listTrackedPlayers(): Promise<RosterPlayer[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, display_name, avatar_url")
    .eq("is_tracked", true)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((player) => ({
    id: player.id,
    displayName: player.display_name,
    avatarUrl: player.avatar_url,
  }));
}

const MIN_PLAYER_SEARCH = 2;

function sanitizePlayerSearch(query: string) {
  return query
    .trim()
    .replace(/[%_,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchCapturedPlayers(query: string): Promise<PlayerSearchHit[]> {
  const needle = sanitizePlayerSearch(query);
  if (needle.length < MIN_PLAYER_SEARCH) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, display_name, avatar_url, is_tracked")
    .or(`display_name.ilike.${needle}%,display_name.ilike.% ${needle}%`)
    .order("display_name", { ascending: true })
    .limit(8);
  if (error) throw new Error(error.message);
  return (data ?? []).map((player) => ({
    id: player.id,
    displayName: player.display_name,
    avatarUrl: player.avatar_url,
    isTracked: player.is_tracked,
  }));
}
