import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, UserProfileV1 } from "../shared/types";

const api: DesktopApi = {
  loadProfile: () => ipcRenderer.invoke("profile:load"),
  saveProfile: (profile: UserProfileV1) =>
    ipcRenderer.invoke("profile:save", profile),
  exportProfile: (profile: UserProfileV1) =>
    ipcRenderer.invoke("profile:export", profile),
  importProfile: () => ipcRenderer.invoke("profile:import"),
  loadGameData: () => ipcRenderer.invoke("game-data:load"),
  getGameDataStatus: () => ipcRenderer.invoke("game-data:status"),
  syncGameData: () => ipcRenderer.invoke("game-data:sync"),
  cancelGameDataSync: () => ipcRenderer.invoke("game-data:cancel"),
  importGameData: (locale) => ipcRenderer.invoke("game-data:import", locale),
  exportGameData: (locale) => ipcRenderer.invoke("game-data:export", locale),
  restoreBuiltinGameData: () => ipcRenderer.invoke("game-data:restore"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  openUserDataDirectory: () => ipcRenderer.invoke("shell:open-user-data"),
  openGameDataDirectory: () => ipcRenderer.invoke("shell:open-game-data"),
  iconUrl: (iconId) =>
    iconId ? `game-data://icon/${encodeURIComponent(iconId)}` : "",
  onGameDataProgress: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: Parameters<typeof listener>[0],
    ) => listener(progress);
    ipcRenderer.on("game-data:progress", handler);
    return () => ipcRenderer.removeListener("game-data:progress", handler);
  },
  onWindowCloseRequested: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("window:close-requested", handler);
    return () => ipcRenderer.removeListener("window:close-requested", handler);
  },
  confirmWindowClose: () => ipcRenderer.send("window:close-confirmed"),
};

contextBridge.exposeInMainWorld("desktopApi", api);
