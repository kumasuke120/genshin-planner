import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { GameDataStore } from './game-data-store';

async function main(): Promise<void> {
  const workspace = process.cwd();
  const buildRoot = path.join(workspace, '.game-data-build');
  const fakeApp = { getPath: () => buildRoot } as unknown as import('electron').App;
  const store = new GameDataStore(fakeApp, (progress) => process.stdout.write(`[${progress.stage}] ${progress.message}\n`));
  await store.sync();
  const destination = path.join(workspace, 'resources', 'game-data', 'builtin');
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(buildRoot, 'game-data', 'active'), destination, { recursive: true });
  process.stdout.write(`Built ${destination}\n`);
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
