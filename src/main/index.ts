import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  shell,
} from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { UserProfileV1 } from "../shared/types";
import { GameDataStore } from "./game-data-store";
import {
  loadProfileFile,
  saveProfileFile,
  validateProfile,
} from "./profile-store";

const testUserData = process.env.GENSHIN_PLANNER_USER_DATA;
if (testUserData) app.setPath("userData", path.resolve(testUserData));

function profilePath(): string {
  return path.join(app.getPath("userData"), "profile.json");
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#f5f7f8",
    icon: app.isPackaged
      ? undefined
      : path.resolve(__dirname, "../../../resources/brand/app.ico"),
    show: process.env.GENSHIN_PLANNER_E2E !== "1",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: process.env.GENSHIN_PLANNER_VISUAL === "1",
      backgroundThrottling: process.env.GENSHIN_PLANNER_VISUAL !== "1",
    },
  });

  let closeConfirmed = false;
  window.on("close", (event) => {
    if (closeConfirmed || window.webContents.isDestroyed()) return;
    event.preventDefault();
    window.webContents.send("window:close-requested");
  });
  ipcMain.once(`window:close-confirmed:${window.id}`, () => {
    closeConfirmed = true;
    window.close();
  });
  window.on("closed", () =>
    ipcMain.removeAllListeners(`window:close-confirmed:${window.id}`),
  );

  if (app.isPackaged || process.env.GENSHIN_PLANNER_E2E === "1")
    window.loadFile(path.join(__dirname, "../../renderer/index.html"));
  else window.loadURL("http://localhost:5173");
  return window;
}

let gameData: GameDataStore;

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  gameData = new GameDataStore(app, (progress) =>
    BrowserWindow.getAllWindows().forEach((window) =>
      window.webContents.send("game-data:progress", progress),
    ),
  );
  protocol.handle("game-data", async (request) => {
    const iconId = decodeURIComponent(
      new URL(request.url).pathname.replace(/^\//, ""),
    );
    const iconPath = await gameData.iconPath(iconId);
    return iconPath
      ? net.fetch(pathToFileURL(iconPath).toString())
      : new Response("", { status: 404 });
  });
  ipcMain.handle("profile:load", () =>
    loadProfileFile(profilePath(), app.getLocale()),
  );
  ipcMain.handle("profile:save", (_event, profile: UserProfileV1) =>
    saveProfileFile(profilePath(), profile),
  );
  ipcMain.handle("profile:export", async (_event, profile: UserProfileV1) => {
    const valid = validateProfile(profile);
    const result = await dialog.showSaveDialog({
      title: "Export Genshin Material Planner data",
      defaultPath: "genshin-material-planner-profile.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, JSON.stringify(valid, null, 2), "utf8");
    return true;
  });
  ipcMain.handle("profile:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import Genshin Material Planner data",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return validateProfile(
      JSON.parse(await readFile(result.filePaths[0], "utf8")),
    );
  });
  ipcMain.handle("game-data:load", () => gameData.load());
  ipcMain.handle("game-data:status", () => gameData.status());
  ipcMain.handle("game-data:sync", () => gameData.sync());
  ipcMain.handle("game-data:cancel", () => gameData.cancelSync());
  ipcMain.on("window:close-confirmed", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) ipcMain.emit(`window:close-confirmed:${window.id}`);
  });
  ipcMain.handle("game-data:restore", () => gameData.restoreBuiltin());
  ipcMain.handle("shell:open-external", async (_event, url: string) => {
    const parsed = new URL(url);
    const allowedHosts = new Set(["lunaris.moe", "github.com"]);
    if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname))
      throw new Error("不允许打开未经批准的外部地址");
    await shell.openExternal(url);
  });
  ipcMain.handle("shell:open-user-data", () =>
    shell.openPath(app.getPath("userData")),
  );
  ipcMain.handle("shell:open-game-data", () =>
    shell.openPath(path.join(app.getPath("userData"), "game-data")),
  );
  ipcMain.handle("game-data:import", async (_event, locale: string) => {
    const packageName = locale.toLowerCase().startsWith("zh")
      ? "原神游戏资料包"
      : "Genshin Data Package";
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: packageName, extensions: ["gdata"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return gameData.importFrom(result.filePaths[0]);
  });
  ipcMain.handle("game-data:export", async (_event, locale: string) => {
    const packageName = locale.toLowerCase().startsWith("zh")
      ? "原神游戏资料包"
      : "Genshin Data Package";
    const status = await gameData.status();
    const provider = status.manifest.provider
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/gu, "-");
    const version = status.manifest.gameDataVersion
      .replace(/^v/iu, "")
      .replace(/[^a-z0-9._-]+/giu, "-");
    const result = await dialog.showSaveDialog({
      defaultPath: `genshin-data-${provider}-v${version}.gdata`,
      filters: [{ name: packageName, extensions: ["gdata"] }],
    });
    if (result.canceled || !result.filePath) return false;
    await gameData.exportTo(result.filePath);
    return true;
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
