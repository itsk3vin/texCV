import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceEntry } from "../shared/types.js";
import { resolveExistingPath, resolveNewPath, WorkspacePathError } from "./path-security.js";

const DEFAULT_TEMPLATE_PATH = ".restex-template.tex";
const HIDDEN = new Set([".git", "node_modules", "dist", "dist-server", ".DS_Store", DEFAULT_TEMPLATE_PATH]);
const EDITABLE = new Set([".tex"]);

export async function readTree(root: string): Promise<WorkspaceEntry[]> {
  async function walk(folder: string, prefix = ""): Promise<WorkspaceEntry[]> {
    const dirents = await readdir(folder, { withFileTypes: true });
    const entries: WorkspaceEntry[] = [];
    for (const dirent of dirents) {
      if (HIDDEN.has(dirent.name)) continue;
      const relative = path.posix.join(prefix, dirent.name);
      const absolute = path.join(folder, dirent.name);
      if (dirent.isSymbolicLink()) continue;
      if (dirent.isDirectory()) {
        entries.push({ name: dirent.name, path: relative, kind: "directory", editable: false, children: await walk(absolute, relative) });
      } else if (dirent.isFile()) {
        const fileStat = await stat(absolute);
        entries.push({ name: dirent.name, path: relative, kind: "file", editable: EDITABLE.has(path.extname(dirent.name).toLowerCase()), modifiedAt: fileStat.mtimeMs });
      }
    }
    return entries.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1);
  }
  return walk(root);
}

export async function readWorkspaceFile(root: string, relativePath: string): Promise<string> {
  const absolute = await resolveExistingPath(root, relativePath);
  if (!(await stat(absolute)).isFile()) throw new WorkspacePathError("Only files can be opened.");
  if (!EDITABLE.has(path.extname(absolute).toLowerCase())) throw new WorkspacePathError("Only .tex files can be edited.");
  return readFile(absolute, "utf8");
}

export async function writeWorkspaceFile(root: string, relativePath: string, content: unknown): Promise<void> {
  if (typeof content !== "string") throw new WorkspacePathError("File content must be text.");
  const absolute = await resolveExistingPath(root, relativePath);
  if (!EDITABLE.has(path.extname(absolute).toLowerCase())) throw new WorkspacePathError("Only .tex files can be edited.");
  await writeFile(absolute, content, "utf8");
}

export async function readDefaultTemplate(root: string): Promise<string | undefined> {
  try {
    return await readFile(await resolveExistingPath(root, DEFAULT_TEMPLATE_PATH), "utf8");
  } catch (error) {
    if (error instanceof WorkspacePathError && error.message === "The requested path does not exist.") return undefined;
    throw error;
  }
}

export async function writeDefaultTemplate(root: string, content: unknown): Promise<void> {
  if (typeof content !== "string") throw new WorkspacePathError("Template content must be text.");
  try {
    await writeFile(await resolveExistingPath(root, DEFAULT_TEMPLATE_PATH), content, "utf8");
  } catch (error) {
    if (!(error instanceof WorkspacePathError) || error.message !== "The requested path does not exist.") throw error;
    await writeFile(await resolveNewPath(root, DEFAULT_TEMPLATE_PATH), content, { encoding: "utf8", flag: "wx" });
  }
}

export async function createWorkspaceEntry(root: string, relativePath: string, kind: unknown): Promise<void> {
  if (kind !== "file" && kind !== "directory") throw new WorkspacePathError("Entry kind must be file or directory.");
  const absolute = await resolveNewPath(root, relativePath);
  try {
    await stat(absolute);
    throw new WorkspacePathError("A file or folder with that name already exists.");
  } catch (error) {
    if (error instanceof WorkspacePathError) throw error;
  }
  if (kind === "directory") await mkdir(absolute);
  else await writeFile(absolute, "", { encoding: "utf8", flag: "wx" });
}

export async function renameWorkspaceEntry(root: string, from: string, to: string): Promise<void> {
  const source = await resolveExistingPath(root, from);
  const destination = await resolveNewPath(root, to);
  try {
    await stat(destination);
    throw new WorkspacePathError("A file or folder with that name already exists.");
  } catch (error) {
    if (error instanceof WorkspacePathError) throw error;
  }
  await rename(source, destination);
}

export async function deleteWorkspaceEntry(root: string, relativePath: string): Promise<void> {
  if (!relativePath) throw new WorkspacePathError("The workspace root cannot be deleted.");
  const absolute = await resolveExistingPath(root, relativePath);
  await rm(absolute, { recursive: true });
}
