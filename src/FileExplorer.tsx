import { useMemo, useState } from "react";
import { Delete02Icon, LicenseDraftIcon, PencilEdit01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Moon, Sun } from "lucide-react";
import type { WorkspaceEntry } from "../shared/types";
import { Command, CommandDialog, CommandDialogPopup, CommandEmpty, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList, CommandPanel } from "./components/ui/command";
import { ContextMenu, ContextMenuItem, ContextMenuPopup, ContextMenuTrigger } from "./components/ui/context-menu";
import { AppIcon } from "./components/AppIcon";
import { SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./components/ui/tooltip";

type Props = {
  entries: WorkspaceEntry[];
  active?: string;
  onOpen: (entry: WorkspaceEntry) => void;
  onSelect: (entry: WorkspaceEntry) => void;
  onCreate: () => void;
  onRename: (entry: WorkspaceEntry) => void;
  onDelete: (entry: WorkspaceEntry) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

function flattenFiles(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  return entries.flatMap((entry) => entry.kind === "directory" ? flattenFiles(entry.children ?? []) : entry.editable ? [entry] : []);
}

function displayName(entry: WorkspaceEntry) {
  return entry.name.replace(/\.tex$/i, "");
}

function updatedLabel(modifiedAt?: number) {
  if (!modifiedAt) return "";
  const date = new Date(modifiedAt);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function FileExplorer({ entries, active, onOpen, onSelect, onCreate, onRename, onDelete, theme, onToggleTheme }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const allFiles = useMemo(() => flattenFiles(entries)
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0)), [entries]);

  return (
    <>
      <SidebarHeader className="gap-1.5 p-2">
        <div className="flex h-8 items-center px-1.5">
          <span className="font-bold text-[1.05rem] tracking-[-.02em] [font-family:'DM_Sans',ui-sans-serif,sans-serif] group-data-[collapsible=icon]:hidden">TexCV</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger render={<SidebarMenuButton className="w-7 justify-center" size="sm" aria-label="Search resumes" onClick={() => setSearchOpen(true)} />}>
                <AppIcon icon={Search01Icon} />
              </TooltipTrigger>
              <TooltipContent side="right">Search resumes</TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="sm" tooltip="Create resume" onClick={onCreate}>
                  <AppIcon icon={LicenseDraftIcon} />
                  <span>Create resume</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="pt-0">
          <SidebarGroupLabel>Resumes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allFiles.map((entry) => (
                <SidebarMenuItem key={entry.path}>
                  <ContextMenu>
                    <ContextMenuTrigger render={<SidebarMenuButton className="resume-row" size="sm" isActive={active === entry.path} tooltip={displayName(entry)} onClick={() => { onSelect(entry); onOpen(entry); }} title={entry.path} />}>
                      <AppIcon icon={LicenseDraftIcon} />
                      <span className="min-w-0 flex-1 truncate">{displayName(entry)}</span>
                      <time className="ml-auto shrink-0 text-[.625rem] text-(--text-faint) tabular-nums group-data-[collapsible=icon]:hidden" dateTime={entry.modifiedAt ? new Date(entry.modifiedAt).toISOString() : undefined}>{updatedLabel(entry.modifiedAt)}</time>
                    </ContextMenuTrigger>
                    <ContextMenuPopup align="start">
                      <ContextMenuItem onClick={() => onRename(entry)}><AppIcon icon={PencilEdit01Icon} />Rename</ContextMenuItem>
                      <ContextMenuItem variant="destructive" onClick={() => onDelete(entry)}><AppIcon icon={Delete02Icon} />Delete</ContextMenuItem>
                    </ContextMenuPopup>
                  </ContextMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {allFiles.length === 0 ? <p className="mx-2 my-5 text-center text-xs text-(--text-faint) group-data-[collapsible=icon]:hidden">No local resumes yet</p> : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger render={<SidebarMenuButton className="w-8 justify-center" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={onToggleTheme} />}>
                {theme === "dark" ? <Sun /> : <Moon />}
              </TooltipTrigger>
              <TooltipContent side="right">{theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandDialogPopup>
          <Command items={allFiles} itemToStringValue={(entry) => displayName(entry as WorkspaceEntry)}>
            <CommandInput placeholder="Search resumes" />
            <CommandPanel>
              <CommandEmpty>No matching resumes</CommandEmpty>
              <CommandGroup>
                <CommandGroupLabel className="px-4">Resumes</CommandGroupLabel>
                <CommandList>
                  {(entry: WorkspaceEntry) => <CommandItem key={entry.path} value={entry} onClick={() => { onSelect(entry); onOpen(entry); setSearchOpen(false); }}><AppIcon icon={LicenseDraftIcon} />{displayName(entry)}</CommandItem>}
                </CommandList>
              </CommandGroup>
            </CommandPanel>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </>
  );
}
