import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { PDFDocument } from "pdf-lib";
import type { CompileResult, Diagnostic } from "../shared/types.js";
import { resolveExistingPath } from "./path-security.js";

function run(command: string, args: string[], cwd?: string, timeout = 45_000, onSpawn?: (child: ChildProcess) => void): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    onSpawn?.(child);
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Compilation timed out after 45 seconds."));
    }, timeout);
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, output }); });
  });
}

export async function detectTectonic(): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await run("tectonic", ["--version"], undefined, 5_000);
    return result.code === 0 ? { available: true, version: result.output.trim().split("\n")[0] } : { available: false };
  } catch {
    return { available: false };
  }
}

export function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = output.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const fileLine = lines[index].match(/^(.+?\.tex):(\d+):\s*(.+)$/);
    if (fileLine) {
      diagnostics.push({ severity: /warning/i.test(fileLine[3]) ? "warning" : "error", file: fileLine[1], line: Number(fileLine[2]), message: fileLine[3].trim() });
      continue;
    }
    if (lines[index].startsWith("! ")) {
      const lineRef = lines.slice(index + 1, index + 4).join(" ").match(/l\.(\d+)/);
      diagnostics.push({ severity: "error", line: lineRef ? Number(lineRef[1]) : undefined, message: lines[index].slice(2).trim() });
    } else if (/^(warning:|LaTeX Warning:)/i.test(lines[index])) {
      diagnostics.push({ severity: "warning", message: lines[index].replace(/^warning:\s*/i, "").trim() });
    }
  }
  return diagnostics.slice(0, 30);
}

export class CompileManager {
  private version = 0;
  private current?: ChildProcess;
  private pdfs = new Map<number, Buffer>();
  private queue: Promise<void> = Promise.resolve();

  getPdf(version: number): Buffer | undefined { return this.pdfs.get(version); }

  compile(root: string, entryFile: string): Promise<CompileResult> {
    const version = ++this.version;
    this.current?.kill("SIGTERM");
    const task = this.queue.catch(() => undefined).then(() => this.compileNow(root, entryFile, version));
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async compileNow(root: string, entryFile: string, version: number): Promise<CompileResult> {
    const started = performance.now();
    const source = await resolveExistingPath(root, entryFile);
    if (path.extname(source).toLowerCase() !== ".tex") throw new Error("Only .tex files can be compiled.");
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "resume-tex-"));
    try {
      const result = await run("tectonic", ["--outdir", outputDir, "--keep-logs", "--synctex", source], root, 45_000, (child) => { this.current = child; });
      const diagnostics = parseDiagnostics(result.output);
      const pdfPath = path.join(outputDir, `${path.basename(source, ".tex")}.pdf`);
      if (result.code !== 0) {
        if (diagnostics.length === 0) diagnostics.push({ severity: "error", message: result.output.trim().split("\n").slice(-4).join(" ") || "Tectonic could not compile this document." });
        return { success: false, version, diagnostics, durationMs: Math.round(performance.now() - started) };
      }
      const bytes = await readFile(pdfPath);
      const pdf = await PDFDocument.load(bytes);
      this.pdfs.set(version, bytes);
      for (const saved of this.pdfs.keys()) if (saved < version - 2) this.pdfs.delete(saved);
      return { success: true, version, pageCount: pdf.getPageCount(), pdfUrl: `/api/pdf/${version}`, diagnostics, durationMs: Math.round(performance.now() - started) };
    } finally {
      this.current = undefined;
      await rm(outputDir, { recursive: true, force: true });
    }
  }
}
