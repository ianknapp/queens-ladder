import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, siteIsLocked, verifySession } from "@/lib/auth";

export async function requireSiteAccess() {
  if (!siteIsLocked()) return;
  const store = await cookies();
  if (!verifySession(store.get(sessionCookieName())?.value)) {
    redirect("/login");
  }
}
