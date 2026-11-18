import { listResolvedSeasons, type SeasonRecord } from "@/lib/seasons";

export type SeasonDraft = {
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export type SeasonFormResult = { ok: true; value: SeasonDraft } | { ok: false; error: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function slugifySeasonName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function readSeasonForm(formData: FormData, slugFromName: boolean): SeasonFormResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  let slug = rawSlug;
  if (!slug && slugFromName) slug = slugifySeasonName(name);
  const startDate = String(formData.get("startDate") ?? "").trim();
  const rawEnd = String(formData.get("endDate") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 40) return { ok: false, error: "Name must be 40 characters or fewer." };
  if (!slug || !SLUG.test(slug)) return { ok: false, error: "Use a slug like 2026-s2." };
  if (!isIsoDate(startDate)) return { ok: false, error: "Start date must be a real date." };
  if (rawEnd && !isIsoDate(rawEnd)) {
    return { ok: false, error: "End date must be a real date, or left empty." };
  }
  if (rawEnd && rawEnd < startDate) {
    return { ok: false, error: "End date must be on or after the start date." };
  }

  return {
    ok: true,
    value: {
      slug,
      name,
      startDate,
      endDate: rawEnd || null,
      isActive,
    },
  };
}

export function withSeasonDraft(existing: SeasonRecord[], draft: SeasonDraft): SeasonRecord[] {
  const next: SeasonRecord = {
    slug: draft.slug,
    name: draft.name,
    startDate: draft.startDate,
    endDate: draft.endDate,
    isActive: draft.isActive,
  };
  const rest = existing.filter((season) => season.slug !== draft.slug);
  if (!draft.isActive) return [...rest, next];
  return rest.map((season) => ({ ...season, isActive: false })).concat(next);
}

export function seasonOverlapMessage(rows: SeasonRecord[]) {
  const resolved = listResolvedSeasons(rows);
  for (let i = 0; i < resolved.length; i += 1) {
    const left = resolved[i];
    const leftEnd = left.endDate ?? "9999-12-31";
    for (let j = i + 1; j < resolved.length; j += 1) {
      const right = resolved[j];
      const rightEnd = right.endDate ?? "9999-12-31";
      if (left.startDate <= rightEnd && right.startDate <= leftEnd) {
        return `${left.name} overlaps ${right.name}. Move the dates so each day belongs to one season.`;
      }
    }
  }
  return null;
}
