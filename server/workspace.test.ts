import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceEntry, deleteWorkspaceEntry, readDefaultTemplate, readTree, renameWorkspaceEntry, writeDefaultTemplate, writeWorkspaceFile } from "./workspace.js";

const created: string[] = [];
afterEach(async () => Promise.all(created.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))));

describe("workspace operations", () => {
  it("creates, updates, renames, lists, and deletes TeX files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "resume-tex-test-")); created.push(root);
    await createWorkspaceEntry(root, "resume.tex", "file");
    await writeWorkspaceFile(root, "resume.tex", "\\documentclass{article}");
    await renameWorkspaceEntry(root, "resume.tex", "cv.tex");
    expect(await readFile(path.join(root, "cv.tex"), "utf8")).toContain("documentclass");
    expect((await readTree(root))[0]).toMatchObject({ name: "cv.tex", editable: true });
    await deleteWorkspaceEntry(root, "cv.tex");
    expect(await readTree(root)).toEqual([]);
  });

  it("refuses writes to supporting files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "resume-tex-test-")); created.push(root);
    await writeFile(path.join(root, "photo.png"), "not really an image");
    await expect(writeWorkspaceFile(root, "photo.png", "changed")).rejects.toThrow("Only .tex files");
  });

  it("persists an exact default template without exposing it in the workspace", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "resume-tex-test-")); created.push(root);
    const template = "\\documentclass{article}\n% exact template\n\\begin{document}\n\\end{document}\n";

    expect(await readDefaultTemplate(root)).toBeUndefined();
    await writeDefaultTemplate(root, template);

    expect(await readDefaultTemplate(root)).toBe(template);
    expect(await readTree(root)).toEqual([]);
  });
});
