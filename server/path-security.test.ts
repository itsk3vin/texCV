import { mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { isWithin, resolveExistingPath, resolveNewPath } from "./path-security.js";

const created: string[] = [];
afterEach(async () => Promise.all(created.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))));

describe("workspace path security", () => {
  it("accepts paths in the workspace and rejects traversal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "resume-tex-test-")); created.push(root);
    await writeFile(path.join(root, "resume.tex"), "hello");
    expect(await resolveExistingPath(root, "resume.tex")).toBe(path.join(await realpath(root), "resume.tex"));
    await expect(resolveExistingPath(root, "../outside.tex")).rejects.toThrow("outside the workspace");
    await expect(resolveNewPath(root, "../outside.tex")).rejects.toThrow("outside the workspace");
  });

  it("rejects symlinks that escape the workspace", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "resume-tex-test-")); created.push(root);
    const outside = await mkdtemp(path.join(os.tmpdir(), "resume-tex-outside-")); created.push(outside);
    await writeFile(path.join(outside, "secret.tex"), "secret");
    await symlink(path.join(outside, "secret.tex"), path.join(root, "linked.tex"));
    await expect(resolveExistingPath(root, "linked.tex")).rejects.toThrow("Symlinks outside");
  });

  it("does not confuse sibling prefixes for descendants", () => {
    expect(isWithin("/tmp/resume", "/tmp/resume/file.tex")).toBe(true);
    expect(isWithin("/tmp/resume", "/tmp/resume-private/file.tex")).toBe(false);
  });
});
