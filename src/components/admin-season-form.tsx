"use client";

import { useActionState } from "react";
import { saveSeasonAction, type SeasonActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SeasonActionState = { error: null };

export function AdminSeasonForm({
  mode,
  slug,
  name,
  startDate,
  endDate,
  isActive,
}: {
  mode: "create" | "edit";
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(saveSeasonAction, initialState);
  const creating = mode === "create";
  const slugId = `${mode}-${slug || "new"}-slug`;
  const nameId = `${mode}-${slug || "new"}-name`;
  const startId = `${mode}-${slug || "new"}-start`;
  const endId = `${mode}-${slug || "new"}-end`;
  const activeId = `${mode}-${slug || "new"}-active`;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="mode" value={mode} />
      {creating ? null : <input type="hidden" name="slug" value={slug} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Name</Label>
          <Input id={nameId} name="name" defaultValue={name} required maxLength={40} />
        </div>
        {creating ? (
          <div className="grid gap-1.5">
            <Label htmlFor={slugId}>Slug</Label>
            <Input id={slugId} name="slug" defaultValue={slug} placeholder="2026-s3" />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor={slugId}>Slug</Label>
            <Input id={slugId} value={slug} readOnly />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={startId}>Starts</Label>
          <Input id={startId} name="startDate" type="date" defaultValue={startDate} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={endId}>Ends</Label>
          <Input id={endId} name="endDate" type="date" defaultValue={endDate} />
        </div>
      </div>
      <label htmlFor={activeId} className="flex items-center gap-2 text-sm">
        <input
          id={activeId}
          name="isActive"
          type="checkbox"
          defaultChecked={isActive}
          className="size-4 accent-primary"
        />
        Active season
      </label>
      <p className="text-xs text-muted-foreground">
        Leave the end date empty to run until the day before the next season starts.
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {creating ? "Add season" : "Save"}
        </Button>
      </div>
    </form>
  );
}
