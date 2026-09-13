import AdmZip from "adm-zip";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";
import { builtinGameData } from "../data/gameData";
import type {
  Character,
  CharacterElement,
  CraftingCharacter,
  DataManifestV1,
  DataSyncProgress,
  GameDataBundle,
  GameDataOperation,
  GameDataStatus,
  LocalizedText,
  MaterialCategory,
  MaterialFamily,
  MaterialRarity,
  MaterialTier,
  Weapon,
  WeaponType,
} from "../shared/types";

type SourceRecord = Record<string, unknown>;
type StoreState = { activeVersion?: string; operations?: GameDataOperation[] };
const qualityToRarity: Record<string, MaterialRarity> = {
  QUALITY_GREEN: 2,
  QUALITY_BLUE: 3,
  QUALITY_PURPLE: 4,
  QUALITY_ORANGE: 5,
};
const qualityToWeaponRarity: Record<string, 1 | 2 | 3 | 4 | 5> = {
  QUALITY_GRAY: 1,
  QUALITY_WHITE: 1,
  QUALITY_GREEN: 2,
  QUALITY_BLUE: 3,
  QUALITY_PURPLE: 4,
  QUALITY_ORANGE: 5,
};
const sourceUrl = "https://api.lunaris.moe/data";

function names(zh: string, en: string) {
  return { "zh-CN": zh || en, "en-US": en || zh };
}
function object(value: unknown): SourceRecord {
  return value && typeof value === "object" ? (value as SourceRecord) : {};
}
function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function rarity(value: unknown): MaterialRarity | undefined {
  return qualityToRarity[string(value)];
}
function weaponRarity(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  return qualityToWeaponRarity[string(value)];
}
function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
/**
 * 将 Lunaris 武器品质转换为内部星级，并修正初始一星武器的来源标记
 * @param id Lunaris 提供的稳定武器 ID
 * @param value Lunaris 提供的品质原始值
 * @returns 内部使用的一至五星武器星级
 */
export function weaponRarityFromSource(
  id: string,
  value: unknown,
): 1 | 2 | 3 | 4 | 5 {
  // Lunaris 把初始 1X101 武器标为 QUALITY_GREEN，此处以稳定 ID 对应的游戏内一星分类为准
  if (/^1[1-5]101$/u.test(id)) return 1;
  return weaponRarity(value) ?? 3;
}
function characterElement(value: unknown): CharacterElement | undefined {
  return (
    {
      Fire: "pyro",
      Water: "hydro",
      Wind: "anemo",
      Electric: "electro",
      Grass: "dendro",
      Ice: "cryo",
      Rock: "geo",
      Pyro: "pyro",
      Hydro: "hydro",
      Anemo: "anemo",
      Electro: "electro",
      Dendro: "dendro",
      Cryo: "cryo",
      Geo: "geo",
    } as Record<string, CharacterElement>
  )[string(value)];
}
function weaponType(value: unknown): WeaponType | undefined {
  return (
    {
      WEAPON_SWORD_ONE_HAND: "sword",
      WEAPON_CLAYMORE: "claymore",
      WEAPON_POLE: "polearm",
      WEAPON_BOW: "bow",
      WEAPON_CATALYST: "catalyst",
    } as Record<string, WeaponType>
  )[string(value)];
}
function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]+\}/g, "")
    .trim();
}
function commonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
const weaponEnglishFamilyNames: Record<string, string> = {
  "114001": "Decarabian",
  "114005": "Boreal Wolf",
  "114009": "Dandelion Gladiator",
  "114013": "Guyun",
  "114017": "Mist Veiled",
  "114021": "Aerosiderite",
  "114025": "Distant Sea",
  "114029": "Narukami",
  "114033": "Mask",
  "114037": "Forest Dew",
  "114041": "Oasis Garden",
  "114045": "Scorching Might",
  "114049": "Ancient Chord",
  "114053": "Pure Sacred Dewdrop",
  "114057": "Pristine Sea",
  "114061": "Blazing Sacrificial Heart",
  "114065": "Delirious",
  "114069": "Night-Wind's Mystic",
  "114073": "Artful Device",
  "114077": "Long Night Flint",
  "114081": "Far-North Scions",
  "114085": "Pale Star Army",
  "114089": "Cellared Spiritual Nectar",
  "114093": "Frost Emperor",
};
function weaponFamilyName(tiers: MaterialTier[]): LocalizedText {
  const chinese = commonPrefix(tiers.map((tier) => tier.names["zh-CN"]))
    .replace(/(?:的一?|之)$/u, "")
    .trim();
  const englishNames = tiers.map((tier) => tier.names["en-US"]);
  const english =
    weaponEnglishFamilyNames[tiers[0]?.id] ??
    commonPrefix(
      englishNames.map((name) =>
        name.replace(
          /^(Tile|Debris|Fragment|Scattered Piece|Grain|Piece|Bit|Chunk) of\s+/i,
          "",
        ),
      ),
    ).trim();
  return names(
    chinese || tiers[0].names["zh-CN"],
    english || tiers[0].names["en-US"],
  );
}

