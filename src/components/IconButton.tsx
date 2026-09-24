import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";

type Props = Omit<ButtonProps, "children" | "size"> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, children, variant = "ghost", ...props }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button aria-label={label} size="icon-xs" variant={variant} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
