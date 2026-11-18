import { adminLogoutAction } from "@/app/admin/actions";
import { AdminPasscodeForm } from "@/components/admin-passcode-form";
import { AdminSeasonForm } from "@/components/admin-season-form";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminCookieName, adminIsConfigured, verifyAdminSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { formatSeasonRange, listResolvedSeasons, type SeasonRecord } from "@/lib/seasons";
import { requireSiteAccess } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function todayInNewYork() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

async function loadSeasonRecords(): Promise<SeasonRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("slug, name, start_date, end_date, is_active")
    .order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    slug: row.slug,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
  }));
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSiteAccess();
  const params = await searchParams;
  const store = await cookies();
  const unlocked = verifyAdminSession(store.get(adminCookieName())?.value);

  if (!adminIsConfigured()) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <p className="text-sm text-muted-foreground">
            Set `ADMIN_PASSWORD` in the environment to open the season editor.
          </p>
        </main>
      </>
    );
  }

  if (!unlocked) {
    return (
      <>
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Admin</CardTitle>
              <CardDescription>Enter the passcode to edit seasons.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminPasscodeForm error={params.error === "1"} />
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (!hasSupabaseConfig()) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <p className="text-sm text-muted-foreground">Connect Supabase first.</p>
        </main>
      </>
    );
  }

  const records = await loadSeasonRecords();
  const seasons = listResolvedSeasons(records);
  const storedBySlug = new Map(records.map((season) => [season.slug, season]));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Seasons</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The active season is the board default. An empty end date runs until the day before
              the next season starts.
            </p>
          </div>
          <form action={adminLogoutAction}>
            <Button variant="outline" size="sm" type="submit">
              Lock admin
            </Button>
          </form>
        </div>

        {seasons.map((season) => {
          const stored = storedBySlug.get(season.id);
          return (
            <Card key={season.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {season.name}
                  {season.isActive ? <Badge>Active</Badge> : null}
                </CardTitle>
                <CardDescription>{formatSeasonRange(season)}</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminSeasonForm
                  key={`${season.id}-${season.startDate}-${stored?.endDate ?? ""}-${season.isActive}`}
                  mode="edit"
                  slug={season.id}
                  name={season.name}
                  startDate={season.startDate}
                  endDate={stored?.endDate ?? ""}
                  isActive={season.isActive}
                />
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle>New season</CardTitle>
            <CardDescription>
              Starting a season leaves the previous one open until the day before, unless you set
              an end date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminSeasonForm
              mode="create"
              slug=""
              name=""
              startDate={todayInNewYork()}
              endDate=""
              isActive
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
