import { useState } from "react";
import { cn } from "@/lib/utils";

interface LogoAvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base"
};

export function LogoAvatar({ src, name, size = "md", className }: LogoAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const initials = name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "rounded-md bg-muted flex items-center justify-center font-medium text-muted-foreground shrink-0",
          sizeClasses[size],
          className
        )}
        data-testid="logo-fallback"
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      onError={() => setHasError(true)}
      className={cn(
        "rounded-md object-contain bg-white/10 shrink-0",
        sizeClasses[size],
        className
      )}
      data-testid="logo-image"
    />
  );
}
