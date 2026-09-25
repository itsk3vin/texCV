import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type AppIconProps = ComponentProps<typeof HugeiconsIcon>;

export function AppIcon(props: AppIconProps) {
  return <HugeiconsIcon color="currentColor" size={16} strokeWidth={2} {...props} />;
}
