"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionCookieName, sessionToken, verifySitePassword } from "@/lib/auth";
import { searchCapturedPlayers } from "@/lib/queries";
import { requireSiteAccess } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!verifySitePassword(password)) {
    redirect("/login?error=1");
  }
  const store = await cookies();
  store.set(sessionCookieName(), sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(sessionCookieName());
  redirect("/login");
}

export async function setTrackedAction(playerId: string, isTracked: boolean) {
  await requireSiteAccess();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("players")
    .update({ is_tracked: isTracked, updated_at: new Date().toISOString() })
    .eq("id", playerId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Player is not in the captured list.");
  }
  revalidatePath("/");
  revalidatePath("/players");
}

export async function searchPlayersAction(query: string) {
  await requireSiteAccess();
  return searchCapturedPlayers(query);
}
