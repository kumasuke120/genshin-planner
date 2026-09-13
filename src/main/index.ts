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

// == 测试环境初始化 ==
// E2E 必须在 Electron 就绪前切换到隔离目录，避免自动化测试读写真实用户数据
const testUserData = process.env.GENSHIN_PLANNER_USER_DATA;
if (testUserData) app.setPath("userData", path.resolve(testUserData));

function profilePath(): string {
  return path.join(app.getPath("userData"), "profile.json");
}

// == 窗口创建与关闭握手 ==
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
  // 首次关闭只通知渲染进程处理未保存内容，收到确认后第二次关闭才真正放行
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

  // 正式包和 E2E 使用已构建页面，日常开发才连接 Vite 开发服务器
  if (app.isPackaged || process.env.GENSHIN_PLANNER_E2E === "1")
    window.loadFile(path.join(__dirname, "../../renderer/index.html"));
  else window.loadURL("http://localhost:5173");
  return window;
}

let gameData: GameDataStore;

// == Electron 主入口 ==
// 依次初始化全局能力、注册协议与 IPC，最后创建首个窗口
app.whenReady().then(() => {
  // 应用使用自有侧栏和工作区导航，不展示 Electron 默认菜单
  Menu.setApplicationMenu(null);

  // 单例资料仓库负责全部窗口共享的资料状态，并向每个窗口广播同步进度
  gameData = new GameDataStore(app, (progress) =>
    BrowserWindow.getAllWindows().forEach((window) =>
      window.webContents.send("game-data:progress", progress),
    ),
  );

  // == 游戏资料协议 ==
  // 只根据稳定图标 ID 返回仓库已定位的本地文件，不暴露任意文件路径
  protocol.handle("game-data", async (request) => {
    const iconId = decodeURIComponent(
      new URL(request.url).pathname.replace(/^\//, ""),
    );
    const iconPath = await gameData.iconPath(iconId);
    return iconPath
      ? net.fetch(pathToFileURL(iconPath).toString())
      : new Response("", { status: 404 });
  });

  // == 用户档案 IPC ==
  // 统一经过 Profile 校验和可恢复的持久化流程
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

  // == 游戏资料 IPC ==
  // 只转发到单例仓库，渲染进程不能直接访问资料目录
  ipcMain.handle("game-data:load", () => gameData.load());
  ipcMain.handle("game-data:status", () => gameData.status());
  ipcMain.handle("game-data:sync", () => gameData.sync());
  ipcMain.handle("game-data:cancel", () => gameData.cancelSync());

  // preload 只能发送通用确认事件，此处按发送方窗口转换为独立的一次性确认通道
  ipcMain.on("window:close-confirmed", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) ipcMain.emit(`window:close-confirmed:${window.id}`);
  });
  ipcMain.handle("game-data:restore", () => gameData.restoreBuiltin());

  // == 系统能力 IPC ==
  // 外链采用 HTTPS 协议与主机双重白名单，避免渲染进程打开任意系统地址
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

  // 游戏资料导入先由原生对话框限制扩展名，实际内容仍由 GameDataStore 完整校验
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

  // 导出文件名只使用清洗后的来源和版本，避免资料字段形成非法或可穿越的路径片段
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

  // == 窗口启动与平台生命周期 ==
  // 所有主进程能力准备完成后再创建窗口，确保渲染页面加载时 IPC 已可用
  createWindow();
  // macOS 从 Dock 再次激活时遵循平台惯例，在没有窗口的情况下重新创建
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// == 应用退出 ==
// Windows 和 Linux 关闭最后一个窗口即退出，macOS 保持后台进程等待再次激活
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
