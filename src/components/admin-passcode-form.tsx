import { adminLoginAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminPasscodeForm({ error }: { error: boolean }) {
  return (
    <form action={adminLoginAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="admin-password">Admin passcode</Label>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">That passcode did not match.</p> : null}
      <Button type="submit">Unlock</Button>
    </form>
  );
}
