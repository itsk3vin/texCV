import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Braces, Check, ChevronLeft, ChevronRight, CircleAlert, FileCode2, PanelLeftClose, PanelLeftOpen, Play, Save } from "lucide-react";
import type { CompileResult, CompileStatus, Diagnostic, WorkspaceEntry, WorkspaceInfo } from "../shared/types";
import { api } from "./api";
import { Editor } from "./Editor";
import { FileExplorer } from "./FileExplorer";
import { PdfPreview } from "./PdfPreview";

function firstTex(entries: WorkspaceEntry[]): string | undefined {
  const files = entries.flatMap((entry): WorkspaceEntry[] => entry.kind === "directory" ? flatten(entry.children ?? []) : [entry]);
  return files.find((entry) => entry.path === "resume.tex")?.path ?? files.find((entry) => entry.editable)?.path;
}

function flatten(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  return entries.flatMap((entry): WorkspaceEntry[] => entry.kind === "directory" ? flatten(entry.children ?? []) : [entry]);
}

function parentPath(value: string) {
  const parts = value.split("/");
  parts.pop();
  return parts.join("/");
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo>();
  const [activeFile, setActiveFile] = useState<string>();
  const [selected, setSelected] = useState<{ path: string; kind: "file" | "directory" }>();
  const [source, setSource] = useState("");
  const [savedSource, setSavedSource] = useState("");
  const [status, setStatus] = useState<CompileStatus>("idle");
  const [result, setResult] = useState<CompileResult>();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [notice, setNotice] = useState<string>();
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [editorWidth, setEditorWidth] = useState(50);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const saving = useRef(false);
  const compileSequence = useRef(0);
  const activeRef = useRef<string | undefined>(undefined);
  const sourceRef = useRef("");
  const savedRef = useRef("");
  activeRef.current = activeFile;
  sourceRef.current = source;
  savedRef.current = savedSource;

  const loadWorkspace = useCallback(async (selectDefault = false) => {
    try {
      const info = await api.workspace();
      setWorkspace(info);
      if (!info.tectonicAvailable) setStatus("unavailable");
      if (selectDefault && !activeRef.current) {
        const next = firstTex(info.entries);
        if (next) await openFile(next);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load workspace."); }
  }, []);

  const openFile = useCallback(async (path: string) => {
    if (activeRef.current === path) return;
    try {
      const content = await api.readFile(path);
      setActiveFile(path); setSelected({ path, kind: "file" }); setSource(content); setSavedSource(content); setDiagnostics([]); setNotice(undefined);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not open file."); }
  }, []);

  const compile = useCallback(async (saveFirst = true) => {
    const file = activeRef.current;
    if (!file) return;
    const sequence = ++compileSequence.current;
    try {
      if (saveFirst && sourceRef.current !== savedRef.current) {
        setStatus("saving"); saving.current = true;
        await api.writeFile(file, sourceRef.current);
        setSavedSource(sourceRef.current);
        saving.current = false;
      }
      setStatus("compiling"); setNotice(undefined);
      const next = await api.compile(file);
      if (sequence !== compileSequence.current) return;
      setResult(next); setDiagnostics(next.diagnostics); setStatus(next.success ? "success" : "error");
    } catch (error) {
      if (sequence !== compileSequence.current) return;
      saving.current = false; setStatus("error"); setNotice(error instanceof Error ? error.message : "Compile failed.");
    }
  }, []);

  useEffect(() => { void loadWorkspace(true); }, [loadWorkspace]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === "workspace" && !saving.current) void loadWorkspace(false);
    };
    return () => events.close();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!activeFile || source === savedSource || status === "unavailable") return;
    const timer = window.setTimeout(() => void compile(true), 550);
    return () => window.clearTimeout(timer);
  }, [source, activeFile, savedSource, compile, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key.toLowerCase() === "b") { event.preventDefault(); setExplorerOpen((value) => !value); }
      if (event.metaKey && event.key.toLowerCase() === "p") { event.preventDefault(); document.querySelector<HTMLButtonElement>(".tree-row")?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "compile_active_resume", title: "Compile active resume", description: "Save and compile the currently open LaTeX resume, then report the result.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async () => { await compile(true); return { file: activeRef.current, requested: true }; },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [compile]);

  const createStarter = async () => {
    try {
      const created = await api.createStarter();
      await loadWorkspace(false);
      await openFile(created.path);
      if (workspace?.tectonicAvailable) setTimeout(() => void compile(false), 0);
    }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not create starter."); }
  };

  const createEntry = async (kind: "file" | "directory") => {
    const base = selected?.kind === "directory" ? selected.path : selected ? parentPath(selected.path) : "";
    const name = window.prompt(kind === "file" ? "New file name" : "New folder name", kind === "file" ? "section.tex" : "assets");
    if (!name) return;
    const path = [base, name].filter(Boolean).join("/");
    try { await api.createEntry(path, kind); await loadWorkspace(false); if (kind === "file" && name.endsWith(".tex")) await openFile(path); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not create entry."); }
  };

  const renameEntry = async () => {
    if (!selected) return;
    const name = window.prompt(`Rename ${selected.kind}`, selected.path.split("/").pop());
    if (!name) return;
    const to = [parentPath(selected.path), name].filter(Boolean).join("/");
    try {
      await api.renameEntry(selected.path, to);
      const wasActive = activeFile === selected.path;
      setSelected({ path: to, kind: selected.kind });
      if (wasActive) setActiveFile(undefined);
      await loadWorkspace(false);
      if (wasActive && name.endsWith(".tex")) await openFile(to);
    }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not rename entry."); }
  };

  const deleteEntry = async () => {
    if (!selected || !window.confirm(`Delete ${selected.path}? This cannot be undone.`)) return;
    try {
      await api.deleteEntry(selected.path);
      if (activeFile === selected.path || (selected.kind === "directory" && activeFile?.startsWith(`${selected.path}/`))) {
        setActiveFile(undefined); setSource(""); setSavedSource(""); setResult(undefined);
      }
      setSelected(undefined);
      await loadWorkspace(false);
    }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete entry."); }
  };

  const beginResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX, start = editorWidth;
    const move = (next: MouseEvent) => setEditorWidth(Math.min(72, Math.max(30, start + ((next.clientX - startX) / window.innerWidth) * 100)));
    const end = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", end); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
  };

  const statusLabel = status === "success" ? `Built in ${result?.durationMs ?? 0} ms` : status === "unavailable" ? "Tectonic unavailable" : status;
  const hasUnsaved = source !== savedSource;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Braces size={17} /></div><span>RES<b>TEX</b></span></div>
        <div className="workspace-path">{workspace?.path ?? "Opening workspace…"}</div>
        <div className="top-actions">
          <button className="toolbar-button" onClick={() => void compile(true)} disabled={!activeFile || status === "unavailable"}><Play size={14} fill="currentColor" /> Build <kbd>⌘↵</kbd></button>
          <button className="toolbar-button primary" onClick={() => void compile(true)} disabled={!activeFile}><Save size={14} /> Save <kbd>⌘S</kbd></button>
        </div>
      </header>

      {!workspace?.tectonicAvailable && workspace ? <div className="setup-banner"><AlertTriangle size={17} /><span><strong>Tectonic is not installed.</strong> The editor works, but preview requires <code>brew install tectonic</code>.</span></div> : null}
      {notice ? <div className="notice"><CircleAlert size={15} />{notice}<button onClick={() => setNotice(undefined)}>Dismiss</button></div> : null}

      <div className="workspace-grid" style={{ gridTemplateColumns: explorerOpen ? `240px minmax(320px, ${editorWidth}fr) 5px minmax(360px, ${100 - editorWidth}fr)` : `0 minmax(320px, ${editorWidth}fr) 5px minmax(360px, ${100 - editorWidth}fr)` }}>
        <div className={explorerOpen ? "explorer-wrap" : "explorer-wrap closed"}>
          {workspace && explorerOpen ? <FileExplorer entries={workspace.entries} active={activeFile} selected={selected?.path} workspaceName={workspace.name} onSelect={(entry) => setSelected({ path: entry.path, kind: entry.kind })} onOpen={(entry) => entry.editable ? void openFile(entry.path) : setNotice(`${entry.name} is a supporting file and cannot be edited here.`)} onCreate={(kind) => void createEntry(kind)} onRename={() => void renameEntry()} onDelete={() => void deleteEntry()} onRefresh={() => void loadWorkspace(false)} /> : null}
        </div>
        <section className="editor-pane">
          <div className="pane-header file-tab">
            <button className="icon-button explorer-toggle" onClick={() => setExplorerOpen((value) => !value)} aria-label="Toggle explorer">{explorerOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}</button>
            {activeFile ? <><FileCode2 size={14} /><span>{activeFile}</span>{hasUnsaved ? <i className="unsaved" aria-label="Unsaved" /> : null}</> : <span>EDITOR</span>}
          </div>
          {activeFile ? <Editor value={source} filePath={activeFile} onChange={setSource} onSave={() => void compile(true)} onCompile={() => void compile(true)} onCursor={(line, column) => setCursor({ line, column })} /> : (
            <div className="editor-empty">
              <div className="empty-icon"><Braces size={26} /></div>
              <h1>{workspace?.isEmpty ? "Start your resume" : "Choose a LaTeX file"}</h1>
              <p>{workspace?.isEmpty ? "Create a clean US Letter starting point, then make it yours." : "Open a .tex file from the explorer to begin editing."}</p>
              {workspace?.isEmpty ? <button className="create-starter" onClick={() => void createStarter()}>Create resume.tex</button> : null}
            </div>
          )}
        </section>
        <div className="resize-handle" onMouseDown={beginResize} role="separator" aria-label="Resize editor and preview"><ChevronLeft size={10} /><ChevronRight size={10} /></div>
        <PdfPreview pdfUrl={result?.success ? result.pdfUrl : undefined} pageCount={result?.pageCount} compiling={status === "compiling" || status === "saving"} error={status === "error" ? "Fix the errors below to update the preview." : undefined} />
      </div>

      {diagnostics.length > 0 ? <section className="diagnostics"><div className="diagnostics-title"><CircleAlert size={14} /> PROBLEMS <span>{diagnostics.length}</span></div>{diagnostics.slice(0, 4).map((item, index) => <div className={`diagnostic ${item.severity}`} key={`${item.message}-${index}`}><span>{item.severity === "error" ? "×" : "!"}</span><p>{item.message}</p><small>{item.file}{item.line ? `:${item.line}` : ""}</small></div>)}</section> : null}
      <footer className="statusbar">
        <div><span className={`status-indicator ${status}`} />{statusLabel}{hasUnsaved ? " • unsaved" : ""}</div>
        <div className="status-meta"><span>US LETTER</span><span>PAGE {result?.pageCount ? `1 / ${result.pageCount}` : "—"}</span><span>Ln {cursor.line}, Col {cursor.column}</span><span>LaTeX</span>{status === "success" ? <Check size={13} /> : null}</div>
      </footer>
    </main>
  );
}
