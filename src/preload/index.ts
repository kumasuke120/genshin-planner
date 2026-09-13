import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, UserProfileV1 } from "../shared/types";

/** 渲染进程可访问的桌面能力实现，仅通过固定 IPC 通道转发受限操作 */
const api: DesktopApi = {
  /**
   * 通过 profile:load 通道读取用户档案
   * @returns 当前用户档案
   */
  loadProfile: () => ipcRenderer.invoke("profile:load"),
  /**
   * 通过 profile:save 通道保存用户档案
   * @param profile 待保存的用户档案
   * @returns 保存完成后的 Promise
   */
  saveProfile: (profile: UserProfileV1) =>
    ipcRenderer.invoke("profile:save", profile),
  /**
   * 通过 profile:export 通道导出用户档案
   * @param profile 待导出的用户档案
   * @returns 用户是否完成导出
   */
  exportProfile: (profile: UserProfileV1) =>
    ipcRenderer.invoke("profile:export", profile),
  /**
   * 通过 profile:import 通道导入用户档案
   * @returns 导入的用户档案，取消时为 null
   */
  importProfile: () => ipcRenderer.invoke("profile:import"),
  /**
   * 通过 game-data:load 通道读取当前游戏资料
   * @returns 当前生效的游戏资料包
   */
  loadGameData: () => ipcRenderer.invoke("game-data:load"),
  /**
   * 通过 game-data:status 通道读取游戏资料状态
   * @returns 当前游戏资料状态
   */
  getGameDataStatus: () => ipcRenderer.invoke("game-data:status"),
  /**
   * 通过 game-data:sync 通道启动游戏资料同步
   * @returns 同步完成后的资料状态
   */
  syncGameData: () => ipcRenderer.invoke("game-data:sync"),
  /**
   * 通过 game-data:cancel 通道取消游戏资料同步
   * @returns 同步任务完全停止后的 Promise
   */
  cancelGameDataSync: () => ipcRenderer.invoke("game-data:cancel"),
  /**
   * 通过 game-data:import 通道导入本地游戏资料包
   * @param locale 文件选择器使用的界面语言
   * @returns 安装后的资料状态，取消时为 null
   */
  importGameData: (locale) => ipcRenderer.invoke("game-data:import", locale),
  /**
   * 通过 game-data:export 通道导出当前游戏资料包
   * @param locale 文件选择器使用的界面语言
   * @returns 用户是否完成导出
   */
  exportGameData: (locale) => ipcRenderer.invoke("game-data:export", locale),
  /**
   * 通过 game-data:restore 通道恢复内置游戏资料
   * @returns 恢复完成后的资料状态
   */
  restoreBuiltinGameData: () => ipcRenderer.invoke("game-data:restore"),
  /**
   * 通过 shell:open-external 通道打开受信任的外部地址
   * @param url 待打开的绝对 URL
   * @returns 系统打开请求完成后的 Promise
   */
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  /**
   * 通过 shell:open-user-data 通道打开用户数据目录
   * @returns 系统打开请求完成后的 Promise
   */
  openUserDataDirectory: () => ipcRenderer.invoke("shell:open-user-data"),
  /**
   * 通过 shell:open-game-data 通道打开游戏资料目录
   * @returns 系统打开请求完成后的 Promise
   */
  openGameDataDirectory: () => ipcRenderer.invoke("shell:open-game-data"),
  /**
   * 将稳定图标 ID 转换为 game-data 自定义协议地址
   * @param iconId 可选的稳定图标 ID
   * @returns 图标协议地址，缺少 ID 时返回空字符串
   */
  iconUrl: (iconId) =>
    iconId ? `game-data://icon/${encodeURIComponent(iconId)}` : "",
  /**
   * 订阅 game-data:progress 事件
   * @param listener 接收同步进度的监听器
   * @returns 对应的取消订阅函数
   */
  onGameDataProgress: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: Parameters<typeof listener>[0],
    ) => listener(progress);
    ipcRenderer.on("game-data:progress", handler);
    return () => ipcRenderer.removeListener("game-data:progress", handler);
  },
  /**
   * 订阅 window:close-requested 事件
   * @param listener 处理窗口关闭请求的监听器
   * @returns 对应的取消订阅函数
   */
  onWindowCloseRequested: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("window:close-requested", handler);
    return () => ipcRenderer.removeListener("window:close-requested", handler);
  },
  /**
   * 通过 window:close-confirmed 通道确认允许关闭窗口
   * @returns 无返回值
   */
  confirmWindowClose: () => ipcRenderer.send("window:close-confirmed"),
};

// contextBridge 是该对象的实际公开边界，新增能力必须同时更新 DesktopApi 和主进程处理器
contextBridge.exposeInMainWorld("desktopApi", api);
