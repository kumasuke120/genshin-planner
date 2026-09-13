import AdmZip from "adm-zip";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "electron";
import { builtinGameData } from "../data/gameData";
import { GameDataStore, weaponRarityFromSource } from "./game-data-store";

let temporaryRoot = "";
let userData = "";
let builtin = "";
let store: GameDataStore;

async function writeBundle(
  directory: string,
  version = "test-version",
  provider: "builtin" | "lunaris" = "builtin",
): Promise<void> {
  await mkdir(path.join(directory, "icons"), { recursive: true });
  await writeFile(
    path.join(directory, "bundle.json"),
    JSON.stringify({
      ...builtinGameData,
      manifest: {
        ...builtinGameData.manifest,
        gameDataVersion: version,
        provider,
      },
    }),
    "utf8",
  );
}

beforeEach(async () => {
  temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "genshin-planner-data-test-"),
  );
  userData = path.join(temporaryRoot, "user-data");
  builtin = path.join(temporaryRoot, "builtin");
  await writeBundle(builtin, "builtin-test");
  const app = {
    getPath: vi.fn().mockReturnValue(userData),
    isPackaged: false,
  } as unknown as App;
  store = new GameDataStore(app, vi.fn());
  Reflect.set(store, "builtin", builtin);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(temporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 50,
  });
});

describe("weaponRarityFromSource", () => {
  it("classifies the stable 1X101 starter weapon IDs as one-star", () => {
    for (const id of ["11101", "12101", "13101", "14101", "15101"]) {
      expect(weaponRarityFromSource(id, "QUALITY_GREEN")).toBe(1);
    }
  });

  it("keeps other green weapons as two-star", () => {
    expect(weaponRarityFromSource("11201", "QUALITY_GREEN")).toBe(2);
  });

  it("uses source rarity and a stable three-star fallback", () => {
    expect(weaponRarityFromSource("11402", "QUALITY_PURPLE")).toBe(4);
    expect(weaponRarityFromSource("unknown", "UNKNOWN")).toBe(3);
  });
});

