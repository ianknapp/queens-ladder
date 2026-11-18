import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminCookieName,
  sessionCookieName,
  siteIsLocked,
  verifyAdminSession,
  verifySession,
} from "@/lib/auth";

export async function requireSiteAccess() {
  if (!siteIsLocked()) return;
  const store = await cookies();
  if (!verifySession(store.get(sessionCookieName())?.value)) {
    redirect("/login");
  }
}

export async function requireAdminAccess() {
  await requireSiteAccess();
  const store = await cookies();
  if (!verifyAdminSession(store.get(adminCookieName())?.value)) {
    redirect("/admin");
  }
}
