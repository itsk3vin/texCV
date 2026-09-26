import type { CompileResult, WorkspaceInfo } from "../shared/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || "Local request failed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  workspace: () => request<WorkspaceInfo>("/api/workspace"),
  readFile: async (path: string) => {
    const response = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error((await response.json()).error || "Could not open the file.");
    return response.text();
  },
  writeFile: (path: string, content: string) => request<void>("/api/file", json("PUT", { path, content })),
  createEntry: (path: string, kind: "file" | "directory") => request("/api/entry", json("POST", { path, kind })),
  renameEntry: (from: string, to: string) => request("/api/entry", json("PATCH", { from, to })),
  deleteEntry: (path: string) => request<void>(`/api/entry?path=${encodeURIComponent(path)}`, { method: "DELETE" }),
  createStarter: (path?: string) => request<{ path: string }>("/api/starter", json("POST", path ? { path } : {})),
  setDefaultTemplate: (content: string) => request<void>("/api/template", json("PUT", { content })),
  compile: (entryFile: string) => request<CompileResult>("/api/compile", json("POST", { entryFile })),
};
