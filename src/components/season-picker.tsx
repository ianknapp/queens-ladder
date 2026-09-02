import { Button } from "@/components/ui/button";
import type { ResolvedSeason } from "@/lib/seasons";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function SeasonPicker({
  seasons,
  selectedId,
}: {
  seasons: ResolvedSeason[];
  selectedId: string;
}) {
  if (seasons.length < 2) return null;

  const activeId = seasons.find((season) => season.isActive)?.id;

  return (
    <nav aria-label="Seasons" className="flex flex-wrap gap-1">
      {seasons.map((season) => {
        const href = season.id === activeId ? "/" : `/?season=${season.id}`;
        const selected = season.id === selectedId;
        return (
          <Button
            key={season.id}
            variant={selected ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link href={href} className={cn(!selected && "text-muted-foreground")}>
              {season.name}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
