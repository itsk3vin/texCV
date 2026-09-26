import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import open from "open";
import { createApp } from "./app.js";
import { assertDirectory } from "./path-security.js";

const VERSION = "0.1.0";
const HELP = `TexCV ${VERSION}

Usage: texcv [folder] [options]

Options:
  --port <number>  Use a specific local port
  --no-open        Do not open a browser automatically
  --help, -h       Show this help
  --version, -v    Show the version`;

function parseArgs(argv: string[]) {
  let folder: string | undefined;
  let port = 0;
  let shouldOpen = true;
  let dev = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") { console.log(HELP); process.exit(0); }
    if (arg === "--version" || arg === "-v") { console.log(VERSION); process.exit(0); }
    if (arg === "--no-open") shouldOpen = false;
    else if (arg === "--dev") dev = true;
    else if (arg === "--port") {
      port = Number(argv[++index]);
      if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("--port must be a number between 0 and 65535.");
    } else if (!arg.startsWith("-")) {
      if (folder) throw new Error("Only one workspace folder can be opened at a time.");
      folder = arg;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return { folder: path.resolve(folder ?? process.cwd()), port, shouldOpen, dev };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.folder)) throw new Error(`Workspace does not exist: ${options.folder}`);
  const root = await assertDirectory(options.folder);
  const { app, close } = await createApp({ root, dev: options.dev });
  const server = createServer(app);
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") console.error(`Port ${options.port} is already in use. Choose another with --port.`);
    else console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(options.port, "127.0.0.1", async () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : options.port;
    const url = `http://127.0.0.1:${port}`;
    console.log(`TexCV is ready at ${url}`);
    console.log(`Workspace: ${root}`);
    if (options.shouldOpen) await open(url);
  });
  const shutdown = async () => {
    await close();
    server.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  console.error("Run texcv --help for usage.");
  process.exit(1);
});
