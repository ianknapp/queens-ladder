import { parseClockToMs, profileIdFromUrl } from "./time";
import type { LeaderboardEntry } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function pickName(obj: Record<string, unknown>): string | null {
  const first = asString(obj.firstName);
  const last = asString(obj.lastName);
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return (
    asString(obj.displayName) ??
    asString(obj.fullName) ??
    asString(obj.name) ??
    asString(obj.title)
  );
}

function pickUrl(obj: Record<string, unknown>): string | null {
  const direct =
    asString(obj.profileUrl) ??
    asString(obj.navigationUrl) ??
    asString(obj.url) ??
    asString(obj.publicProfileUrl);
  if (direct?.includes("linkedin.com/in/")) return direct.split("?")[0];
  const identifier = asString(obj.publicIdentifier) ?? asString(obj.vanityName);
  return identifier ? `https://www.linkedin.com/in/${identifier}` : null;
}

function pickUrn(obj: Record<string, unknown>): string | null {
  const urn = asString(obj.entityUrn) ?? asString(obj.urn) ?? asString(obj.memberUrn);
  return urn?.includes("urn:li:") ? urn : null;
}

function pickTimeMs(obj: Record<string, unknown>): number | null {
  const clock =
    asString(obj.time) ??
    asString(obj.score) ??
    asString(obj.formattedTime) ??
    asString(obj.duration);
  const fromClock = clock ? parseClockToMs(clock) : null;
  if (fromClock != null) return fromClock;

  const elapsed = asNumber(obj.timeElapsed) ?? asNumber(obj.durationMs) ?? asNumber(obj.solveTime);
  if (elapsed == null) return null;
  // LinkedIn games usually send seconds; treat large values as already-ms.
  return elapsed > 10_000 ? elapsed : elapsed * 1000;
}

function pickRank(obj: Record<string, unknown>): number | null {
  return asNumber(obj.rank) ?? asNumber(obj.ranking) ?? asNumber(obj.position);
}

function pickAvatar(obj: Record<string, unknown>): string | null {
  if (isRecord(obj.profilePicture)) {
    return asString(obj.profilePicture.url) ?? pickAvatar(obj.profilePicture);
  }
  return asString(obj.avatarUrl) ?? asString(obj.imageUrl);
}

function walk(value: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!isRecord(value)) return;
  visit(value);
  for (const nested of Object.values(value)) walk(nested, visit);
}

export function extractEntriesFromJson(data: unknown): LeaderboardEntry[] {
  const found: LeaderboardEntry[] = [];
  const seen = new Set<string>();

  walk(data, (obj) => {
    const displayName = pickName(obj);
    const profileUrl = pickUrl(obj);
    const timeMs = pickTimeMs(obj);
    const rank = pickRank(obj);
    if (!displayName && !profileUrl) return;
    if (timeMs == null && rank == null) return;

    const profileId = profileIdFromUrl(profileUrl);
    const key = profileId ?? profileUrl ?? displayName ?? "";
    if (!key || seen.has(key)) return;
    seen.add(key);

    found.push({
      rank,
      displayName: displayName ?? profileId ?? "Unknown",
      profileUrl,
      profileId,
      linkedinUrn: pickUrn(obj),
      avatarUrl: pickAvatar(obj),
      timeMs,
      visibility: timeMs == null ? "played_only" : "score",
      noHints: typeof obj.noHints === "boolean" ? obj.noHints : null,
      noMistakes: typeof obj.noMistakes === "boolean" ? obj.noMistakes : null,
    });
  });

  return found.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
}

export function mergeEntries(...groups: LeaderboardEntry[][]): LeaderboardEntry[] {
  const byKey = new Map<string, LeaderboardEntry>();
  for (const group of groups) {
    for (const entry of group) {
      const key = entry.profileId ?? entry.profileUrl ?? entry.displayName;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, entry);
        continue;
      }
      byKey.set(key, {
        ...existing,
        ...Object.fromEntries(
          Object.entries(entry).filter(([, value]) => value != null),
        ),
        displayName: existing.displayName || entry.displayName,
      } as LeaderboardEntry);
    }
  }
  return [...byKey.values()].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
}

export function puzzleNumberFromText(text: string, gameName?: string): number | null {
  if (gameName) {
    const escaped = gameName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const named = text.match(new RegExp(`${escaped}\\s*#\\s*(\\d+)`, "i"));
    if (named) return Number(named[1]);
  }
  const puzzleNo = text.match(/Puzzle No\.?\s*(\d+)/i);
  if (puzzleNo) return Number(puzzleNo[1]);
  return null;
}

export function extractEntriesFromBodyText(text: string): LeaderboardEntry[] {
  const cutoff = text.search(/\nSee less\b|\nSend your connections|\nNudge\b/i);
  const slice = cutoff === -1 ? text : text.slice(0, cutoff);
  const start = slice.search(/\nToday\b|\nYesterday\b/i);
  const body = start === -1 ? slice : slice.slice(start);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const skip =
    /^(Today|Yesterday|Settings|See more|See less|Home|My Network|Jobs|Messaging|Notifications|More|Me|For Business|\d+ notifications|Skip to|Keyboard shortcuts|Close jump menu|new feed updates|Queens Leaderboard|Patches Leaderboard|Wend Leaderboard|Zip Leaderboard|Mini Sudoku Leaderboard|Puzzle No\.?)/i;
  const timeRe = /^(\d{1,2}):(\d{2})$/;
  const entries: LeaderboardEntry[] = [];
  let rank: number | null = null;
  let name: string | null = null;
  let noHints: boolean | null = null;
  let noMistakes: boolean | null = null;
  let skipNextNumber = false;
  let inferredRank = 0;

  for (const line of lines) {
    if (skip.test(line) || line === "🔥") {
      if (line === "🔥") skipNextNumber = true;
      continue;
    }
    if (timeRe.test(line) && name) {
      const timeMs = parseClockToMs(line);
      inferredRank += 1;
      entries.push({
        rank: rank ?? inferredRank,
        displayName: name,
        profileUrl: null,
        profileId: null,
        linkedinUrn: null,
        avatarUrl: null,
        timeMs,
        visibility: "score",
        noHints,
        noMistakes,
      });
      rank = null;
      name = null;
      noHints = null;
      noMistakes = null;
      skipNextNumber = false;
      continue;
    }
    if (/^\d{1,3}$/.test(line)) {
      if (skipNextNumber) {
        skipNextNumber = false;
        continue;
      }
      if (!name) rank = Number(line);
      continue;
    }
    if (/no hints/i.test(line) || /no mistakes/i.test(line)) {
      if (/no hints/i.test(line)) noHints = true;
      if (/no mistakes/i.test(line)) noMistakes = true;
      continue;
    }
    if (line.length > 1 && line.length < 80 && !/^https?:/i.test(line)) {
      name = line;
    }
  }

  return entries;
}
