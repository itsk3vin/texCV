import { LoaderCircleIcon } from "@hugeicons/core-free-icons";
import type React from "react";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/AppIcon";

export function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<typeof AppIcon>, "icon">): React.ReactElement {
  return (
    <AppIcon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
      icon={LoaderCircleIcon}
    />
  );
}