const weaponCurves: Record<
  number,
  Record<number, Partial<Record<MaterialRarity, number>>>
> = {
  5: {
    1: { 2: 5 },
    2: { 3: 5 },
    3: { 3: 9 },
    4: { 4: 5 },
    5: { 4: 9 },
    6: { 5: 6 },
  },
  4: {
    1: { 2: 3 },
    2: { 3: 3 },
    3: { 3: 6 },
    4: { 4: 3 },
    5: { 4: 6 },
    6: { 5: 4 },
  },
  3: {
    1: { 2: 2 },
    2: { 3: 2 },
    3: { 3: 6 },
    4: { 4: 2 },
    5: { 4: 6 },
    6: { 5: 3 },
  },
};

/**
 * 管理可替换的游戏资料包，负责校验、原子安装、回退、同步与图标定位
 * 用户方案由 ProfileStore 独立管理，本类不得读取或修改 Profile 文件
 */
export class GameDataStore {
  /** 游戏资料在 Electron userData 下的持久化根目录 */
  private readonly root: string;
  /** 旧版固定活动目录；仅用于把已有资料迁移到版本目录 */
  private readonly legacyActive: string;
  /** 随应用提供的最小示例资料目录；开发环境缺失时改用本地 fallback */
  private builtin: string;
  /** 当前同步任务的取消控制器；没有同步任务时为 null */
  private syncAbort: AbortController | null = null;
  /** 当前同步任务完全退出时兑现；取消操作通过它等待清理结束 */
  private syncStopped: Promise<void> | null = null;
  /** 通知等待方同步任务已经退出；仅在同步生命周期内存在 */
  private resolveSyncStopped: (() => void) | null = null;

  /**
   * 创建游戏资料仓库
   * @param electronApp 提供 userData 路径与打包状态的 Electron 应用实例
   * @param report 接收同步阶段进度的回调
   */
  constructor(
    private readonly electronApp: App,
    private readonly report: (progress: DataSyncProgress) => void,
  ) {
    this.root = path.join(electronApp.getPath("userData"), "game-data");
    this.legacyActive = path.join(this.root, "active");
    this.builtin = electronApp.isPackaged
      ? path.join(process.resourcesPath, "game-data", "builtin")
      : path.resolve(__dirname, "../../resources/game-data/builtin");
  }

