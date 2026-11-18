"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminCookieName,
  adminSessionToken,
  verifyAdminPassword,
} from "@/lib/auth";
import {
  readSeasonForm,
  seasonOverlapMessage,
  withSeasonDraft,
  type SeasonDraft,
} from "@/lib/season-admin";
import type { SeasonRecord } from "@/lib/seasons";
import { requireAdminAccess, requireSiteAccess } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type SeasonActionState = {
  error: string | null;
};

const savedState: SeasonActionState = { error: null };

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function adminLoginAction(formData: FormData) {
  await requireSiteAccess();
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) redirect("/admin?error=1");
  const store = await cookies();
  store.set(adminCookieName(), adminSessionToken(), cookieOptions());
  redirect("/admin");
}

export async function adminLogoutAction() {
  const store = await cookies();
  store.delete(adminCookieName());
  redirect("/admin");
}

type SeasonRow = {
  slug: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
};

function toRecord(row: SeasonRow): SeasonRecord {
  return {
    slug: row.slug,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
  };
}

async function loadSeasons() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("slug, name, start_date, end_date, is_active")
    .order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeasonRow[];
}

function revalidateBoards() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/players");
}

async function writeSeason(draft: SeasonDraft, creating: boolean) {
  const supabase = createAdminClient();
  const payload = {
    slug: draft.slug,
    name: draft.name,
    start_date: draft.startDate,
    end_date: draft.endDate,
    is_active: draft.isActive,
  };

  if (creating) {
    const { error } = await supabase.from("seasons").insert(payload);
    if (error) return error.message;
    return null;
  }

  const { data, error } = await supabase
    .from("seasons")
    .update({
      name: payload.name,
      start_date: payload.start_date,
      end_date: payload.end_date,
      is_active: payload.is_active,
    })
    .eq("slug", draft.slug)
    .select("slug")
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "That season was not found.";
  return null;
}

export async function saveSeasonAction(
  _state: SeasonActionState,
  formData: FormData,
): Promise<SeasonActionState> {
  await requireAdminAccess();
  const creating = formData.get("mode") === "create";
  const parsed = readSeasonForm(formData, creating);
  if (!parsed.ok) return { error: parsed.error };

  const existing = (await loadSeasons()).map(toRecord);
  const alreadyExists = existing.some((season) => season.slug === parsed.value.slug);
  if (creating && alreadyExists) return { error: "That slug is already used." };
  if (!creating && !alreadyExists) return { error: "That season was not found." };

  const overlap = seasonOverlapMessage(withSeasonDraft(existing, parsed.value));
  if (overlap) return { error: overlap };

  const writeError = await writeSeason(parsed.value, creating);
  if (writeError) return { error: writeError };

  revalidateBoards();
  return savedState;
}
