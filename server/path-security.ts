import { realpath, stat } from "node:fs/promises";
import path from "node:path";

export class WorkspacePathError extends Error {
  status = 400;
}

export function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function resolveExistingPath(root: string, relativePath: string): Promise<string> {
  const canonicalRoot = await realpath(root);
  if (path.isAbsolute(relativePath)) throw new WorkspacePathError("Paths must be workspace-relative.");
  const lexical = path.resolve(canonicalRoot, relativePath || ".");
  if (!isWithin(canonicalRoot, lexical)) throw new WorkspacePathError("That path is outside the workspace.");
  let resolved: string;
  try {
    resolved = await realpath(lexical);
  } catch {
    throw new WorkspacePathError("The requested path does not exist.");
  }
  if (!isWithin(canonicalRoot, resolved)) throw new WorkspacePathError("Symlinks outside the workspace are not allowed.");
  return resolved;
}

export async function resolveNewPath(root: string, relativePath: string): Promise<string> {
  const canonicalRoot = await realpath(root);
  if (!relativePath || path.isAbsolute(relativePath)) throw new WorkspacePathError("Choose a workspace-relative path.");
  const lexical = path.resolve(canonicalRoot, relativePath);
  if (!isWithin(canonicalRoot, lexical)) throw new WorkspacePathError("That path is outside the workspace.");
  const parent = await realpath(path.dirname(lexical));
  if (!isWithin(canonicalRoot, parent)) throw new WorkspacePathError("Symlinks outside the workspace are not allowed.");
  return path.join(parent, path.basename(lexical));
}

export async function assertDirectory(candidate: string): Promise<string> {
  const resolved = await realpath(candidate);
  if (!(await stat(resolved)).isDirectory()) throw new WorkspacePathError("The workspace path must be a folder.");
  return resolved;
}
