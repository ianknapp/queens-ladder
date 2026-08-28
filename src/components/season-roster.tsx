"use client";

import { useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { searchPlayersAction, setTrackedAction } from "@/app/actions";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlayerSearchHit, RosterPlayer } from "@/lib/queries";

function RemoveButton({ playerId }: { playerId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void setTrackedAction(playerId, false);
        });
      }}
    >
      Remove
    </Button>
  );
}

function PlayerSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlayerSearchHit[]>([]);
  const [lookedUp, setLookedUp] = useState(false);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);
  const timer = useRef<number | null>(null);

  function lookup(value: string) {
    const request = ++requestId.current;
    startTransition(async () => {
      const found = await searchPlayersAction(value);
      if (request !== requestId.current) return;
      setHits(found);
      setLookedUp(true);
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (timer.current) window.clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      requestId.current += 1;
      setHits([]);
      setLookedUp(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      lookup(trimmed);
    }, 200);
  }

  function addPlayer(playerId: string) {
    startTransition(async () => {
      await setTrackedAction(playerId, true);
      setHits((current) =>
        current.map((hit) => (hit.id === playerId ? { ...hit, isTracked: true } : hit)),
      );
      setQuery("");
      setHits([]);
      setLookedUp(false);
    });
  }

  let status: string | null = null;
  if (query.trim().length > 0 && query.trim().length < 2) {
    status = "Type at least 2 letters. Matches stay private until you search.";
  } else if (lookedUp && hits.length === 0 && !pending) {
    status = "No captured player matches. They have to appear on a board first.";
  }

  const showList = hits.length > 0;

  return (
    <div className="relative">
      <Label htmlFor="player-search">Add from capture</Label>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="player-search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search a name…"
          className="pl-8"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls="player-search-results"
          onChange={(event) => handleQueryChange(event.target.value)}
        />
      </div>
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
      {showList ? (
        <ul
          id="player-search-results"
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {hits.map((hit) => (
            <li key={hit.id} role="option" aria-selected={hit.isTracked}>
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <PlayerAvatar src={hit.avatarUrl} />
                <span className="min-w-0 flex-1 truncate text-sm">{hit.displayName}</span>
                {hit.isTracked ? (
                  <span className="text-xs text-muted-foreground">On season</span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => addPlayer(hit.id)}
                  >
                    Add
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SeasonRoster({ players }: { players: RosterPlayer[] }) {
  return (
    <div className="flex flex-col gap-4">
      <PlayerSearch />
      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one is on the season yet. Search a captured name to add them.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {players.map((player) => (
            <li key={player.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <PlayerAvatar src={player.avatarUrl} />
                <span className="truncate text-sm">{player.displayName}</span>
              </div>
              <RemoveButton playerId={player.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
