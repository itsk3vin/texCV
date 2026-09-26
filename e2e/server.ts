import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { createApp } from "../server/app.js";

const root = path.resolve("e2e/workspace");
const { app, close } = await createApp({ root, dev: true });
const server = createServer(app);

server.listen(43_210, "127.0.0.1");

const shutdown = async () => {
  await close();
  server.closeAllConnections();
  server.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
