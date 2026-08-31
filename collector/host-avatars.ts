import {
  AVATAR_BUCKET,
  avatarObjectPath,
  avatarVersion,
  isDownloadableAvatarUrl,
  sniffImageContentType,
} from "../src/lib/avatars";
import { hasSupabaseConfig } from "../src/lib/env";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { LeaderboardEntry } from "../src/lib/types";

export type AvatarDownload = {
  bytes: Buffer;
  contentType: string;
};

export type AvatarDownloader = (url: string) => Promise<AvatarDownload | null>;

const hostedByName = new Map<string, string>();
const MIN_BYTES = 200;

export function resetAvatarSessionCache() {
  hostedByName.clear();
}

export async function ensureAvatarBucket() {
  const supabase = createAdminClient();
  const options = {
    public: true,
    fileSizeLimit: 524288,
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
  };
  const { error } = await supabase.storage.createBucket(AVATAR_BUCKET, options);
  if (!error) return;
  if (!/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Could not create avatars bucket: ${error.message}`);
  }
  const { error: updateError } = await supabase.storage.updateBucket(AVATAR_BUCKET, options);
  if (updateError) {
    throw new Error(`Could not update avatars bucket: ${updateError.message}`);
  }
}

async function uploadAvatar(displayName: string, download: AvatarDownload): Promise<string | null> {
  const contentType = sniffImageContentType(download.bytes, download.contentType);
  if (!contentType || download.bytes.length < MIN_BYTES) return null;

  const supabase = createAdminClient();
  const path = avatarObjectPath(displayName, contentType);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, download.bytes, {
    contentType,
    upsert: true,
    cacheControl: "86400",
  });
  if (error) {
    console.error(`Avatar upload failed for ${displayName}: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${avatarVersion(download.bytes)}`;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function hostLeaderboardAvatars(
  entries: LeaderboardEntry[],
  download: AvatarDownloader,
): Promise<{ entries: LeaderboardEntry[]; uploaded: number; failed: number }> {
  if (!hasSupabaseConfig() || entries.length === 0) {
    return { entries, uploaded: 0, failed: 0 };
  }

  await ensureAvatarBucket();

  const jobs = new Map<string, string>();
  for (const entry of entries) {
    if (hostedByName.has(entry.displayName)) continue;
    if (!isDownloadableAvatarUrl(entry.avatarUrl) || !entry.avatarUrl) continue;
    if (jobs.has(entry.displayName)) continue;
    jobs.set(entry.displayName, entry.avatarUrl);
  }

  let uploaded = 0;
  let failed = 0;
  await mapPool([...jobs.entries()], 6, async ([displayName, sourceUrl]) => {
    const file = await download(sourceUrl);
    if (!file) {
      failed += 1;
      return;
    }
    const hosted = await uploadAvatar(displayName, file);
    if (!hosted) {
      failed += 1;
      return;
    }
    hostedByName.set(displayName, hosted);
    uploaded += 1;
  });

  return {
    entries: entries.map((entry) => {
      const hosted = hostedByName.get(entry.displayName);
      if (!hosted) return entry;
      return { ...entry, avatarUrl: hosted };
    }),
    uploaded,
    failed,
  };
}
