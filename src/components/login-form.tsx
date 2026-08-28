import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ error }: { error: boolean }) {
  return (
    <form action={loginAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="password">Site password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive">That password did not match.</p>
      ) : null}
      <Button type="submit">Enter</Button>
    </form>
  );
}
