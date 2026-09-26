import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircleIcon, BracesIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, Download06Icon, FileCodeIcon, FileStarIcon, PencilEdit01Icon, TriangleAlertIcon } from "@hugeicons/core-free-icons";
import { ChevronDown } from "lucide-react";
import type { CompileResult, CompileStatus, Diagnostic, WorkspaceEntry, WorkspaceInfo } from "../shared/types";
import { api } from "./api";
import { Editor } from "./Editor";
import { FileExplorer } from "./FileExplorer";
import { PdfPreview } from "./PdfPreview";
import { Alert, AlertAction, AlertDescription } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./components/ui/menu";
import { AppIcon } from "./components/AppIcon";
import { Sidebar, SidebarInset, SidebarProvider } from "./components/ui/sidebar";

function firstTex(entries: WorkspaceEntry[], preferred?: string | null): string | undefined {
  const files = entries.flatMap((entry): WorkspaceEntry[] => entry.kind === "directory" ? flatten(entry.children ?? []) : [entry]);
  return files.find((entry) => entry.editable && entry.path === preferred)?.path ?? files.find((entry) => entry.path === "resume.tex")?.path ?? files.find((entry) => entry.editable)?.path;
}

function flatten(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  return entries.flatMap((entry): WorkspaceEntry[] => entry.kind === "directory" ? flatten(entry.children ?? []) : [entry]);
}

function parentPath(value: string) {
  const parts = value.split("/");
  parts.pop();
  return parts.join("/");
}

function documentName(value: string) {
  return value.split("/").pop()?.replace(/\.tex$/i, "") ?? value;
}

const PINNED_RESUMES_KEY = "texcv-pinned-resumes";

function savedPinnedResumes(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(PINNED_RESUMES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string") : [];
  } catch {
    return [];
  }
}

