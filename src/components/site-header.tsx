import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { siteIsLocked } from "@/lib/auth";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Ladder
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Boards</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/players">Friends</Link>
          </Button>
          {siteIsLocked() ? (
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Log out
              </Button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