describe("GameDataStore local lifecycle", () => {
  it("loads built-in data and reports content counts when active data is absent", async () => {
    const loaded = await store.load();
    const status = await store.status();

    expect(loaded.manifest.gameDataVersion).toBe("builtin-test");
    expect(status.source).toBe("builtin");
    expect(status.counts.characters).toBe(loaded.characters.length);
    expect(status.counts.weapons).toBe(loaded.weapons.length);
    expect(status.operations).toEqual([]);
    await expect(
      store.exportTo(path.join(temporaryRoot, "builtin.gdata")),
    ).rejects.toThrow("内置游戏资料不支持导出");
    expect(store.iconUrl("a/b")).toBe("game-data://icon/a%2Fb");
    expect(store.iconUrl(undefined)).toBe("");
    expect(await store.iconPath("missing")).toBeNull();
  });

  it("finds active and built-in icons and ignores malformed operation history", async () => {
    const active = path.join(userData, "game-data", "active");
    await writeBundle(active, "active-icons");
    await writeFile(path.join(active, "icons", "active.webp"), "active");
    await writeFile(path.join(builtin, "icons", "builtin.webp"), "builtin");
    await mkdir(path.join(userData, "game-data"), { recursive: true });
    await writeFile(
      path.join(userData, "game-data", "state.json"),
      '{"operations":{}}',
      "utf8",
    );

    const migrated = path.join(userData, "game-data", "builtin-vactive-icons");
    expect(await store.iconPath("active")).toBe(
      path.join(migrated, "icons", "active.webp"),
    );
    expect(await store.iconPath("builtin")).toBe(
      path.join(builtin, "icons", "builtin.webp"),
    );
    const status = await store.status();
    expect(status.counts.icons).toBe(1);
    expect(status.operations).toEqual([]);
    expect(
      JSON.parse(
        await readFile(path.join(userData, "game-data", "state.json"), "utf8"),
      ).activeVersion,
    ).toBe("builtin-vactive-icons");

    const operations = Array.from({ length: 4 }, (_, index) => ({
      action: "sync",
      outcome: "started",
      at: `2026-09-12T00:00:0${index}.000Z`,
    }));
    await writeFile(
      path.join(userData, "game-data", "state.json"),
      JSON.stringify({ operations }),
      "utf8",
    );
    expect((await store.status()).operations).toHaveLength(3);
  });

  it("restores built-in data without changing sibling profile files", async () => {
    await mkdir(userData, { recursive: true });
    const profilePath = path.join(userData, "profile.json");
    await writeFile(profilePath, '{"keep":true}', "utf8");
    await writeBundle(path.join(userData, "game-data", "active"), "old-active");

    const status = await store.restoreBuiltin();

    expect(status.source).toBe("active");
    expect(status.manifest.gameDataVersion).toBe("builtin-test");
    expect(await readFile(profilePath, "utf8")).toBe('{"keep":true}');
    expect(status.operations[0]).toMatchObject({
      action: "restore",
      outcome: "success",
      version: "builtin-test",
    });
  });

  it("exports active data and imports a valid archive while retaining the previous version", async () => {
    const active = path.join(userData, "game-data", "active");
    await writeBundle(active, "active-before-import", "lunaris");
    const exported = path.join(temporaryRoot, "export.gdata");
    await store.exportTo(exported);
    expect(new AdmZip(exported).getEntry("bundle.json")).not.toBeNull();

    const incoming = path.join(temporaryRoot, "incoming");
    await writeBundle(incoming, "imported-version", "lunaris");
    const archivePath = path.join(temporaryRoot, "incoming.gdata");
    const archive = new AdmZip();
    archive.addLocalFolder(incoming);
    archive.writeZip(archivePath);

    const status = await store.importFrom(archivePath);
    expect(status.manifest.gameDataVersion).toBe("imported-version");
    expect(status.operations[0]).toMatchObject({
      action: "import",
      outcome: "success",
      version: "imported-version",
    });
    const previous = JSON.parse(
      await readFile(
        path.join(
          userData,
          "game-data",
          "lunaris-vactive-before-import",
          "bundle.json",
        ),
        "utf8",
      ),
    );
    expect(previous.manifest.gameDataVersion).toBe("active-before-import");
    expect(
      JSON.parse(
        await readFile(path.join(userData, "game-data", "state.json"), "utf8"),
      ).activeVersion,
    ).toBe("lunaris-vimported-version");
  });

  it("rejects unsafe and invalid archives and records the failure", async () => {
    const unsafePath = path.join(temporaryRoot, "unsafe.gdata");
    const unsafe = new AdmZip();
    unsafe.addFile("outside.txt", Buffer.from("no"));
    unsafe.getEntries()[0].entryName = "../outside.txt";
    unsafe.writeZip(unsafePath);
    await expect(store.importFrom(unsafePath)).rejects.toThrow("Unsafe path");

    const invalidPath = path.join(temporaryRoot, "invalid.gdata");
    const invalid = new AdmZip();
    invalid.addFile("bundle.json", Buffer.from("{}"));
    invalid.writeZip(invalidPath);
    await expect(store.importFrom(invalidPath)).rejects.toThrow(
      "Invalid game data bundle",
    );
    await expect(
      store.importFrom(path.join(temporaryRoot, "legacy.zip")),
    ).rejects.toThrow("仅支持 .gdata");
    expect((await store.status()).operations[0]).toMatchObject({
      action: "import",
      outcome: "failed",
    });
  });

  it("uses a generated fallback when the configured built-in directory is unavailable", async () => {
    Reflect.set(store, "builtin", path.join(temporaryRoot, "missing-builtin"));
    const loaded = await store.load();
    expect(loaded.manifest.schemaVersion).toBe(1);
    expect(
      await readFile(
        path.join(userData, "game-data", "builtin-fallback", "bundle.json"),
        "utf8",
      ),
    ).toContain("materialFamilies");
  });

  it("synchronizes a minimal supported Lunaris catalog and reports each stage", async () => {
    const reports: Array<{ stage: string }> = [];
    const app = {
      getPath: vi.fn().mockReturnValue(userData),
      isPackaged: false,
    } as unknown as App;
    store = new GameDataStore(app, (progress) => reports.push(progress));
    Reflect.set(store, "builtin", builtin);
    const materials = {
      "104301": {
        qualityType: "QUALITY_GREEN",
        chsName: "「繁荣」的教导",
        enName: "Teachings of Prosperity",
        enDescription: "Talent Level-Up Material",
        icon: "T1",
      },
      "104302": {
        qualityType: "QUALITY_BLUE",
        chsName: "「繁荣」的指引",
        enName: "Guide to Prosperity",
        enDescription: "Talent Level-Up Material",
        icon: "T2",
      },
      "104303": {
        qualityType: "QUALITY_PURPLE",
        chsName: "「繁荣」的哲学",
        enName: "Philosophies of Prosperity",
        enDescription: "Talent Level-Up Material",
        icon: "T3",
      },
      "114001": {
        qualityType: "QUALITY_GREEN",
        chsName: "高塔孤王的破瓦",
        enName: "Tile of Decarabian",
        enDescription: "Weapon Ascension Material",
        icon: "W1",
      },
      "114002": {
        qualityType: "QUALITY_BLUE",
        chsName: "高塔孤王的残垣",
        enName: "Debris of Decarabian",
        enDescription: "Weapon Ascension Material",
        icon: "W2",
      },
      "114003": {
        qualityType: "QUALITY_PURPLE",
        chsName: "高塔孤王的断片",
        enName: "Fragment of Decarabian",
        enDescription: "Weapon Ascension Material",
        icon: "W3",
      },
      "114004": {
        qualityType: "QUALITY_ORANGE",
        chsName: "高塔孤王的碎梦",
        enName: "Scattered Piece of Decarabian",
        enDescription: "Weapon Ascension Material",
        icon: "W4",
      },
    };
    const zhCharacter = {
      info: { name: "测试角色" },
      skills: {
        leveling: { books: { "104301": 1, "104302": 1, "104303": 1 } },
      },
      passives: {
        p1: { description: "合成角色天赋素材时，有25%概率返还部分合成材料。" },
      },
    };
    const enCharacter = {
      info: { name: "Test Character" },
      passives: {
        p1: {
          description:
            "When crafting Character Talent Materials, has a 25% chance to refund.",
        },
      },
    };
    const zhWeapon = {
      name: "测试剑",
      ascension: Object.keys(materials)
        .filter((id) => id.startsWith("114"))
        .map((id) => ({ icon: `UI_ItemIcon_${id}` })),
    };
    const enWeapon = { name: "Test Sword" };
    const jsonBySuffix: Record<string, unknown> = {
      "/version.json": { version: "v-test" },
      "/charlist.json": {
        c1: {
          chsName: "测试角色",
          enName: "Test Character",
          qualityType: "QUALITY_ORANGE",
          element: "Ice",
          CardImg: "UI_Gacha_AvatarIcon_Test",
        },
        "c-skip": { chsName: "缺详情角色" },
        "c-bad-family": { chsName: "缺素材角色", enName: "Missing Family" },
      },
      "/weaponlist.json": {
        "11402": {
          chsName: "测试剑",
          enName: "Test Sword",
          qualityType: "QUALITY_PURPLE",
          weaponType: "WEAPON_SWORD_ONE_HAND",
          weaponIcon: "UI_Weapon_Test",
        },
        "99998": {
          chsName: "未知武器",
          qualityType: "UNKNOWN",
          weaponType: "UNKNOWN",
        },
        "99999": { chsName: "缺详情武器" },
      },
      "/materiallist.json": materials,
      "/chs/char/c1.json": zhCharacter,
      "/en/char/c1.json": enCharacter,
      "/chs/char/c-bad-family.json": {
        info: { name: "缺素材角色" },
        skills: { leveling: { books: { "104301": 1 } } },
      },
      "/chs/weapon/11402.json": zhWeapon,
      "/en/weapon/11402.json": enWeapon,
      "/chs/weapon/99998.json": { name: "未知武器", ascension: {} },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        const entry = Object.entries(jsonBySuffix).find(([suffix]) =>
          url.endsWith(suffix),
        );
        return entry
          ? new Response(JSON.stringify(entry[1]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          : new Response(Uint8Array.from([1, 2, 3]), { status: 200 });
      }),
    );

    const status = await store.sync();
    const loaded = await store.load();

    expect(status.manifest.gameDataVersion).toBe("v-test");
    expect(loaded.characters[0]).toMatchObject({ element: "cryo", rarity: 5 });
    expect(loaded.weapons[0]).toMatchObject({
      rarity: 4,
      type: "sword",
      calculationStatus: "supported",
    });
    const unsupportedWeapon = loaded.weapons.find(
      (weapon) => weapon.id === "99998",
    );
    expect(unsupportedWeapon).toMatchObject({
      rarity: 3,
      calculationStatus: "unsupported-source-curve",
    });
    expect(unsupportedWeapon?.type).toBeUndefined();
    expect(loaded.craftingCharacters[0].passive.strategy).toBe("refund_25");
    expect(reports.map(({ stage }) => stage)).toEqual(
      expect.arrayContaining([
        "checking",
        "catalogs",
        "details",
        "validating",
        "icons",
        "installing",
        "complete",
      ]),
    );
    expect(status.operations.slice(0, 2).map(({ outcome }) => outcome)).toEqual(
      ["success", "started"],
    );
  });

  it("rejects overlapping syncs and supports cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: string | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    );
    const first = store.sync();
    await expect(store.sync()).rejects.toThrow("already running");
    await store.cancelSync();
    await expect(first).rejects.toThrow();
    const status = await store.status();
    expect(status.operations[0]).toMatchObject({
      action: "sync",
      outcome: "cancelled",
    });
    expect(status.operations[1]).toMatchObject({
      action: "sync",
      outcome: "started",
    });
  });

  it("records missing versions and HTTP failures as failed syncs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(store.sync()).rejects.toThrow("missing version");
    expect((await store.status()).operations[0]).toMatchObject({
      action: "sync",
      outcome: "failed",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );
    await expect(store.sync()).rejects.toThrow("Request failed (503)");
    expect((await store.status()).operations[0]).toMatchObject({
      action: "sync",
      outcome: "failed",
    });
  });

  it("rejects every invalid cross-reference and localization boundary", () => {
    type Validate = (
      characters: typeof builtinGameData.characters,
      weapons: typeof builtinGameData.weapons,
      families: typeof builtinGameData.materialFamilies,
      crafting: typeof builtinGameData.craftingCharacters,
    ) => void;
    const validate = Reflect.get(store, "validate").bind(store) as Validate;
    const valid = () => structuredClone(builtinGameData);
    const expectInvalid = (
      mutate: (bundle: ReturnType<typeof valid>) => void,
      message: string,
    ) => {
      const bundle = valid();
      mutate(bundle);
      expect(() =>
        validate(
          bundle.characters,
          bundle.weapons,
          bundle.materialFamilies,
          bundle.craftingCharacters,
        ),
      ).toThrow(message);
    };

    expect(() =>
      validate(
        [],
        builtinGameData.weapons,
        builtinGameData.materialFamilies,
        builtinGameData.craftingCharacters,
      ),
    ).toThrow("No supported");
    expectInvalid(
      (bundle) =>
        bundle.materialFamilies.push(
          structuredClone(bundle.materialFamilies[0]),
        ),
      "Duplicate material family",
    );
    expectInvalid((bundle) => {
      delete bundle.materialFamilies[0].materialsByRarity[
        bundle.materialFamilies[0].craftableRarities[0]
      ];
    }, "Incomplete material family");
    expectInvalid((bundle) => {
      bundle.materialFamilies[0].names["zh-CN"] = "";
    }, "Missing localized material family name");
    expectInvalid((bundle) => {
      bundle.materialFamilies[0].materialsByRarity[
        bundle.materialFamilies[0].craftableRarities[0]
      ]!.names["en-US"] = "";
    }, "Missing localized material name");
    expectInvalid((bundle) => {
      bundle.characters[0].talentMaterialFamilyId = "missing";
    }, "Invalid character reference");
    expectInvalid((bundle) => {
      bundle.weapons[0].materialFamilyId = "missing";
    }, "Invalid weapon reference");
    expectInvalid((bundle) => {
      bundle.craftingCharacters[0].passive.categories = [];
    }, "Invalid crafting character");
  });

  it("filters incomplete source families and recognizes both supported passive strategies", () => {
    type FamilyFromIds = (
      seed: string,
      category: "talent-book" | "weapon-ascension",
      ids: string[],
      materials: Record<string, unknown>,
    ) => unknown;
    type ExtractPassives = (
      id: string,
      zh: Record<string, unknown>,
      en: Record<string, unknown>,
      catalog: Record<string, unknown>,
    ) => Array<{ passive: { strategy: string; categories: string[] } }>;
    const familyFromIds = Reflect.get(store, "familyFromIds").bind(
      store,
    ) as FamilyFromIds;
    const extractPassives = Reflect.get(store, "extractPassives").bind(
      store,
    ) as ExtractPassives;
    expect(familyFromIds("empty", "talent-book", ["missing"], {})).toBeNull();
    expect(
      familyFromIds("wrong", "talent-book", ["x"], {
        x: {
          qualityType: "QUALITY_GREEN",
          chsName: "甲",
          enName: "A",
          enDescription: "Other",
        },
      }),
    ).toBeNull();
    const passives = extractPassives(
      "c1",
      {
        info: { name: "角色" },
        passives: {
          double: {
            description: "合成武器突破素材时，有10%概率获得双倍产物。",
          },
          irrelevant: { description: "移动速度提高。" },
        },
      },
      {
        info: { name: "Character" },
        passives: {
          double: {
            description:
              "When crafting Weapon Ascension Materials, has a 10% chance to receive double the product.",
          },
          irrelevant: { description: "Increases movement speed." },
        },
      },
      {},
    );
    expect(passives).toHaveLength(1);
    expect(passives[0].passive).toMatchObject({
      strategy: "double_10",
      categories: ["weapon-ascension"],
    });
  });

  it("handles localization fallbacks, optional requests, and icon retry boundaries", async () => {
    type FamilyFromIds = (
      seed: string,
      category: "talent-book" | "weapon-ascension",
      ids: string[],
      materials: Record<string, unknown>,
    ) => {
      names: { "zh-CN": string; "en-US": string };
      materialsByRarity: Record<number, unknown>;
    } | null;
    type ExtractPassives = (
      id: string,
      zh: Record<string, unknown>,
      en: Record<string, unknown>,
      catalog: Record<string, unknown>,
    ) => Array<{
      names: { "zh-CN": string; "en-US": string };
      passive: { strategy: string; categories: string[] };
    }>;
    type FetchOptional = (
      url: string,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    type DownloadIcons = (
      version: string,
      characters: [string, unknown][],
      weapons: [string, unknown][],
      families: typeof builtinGameData.materialFamilies,
      materials: Record<string, unknown>,
      emit: () => void,
      signal: AbortSignal,
    ) => Promise<Map<string, Buffer>>;
    const familyFromIds = Reflect.get(store, "familyFromIds").bind(
      store,
    ) as FamilyFromIds;
    const extractPassives = Reflect.get(store, "extractPassives").bind(
      store,
    ) as ExtractPassives;
    const fetchOptional = Reflect.get(store, "fetchJsonOptional").bind(
      store,
    ) as FetchOptional;
    const downloadIcons = Reflect.get(store, "downloadIcons").bind(
      store,
    ) as DownloadIcons;
    const materials = {
      a: {
        qualityType: "QUALITY_GREEN",
        chsName: "",
        enName: "Shard Alpha",
        enDescription: "Weapon Ascension Material",
      },
      b: {
        qualityType: "QUALITY_BLUE",
        chsName: "乙",
        enName: "Shard Beta",
        enDescription: "Weapon Ascension Material",
      },
      c: {
        qualityType: "QUALITY_PURPLE",
        chsName: "丙",
        enName: "Shard Gamma",
        enDescription: "Weapon Ascension Material",
      },
      d: {
        qualityType: "QUALITY_ORANGE",
        chsName: "丁",
        enName: "",
        enDescription: "Weapon Ascension Material",
      },
    };
    const family = familyFromIds(
      "fallbacks",
      "weapon-ascension",
      ["a", "b", "c", "d"],
      materials,
    );
    expect(family?.names["zh-CN"]).toBeTruthy();
    expect(family?.names["en-US"]).toBeTruthy();

    const passives = extractPassives(
      "english-only",
      { passives: { craft: { description: "" } } },
      {
        info: { name: "English Crafter" },
        passives: {
          craft: {
            description:
              "When crafting Character Talent Materials, has a 25% chance to refund.",
          },
        },
      },
      { chsName: "中文角色" },
    );
    expect(passives[0]).toMatchObject({
      names: { "zh-CN": "中文角色", "en-US": "English Crafter" },
      passive: { strategy: "refund_25", categories: ["talent-book"] },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        )
        .mockRejectedValueOnce(new Error("offline")),
    );
    await expect(fetchOptional("https://example.test/ok")).resolves.toEqual({
      ok: true,
    });
    await expect(
      fetchOptional("https://example.test/offline"),
    ).resolves.toEqual({});

    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(
      fetchOptional("https://example.test/abort", controller.signal),
    ).rejects.toThrow("aborted");

    const iconFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockImplementation(() =>
        Promise.resolve(new Response(Uint8Array.from([1]), { status: 200 })),
      );
    vi.stubGlobal("fetch", iconFetch);
    const icons = await downloadIcons(
      "v-test",
      [["no-icon", {}]],
      [["no-icon", {}]],
      [
        {
          ...builtinGameData.materialFamilies[0],
          materialsByRarity: {
            ...builtinGameData.materialFamilies[0].materialsByRarity,
            5: undefined,
          },
        },
      ],
      {},
      () => {},
      new AbortController().signal,
    );
    expect(icons.size).toBeGreaterThan(0);
    expect(iconFetch.mock.calls.length).toBeGreaterThan(1);

    vi.useFakeTimers();
    const failedFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", failedFetch);
    const failedDownload = expect(
      downloadIcons(
        "v-test",
        [],
        [],
        [],
        {},
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow("Required icon download failed");
    await vi.runAllTimersAsync();
    await failedDownload;
    expect(failedFetch).toHaveBeenCalledTimes(50);
    vi.useRealTimers();
  });
});