export function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("restex-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
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
  const [defaultFile, setDefaultFile] = useState(() => window.localStorage.getItem("restex-default-document"));
  const [pinnedResumes, setPinnedResumes] = useState(savedPinnedResumes);
  const [documentDialog, setDocumentDialog] = useState<"create" | "rename" | null>(null);
  const [documentTarget, setDocumentTarget] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceEntry>();
  const [documentNameDraft, setDocumentNameDraft] = useState("");
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
        const next = firstTex(info.entries, window.localStorage.getItem("restex-default-document"));
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
      return next;
    } catch (error) {
      if (sequence !== compileSequence.current) return;
      saving.current = false; setStatus("error"); setNotice(error instanceof Error ? error.message : "Compile failed.");
    }
  }, []);

  const downloadPdf = useCallback(async () => {
    const compiled = await compile(true);
    if (!compiled?.success || !compiled.pdfUrl) return;
    const link = document.createElement("a");
    link.href = compiled.pdfUrl;
    link.download = `${activeRef.current?.split("/").pop()?.replace(/\.tex$/i, "") || "resume"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [compile]);

  useEffect(() => { void loadWorkspace(true); }, [loadWorkspace]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    window.localStorage.setItem("restex-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(PINNED_RESUMES_KEY, JSON.stringify(pinnedResumes));
  }, [pinnedResumes]);

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
    if (!activeFile || workspace?.tectonicAvailable !== true) return;
    const timer = window.setTimeout(() => void compile(false), 0);
    return () => window.clearTimeout(timer);
  }, [activeFile, compile, workspace?.tectonicAvailable]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key.toLowerCase() === "p") { event.preventDefault(); document.querySelector<HTMLButtonElement>(".resume-row")?.focus(); }
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

  const openDocumentDialog = (mode: "create" | "rename", target = activeFile) => {
    setDocumentTarget(mode === "rename" ? target : undefined);
    setDocumentNameDraft(mode === "rename" && target ? documentName(target) : "Untitled");
    setDocumentDialog(mode);
  };

  const submitDocumentDialog = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = documentNameDraft.trim().replace(/\.tex$/i, "");
    if (!name || !documentDialog) return;
    const filename = `${name}.tex`;
    if (documentDialog === "create") {
      const base = selected?.kind === "directory" ? selected.path : selected ? parentPath(selected.path) : "";
      const path = [base, filename].filter(Boolean).join("/");
      try {
        await api.createStarter(path);
        await loadWorkspace(false);
        await openFile(path);
        setDocumentDialog(null);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create resume."); }
      return;
    }
    const renameFrom = documentTarget ?? activeFile;
    if (!renameFrom || name === documentName(renameFrom)) { setDocumentDialog(null); return; }
    const to = [parentPath(renameFrom), filename].filter(Boolean).join("/");
    try {
      await api.renameEntry(renameFrom, to);
      if (defaultFile === renameFrom) {
        window.localStorage.setItem("restex-default-document", to);
        setDefaultFile(to);
      }
      setPinnedResumes((paths) => paths.map((path) => path === renameFrom ? to : path));
      await loadWorkspace(false);
      if (activeFile === renameFrom) {
        setActiveFile(undefined);
        await openFile(to);
      }
      setDocumentDialog(null);
      setDocumentTarget(undefined);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not rename file."); }
  };

  const deleteResume = async () => {
    if (!deleteTarget) return;
    const path = deleteTarget.path;
    try {
      await api.deleteEntry(path);
      if (defaultFile === path) {
        window.localStorage.removeItem("restex-default-document");
        setDefaultFile(null);
      }
      setPinnedResumes((paths) => paths.filter((pinnedPath) => pinnedPath !== path));
      if (activeFile === path) {
        setActiveFile(undefined);
        setSelected(undefined);
        setSource("");
        setSavedSource("");
        setResult(undefined);
        setDiagnostics([]);
      }
      setDeleteTarget(undefined);
      await loadWorkspace(false);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete resume."); }
  };

  const makeActiveFileDefault = () => {
    if (!activeFile) return;
    window.localStorage.setItem("restex-default-document", activeFile);
    setDefaultFile(activeFile);
    setNotice(`${documentName(activeFile)} will open by default.`);
  };

  const togglePinnedResume = (path: string) => {
    setPinnedResumes((paths) => paths.includes(path)
      ? paths.filter((pinnedPath) => pinnedPath !== path)
      : [path, ...paths]);
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
    <SidebarProvider open={explorerOpen} onOpenChange={setExplorerOpen} className={`relative isolate h-dvh min-h-0 overflow-hidden bg-(--bg) [&_svg]:[stroke-width:2] ${theme}`} style={{ "--sidebar-width": "15rem" } as React.CSSProperties}>
      <Sidebar collapsible="icon" className="border-border bg-(--surface-sidebar)">
        <FileExplorer entries={workspace?.entries ?? []} active={activeFile} pinnedPaths={pinnedResumes} onTogglePin={togglePinnedResume} onSelect={(entry) => setSelected({ path: entry.path, kind: entry.kind })} onOpen={(entry) => void openFile(entry.path)} onCreate={() => openDocumentDialog("create")} onRename={(entry) => openDocumentDialog("rename", entry.path)} onDelete={setDeleteTarget} theme={theme} onToggleTheme={() => setTheme((value) => value === "dark" ? "light" : "dark")} />
      </Sidebar>
      <SidebarInset className="h-full min-h-0 min-w-0 overflow-hidden bg-(--bg)">
        <header className="flex h-12 shrink-0 items-center justify-center border-b border-border bg-(--surface-header)">
        {activeFile ? (
          <Menu>
            <MenuTrigger render={<Button className="text-lg font-medium" variant="ghost" size="sm" />}><span>{documentName(activeFile)}</span><ChevronDown size={13} /></MenuTrigger>
            <MenuPopup className="min-w-45" align="center">
              <MenuItem onClick={() => openDocumentDialog("rename")}><AppIcon icon={PencilEdit01Icon} />Rename</MenuItem>
              <MenuItem onClick={makeActiveFileDefault} disabled={defaultFile === activeFile}><AppIcon icon={FileStarIcon} />Make default</MenuItem>
              <MenuItem onClick={() => void downloadPdf()} disabled={status === "unavailable"}><AppIcon icon={Download06Icon} />Download PDF</MenuItem>
            </MenuPopup>
          </Menu>
        ) : <div className="overflow-hidden px-4.5 text-center font-mono text-[.72rem] text-(--text-subtle) text-ellipsis whitespace-nowrap max-[900px]:hidden">No file open</div>}
        </header>

      {!workspace?.tectonicAvailable && workspace ? <Alert variant="info" className="min-h-9.5 rounded-none border-x-0 px-3.5 py-2"><AppIcon icon={TriangleAlertIcon} /><AlertDescription><strong>Tectonic is not installed.</strong> The editor works, but preview requires <code className="rounded bg-input px-1.5 py-0.5 text-foreground">brew install tectonic</code>.</AlertDescription></Alert> : null}
      {notice ? <Alert variant="error" className="min-h-9.5 rounded-none border-x-0 px-3.5 py-2"><AppIcon icon={AlertCircleIcon} /><AlertDescription>{notice}</AlertDescription><AlertAction><Button variant="ghost" size="xs" onClick={() => setNotice(undefined)}>Dismiss</Button></AlertAction></Alert> : null}

      <div className="grid min-h-0 flex-1 max-[900px]:grid-cols-1! max-[900px]:grid-rows-[minmax(45%,1fr)_minmax(45%,1fr)]" style={{ gridTemplateColumns: `minmax(320px, ${editorWidth}fr) 5px minmax(360px, ${100 - editorWidth}fr)` }}>
        <section className="flex min-h-0 min-w-0 flex-col bg-(--surface-editor) max-[900px]:col-span-full max-[900px]:border-b-4 max-[900px]:border-border">
          <div className="flex h-9.5 min-h-9.5 items-center gap-2 border-b border-border px-3 font-mono text-[.67rem] font-normal text-(--text-subtle) tracking-[.02em]">
            {activeFile ? <><AppIcon icon={FileCodeIcon} size={14} /><span>{documentName(activeFile)}</span>{hasUnsaved ? <i className="size-1.5 rounded-full bg-(--editor-accent)" aria-label="Unsaved" /> : null}</> : <span>EDITOR</span>}
          </div>
          {activeFile ? <Editor value={source} filePath={activeFile} onChange={setSource} onSave={() => void compile(true)} onCompile={() => void compile(true)} onCursor={(line, column) => setCursor({ line, column })} /> : (
            <div className="flex flex-1 flex-col items-center justify-center p-7 text-center">
              <div className="grid size-13.5 place-items-center rounded-lg border border-border bg-(--surface-raised) text-(--editor-accent) shadow-(--shadow-elevated)"><AppIcon icon={BracesIcon} size={26} /></div>
              <h1 className="mt-4.5 mb-2 text-[1.08rem] font-semibold text-foreground">{workspace?.isEmpty ? "Start your resume" : "Choose a LaTeX file"}</h1>
              <p className="m-0 max-w-85 text-[.85rem] leading-relaxed text-muted-foreground">{workspace?.isEmpty ? "Create a clean US Letter starting point, then make it yours." : "Open a document from the explorer to begin editing."}</p>
              {workspace?.isEmpty ? <Button className="mt-5" variant="outline" onClick={() => void createStarter()}>Create Resume</Button> : null}
            </div>
          )}
        </section>
        <div className="z-2 flex cursor-col-resize items-center justify-center overflow-hidden border-x border-border bg-(--handle) text-(--text-faint) hover:bg-(--handle-hover) hover:text-(--editor-accent) max-[900px]:hidden" onMouseDown={beginResize} role="separator" aria-label="Resize editor and preview"><AppIcon icon={ChevronLeftIcon} size={10} /><AppIcon icon={ChevronRightIcon} size={10} /></div>
        <PdfPreview pdfUrl={result?.success ? result.pdfUrl : undefined} pageCount={result?.pageCount} compiling={status === "compiling" || status === "saving"} error={status === "error" ? "Fix the errors below to update the preview." : undefined} actionsDisabled={!activeFile || status === "unavailable"} onBuild={() => void compile(true)} onDownload={() => void downloadPdf()} />
      </div>

      {diagnostics.length > 0 ? <section className="max-h-37.5 shrink-0 overflow-auto border-t border-(--danger-border) bg-(--danger-surface)"><div className="flex h-8 items-center gap-2 px-3 text-[.65rem] text-(--text-subtle) tracking-[.08em]"><AppIcon icon={AlertCircleIcon} size={14} /> PROBLEMS <Badge variant={diagnostics.some((item) => item.severity === "error") ? "error" : "warning"}>{diagnostics.length}</Badge></div>{diagnostics.slice(0, 4).map((item, index) => <div className="grid min-h-7 grid-cols-[18px_1fr_auto] items-center gap-1 border-t border-(--danger-border) px-3 py-1 text-[.72rem]" key={`${item.message}-${index}`}><span className={item.severity === "error" ? "font-bold text-(--red)" : "font-bold text-(--warning-text)"}>{item.severity === "error" ? "×" : "!"}</span><p className="m-0 overflow-hidden text-foreground text-ellipsis whitespace-nowrap">{item.message}</p><small className="font-mono text-(--text-faint)">{item.file ? documentName(item.file) : ""}{item.line ? `:${item.line}` : ""}</small></div>)}</section> : null}
      <footer className="flex h-6.25 shrink-0 items-center justify-between border-t border-border bg-(--surface-status) px-2 text-[.65rem] text-(--text-subtle)">
        <div className="flex items-center gap-2 capitalize"><span className={`size-1.5 rounded-full ${status === "success" ? "bg-(--green)" : status === "compiling" || status === "saving" ? "bg-(--editor-accent)" : status === "error" || status === "unavailable" ? "bg-(--red)" : "bg-(--text-faint)"}`} />{statusLabel}{hasUnsaved ? " • unsaved" : ""}</div>
        <div className="flex h-full items-center gap-0 [&>span]:flex [&>span]:h-full [&>span]:items-center [&>span]:border-l [&>span]:border-border [&>span]:px-2 max-[900px]:[&>span:nth-child(-n+2)]:hidden"><span>US LETTER</span><span>PAGE {result?.pageCount ? `1 / ${result.pageCount}` : "—"}</span><span>Ln {cursor.line}, Col {cursor.column}</span><span>LaTeX</span>{status === "success" ? <AppIcon icon={CheckIcon} size={13} className="ml-1 text-(--green)" /> : null}</div>
      </footer>
      </SidebarInset>
      <Dialog open={documentDialog !== null} onOpenChange={(open) => { if (!open) { setDocumentDialog(null); setDocumentTarget(undefined); } }}>
        <DialogPopup>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submitDocumentDialog(event)}>
            <DialogHeader>
              <DialogTitle>{documentDialog === "rename" ? "Rename resume" : "New resume"}</DialogTitle>
              <DialogDescription>{documentDialog === "rename" ? "Choose a new name for this local resume." : "Choose a name for the new local resume."}</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <Input autoFocus value={documentNameDraft} onChange={(event) => setDocumentNameDraft(event.target.value)} aria-label="Resume name" />
            </DialogPanel>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDocumentDialog(null)}>Cancel</Button>
              <Button type="submit">{documentDialog === "rename" ? "Rename" : "Create resume"}</Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
      <Dialog open={deleteTarget !== undefined} onOpenChange={(open) => { if (!open) setDeleteTarget(undefined); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Delete resume?</DialogTitle>
            <DialogDescription>This will permanently delete {deleteTarget ? `“${documentName(deleteTarget.path)}”` : "this resume"} from your local workspace.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(undefined)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteResume()}>Delete resume</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </SidebarProvider>
  );
}
