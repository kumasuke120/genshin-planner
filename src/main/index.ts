import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { UserProfileV1 } from '../shared/types';
import { GameDataStore } from './game-data-store';

const countsSchema = z.partialRecord(z.enum(['2', '3', '4', '5']), z.number().int().nonnegative());
const talentLevelsSchema = z.object({ normal: z.number().int().min(1).max(10), skill: z.number().int().min(1).max(10), burst: z.number().int().min(1).max(10) });
const targetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weapon'), weaponId: z.string().min(1), currentPhase: z.number().int().min(0).max(6), targetPhase: z.number().int().min(0).max(6) }),
  z.object({ type: z.literal('talent'), characterId: z.string().min(1), current: talentLevelsSchema, target: talentLevelsSchema }),
  z.object({ type: z.literal('manual'), materialFamilyId: z.string().min(1), required: countsSchema })
]);
const savedPlanSchema = z.object({ id: z.string().min(1), name: z.string().min(1).max(100), target: targetSchema, craftingCharacterId: z.string().min(1).nullable(), createdAt: z.string(), updatedAt: z.string() });
const normalizedPlanName = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase();
const profileSchema = z.object({
  schemaVersion: z.literal(1),
  locale: z.enum(['zh-CN', 'en-US']),
  inventoryByMaterialFamily: z.record(z.string(), countsSchema).default({}),
  savedPlans: z.array(savedPlanSchema).default([]),
  recentPlanIds: z.array(z.string()).default([]),
  updatedAt: z.string()
}).superRefine((profile, context) => {
  const names = new Set<string>();
  profile.savedPlans.forEach((plan, index) => {
    const normalized = normalizedPlanName(plan.name);
    if (names.has(normalized)) context.addIssue({ code: 'custom', path: ['savedPlans', index, 'name'], message: 'Saved plan names must be unique' });
    names.add(normalized);
  });
});

function defaultProfile(): UserProfileV1 {
  return {
    schemaVersion: 1,
    locale: app.getLocale().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US',
    inventoryByMaterialFamily: {},
    savedPlans: [],
    recentPlanIds: [],
    updatedAt: new Date().toISOString()
  };
}

function profilePath(): string {
  return path.join(app.getPath('userData'), 'profile.json');
}

async function validateProfile(raw: unknown): Promise<UserProfileV1> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid profile format');
  return parsed.data as UserProfileV1;
}

async function loadProfile(): Promise<UserProfileV1> {
  try {
    return await validateProfile(JSON.parse(await readFile(profilePath(), 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultProfile();
    throw error;
  }
}

async function saveProfile(profile: UserProfileV1): Promise<void> {
  const valid = await validateProfile(profile);
  const destination = profilePath();
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify({ ...valid, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  await rename(temporary, destination);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#f5f7f8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) window.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  else window.loadURL('http://localhost:5173');
  return window;
}

let gameData: GameDataStore;

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  gameData = new GameDataStore(app, (progress) => BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('game-data:progress', progress)));
  protocol.handle('game-data', async (request) => {
    const iconId = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''));
    const iconPath = await gameData.iconPath(iconId);
    return iconPath ? net.fetch(pathToFileURL(iconPath).toString()) : new Response('', { status: 404 });
  });
  ipcMain.handle('profile:load', () => loadProfile());
  ipcMain.handle('profile:save', (_event, profile: UserProfileV1) => saveProfile(profile));
  ipcMain.handle('profile:export', async (_event, profile: UserProfileV1) => {
    const valid = await validateProfile(profile);
    const result = await dialog.showSaveDialog({
      title: 'Export Genshin Material Planner data',
      defaultPath: 'genshin-material-planner-profile.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, JSON.stringify(valid, null, 2), 'utf8');
    return true;
  });
  ipcMain.handle('profile:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Genshin Material Planner data',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return validateProfile(JSON.parse(await readFile(result.filePaths[0], 'utf8')));
  });
  ipcMain.handle('game-data:load', () => gameData.load());
  ipcMain.handle('game-data:status', () => gameData.status());
  ipcMain.handle('game-data:sync', () => gameData.sync());
  ipcMain.handle('game-data:cancel', () => gameData.cancelSync());
  ipcMain.handle('game-data:restore', () => gameData.restoreBuiltin());
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'lunaris.moe') throw new Error('Unsupported external URL');
    await shell.openExternal(url);
  });
  ipcMain.handle('game-data:import', async () => {
    const result = await dialog.showOpenDialog({ title: 'Import game data', properties: ['openFile'], filters: [{ name: 'Genshin Material Data', extensions: ['gmpdata', 'zip'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    return gameData.importFrom(result.filePaths[0]);
  });
  ipcMain.handle('game-data:export', async () => {
    const result = await dialog.showSaveDialog({ title: 'Export game data', defaultPath: 'genshin-game-data.gmpdata', filters: [{ name: 'Genshin Material Data', extensions: ['gmpdata'] }] });
    if (result.canceled || !result.filePath) return false;
    await gameData.exportTo(result.filePath);
    return true;
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
