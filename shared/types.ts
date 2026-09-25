export type WorkspaceEntry = {
  name: string;
  path: string;
  kind: "file" | "directory";
  editable: boolean;
  modifiedAt?: number;
  children?: WorkspaceEntry[];
};

export type Diagnostic = {
  severity: "error" | "warning";
  message: string;
  file?: string;
  line?: number;
  column?: number;
};

export type CompileStatus = "idle" | "saving" | "compiling" | "success" | "error" | "unavailable";

export type CompileResult = {
  success: boolean;
  version: number;
  pageCount?: number;
  pdfUrl?: string;
  diagnostics: Diagnostic[];
  durationMs: number;
};

export type WorkspaceInfo = {
  name: string;
  path: string;
  entries: WorkspaceEntry[];
  isEmpty: boolean;
  tectonicAvailable: boolean;
  tectonicVersion?: string;
};

export type WorkspaceEvent = {
  type: "workspace" | "compile";
  path?: string;
  status?: CompileStatus;
};
