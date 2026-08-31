import { isHostedAvatarUrl } from "../src/lib/avatars";
import { hasSupabaseConfig } from "../src/lib/env";
import { createAdminClient } from "../src/lib/supabase/admin";
import { hostLeaderboardAvatars } from "./host-avatars";
import { loadDotEnv } from "./load-env";
import type { LeaderboardEntry } from "../src/lib/types";

async function downloadViaFetch(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    if (!response.ok) return null;
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

async function main() {
  loadDotEnv();
  if (!hasSupabaseConfig()) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  }

  const supabase = createAdminClient();
  const { data: players, error } = await supabase
    .from("players")
    .select("id, display_name, avatar_url")
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);

  const pending = (players ?? []).filter((player) => !isHostedAvatarUrl(player.avatar_url));
  console.log(`${pending.length} of ${players?.length ?? 0} players still point at LinkedIn (or have no photo).`);
  if (pending.length === 0) return;

  const stubEntries: LeaderboardEntry[] = pending.map((player) => ({
    rank: null,
    displayName: player.display_name,
    profileUrl: null,
    profileId: null,
    linkedinUrn: null,
    avatarUrl: player.avatar_url,
    timeMs: null,
    visibility: "score",
    noHints: null,
    noMistakes: null,
  }));

  const hosted = await hostLeaderboardAvatars(stubEntries, downloadViaFetch);
  console.log(`Downloaded ${hosted.uploaded}, failed ${hosted.failed}.`);

  const byName = new Map(pending.map((player) => [player.display_name, player]));
  let updated = 0;
  for (const entry of hosted.entries) {
    const player = byName.get(entry.displayName);
    if (!player || !isHostedAvatarUrl(entry.avatarUrl)) continue;
    const { error: updateError } = await supabase
      .from("players")
      .update({
        avatar_url: entry.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", player.id);
    if (updateError) {
      console.error(`Could not update ${player.display_name}: ${updateError.message}`);
      continue;
    }
    updated += 1;
  }

  console.log(`Updated ${updated} player rows to public bucket URLs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
