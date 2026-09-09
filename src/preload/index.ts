import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, UserProfileV1 } from '../shared/types';

const api: DesktopApi = {
  loadProfile: () => ipcRenderer.invoke('profile:load'),
  saveProfile: (profile: UserProfileV1) => ipcRenderer.invoke('profile:save', profile),
  exportProfile: (profile: UserProfileV1) => ipcRenderer.invoke('profile:export', profile),
  importProfile: () => ipcRenderer.invoke('profile:import'),
  loadGameData: () => ipcRenderer.invoke('game-data:load'),
  getGameDataStatus: () => ipcRenderer.invoke('game-data:status'),
  syncGameData: () => ipcRenderer.invoke('game-data:sync'),
  cancelGameDataSync: () => ipcRenderer.invoke('game-data:cancel'),
  importGameData: () => ipcRenderer.invoke('game-data:import'),
  exportGameData: () => ipcRenderer.invoke('game-data:export'),
  restoreBuiltinGameData: () => ipcRenderer.invoke('game-data:restore'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  iconUrl: (iconId) => iconId ? `game-data://icon/${encodeURIComponent(iconId)}` : '',
  onGameDataProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on('game-data:progress', handler);
    return () => ipcRenderer.removeListener('game-data:progress', handler);
  }
};

contextBridge.exposeInMainWorld('desktopApi', api);
