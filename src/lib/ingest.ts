import { z } from "zod";
import { GAME_SLUGS } from "@/lib/games";
import { profileIdFromUrl } from "@/lib/time";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CapturePayload } from "@/lib/types";

const entrySchema = z.object({
  rank: z.number().int().nullable(),
  displayName: z.string().min(1),
  profileUrl: z.string().nullable(),
  profileId: z.string().nullable(),
  linkedinUrn: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  timeMs: z.number().int().nullable(),
  visibility: z.enum(["score", "played_only"]),
  noHints: z.boolean().nullable(),
  noMistakes: z.boolean().nullable(),
});

export const capturePayloadSchema = z.object({
  game: z.enum(GAME_SLUGS),
  puzzleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  puzzleNumber: z.number().int().nullable(),
  capturedAt: z.string(),
  kind: z.enum(["scheduled_final", "scheduled_midday", "manual"]),
  pageUrl: z.string(),
  entries: z.array(entrySchema),
  raw: z.unknown().optional(),
});

export async function ingestCapture(payload: CapturePayload) {
  const supabase = createAdminClient();

  const { data: existingPuzzle, error: existingError } = await supabase
    .from("puzzles")
    .select("id, puzzle_number")
    .eq("game", payload.game)
    .eq("puzzle_date", payload.puzzleDate)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  let puzzle = existingPuzzle;
  if (!puzzle) {
    const { data: created, error: createPuzzleError } = await supabase
      .from("puzzles")
      .insert({
        game: payload.game,
        puzzle_date: payload.puzzleDate,
        puzzle_number: payload.puzzleNumber,
      })
      .select("id, puzzle_number")
      .single();
    if (createPuzzleError || !created) {
      throw new Error(createPuzzleError?.message ?? "Could not create puzzle");
    }
    puzzle = created;
  } else if (payload.puzzleNumber && !puzzle.puzzle_number) {
    await supabase
      .from("puzzles")
      .update({ puzzle_number: payload.puzzleNumber })
      .eq("id", puzzle.id);
  }

  const { data: snapshot, error: snapshotError } = await supabase
    .from("snapshots")
    .insert({
      puzzle_id: puzzle.id,
      captured_at: payload.capturedAt,
      kind: payload.kind,
      status: payload.entries.length > 0 ? "success" : "failed",
      visible_count: payload.entries.length,
      raw_json: {
        pageUrl: payload.pageUrl,
        raw: payload.raw ?? null,
      },
    })
    .select("id")
    .single();

  if (snapshotError || !snapshot) {
    throw new Error(snapshotError?.message ?? "Could not insert snapshot");
  }

  for (const entry of payload.entries) {
    const profileId = entry.profileId ?? profileIdFromUrl(entry.profileUrl);
    const matchColumn = entry.linkedinUrn
      ? "linkedin_urn"
      : profileId
        ? "profile_id"
        : entry.profileUrl
          ? "profile_url"
          : null;

    let playerId: string | null = null;

    if (matchColumn) {
      const matchValue =
        matchColumn === "linkedin_urn"
          ? entry.linkedinUrn
          : matchColumn === "profile_id"
            ? profileId
            : entry.profileUrl;
      const { data: existing } = await supabase
        .from("players")
        .select("id, display_name, avatar_url, profile_url, profile_id, linkedin_urn")
        .eq(matchColumn, matchValue)
        .maybeSingle();

      if (existing) {
        playerId = existing.id;
        await supabase
          .from("players")
          .update({
            display_name: entry.displayName || existing.display_name,
            avatar_url: entry.avatarUrl ?? existing.avatar_url,
            profile_url: entry.profileUrl ?? existing.profile_url,
            profile_id: profileId ?? existing.profile_id,
            linkedin_urn: entry.linkedinUrn ?? existing.linkedin_urn,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
    }

    if (!playerId && entry.displayName) {
      const { data: byName } = await supabase
        .from("players")
        .select("id")
        .eq("display_name", entry.displayName)
        .maybeSingle();
      if (byName) playerId = byName.id;
    }

    if (!playerId) {
      const { data: created, error: createError } = await supabase
        .from("players")
        .insert({
          linkedin_urn: entry.linkedinUrn,
          profile_url: entry.profileUrl,
          profile_id: profileId,
          display_name: entry.displayName,
          avatar_url: entry.avatarUrl,
        })
        .select("id")
        .single();
      if (createError || !created) {
        throw new Error(createError?.message ?? "Could not create player");
      }
      playerId = created.id;
    }

    const { error: scoreError } = await supabase.from("scores").insert({
      snapshot_id: snapshot.id,
      player_id: playerId,
      linkedin_rank: entry.rank,
      time_ms: entry.timeMs,
      visibility: entry.visibility,
      no_hints: entry.noHints,
      no_mistakes: entry.noMistakes,
    });
    if (scoreError) {
      throw new Error(scoreError.message);
    }
  }

  return { puzzleId: puzzle.id, snapshotId: snapshot.id, count: payload.entries.length };
}
