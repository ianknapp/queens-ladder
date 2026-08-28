import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";
import { sessionCookieName, siteIsLocked, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!siteIsLocked()) redirect("/");
  const store = await cookies();
  if (verifySession(store.get(sessionCookieName())?.value)) redirect("/");
  const params = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Ladder</CardTitle>
          <CardDescription>Enter the shared site password to view the boards.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm error={params.error === "1"} />
        </CardContent>
      </Card>
    </main>
  );
}
