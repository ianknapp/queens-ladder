import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "size-5",
  md: "size-10",
  lg: "size-16",
} as const;

export function PlayerAvatar({
  src,
  size = "sm",
  className,
}: {
  src: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const dim = SIZE_CLASS[size];
  if (src) {
    return (
      // LinkedIn CDNs vary; native img avoids next/image remote config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn(dim, "shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return <span className={cn(dim, "shrink-0 rounded-full bg-muted", className)} />;
}
