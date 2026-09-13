import path from "node:path";
import { GameDataStore } from "./game-data-store";

/** 将完整 Lunaris 资料生成到统一的开发构建目录 */
async function main(): Promise<void> {
  const workspace = process.cwd();
  const outputRoot = path.join(workspace, "out");
  const fakeApp = {
    getPath: () => outputRoot,
  } as unknown as import("electron").App;
  const store = new GameDataStore(fakeApp, (progress) =>
    process.stdout.write(`[${progress.stage}] ${progress.message}\n`),
  );
  const status = await store.sync();
  const destination = path.join(
    outputRoot,
    "game-data",
    `${status.manifest.provider}-v${status.manifest.gameDataVersion}`,
  );
  process.stdout.write(`Built ${destination}\n`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
