import { createHash } from "node:crypto";

export const AVATAR_BUCKET = "avatars";

export function isHostedAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/storage\/v1\/object\/public\/avatars\//.test(url);
}

export function isDownloadableAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/static\.licdn\.com/i.test(url)) return false;
  if (isHostedAvatarUrl(url)) return false;
  return true;
}

export function preferAvatarUrl(incoming: string | null, existing: string | null): string | null {
  if (isHostedAvatarUrl(incoming)) return incoming;
  if (isHostedAvatarUrl(existing)) return existing;
  return incoming ?? existing;
}

export function avatarObjectPath(displayName: string, contentType: string): string {
  const id = createHash("sha256")
    .update(displayName.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  return `${id}.${extensionForContentType(contentType)}`;
}

export function avatarVersion(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 10);
}

export function extensionForContentType(contentType: string): string {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function sniffImageContentType(bytes: Buffer, declared: string): string | null {
  const type = declared.split(";")[0]?.trim().toLowerCase() ?? "";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && bytes.subarray(0, 3).toString("ascii") === "GIF") {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (type.startsWith("image/") && type !== "image/svg+xml") return type;
  return null;
}
