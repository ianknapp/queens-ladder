export const GAME_SLUGS = ["queens", "patches", "wend", "mini-sudoku", "zip"] as const;

export type GameSlug = (typeof GAME_SLUGS)[number];

export const GAMES = [
  { slug: "queens", name: "Queens", short: "Queens", path: "queens" },
  { slug: "patches", name: "Patches", short: "Patches", path: "patches" },
  { slug: "wend", name: "Wend", short: "Wend", path: "wend" },
  { slug: "mini-sudoku", name: "Mini Sudoku", short: "Mini", path: "mini-sudoku" },
  { slug: "zip", name: "Zip", short: "Zip", path: "zip" },
] as const satisfies ReadonlyArray<{
  slug: GameSlug;
  name: string;
  short: string;
  path: string;
}>;

export type GameDef = (typeof GAMES)[number];

export function isGameSlug(value: string): value is GameSlug {
  return (GAME_SLUGS as readonly string[]).includes(value);
}

export function gameBySlug(slug: GameSlug): GameDef {
  const game = GAMES.find((item) => item.slug === slug);
  if (!game) throw new Error(`Unknown game ${slug}`);
  return game;
}

export function resultsUrl(slug: GameSlug): string {
  return `https://www.linkedin.com/games/${gameBySlug(slug).path}/results/`;
}

export function leaderboardUrl(slug: GameSlug): string {
  return `${resultsUrl(slug)}leaderboard/connections/`;
}

export function parseGameArgs(raw: string | null): GameDef[] {
  if (!raw) return [...GAMES];
  const slugs = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (slugs.length === 0) return [...GAMES];
  return slugs.map((slug) => {
    if (!isGameSlug(slug)) {
      throw new Error(`Unknown game "${slug}". Use: ${GAME_SLUGS.join(", ")}`);
    }
    return gameBySlug(slug);
  });
}
