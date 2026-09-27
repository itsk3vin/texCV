import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
import { assertDirectory } from "../server/path-security.js";

type WorkspaceRuntime = {
  closeApp: () => Promise<void>;
  server: Server;
};

let mainWindow: BrowserWindow | undefined;
let runtime: WorkspaceRuntime | undefined;

function addCommonExecutablePaths() {
  const candidates = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(os.homedir(), ".cargo", "bin"),
  ];
  const current = process.env.PATH?.split(path.delimiter) ?? [];
  process.env.PATH = [...candidates, ...current]
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .join(path.delimiter);
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function defaultWorkspacePath() {
  return path.join(app.getPath("documents"), "TexCV");
}

async function ensureDefaultWorkspace() {
  const root = defaultWorkspacePath();
  await mkdir(root, { recursive: true });
  return root;
}

async function lastWorkspace(): Promise<string | undefined> {
  try {
    const settings = JSON.parse(await readFile(settingsPath(), "utf8")) as { lastWorkspace?: unknown };
    return typeof settings.lastWorkspace === "string" ? settings.lastWorkspace : undefined;
  } catch {
    return undefined;
  }
}

async function rememberWorkspace(root: string) {
  await writeFile(settingsPath(), JSON.stringify({ lastWorkspace: root }, null, 2), "utf8");
}

async function chooseWorkspace(): Promise<string | undefined> {
  const options: Electron.OpenDialogOptions = {
    title: "Open a LaTeX workspace",
    buttonLabel: "Open Workspace",
    properties: ["openDirectory", "createDirectory"],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? undefined : result.filePaths[0];
}

async function stopWorkspace() {
  const active = runtime;
  runtime = undefined;
  if (!active) return;
  await active.closeApp();
  active.server.closeAllConnections();
  await new Promise<void>((resolve) => active.server.close(() => resolve()));
}

async function openWorkspace(folder: string) {
  const root = await assertDirectory(folder);
  await stopWorkspace();

  const { app: expressApp, close } = await createApp({ root });
  const server = createServer(expressApp);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  runtime = { closeApp: close, server };

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the local TexCV server.");
  await mainWindow?.loadURL(`http://127.0.0.1:${address.port}`);
  mainWindow?.setTitle(`TexCV — ${path.basename(root)}`);
  await rememberWorkspace(root);
}

async function promptForWorkspace() {
  const folder = await chooseWorkspace();
  if (!folder) return;
  try {
    await openWorkspace(folder);
  } catch (error) {
    const options: Electron.MessageBoxOptions = {
      type: "error",
      title: "Could not open workspace",
      message: error instanceof Error ? error.message : "The selected folder could not be opened.",
    };
    if (mainWindow) await dialog.showMessageBox(mainWindow, options);
    else await dialog.showMessageBox(options);
  }
}

function installMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "TexCV",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "Open Folder…", accelerator: "CmdOrCtrl+O", click: () => void promptForWorkspace() },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#111318",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 13, y: 11 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (current && new URL(url).origin !== new URL(current).origin) event.preventDefault();
  });
  mainWindow.on("closed", () => { mainWindow = undefined; });

  const initial = await lastWorkspace();
  if (initial) {
    try {
      await openWorkspace(initial);
      return;
    } catch {
      // If a previously selected folder was moved or deleted, fall back to the
      // app-managed document folder instead of interrupting launch.
    }
  }
  await openWorkspace(await ensureDefaultWorkspace());
}

addCommonExecutablePaths();

app.whenReady().then(async () => {
  installMenu();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error: unknown) => {
  dialog.showErrorBox("TexCV could not start", error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (!runtime) return;
  event.preventDefault();
  void stopWorkspace().finally(() => app.quit());
});