  private statePath(): string {
    return path.join(this.root, "state.json");
  }
  private async state(): Promise<StoreState> {
    try {
      return JSON.parse(await readFile(this.statePath(), "utf8")) as StoreState;
    } catch {
      return {};
    }
  }
  private async writeState(state: StoreState): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const temporary = `${this.statePath()}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
    await rename(temporary, this.statePath());
  }
  private async operations(): Promise<GameDataOperation[]> {
    const state = await this.state();
    return Array.isArray(state.operations) ? state.operations.slice(0, 3) : [];
  }
  private async record(
    action: GameDataOperation["action"],
    outcome: GameDataOperation["outcome"],
    version?: string,
  ): Promise<void> {
    const state = await this.state();
    const operations = [
      { action, outcome, version, at: new Date().toISOString() },
      ...(Array.isArray(state.operations) ? state.operations : []),
    ].slice(0, 3);
    await this.writeState({ ...state, operations });
  }

  private versionDirectory(version: string): string {
    const name =
      [...version.trim()]
        .map((character) =>
          character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
            ? "_"
            : character,
        )
        .join("")
        .replace(/[. ]+$/u, "") || "unknown-version";
    return path.join(this.root, name);
  }

  private packageKey(manifest: DataManifestV1): string {
    const provider = manifest.provider
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/gu, "-");
    const version = manifest.gameDataVersion
      .replace(/^v/iu, "")
      .replace(/[^a-z0-9._-]+/giu, "-");
    return `${provider}-v${version}`;
  }

  private async activeDirectory(): Promise<string | null> {
    const state = await this.state();
    if (state.activeVersion) {
      const directory = this.versionDirectory(state.activeVersion);
      try {
        await stat(path.join(directory, "bundle.json"));
        return directory;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    // 旧版把活动资料固定放在 active 目录，首次读取时迁入按来源和版本命名的目录并回写状态
    try {
      const bundle = await this.readBundle(this.legacyActive);
      const packageKey = this.packageKey(bundle.manifest);
      const directory = this.versionDirectory(packageKey);
      try {
        await stat(directory);
      } catch (error) {
        if (!isNotFound(error)) throw error;
        await rename(this.legacyActive, directory);
      }
      await this.writeState({
        ...state,
        activeVersion: packageKey,
      });
      return directory;
    } catch {
      return null;
    }
  }

  private async writeBundle(
    directory: string,
    bundle: GameDataBundle,
    icons: Map<string, Buffer> = new Map(),
  ): Promise<void> {
    await rm(directory, { recursive: true, force: true });
    await mkdir(path.join(directory, "icons"), { recursive: true });
    await writeFile(
      path.join(directory, "bundle.json"),
      JSON.stringify(bundle, null, 2),
      "utf8",
    );
    await Promise.all(
      [...icons].map(([id, data]) =>
        writeFile(path.join(directory, "icons", `${id}.webp`), data),
      ),
    );
  }

  private async ensureBuiltin(): Promise<void> {
    try {
      await stat(path.join(this.builtin, "bundle.json"));
    } catch {
      this.builtin = path.join(this.root, "builtin-fallback");
      try {
        await stat(path.join(this.builtin, "bundle.json"));
      } catch {
        await this.writeBundle(this.builtin, builtinGameData);
      }
    }
  }

  private async readBundle(directory: string): Promise<GameDataBundle> {
    const raw = JSON.parse(
      await readFile(path.join(directory, "bundle.json"), "utf8"),
    ) as GameDataBundle;
    if (
      raw.manifest?.schemaVersion !== 1 ||
      !Array.isArray(raw.characters) ||
      !Array.isArray(raw.weapons) ||
      !Array.isArray(raw.materialFamilies) ||
      !Array.isArray(raw.craftingCharacters)
    )
      throw new Error("Invalid game data bundle");
    this.validate(
      raw.characters,
      raw.weapons,
      raw.materialFamilies,
      raw.craftingCharacters,
    );
    return raw;
  }

  /**
   * 加载当前资料；活动资料不可用时回退到内置资料
   * @returns 已通过结构与引用校验的游戏资料
   */
  async load(): Promise<GameDataBundle> {
    await this.ensureBuiltin();
    const active = await this.activeDirectory();
    try {
      return active
        ? await this.readBundle(active)
        : await this.readBundle(this.builtin);
    } catch {
      return this.readBundle(this.builtin);
    }
  }

  /**
   * 返回当前资料来源、内容计数和最近五条维护操作
   * @returns 当前游戏资料状态
   */
  async status(): Promise<GameDataStatus> {
    await this.ensureBuiltin();
    let source: "builtin" | "active" = "active";
    let directory = await this.activeDirectory();
    if (!directory) {
      source = "builtin";
      directory = this.builtin;
    }
    const bundle = await this.readBundle(directory);
    let icons = 0;
    try {
      icons = (await readdir(path.join(directory, "icons"))).length;
    } catch {
      /* 内置后备资料不携带图标 */
    }
    return {
      manifest: bundle.manifest,
      source,
      counts: {
        characters: bundle.characters.length,
        weapons: bundle.weapons.length,
        talentMaterials: bundle.materialFamilies
          .filter((family) => family.category === "talent-book")
          .reduce(
            (count, family) => count + family.craftableRarities.length,
            0,
          ),
        weaponMaterials: bundle.materialFamilies
          .filter((family) => family.category === "weapon-ascension")
          .reduce(
            (count, family) => count + family.craftableRarities.length,
            0,
          ),
        icons,
      },
      operations: await this.operations(),
    };
  }

  private async install(staging: string): Promise<GameDataStatus> {
    const bundle = await this.readBundle(staging);
    const packageKey = this.packageKey(bundle.manifest);
    const destination = this.versionDirectory(packageKey);
    const replaced = path.join(this.root, ".replaced-version");
    await rm(replaced, { recursive: true, force: true });
    let movedDestination = false;
    try {
      // 已有同版本资料先移到可恢复目录，验证后的暂存目录才能进入正式位置
      try {
        await rename(destination, replaced);
        movedDestination = true;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      await rename(staging, destination);
      const state = await this.state();
      await this.writeState({
        ...state,
        activeVersion: packageKey,
      });
      await rm(replaced, { recursive: true, force: true });
    } catch (error) {
      // 替换或状态写入失败时移除新目录，并尽力恢复刚才移走的旧版本
      await rm(destination, { recursive: true, force: true });
      if (movedDestination)
        try {
          await rename(replaced, destination);
        } catch {
          /* 保留目录供人工恢复 */
        }
      throw error;
    }
    return this.status();
  }

  /**
   * 使用已校验的内置资料替换活动资料，不触碰用户方案
   * @returns 恢复完成后的资料状态
   */
  async restoreBuiltin(): Promise<GameDataStatus> {
    await this.ensureBuiltin();
    const staging = path.join(this.root, "restore-staging");
    await rm(staging, { recursive: true, force: true });
    await mkdir(this.root, { recursive: true });
    await cp(this.builtin, staging, { recursive: true });
    const result = await this.install(staging);
    await this.record("restore", "success", result.manifest.gameDataVersion);
    return this.status();
  }

  /**
   * 将当前资料导出为 `.gdata` 格式的原神游戏资料包
   * @param filePath 目标文件的绝对路径
   */
  async exportTo(filePath: string): Promise<void> {
    if (path.extname(filePath).toLowerCase() !== ".gdata")
      throw new Error("游戏资料包仅支持 .gdata 格式");
    if ((await this.status()).manifest.provider === "builtin")
      throw new Error("内置游戏资料不支持导出");
    const source = await this.loadDirectory();
    const zip = new AdmZip();
    zip.addLocalFolder(source, "");
    zip.writeZip(filePath);
  }

  /**
   * 校验并原子安装本地资料包，失败时保留原活动资料
   * @param filePath 待导入资料包的绝对路径
   * @returns 安装完成后的资料状态
   */
  async importFrom(filePath: string): Promise<GameDataStatus> {
    try {
      if (path.extname(filePath).toLowerCase() !== ".gdata")
        throw new Error("游戏资料包仅支持 .gdata 格式");
      const staging = path.join(this.root, "import-staging");
      await rm(staging, { recursive: true, force: true });
      const archive = new AdmZip(filePath);
      if (
        archive
          .getEntries()
          .some(
            (entry) =>
              path.isAbsolute(entry.entryName) ||
              entry.entryName.split(/[\\/]/).includes(".."),
          )
      )
        throw new Error("Unsafe path in game data archive");
      archive.extractAllTo(staging, true);
      const result = await this.install(staging);
      await this.record("import", "success", result.manifest.gameDataVersion);
      return this.status();
    } catch (error) {
      await this.record("import", "failed");
      throw error;
    }
  }

  private async loadDirectory(): Promise<string> {
    await this.ensureBuiltin();
    return (await this.activeDirectory()) ?? this.builtin;
  }

  /**
   * 根据稳定图标 ID 构造渲染进程可访问的自定义协议地址
   * @param iconId 可选的不含扩展名的稳定图标 ID
   * @returns 图标存在 ID 时返回自定义协议地址，否则返回空字符串
   */
  iconUrl(iconId: string | undefined): string {
    return iconId ? `game-data://icon/${encodeURIComponent(iconId)}` : "";
  }
  /**
   * 在活动资料和内置资料中查找图标
   * @param iconId 不含扩展名的稳定图标 ID
   * @returns 找到时返回绝对路径，否则返回 null
   */
  async iconPath(iconId: string): Promise<string | null> {
    for (const directory of [await this.loadDirectory(), this.builtin]) {
      const candidate = path.join(directory, "icons", `${iconId}.webp`);
      try {
        await stat(candidate);
        return candidate;
      } catch {
        /* 当前目录没有该图标，继续检查下一资料目录 */
      }
    }
    return null;
  }

  /**
   * 从 Lunaris 同步、转换、校验并安装最新资料
   * @returns 安装完成后的资料状态
   */
  async sync(): Promise<GameDataStatus> {
    if (this.syncAbort) throw new Error("A game data sync is already running");
    this.syncAbort = new AbortController();
    this.syncStopped = new Promise<void>((resolve) => {
      this.resolveSyncStopped = resolve;
    });
    try {
      await this.record("sync", "started");
      const result = await this.syncInternal(this.syncAbort.signal);
      await this.record("sync", "success", result.manifest.gameDataVersion);
      return this.status();
    } catch (error) {
      const cancelled = this.syncAbort.signal.aborted;
      await this.record("sync", cancelled ? "cancelled" : "failed");
      this.report({
        stage: cancelled ? "cancelled" : "error",
        completed: 0,
        total: 0,
        message: cancelled
          ? "Game data sync cancelled"
          : (error as Error).message,
      });
      throw error;
    } finally {
      this.syncAbort = null;
      this.resolveSyncStopped?.();
      this.resolveSyncStopped = null;
      this.syncStopped = null;
    }
  }

  /** 请求取消当前同步，并等待下载、转换或安装任务完全退出；没有活动任务时不产生副作用 */
  async cancelSync(): Promise<void> {
    const stopped = this.syncStopped;
    this.syncAbort?.abort();
    await stopped;
  }

  private async syncInternal(signal: AbortSignal): Promise<GameDataStatus> {
    signal.throwIfAborted();
    const emit = (
      stage: DataSyncProgress["stage"],
      completed: number,
      total: number,
      message: string,
    ) => this.report({ stage, completed, total, message });
    emit("checking", 0, 1, "Reading game data version");
    const versionInfo = object(
      await this.fetchJson(`${sourceUrl}/version.json`, signal),
    );
    const version = string(versionInfo.version);
    if (!version)
      throw new Error("Lunaris version response is missing version");
    const fetchedAt = new Date().toISOString();
    let completedCatalogs = 0;
    emit("catalogs", 0, 3, "Downloading data catalogs");
    const fetchCatalog = async (fileName: string) => {
      const catalog = await this.fetchJson(
        `${sourceUrl}/${version}/${fileName}`,
        signal,
      );
      completedCatalogs += 1;
      emit("catalogs", completedCatalogs, 3, "Downloading data catalogs");
      return catalog;
    };
    const [characterCatalog, weaponCatalog, materialCatalog] =
      await Promise.all([
        fetchCatalog("charlist.json"),
        fetchCatalog("weaponlist.json"),
        fetchCatalog("materiallist.json"),
      ]);
    const characterEntries = Object.entries(object(characterCatalog));
    const weaponEntries = Object.entries(object(weaponCatalog));
    const materials = object(materialCatalog);
    const total = characterEntries.length + weaponEntries.length;
    emit("details", 0, total, "Reading character and weapon details");
    const characters: Character[] = [];
    const craftingCharacters: CraftingCharacter[] = [];
    const talentFamilies = new Map<string, MaterialFamily>();
    let complete = 0;
    for (let offset = 0; offset < characterEntries.length; offset += 8)
      await Promise.all(
        characterEntries.slice(offset, offset + 8).map(async ([id, item]) => {
          const catalog = object(item);
          const [zh, en] = await Promise.all([
            this.fetchJsonOptional(
              `${sourceUrl}/${version}/chs/char/${id}.json`,
              signal,
            ),
            this.fetchJsonOptional(
              `${sourceUrl}/${version}/en/char/${id}.json`,
              signal,
            ),
          ]);
          const zhDetail = object(zh);
          const enDetail = object(en);
          if (Object.keys(zhDetail).length === 0) {
            complete += 1;
            emit("details", complete, total, `Skipped character ${id}`);
            return;
          }
          const books = object(object(object(zhDetail.skills).leveling).books);
          const family = this.familyFromIds(
            `talent-${id}`,
            "talent-book",
            Object.keys(books),
            materials,
          );
          if (family) {
            talentFamilies.set(family.id, family);
            const characterRarity = rarity(catalog.qualityType);
            characters.push({
              id,
              names: names(
                string(object(zhDetail.info).name) || string(catalog.chsName),
                string(object(enDetail.info).name) || string(catalog.enName),
              ),
              iconId: `character-${id}`,
              element: characterElement(catalog.element),
              rarity:
                characterRarity === 4 || characterRarity === 5
                  ? characterRarity
                  : undefined,
              talentMaterialFamilyId: family.id,
            });
          }
          craftingCharacters.push(
            ...this.extractPassives(id, zhDetail, enDetail, catalog),
          );
          complete += 1;
          emit(
            "details",
            complete,
            total,
            `Characters ${complete}/${characterEntries.length}`,
          );
        }),
      );
    const weaponFamilies = new Map<string, MaterialFamily>();
    const weapons: Weapon[] = [];
    for (let offset = 0; offset < weaponEntries.length; offset += 8)
      await Promise.all(
        weaponEntries.slice(offset, offset + 8).map(async ([id, item]) => {
          const catalog = object(item);
          const [zh, en] = await Promise.all([
            this.fetchJsonOptional(
              `${sourceUrl}/${version}/chs/weapon/${id}.json`,
              signal,
            ),
            this.fetchJsonOptional(
              `${sourceUrl}/${version}/en/weapon/${id}.json`,
              signal,
            ),
          ]);
          if (Object.keys(object(zh)).length === 0) {
            complete += 1;
            emit("details", complete, total, `Skipped weapon ${id}`);
            return;
          }
          const ids = object(zh).ascension;
          const sourceIds = Array.isArray(ids)
            ? ids
                .map((entry) =>
                  string(object(entry).icon).replace(/^UI_ItemIcon_/, ""),
                )
                .filter(Boolean)
            : [];
          const family = this.familyFromIds(
            `weapon-${id}`,
            "weapon-ascension",
            sourceIds,
            materials,
          );
          const resolvedWeaponRarity = weaponRarityFromSource(
            id,
            catalog.qualityType,
          );
          if (family) weaponFamilies.set(family.id, family);
          const curve = family ? weaponCurves[resolvedWeaponRarity] : undefined;
          weapons.push({
            id,
            names: names(
              string(catalog.chsName) || string(object(zh).name),
              string(catalog.enName) || string(object(en).name),
            ),
            iconId: `weapon-${id}`,
            rarity: resolvedWeaponRarity,
            type: weaponType(catalog.weaponType),
            materialFamilyId: family?.id,
            phaseRequirements: curve ?? {},
            calculationStatus: curve ? "supported" : "unsupported-source-curve",
          });
          complete += 1;
          emit(
            "details",
            complete,
            total,
            `Weapons ${complete - characterEntries.length}/${weaponEntries.length}`,
          );
        }),
      );
    const allFamilies = [
      ...talentFamilies.values(),
      ...weaponFamilies.values(),
    ];
    signal.throwIfAborted();
    emit("validating", 0, 1, "Validating data bundle");
    this.validate(characters, weapons, allFamilies, craftingCharacters);
    emit("validating", 1, 1, "Validating data bundle");
    emit(
      "icons",
      0,
      characters.length +
        weapons.length +
        allFamilies.reduce(
          (total, family) => total + family.craftableRarities.length,
          0,
        ),
      "Downloading required icons",
    );
    const icons = await this.downloadIcons(
      version,
      characterEntries,
      weaponEntries,
      allFamilies,
      materials,
      emit,
      signal,
    );
    signal.throwIfAborted();
    const manifest: DataManifestV1 = {
      schemaVersion: 1,
      gameDataVersion: version,
      provider: "lunaris",
      providerUrl: "https://lunaris.moe/",
      fetchedAt,
      generatedAt: new Date().toISOString(),
      locales: ["zh-CN", "en-US"],
    };
    const bundle: GameDataBundle = {
      manifest,
      materialFamilies: allFamilies,
      characters,
      weapons,
      craftingCharacters,
    };
    emit("installing", 0, 1, "Installing verified game data");
    const staging = path.join(this.root, "sync-staging");
    await this.writeBundle(staging, bundle, icons);
    const result = await this.install(staging);
    emit("complete", 1, 1, "Game data updated");
    return result;
  }

  private familyFromIds(
    seed: string,
    category: MaterialCategory,
    ids: string[],
    materials: SourceRecord,
  ): MaterialFamily | null {
    const tiers: MaterialTier[] = [];
    for (const id of ids) {
      const item = object(materials[id]);
      const rank = rarity(item.qualityType);
      if (rank)
        tiers.push({
          id,
          rarity: rank,
          names: names(string(item.chsName), string(item.enName)),
          iconId: `material-${id}`,
        });
    }
    const accepted =
      category === "talent-book"
        ? tiers.filter((tier) =>
            /Talent Level-Up Material/i.test(
              string(object(materials[tier.id]).enDescription),
            ),
          )
        : tiers.filter((tier) =>
            /Weapon Ascension Material/i.test(
              string(object(materials[tier.id]).enDescription),
            ),
          );
    const expected = category === "talent-book" ? [2, 3, 4] : [2, 3, 4, 5];
    if (
      accepted.length !== expected.length ||
      expected.some((rank) => !accepted.some((tier) => tier.rarity === rank))
    )
      return null;
    const first = accepted[0];
    const familyNames =
      category === "talent-book"
        ? names(
            first.names["zh-CN"].match(/^「([^」]+)」/u)?.[1] ??
              first.names["zh-CN"],
            first.names["en-US"].replace(
              /^(Teachings of|Guide to|Philosophies of)\s+/i,
              "",
            ),
          )
        : weaponFamilyName(accepted);
    return {
      id: `${category}-${accepted
        .map((tier) => tier.id)
        .sort()
        .join("-")}`,
      category,
      names: familyNames,
      craftableRarities: expected as MaterialRarity[],
      materialsByRarity: Object.fromEntries(
        accepted.map((tier) => [tier.rarity, tier]),
      ),
    };
  }

  private extractPassives(
    characterId: string,
    zhDetail: SourceRecord,
    enDetail: SourceRecord,
    catalog: SourceRecord,
  ): CraftingCharacter[] {
    const zh = object(zhDetail.passives);
    const en = object(enDetail.passives);
    const result: CraftingCharacter[] = [];
    for (const [passiveId, zhValue] of Object.entries(zh)) {
      const zhPassive = object(zhValue);
      const enPassive = object(en[passiveId]);
      const zhDescription = stripMarkup(string(zhPassive.description));
      const enDescription = stripMarkup(string(enPassive.description));
      const talent =
        /角色天赋素材/.test(zhDescription) ||
        /Character Talent Materials/i.test(enDescription);
      const weapon =
        /武器突破素材/.test(zhDescription) ||
        /Weapon Ascension Materials/i.test(enDescription);
      const refund =
        (/25%/.test(zhDescription) || /25%/.test(enDescription)) &&
        (/返还/.test(zhDescription) || /refund/i.test(enDescription));
      const doubled =
        (/10%/.test(zhDescription) || /10%/.test(enDescription)) &&
        (/双倍/.test(zhDescription) || /double/i.test(enDescription));
      if ((!talent && !weapon) || (!refund && !doubled)) continue;
      result.push({
        id: `${characterId}-${passiveId}`,
        names: names(
          string(zhDetail.info && object(zhDetail.info).name) ||
            string(catalog.chsName),
          string(enDetail.info && object(enDetail.info).name) ||
            string(catalog.enName),
        ),
        iconId: `character-${characterId}`,
        passive: {
          strategy: refund ? "refund_25" : "double_10",
          categories: [talent ? "talent-book" : "weapon-ascension"],
          description: names(
            string(zhPassive.description),
            string(enPassive.description),
          ),
        },
      });
    }
    return result;
  }

  private validate(
    characters: Character[],
    weapons: Weapon[],
    families: MaterialFamily[],
    craftingCharacters: CraftingCharacter[],
  ): void {
    if (!characters.length || !weapons.length || !families.length)
      throw new Error("No supported game data was found");
    const ids = new Set<string>();
    for (const family of families) {
      if (ids.has(family.id))
        throw new Error(`Duplicate material family: ${family.id}`);
      ids.add(family.id);
      const expected =
        family.category === "talent-book" ? [2, 3, 4] : [2, 3, 4, 5];
      if (
        expected.some(
          (rank) => !family.materialsByRarity[rank as MaterialRarity],
        )
      )
        throw new Error(`Incomplete material family: ${family.id}`);
      if (!family.names["zh-CN"] || !family.names["en-US"])
        throw new Error(`Missing localized material family name: ${family.id}`);
      for (const tier of Object.values(family.materialsByRarity))
        if (tier && (!tier.names["zh-CN"] || !tier.names["en-US"]))
          throw new Error(`Missing localized material name: ${tier.id}`);
    }
    const familyIds = new Set(families.map((family) => family.id));
    if (
      characters.some(
        (character) =>
          !character.names["zh-CN"] ||
          !character.names["en-US"] ||
          !familyIds.has(character.talentMaterialFamilyId),
      )
    )
      throw new Error("Invalid character reference");
    if (
      weapons.some(
        (weapon) =>
          !weapon.names["zh-CN"] ||
          !weapon.names["en-US"] ||
          (weapon.calculationStatus !== "unsupported-source-curve" &&
            (!weapon.materialFamilyId ||
              !familyIds.has(weapon.materialFamilyId))),
      )
    )
      throw new Error("Invalid weapon reference");
    if (
      craftingCharacters.some(
        (character) =>
          !character.names["zh-CN"] ||
          !character.names["en-US"] ||
          character.passive.strategy === "none" ||
          !character.passive.categories.length,
      )
    )
      throw new Error("Invalid crafting character");
  }

  private async downloadIcons(
    version: string,
    characterEntries: [string, unknown][],
    weaponEntries: [string, unknown][],
    families: MaterialFamily[],
    materials: SourceRecord,
    emit: (
      stage: DataSyncProgress["stage"],
      completed: number,
      total: number,
      message: string,
    ) => void,
    signal: AbortSignal,
  ): Promise<Map<string, Buffer>> {
    const requests: Array<{ id: string; urls: string[] }> = [];
    for (const name of [
      "pyro",
      "hydro",
      "anemo",
      "electro",
      "dendro",
      "cryo",
      "geo",
      "sword",
      "claymore",
      "polearm",
      "bow",
      "catalyst",
    ])
      requests.push({
        id: `filter-${name}`,
        urls: [`${sourceUrl}/assets/icons/${name}.webp`],
      });
    for (const [id, entry] of characterEntries) {
      const icon = string(object(entry).CardImg).replace(
        /^UI_Gacha_AvatarIcon/u,
        "UI_AvatarIcon",
      );
      if (icon)
        requests.push({
          id: `character-${id}`,
          urls: [`${sourceUrl}/assets/avataricon/${icon}.webp`],
        });
    }
    for (const [id, entry] of weaponEntries) {
      const icon = string(object(entry).weaponIcon);
      if (icon)
        requests.push({
          id: `weapon-${id}`,
          urls: [`${sourceUrl}/assets/weaponicon/${icon}.webp`],
        });
    }
    for (const family of families)
      for (const tier of Object.values(family.materialsByRarity)) {
        if (!tier) continue;
        const icon = string(object(materials[tier.id]).icon);
        if (icon)
          requests.push({
            id: `material-${tier.id}`,
            urls: [`${sourceUrl}/assets/items/${icon}.webp`],
          });
      }
    const results = new Map<string, Buffer>();
    let completed = 0;
    for (let offset = 0; offset < requests.length; offset += 10) {
      signal.throwIfAborted();
      await Promise.all(
        requests.slice(offset, offset + 10).map(async (request) => {
          for (const url of request.urls) {
            for (let attempt = 0; attempt < 5; attempt += 1) {
              try {
                const response = await fetch(url, {
                  signal: AbortSignal.any([
                    signal,
                    AbortSignal.timeout(15_000),
                  ]),
                });
                if (response.ok) {
                  results.set(
                    request.id,
                    Buffer.from(await response.arrayBuffer()),
                  );
                  break;
                }
              } catch {
                signal.throwIfAborted();
                /* 单次网络请求失败后仍按退避策略重试 */
              }
              if (results.has(request.id) || signal.aborted) break;
              if (attempt < 4)
                await new Promise((resolve) =>
                  setTimeout(resolve, 250 * (attempt + 1)),
                );
            }
            if (results.has(request.id)) break;
          }
          if (!results.has(request.id))
            throw new Error(`Required icon download failed: ${request.id}`);
          completed += 1;
          emit(
            "icons",
            completed,
            requests.length,
            `Icons ${completed}/${requests.length}`,
          );
        }),
      );
    }
    signal.throwIfAborted();
    return results;
  }

  private async fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GenshinMaterialPlanner/1.0 (local personal use)",
      },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
        : AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(`Request failed (${response.status}): ${url}`);
    return response.json();
  }

  private async fetchJsonOptional(
    url: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    try {
      return await this.fetchJson(url, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      return {};
    }
  }
}
