import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, FileAddIcon, FileCodeIcon, FileImageIcon, FolderAddIcon, FolderIcon, PencilIcon, RefreshCwIcon, TrashIcon } from "@hugeicons/core-free-icons";
import type { WorkspaceEntry } from "../shared/types";
import { Button } from "./components/ui/button";
import { IconButton } from "./components/IconButton";
import { AppIcon } from "./components/AppIcon";

type Props = {
  entries: WorkspaceEntry[];
  active?: string;
  selected?: string;
  workspaceName: string;
  onOpen: (entry: WorkspaceEntry) => void;
  onSelect: (entry: WorkspaceEntry) => void;
  onCreate: (kind: "file" | "directory") => void;
  onRename: () => void;
  onDelete: () => void;
  onRefresh: () => void;
};

function FileIcon({ name }: { name: string }) {
  return /\.(png|jpe?g|svg|pdf)$/i.test(name) ? <AppIcon icon={FileImageIcon} size={15} /> : <AppIcon icon={FileCodeIcon} size={15} />;
}

function TreeItem({ entry, active, selected, onOpen, onSelect, depth = 0 }: { entry: WorkspaceEntry; active?: string; selected?: string; onOpen: (entry: WorkspaceEntry) => void; onSelect: (entry: WorkspaceEntry) => void; depth?: number }) {
  const [open, setOpen] = useState(true);
  if (entry.kind === "directory") return (
    <div>
      <Button variant="ghost" size="sm" className={`tree-row ${selected === entry.path ? "selected" : ""}`} style={{ paddingLeft: 12 + depth * 14 }} onClick={() => { onSelect(entry); setOpen((value) => !value); }}>
        {open ? <AppIcon icon={ChevronDownIcon} size={13} /> : <AppIcon icon={ChevronRightIcon} size={13} />}<AppIcon icon={FolderIcon} size={15} /><span>{entry.name}</span>
      </Button>
      {open ? entry.children?.map((child) => <TreeItem key={child.path} entry={child} active={active} selected={selected} onOpen={onOpen} onSelect={onSelect} depth={depth + 1} />) : null}
    </div>
  );
  return (
    <Button variant="ghost" size="sm" className={`tree-row ${active === entry.path ? "active" : selected === entry.path ? "selected" : ""}`} style={{ paddingLeft: 28 + depth * 14 }} onClick={() => { onSelect(entry); onOpen(entry); }} title={entry.editable ? entry.path : `${entry.path} (supporting file)`}>
      <FileIcon name={entry.name} /><span>{entry.name}</span>{entry.editable ? null : <span className="readonly-dot" />}
    </Button>
  );
}

export function FileExplorer(props: Props) {
  return (
    <aside className="explorer" aria-label="File explorer">
      <div className="pane-header explorer-header">
        <span>{props.workspaceName.toUpperCase()}</span>
        <div className="explorer-actions">
          <IconButton onClick={() => props.onCreate("file")} label="New file"><AppIcon icon={FileAddIcon} /></IconButton>
          <IconButton onClick={() => props.onCreate("directory")} label="New folder"><AppIcon icon={FolderAddIcon} /></IconButton>
          <IconButton onClick={props.onRename} label="Rename selected" disabled={!props.selected}><AppIcon icon={PencilIcon} /></IconButton>
          <IconButton onClick={props.onDelete} label="Delete selected" variant="destructive-outline" disabled={!props.selected}><AppIcon icon={TrashIcon} /></IconButton>
          <IconButton onClick={props.onRefresh} label="Refresh files"><AppIcon icon={RefreshCwIcon} /></IconButton>
        </div>
      </div>
      <nav className="tree" tabIndex={-1} id="file-explorer">
        {props.entries.map((entry) => <TreeItem key={entry.path} entry={entry} active={props.active} selected={props.selected} onOpen={props.onOpen} onSelect={props.onSelect} />)}
      </nav>
    </aside>
  );
}
