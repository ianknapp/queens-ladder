export type SeasonDefinition = {
  id: string;
  name: string;
  /** Inclusive YYYY-MM-DD. */
  startDate: string;
  /** Inclusive YYYY-MM-DD. Omit or null to run until the next season starts. */
  endDate?: string | null;
  isActive?: boolean;
};

export type SeasonRecord = {
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export type ResolvedSeason = {
  id: string;
  name: string;
  startDate: string;
  /** Inclusive YYYY-MM-DD, or null if the season is still open. */
  endDate: string | null;
  isActive: boolean;
};

export function formatPuzzleDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatSeasonRange(season: Pick<ResolvedSeason, "startDate" | "endDate">) {
  const start = formatPuzzleDate(season.startDate);
  if (season.endDate == null) return `${start} – present`;
  return `${start} – ${formatPuzzleDate(season.endDate)}`;
}

export function previousDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

export function resolveSeasonWindow(
  season: SeasonDefinition,
  allSeasons: readonly SeasonDefinition[] = [],
): ResolvedSeason {
  const sorted = [...allSeasons].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const index = sorted.findIndex((item) => item.id === season.id);
  let endDate = season.endDate ?? null;
  if (endDate == null) {
    const next = index >= 0 ? sorted[index + 1] : undefined;
    if (next) endDate = previousDate(next.startDate);
  }
  return {
    id: season.id,
    name: season.name,
    startDate: season.startDate,
    endDate,
    isActive: Boolean(season.isActive),
  };
}

export function recordsToDefinitions(rows: SeasonRecord[]): SeasonDefinition[] {
  return rows.map((row) => ({
    id: row.slug,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    isActive: row.isActive,
  }));
}

export function listResolvedSeasons(rows: SeasonRecord[]): ResolvedSeason[] {
  const definitions = recordsToDefinitions(rows);
  return definitions
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((season) => resolveSeasonWindow(season, definitions));
}

export function selectSeason(rows: SeasonRecord[], slug?: string | null): ResolvedSeason {
  const resolved = listResolvedSeasons(rows);
  if (resolved.length === 0) {
    throw new Error(
      "No seasons found. Run supabase/migrations/20260902120000_seasons.sql in the SQL editor.",
    );
  }
  if (slug) {
    const match = resolved.find((season) => season.id === slug);
    if (match) return match;
  }
  const active = resolved.find((season) => season.isActive);
  if (active) return active;
  return resolved[resolved.length - 1];
}
