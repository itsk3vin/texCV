import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createServer as createViteServer } from "vite";
import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CompileStatus, WorkspaceEvent } from "../shared/types.js";
import { CompileManager, detectTectonic } from "./compiler.js";
import { WorkspacePathError } from "./path-security.js";
import { STARTER } from "./starter.js";
import {
  createWorkspaceEntry,
  deleteWorkspaceEntry,
  readDefaultTemplate,
  readTree,
  readWorkspaceFile,
  renameWorkspaceEntry,
  writeDefaultTemplate,
  writeWorkspaceFile,
} from "./workspace.js";

type AppOptions = { root: string; dev?: boolean };

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => { handler(request, response).catch(next); };
}

export async function createApp(options: AppOptions): Promise<{ app: Express; close: () => Promise<void> }> {
  const app = express();
  const compiler = new CompileManager();
  const tectonic = await detectTectonic();
  const clients = new Set<Response>();
  const sendEvent = (event: WorkspaceEvent) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(payload);
  };

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const remote = request.socket.remoteAddress;
    const host = request.hostname.replace(/^\[|\]$/g, "");
    if ((remote && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) || !["127.0.0.1", "localhost", "::1"].includes(host)) {
      response.status(403).json({ error: "TexCV is available only from this computer." });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/workspace", asyncRoute(async (_request, response) => {
    const entries = await readTree(options.root);
    response.json({
      name: path.basename(options.root),
      path: options.root,
      entries,
      isEmpty: entries.length === 0,
      tectonicAvailable: tectonic.available,
      tectonicVersion: tectonic.version,
    });
  }));

  app.get("/api/file", asyncRoute(async (request, response) => {
    response.type("text/plain").send(await readWorkspaceFile(options.root, String(request.query.path ?? "")));
  }));

  app.put("/api/file", asyncRoute(async (request, response) => {
    await writeWorkspaceFile(options.root, String(request.body.path ?? ""), request.body.content);
    response.status(204).end();
  }));

  app.post("/api/entry", asyncRoute(async (request, response) => {
    await createWorkspaceEntry(options.root, String(request.body.path ?? ""), request.body.kind);
    response.status(201).json({ ok: true });
  }));

  app.patch("/api/entry", asyncRoute(async (request, response) => {
    await renameWorkspaceEntry(options.root, String(request.body.from ?? ""), String(request.body.to ?? ""));
    response.json({ ok: true });
  }));

  app.delete("/api/entry", asyncRoute(async (request, response) => {
    await deleteWorkspaceEntry(options.root, String(request.query.path ?? ""));
    response.status(204).end();
  }));

  app.post("/api/starter", asyncRoute(async (request, response) => {
    const starterPath = String(request.body?.path ?? "resume.tex");
    await createWorkspaceEntry(options.root, starterPath, "file");
    await writeWorkspaceFile(options.root, starterPath, (await readDefaultTemplate(options.root)) ?? STARTER);
    response.status(201).json({ path: starterPath });
  }));

  app.put("/api/template", asyncRoute(async (request, response) => {
    await writeDefaultTemplate(options.root, request.body?.content);
    response.status(204).end();
  }));

  app.post("/api/compile", asyncRoute(async (request, response) => {
    if (!tectonic.available) {
      response.status(503).json({ error: "Tectonic is not installed. Run: brew install tectonic" });
      return;
    }
    sendEvent({ type: "compile", status: "compiling" });
    const result = await compiler.compile(options.root, String(request.body.entryFile ?? ""));
    const status: CompileStatus = result.success ? "success" : "error";
    sendEvent({ type: "compile", status });
    response.json(result);
  }));

  app.get("/api/pdf/:version", (request, response) => {
    const pdf = compiler.getPdf(Number(request.params.version));
    if (!pdf) { response.status(404).json({ error: "That preview has expired." }); return; }
    response.set({ "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Length": String(pdf.length) });
    response.end(pdf);
  });

  app.get("/api/events", (request, response) => {
    response.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    response.flushHeaders();
    clients.add(response);
    response.write(`data: ${JSON.stringify({ type: "compile", status: tectonic.available ? "idle" : "unavailable" })}\n\n`);
    request.on("close", () => clients.delete(response));
  });

  const watcher: FSWatcher = chokidar.watch(options.root, {
    ignored: [/(^|[/\\])\../, /node_modules/, /dist-server?/, /\.synctex\.gz$/, /\.(aux|log)$/],
    ignoreInitial: true,
    depth: 12,
  });
  watcher.on("error", (error) => {
    console.warn(`File watching is unavailable: ${error instanceof Error ? error.message : error}`);
  });
  let eventTimer: NodeJS.Timeout | undefined;
  watcher.on("all", (_event, changedPath) => {
    clearTimeout(eventTimer);
    eventTimer = setTimeout(() => sendEvent({ type: "workspace", path: path.relative(options.root, changedPath) }), 80);
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = error instanceof WorkspacePathError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected local server error.";
    response.status(status).json({ error: message });
  });

  if (options.dev) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    return { app, close: async () => { clearTimeout(eventTimer); await watcher.close(); await vite.close(); } };
  }

  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  app.use(express.static(path.join(packageRoot, "dist"), { index: false }));
  app.get("*splat", (_request, response) => response.sendFile(path.join(packageRoot, "dist", "index.html")));
  return { app, close: async () => { clearTimeout(eventTimer); await watcher.close(); } };
}
