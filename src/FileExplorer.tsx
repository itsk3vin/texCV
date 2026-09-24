import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FileImage, FilePlus2, Folder, FolderPlus, Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { WorkspaceEntry } from "../shared/types";

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
  return /\.(png|jpe?g|svg|pdf)$/i.test(name) ? <FileImage size={15} /> : <FileCode2 size={15} />;
}

function TreeItem({ entry, active, selected, onOpen, onSelect, depth = 0 }: { entry: WorkspaceEntry; active?: string; selected?: string; onOpen: (entry: WorkspaceEntry) => void; onSelect: (entry: WorkspaceEntry) => void; depth?: number }) {
  const [open, setOpen] = useState(true);
  if (entry.kind === "directory") return (
    <div>
      <button className={`tree-row ${selected === entry.path ? "selected" : ""}`} style={{ paddingLeft: 12 + depth * 14 }} onClick={() => { onSelect(entry); setOpen((value) => !value); }}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Folder size={15} /><span>{entry.name}</span>
      </button>
      {open ? entry.children?.map((child) => <TreeItem key={child.path} entry={child} active={active} selected={selected} onOpen={onOpen} onSelect={onSelect} depth={depth + 1} />) : null}
    </div>
  );
  return (
    <button className={`tree-row ${active === entry.path ? "active" : selected === entry.path ? "selected" : ""}`} style={{ paddingLeft: 28 + depth * 14 }} onClick={() => { onSelect(entry); onOpen(entry); }} title={entry.editable ? entry.path : `${entry.path} (supporting file)`}>
      <FileIcon name={entry.name} /><span>{entry.name}</span>{entry.editable ? null : <span className="readonly-dot" />}
    </button>
  );
}

export function FileExplorer(props: Props) {
  return (
    <aside className="explorer" aria-label="File explorer">
      <div className="pane-header explorer-header">
        <span>{props.workspaceName.toUpperCase()}</span>
        <div className="explorer-actions">
          <button onClick={() => props.onCreate("file")} className="icon-button" aria-label="New file" title="New file"><FilePlus2 size={15} /></button>
          <button onClick={() => props.onCreate("directory")} className="icon-button" aria-label="New folder" title="New folder"><FolderPlus size={15} /></button>
          <button onClick={props.onRename} className="icon-button" aria-label="Rename selected" title="Rename selected" disabled={!props.selected}><Pencil size={14} /></button>
          <button onClick={props.onDelete} className="icon-button danger" aria-label="Delete selected" title="Delete selected" disabled={!props.selected}><Trash2 size={14} /></button>
          <button onClick={props.onRefresh} className="icon-button" aria-label="Refresh files" title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>
      <nav className="tree" tabIndex={-1} id="file-explorer">
        {props.entries.map((entry) => <TreeItem key={entry.path} entry={entry} active={props.active} selected={props.selected} onOpen={props.onOpen} onSelect={props.onSelect} />)}
      </nav>
    </aside>
  );
}
