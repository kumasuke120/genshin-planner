import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import i18n from "./i18n";
import type { GameDataStatus, UserProfileV1 } from "../shared/types";
import { builtinGameData } from "../data/gameData";

const profile: UserProfileV1 = {
  schemaVersion: 1,
  locale: "zh-CN",
  inventoryByMaterialFamily: {},
  savedPlans: [],
  recentPlanIds: [],
  updatedAt: new Date().toISOString(),
};

describe("planner interface", () => {
  afterEach(cleanup);
  beforeEach(() => {
    i18n.changeLanguage("zh-CN");
    window.desktopApi = {
      loadProfile: vi.fn().mockResolvedValue(profile),
      saveProfile: vi.fn().mockResolvedValue(undefined),
      exportProfile: vi.fn().mockResolvedValue(true),
      importProfile: vi.fn().mockResolvedValue(null),
      loadGameData: vi.fn().mockResolvedValue(builtinGameData),
      getGameDataStatus: vi.fn().mockResolvedValue({
        manifest: builtinGameData.manifest,
        source: "builtin",
        counts: {
          characters: 6,
          weapons: 3,
          talentMaterials: 24,
          weaponMaterials: 8,
          icons: 0,
        },
      }),
      syncGameData: vi.fn(),
      cancelGameDataSync: vi.fn().mockResolvedValue(undefined),
      importGameData: vi.fn(),
      exportGameData: vi.fn(),
      restoreBuiltinGameData: vi.fn(),
      openExternal: vi.fn(),
      openUserDataDirectory: vi.fn(),
      openGameDataDirectory: vi.fn(),
      iconUrl: vi.fn().mockReturnValue(""),
      onGameDataProgress: vi.fn().mockReturnValue(() => {}),
      onWindowCloseRequested: vi.fn().mockReturnValue(() => {}),
      confirmWindowClose: vi.fn(),
    };
  });

  it("matches a crafting character passive", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    expect(document.title).toBe("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "手动计算" }));
    await user.click(screen.getByRole("button", { name: "不使用角色" }));
    await user.click(
      screen.getByRole("button", { name: /行秋.*返还部分合成材料/ }),
    );
    expect(screen.getByText(/合成角色天赋素材时/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByLabelText("语言"));
    await user.click(screen.getByRole("option", { name: "English" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Manual Calculation" }),
      ).toBeInTheDocument(),
    );
    expect(document.title).toBe("Genshin Planner");
  });

  it("provides Chinese and English resources", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("manual")).toBe("Manual Calculation");
    window.desktopApi!.loadProfile = vi
      .fn()
      .mockResolvedValue({ ...profile, locale: "en-US" });
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("Genshin Planner");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Character Talents",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Xingqiu" }));
    const pyroFilter = within(
      screen.getByRole("dialog", { name: "Character" }),
    ).getByRole("button", { name: "Pyro" });
    const icon = pyroFilter.querySelector("img");
    expect(icon).not.toBeNull();
    fireEvent.error(icon!);
    expect(within(pyroFilter).getByText("P")).toBeVisible();
  });

  it("guides users from built-in sample data to the update settings", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    const guide = await screen.findByText(/当前使用示例游戏资料/);
    await user.click(
      within(guide.parentElement!).getByRole("button", { name: "前往同步" }),
    );
    expect(screen.getByRole("button", { name: "游戏资料" })).toHaveClass(
      "selected",
    );
    const syncButton = screen.getByRole("button", { name: "同步 Lunaris" });
    expect(syncButton).toHaveClass("sync-action-highlight");
    expect(syncButton).toHaveFocus();

    await user.click(
      within(screen.getByRole("status")).getByRole("button", { name: "关闭" }),
    );
    expect(screen.queryByText(/当前使用示例游戏资料/)).not.toBeInTheDocument();
  });

  it("opens a material family in manual calculation", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    const materialEntry = await screen.findByText("「繁荣」系列");
    await user.click(materialEntry.closest("button")!);

    expect(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "手动计算",
      }),
    ).toHaveClass("active");
    expect(screen.getByLabelText("材料系列")).toHaveTextContent("繁荣");
    expect(
      within(screen.getByRole("group", { name: "材料类别" })).getByRole(
        "button",
        { name: "角色天赋" },
      ),
    ).toHaveClass("selected");
  });

  it("opens the weapon picker and applies a selected weapon", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    const trigger = screen.getByRole("button", { name: "西风剑" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "武器" });
    expect(within(dialog).getByRole("button", { name: "笛剑" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "笛剑" }));
    expect(
      screen.queryByRole("dialog", { name: "武器" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "笛剑" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("keeps a one-star weapon visible through the weapon rarity filter", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    await user.click(screen.getByRole("button", { name: "西风剑" }));
    const dialog = screen.getByRole("dialog", { name: "武器" });
    await user.click(within(dialog).getByRole("button", { name: "1★" }));
    expect(
      within(dialog).getByRole("button", { name: "训练大剑" }),
    ).toBeVisible();
  });

  it("opens the character picker, filters it, and selects a character", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "角色天赋",
      }),
    );
    await user.click(screen.getByRole("button", { name: "行秋" }));
    const dialog = screen.getByRole("dialog", { name: "角色" });
    const cryoFilter = within(dialog).getByRole("button", { name: "冰" });
    const cryoIcon = cryoFilter.querySelector("img");
    expect(cryoIcon).not.toBeNull();
    fireEvent.error(cryoIcon!);
    expect(cryoIcon).toHaveStyle({ display: "none" });
    expect(within(cryoFilter).getByText("冰")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "冰" }));
    expect(within(dialog).getByRole("button", { name: "优菈" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "优菈" }));
    expect(
      screen.queryByRole("dialog", { name: "角色" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "优菈" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("saves through an editable in-app dialog", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    await user.click(screen.getByRole("button", { name: "保存方案" }));
    const dialog = screen.getByRole("dialog", { name: "保存方案" });
    const input = within(dialog).getByLabelText("方案名称");
    expect(input).toHaveValue("「西风剑」突破方案");
    await user.clear(input);
    await user.type(input, "我的武器计划");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));
    await waitFor(
      () => expect(window.desktopApi?.saveProfile).toHaveBeenCalled(),
      { timeout: 1_000 },
    );
    expect(
      screen.queryByRole("dialog", { name: "保存方案" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".workspace-tab.active")).toHaveTextContent(
      "我的武器计划",
    );
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("uses compact rarity deficits and does not repeat a material subtitle", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    expect(screen.queryByText("高塔孤王")).not.toBeInTheDocument();
    expect(screen.getByText("缺少素材")).toBeInTheDocument();
    expect(document.querySelectorAll(".deficit-tag")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "保存方案" })).toHaveClass(
      "save-plan-button",
    );
  });

  it("replaces a zero inventory value when entering a material count", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    const input = screen.getByLabelText("库存 高塔孤王的破瓦 2★");
    await user.click(input);
    await user.type(input, "9");
    expect(input).toHaveValue(9);
  });

  it("keeps picker dimensions stable and provides the no-bonus crafting option", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    await user.click(screen.getByRole("button", { name: "西风剑" }));
    const weaponDialog = screen.getByRole("dialog", { name: "武器" });
    expect(weaponDialog).toHaveClass("stable-picker-dialog");
    await user.click(within(weaponDialog).getByRole("button", { name: "1★" }));
    expect(weaponDialog).toHaveClass("stable-picker-dialog");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "手动计算",
      }),
    );
    await user.click(screen.getByRole("button", { name: "不使用角色" }));
    const craftingDialog = screen.getByRole("dialog", { name: "合成角色" });
    expect(
      within(craftingDialog).getByRole("button", {
        name: /不使用角色.*无加成/,
      }),
    ).toBeVisible();
  });

  it("shows an enlarged material preview on hover", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    await user.hover(
      screen.getByRole("button", { name: "预览 高塔孤王的破瓦" }),
    );
    expect(document.querySelector(".material-preview-card")).toHaveTextContent(
      "高塔孤王的破瓦",
    );
  });

  it("shows a crafting character expectation in manual calculation", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "手动计算",
      }),
    );
    const guideInventory = screen.getByLabelText("库存 「繁荣」的指引 3★");
    await user.clear(guideInventory);
    await user.type(guideInventory, "30");
    await user.click(screen.getByRole("button", { name: "不使用角色" }));
    const dialog = screen.getByRole("dialog", { name: "合成角色" });
    await user.click(
      within(dialog).getByRole("button", { name: /优菈.*双倍产物/ }),
    );
    expect(screen.getByText("合成 +10")).toBeVisible();
    expect(screen.getByText("被动 +1")).toBeVisible();
    expect(screen.getAllByText("被动 +0")).not.toHaveLength(0);
  });

  it("updates an opened plan instead of creating a new one", async () => {
    const user = userEvent.setup();
    const savedPlan = {
      id: "saved-weapon-plan",
      name: "「西风剑」突破方案",
      target: {
        type: "weapon" as const,
        weaponId: "favonius-sword",
        currentPhase: 0,
        targetPhase: 6,
      },
      craftingCharacterId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [savedPlan],
      recentPlanIds: [savedPlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      screen.getByRole("button", { name: /「西风剑」突破方案/ }),
    );
    expect(document.querySelector(".workspace-tab.active")).toHaveTextContent(
      "「西风剑」突破方案",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(
      screen.queryByRole("dialog", { name: "保存方案" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(window.desktopApi?.saveProfile).toHaveBeenCalled(),
    );
    expect(await screen.findByText("方案已更新")).toBeVisible();
    const latestProfile = (
      window.desktopApi!.saveProfile as ReturnType<typeof vi.fn>
    ).mock.calls.at(-1)?.[0] as UserProfileV1;
    expect(latestProfile.savedPlans).toHaveLength(1);
    expect(latestProfile.savedPlans[0].id).toBe(savedPlan.id);
  });

  it("generates the next unique name when saving an opened plan as a new plan", async () => {
    const user = userEvent.setup();
    const savedPlan = {
      id: "saved-weapon-plan",
      name: "「西风剑」突破方案",
      target: {
        type: "weapon" as const,
        weaponId: "favonius-sword",
        currentPhase: 0,
        targetPhase: 6,
      },
      craftingCharacterId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const currentTargetPlan = {
      ...savedPlan,
      id: "current-weapon-plan",
      name: "「笛剑」突破方案",
      target: { ...savedPlan.target, weaponId: "the-flute" },
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [savedPlan, currentTargetPlan],
      recentPlanIds: [savedPlan.id, currentTargetPlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      screen.getByRole("button", { name: /「西风剑」突破方案/ }),
    );
    await user.click(screen.getByRole("button", { name: "西风剑" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "武器" })).getByRole("button", {
        name: "笛剑",
      }),
    );
    await user.click(screen.getByRole("button", { name: "另存为" }));
    await user.click(screen.getByRole("menuitem", { name: "另存为" }));
    const dialog = screen.getByRole("dialog", { name: "保存方案" });
    expect(within(dialog).getByLabelText("方案名称")).toHaveValue(
      "「笛剑」突破方案 (2)",
    );
  });

  it("blocks manually entered duplicate plan names", async () => {
    const user = userEvent.setup();
    const savedPlan = {
      id: "saved-weapon-plan",
      name: "「西风剑」突破方案",
      target: {
        type: "weapon" as const,
        weaponId: "favonius-sword",
        currentPhase: 0,
        targetPhase: 6,
      },
      craftingCharacterId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [savedPlan],
      recentPlanIds: [savedPlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    await user.click(screen.getByRole("button", { name: "保存方案" }));
    const dialog = screen.getByRole("dialog", { name: "保存方案" });
    const input = within(dialog).getByLabelText("方案名称");
    await user.clear(input);
    await user.type(input, "「西风剑」突破方案");
    expect(within(dialog).getByText("方案名称已存在。")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("hides calculation controls for weapons without a supported curve", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    expect(screen.getByRole("button", { name: "保存方案" })).toBeVisible();
    expect(document.querySelector(".material-grid")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "西风剑" }));
    const dialog = screen.getByRole("dialog", { name: "武器" });
    await user.click(within(dialog).getByRole("button", { name: "1★" }));
    await user.click(within(dialog).getByRole("button", { name: "训练大剑" }));
    expect(screen.getByText("暂不支持突破计算")).toBeVisible();
    expect(document.querySelector(".material-grid")).not.toBeInTheDocument();
    expect(screen.queryByText("合成角色")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "保存方案" }),
    ).not.toBeInTheDocument();
  });

  it("changes theme and language only from settings", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    expect(screen.queryByLabelText("语言")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "深色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(screen.getByLabelText("语言"));
    await user.click(screen.getByRole("option", { name: "English" }));
    expect(
      await screen.findByRole("button", { name: "Display & Language" }),
    ).toBeVisible();
  });

  it("warns before restoring built-in data", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    await user.click(screen.getByRole("button", { name: "恢复内置资料" }));
    const dialog = screen.getByRole("alertdialog", { name: "恢复内置资料？" });
    expect(within(dialog).getByText(/方案不会被删除/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(window.desktopApi?.restoreBuiltinGameData).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "恢复内置资料" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "恢复内置资料",
      }),
    );
    await waitFor(() =>
      expect(window.desktopApi?.restoreBuiltinGameData).toHaveBeenCalledOnce(),
    );
  });

  it("opens the user and game data folders from their owning settings tabs", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "我的方案" }));
    await user.click(screen.getByRole("button", { name: "打开用户数据目录" }));
    expect(window.desktopApi?.openUserDataDirectory).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    await user.click(screen.getByRole("button", { name: "打开资料目录" }));
    expect(window.desktopApi?.openGameDataDirectory).toHaveBeenCalledOnce();
  });

  it("keeps unsaved input when switching between opened plan tabs", async () => {
    const user = userEvent.setup();
    const first = {
      id: "weapon-plan",
      name: "武器计划",
      target: {
        type: "weapon" as const,
        weaponId: "favonius-sword",
        currentPhase: 0,
        targetPhase: 6,
      },
      craftingCharacterId: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    const second = {
      id: "manual-plan",
      name: "手动计划",
      target: {
        type: "manual" as const,
        materialFamilyId: "prosperity",
        required: {},
      },
      craftingCharacterId: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [first, second],
      recentPlanIds: [first.id, second.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await user.click(await screen.findByRole("button", { name: /武器计划/ }));
    await user.click(screen.getByLabelText("当前阶段"));
    await user.click(screen.getByRole("option", { name: "Lv. 40+" }));
    await user.click(screen.getAllByRole("button", { name: "总览" })[0]);
    await user.click(screen.getByRole("button", { name: /手动计划/ }));
    await user.click(screen.getByRole("button", { name: /武器计划/ }));
    expect(screen.getByLabelText("当前阶段")).toHaveTextContent("Lv. 40+");
  });

  it("keeps a plan visible but blocks editing when its game data is absent", async () => {
    const user = userEvent.setup();
    const unavailable = {
      id: "future-plan",
      name: "未来角色计划",
      target: {
        type: "talent" as const,
        characterId: "missing-character",
        current: { normal: 1, skill: 1, burst: 1 },
        target: { normal: 9, skill: 9, burst: 9 },
      },
      craftingCharacterId: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [unavailable],
      recentPlanIds: [unavailable.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: /未来角色计划/ }),
    );
    let dialog = screen.getByRole("alertdialog", { name: "暂时无法打开方案" });
    expect(dialog).toHaveTextContent(
      "未来角色计划所需资料尚未下载，同步 Lunaris 后可继续查看与编辑。",
    );
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(
      screen.queryByRole("alertdialog", { name: "暂时无法打开方案" }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "总览",
      }),
    ).toHaveClass("active");
    await user.click(screen.getByRole("button", { name: /未来角色计划/ }));
    dialog = screen.getByRole("alertdialog", { name: "暂时无法打开方案" });
    await user.click(within(dialog).getByRole("button", { name: "前往同步" }));
    expect(screen.getByRole("button", { name: "游戏资料" })).toHaveClass(
      "selected",
    );
  });

  it("confirms before closing a changed plan tab and restores the overview after closing", async () => {
    const user = userEvent.setup();
    const savedPlan = {
      id: "close-plan",
      name: "待关闭方案",
      target: {
        type: "weapon" as const,
        weaponId: "favonius-sword",
        currentPhase: 0,
        targetPhase: 6,
      },
      craftingCharacterId: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [savedPlan],
      recentPlanIds: [savedPlan.id],
    });
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await user.click(await screen.findByRole("button", { name: /待关闭方案/ }));
    await user.click(screen.getByLabelText("当前阶段"));
    await user.click(screen.getByRole("option", { name: "Lv. 40+" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: /待关闭方案/ }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("待关闭方案");
    const close = screen.getByRole("img", { name: "关闭" });
    await user.click(close);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(document.querySelector(".workspace-tab.active")).toHaveTextContent(
      "待关闭方案",
    );
    await user.click(close);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".overview")).toBeVisible();
  });

  it("runs plan maintenance and about actions from their settings tabs", async () => {
    const user = userEvent.setup();
    const imported = {
      ...profile,
      locale: "zh-CN" as const,
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    window.desktopApi!.importProfile = vi.fn().mockResolvedValue(imported);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "我的方案" }));
    await user.click(screen.getByRole("button", { name: "导入方案" }));
    await user.click(screen.getByRole("button", { name: "导出方案" }));
    expect(window.desktopApi?.importProfile).toHaveBeenCalledOnce();
    expect(window.desktopApi?.exportProfile).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "关于" }));
    await user.click(screen.getByRole("button", { name: /Kumasuke120/ }));
    await user.click(screen.getByRole("button", { name: "项目主页" }));
    await user.click(screen.getByRole("button", { name: "复制版本信息" }));
    expect(window.desktopApi?.openExternal).toHaveBeenCalledTimes(2);
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
  });

  it("runs game-data actions and displays operation history", async () => {
    const user = userEvent.setup();
    const status = {
      manifest: { ...builtinGameData.manifest, provider: "lunaris" as const },
      source: "active" as const,
      counts: {
        characters: 1,
        weapons: 5,
        talentMaterials: 3,
        weaponMaterials: 4,
        icons: 0,
      },
      operations: [
        {
          action: "sync" as const,
          outcome: "success" as const,
          version: "test",
          at: "2026-09-12T01:02:03.000Z",
        },
        {
          action: "sync" as const,
          outcome: "started" as const,
          at: "2026-09-12T01:01:59.000Z",
        },
      ],
    };
    window.desktopApi!.getGameDataStatus = vi.fn().mockResolvedValue(status);
    window.desktopApi!.syncGameData = vi.fn().mockResolvedValue(status);
    window.desktopApi!.importGameData = vi.fn().mockResolvedValue(status);
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    expect(screen.getByText("最近操作")).toBeVisible();
    expect(screen.getByText(status.manifest.gameDataVersion)).toBeVisible();
    expect(screen.getByText("开始同步游戏资料")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "同步 Lunaris" }));
    await waitFor(() =>
      expect(window.desktopApi?.syncGameData).toHaveBeenCalledOnce(),
    );
    await user.click(screen.getByRole("button", { name: "导入资料" }));
    await waitFor(() =>
      expect(window.desktopApi?.importGameData).toHaveBeenCalledOnce(),
    );
    await user.click(screen.getByRole("button", { name: "导出资料" }));
    expect(window.desktopApi?.exportGameData).toHaveBeenCalledOnce();
  });

  it("does not expose a source or allow exporting built-in game data", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));

    expect(
      screen.queryByRole("button", { name: "Lunaris" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出资料" })).toBeDisabled();
  });

  it("keeps the sync action visible while game data is being imported", async () => {
    const user = userEvent.setup();
    let finishImport!: (status: GameDataStatus | null) => void;
    window.desktopApi!.importGameData = vi.fn(
      () =>
        new Promise<GameDataStatus | null>((resolve) => {
          finishImport = resolve;
        }),
    );
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    await user.click(screen.getByRole("button", { name: "导入资料" }));
    expect(screen.getByRole("button", { name: "同步 Lunaris" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "取消同步" }),
    ).not.toBeInTheDocument();
    finishImport(null);
  });

  it("switches manual material categories and edits required quantities", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "手动计算",
      }),
    );
    const group = screen.getByRole("group", { name: "材料类别" });
    await user.click(within(group).getByRole("button", { name: "武器突破" }));
    expect(within(group).getByRole("button", { name: "武器突破" })).toHaveClass(
      "selected",
    );
    const required = screen.getByLabelText(/需求 .* 2★/);
    await user.click(required);
    await user.type(required, "7");
    expect(required).toHaveValue(7);
  });

  it("covers picker search, filters, image fallback, and explicit close actions", async () => {
    const user = userEvent.setup();
    const dataWithTestIcon = structuredClone(builtinGameData);
    for (const family of dataWithTestIcon.materialFamilies) {
      for (const rarity of family.craftableRarities)
        family.materialsByRarity[rarity]!.iconId = `test-icon-${rarity}`;
    }
    window.desktopApi!.loadGameData = vi
      .fn()
      .mockResolvedValue(dataWithTestIcon);
    window.desktopApi!.iconUrl = vi.fn((id) =>
      id ? `game-data://icon/${id}` : "",
    );
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    const previewImage = screen
      .getByRole("button", { name: "预览 高塔孤王的破瓦" })
      .querySelector("img")!;
    fireEvent.error(previewImage);
    expect(previewImage).toHaveStyle({ display: "none" });
    await user.click(screen.getByRole("button", { name: "西风剑" }));
    const dialog = screen.getByRole("dialog", { name: "武器" });
    const search = within(dialog).getByLabelText("搜索武器");
    await user.type(search, "不存在的武器");
    expect(within(dialog).getByText("没有匹配结果")).toBeVisible();
    await user.clear(search);
    const weaponFilter = within(dialog).getByRole("button", { name: "单手剑" });
    const filterImage = weaponFilter.querySelector("img")!;
    const filterFallback = weaponFilter.querySelector(".filter-fallback")!;
    expect(filterFallback).toHaveAttribute("hidden");
    fireEvent.error(filterImage);
    expect(filterImage).toHaveAttribute("hidden");
    expect(filterFallback).not.toHaveAttribute("hidden");
    await user.click(within(dialog).getByRole("button", { name: "单手剑" }));
    await user.click(
      within(dialog).getAllByRole("button", { name: "全部" })[0],
    );
    await user.click(within(dialog).getByRole("button", { name: "关闭" }));
    expect(
      screen.queryByRole("dialog", { name: "武器" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the base weapon workspace while switching to and from a talent plan", async () => {
    const user = userEvent.setup();
    const talentPlan = {
      id: "saved-talent-plan",
      name: "角色方案",
      target: {
        type: "talent" as const,
        characterId: "xingqiu",
        current: { normal: 1, skill: 1, burst: 1 },
        target: { normal: 9, skill: 9, burst: 9 },
      },
      craftingCharacterId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [talentPlan],
      recentPlanIds: [talentPlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: /角色方案/ }));
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    await user.click(screen.getByRole("button", { name: /角色方案/ }));
    const tabs = document.querySelectorAll(".workspace-tab");
    expect(tabs[0]).toHaveTextContent("新建武器突破");
    expect(tabs[1]).toHaveClass("active");
    await user.click(tabs[0] as HTMLElement);
    expect(tabs[0]).toHaveClass("active");
    expect(screen.getByText("当前阶段")).toBeVisible();
  });

  it("keeps active workspaces inert and handles a normal window close", async () => {
    const user = userEvent.setup();
    let closeListener: (() => void) | undefined;
    window.desktopApi!.onWindowCloseRequested = vi.fn((listener) => {
      closeListener = listener;
      return () => undefined;
    });
    const talentPlan = {
      id: "recent-talent-plan",
      name: "最近角色方案",
      target: {
        type: "talent" as const,
        characterId: "xingqiu",
        current: { normal: 1, skill: 1, burst: 1 },
        target: { normal: 8, skill: 8, burst: 8 },
      },
      craftingCharacterId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [talentPlan],
      recentPlanIds: [talentPlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");

    await user.click(document.querySelector(".workspace-tab.active")!);
    await act(() => closeListener?.());
    expect(window.desktopApi!.confirmWindowClose).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: /最近角色方案/ }));
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "总览",
      }),
    );
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "角色天赋",
      }),
    );
    expect(screen.getByRole("button", { name: /最近角色方案/ })).toHaveClass(
      "active",
    );

    const levelSelect = screen.getAllByRole("combobox")[0];
    await user.click(levelSelect);
    expect(screen.getByRole("option", { name: "1" })).toBeVisible();
    fireEvent.keyDown(levelSelect, { key: "ArrowUp" });
    expect(levelSelect).toHaveTextContent("10");
    fireEvent.keyDown(levelSelect, { key: "Escape" });
    expect(screen.queryByRole("option", { name: "1" })).not.toBeInTheDocument();
    await user.click(levelSelect);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("option", { name: "1" })).not.toBeInTheDocument();
  });

  it("validates talent ranges without exposing an unfinished new-tab action", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "角色天赋",
      }),
    );
    const levels = screen.getAllByRole("combobox").slice(0, 6);
    await user.click(levels[0]);
    await user.click(screen.getByRole("option", { name: "9" }));
    await user.click(levels[1]);
    await user.click(screen.getByRole("option", { name: "2" }));
    expect(screen.getByText("目标等级不能低于当前等级")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "新建计算" }),
    ).not.toBeInTheDocument();
  });

  it("searches and deletes plans from settings", async () => {
    const user = userEvent.setup();
    const savedPlan = {
      id: "delete-plan",
      name: "待删除方案",
      target: {
        type: "manual" as const,
        materialFamilyId: "prosperity",
        required: {},
      },
      craftingCharacterId: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [savedPlan],
      recentPlanIds: [savedPlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "我的方案" }));
    const search = screen.getByPlaceholderText("搜索方案名称");
    await user.type(search, "不存在");
    expect(screen.getByText("暂无已保存方案。")).toBeVisible();
    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.queryByText("待删除方案")).not.toBeInTheDocument();
  });

  it("reports failed data actions and allows cancelling reported progress", async () => {
    const user = userEvent.setup();
    window.desktopApi!.syncGameData = vi
      .fn()
      .mockRejectedValue(new Error("network"));
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    await user.click(screen.getByRole("button", { name: "同步 Lunaris" }));
    expect(
      await screen.findByText("资料操作失败，当前资料未被替换。"),
    ).toBeVisible();
    const progressCallback = (
      window.desktopApi!.onGameDataProgress as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    window.desktopApi!.syncGameData = vi.fn(
      () => new Promise<never>(() => undefined),
    );
    await user.click(screen.getByRole("button", { name: "同步 Lunaris" }));
    expect(screen.getByText("开始同步游戏资料")).toBeVisible();
    await act(() =>
      progressCallback({
        stage: "checking",
        completed: 0,
        total: 0,
        message: "Checking",
      }),
    );
    const indeterminateProgress = screen.getByRole("progressbar", {
      name: "正在检查游戏资料版本",
    });
    expect(indeterminateProgress).not.toHaveAttribute("aria-valuenow");
    expect(
      indeterminateProgress.querySelector(".sync-progress-fill"),
    ).toHaveClass("indeterminate");
    await act(() =>
      progressCallback({
        stage: "details",
        completed: 1,
        total: 2,
        message: "同步中",
      }),
    );
    expect(screen.getByText("正在读取角色与武器详情")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "正在读取角色与武器详情" }),
    ).toHaveAttribute("aria-valuenow", "1");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "总览",
      }),
    );
    let leaveDialog = screen.getByRole("alertdialog", {
      name: "取消同步并离开？",
    });
    await user.click(
      within(leaveDialog).getByRole("button", { name: "继续同步" }),
    );
    expect(screen.getByRole("button", { name: "游戏资料" })).toHaveClass(
      "selected",
    );
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "总览",
      }),
    );
    leaveDialog = screen.getByRole("alertdialog", { name: "取消同步并离开？" });
    await user.click(
      within(leaveDialog).getByRole("button", { name: "取消同步并离开" }),
    );
    await screen.findByText("选择培养目标，查看所需素材。");
    expect(window.desktopApi?.cancelGameDataSync).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    await user.click(screen.getByRole("button", { name: "取消同步" }));
    let cancelDialog = screen.getByRole("alertdialog", { name: "取消同步？" });
    await user.click(
      within(cancelDialog).getByRole("button", { name: "继续同步" }),
    );
    expect(window.desktopApi?.cancelGameDataSync).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "取消同步" }));
    cancelDialog = screen.getByRole("alertdialog", { name: "取消同步？" });
    await user.click(
      within(cancelDialog).getByRole("button", { name: "取消同步" }),
    );
    await waitFor(() =>
      expect(window.desktopApi?.cancelGameDataSync).toHaveBeenCalledTimes(2),
    );
    await act(() =>
      progressCallback({
        stage: "cancelled",
        completed: 0,
        total: 0,
        message: "Game data sync cancelled",
      }),
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("asks before closing during sync and cancels before confirming the close", async () => {
    const user = userEvent.setup();
    window.desktopApi!.syncGameData = vi.fn(
      () => new Promise<never>(() => undefined),
    );
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    await user.click(screen.getByRole("button", { name: "同步 Lunaris" }));
    const progressCallback = (
      window.desktopApi!.onGameDataProgress as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    await act(() =>
      progressCallback({
        stage: "details",
        completed: 1,
        total: 2,
        message: "同步中",
      }),
    );

    const closeRequestCalls = (
      window.desktopApi!.onWindowCloseRequested as ReturnType<typeof vi.fn>
    ).mock.calls;
    const closeRequested = closeRequestCalls.at(-1)?.[0] as () => void;
    act(() => closeRequested());
    let dialog = screen.getByRole("alertdialog", { name: "取消同步并离开？" });
    await user.click(within(dialog).getByRole("button", { name: "继续同步" }));
    expect(window.desktopApi?.confirmWindowClose).not.toHaveBeenCalled();

    act(() => closeRequested());
    dialog = screen.getByRole("alertdialog", { name: "取消同步并离开？" });
    await user.click(
      within(dialog).getByRole("button", { name: "取消同步并离开" }),
    );
    await waitFor(() =>
      expect(window.desktopApi?.cancelGameDataSync).toHaveBeenCalledOnce(),
    );
    expect(window.desktopApi?.confirmWindowClose).toHaveBeenCalledOnce();
  });

  it("does not offer plan saving from manual calculation", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "手动计算",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "保存方案" }),
    ).not.toBeInTheDocument();
  });

  it("handles cancelled and failed profile imports without replacing current data", async () => {
    const user = userEvent.setup();
    window.desktopApi!.importProfile = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("invalid"));
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "我的方案" }));
    await user.click(screen.getByRole("button", { name: "导入方案" }));
    expect(
      screen.queryByText("导入失败：文件格式无效"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "导入方案" }));
    expect(await screen.findByText("导入失败：文件格式无效")).toBeVisible();
  });

  it("keeps a dirty plan draft when opening settings and restores it from its tab", async () => {
    const user = userEvent.setup();
    const savedPlan = {
      id: "settings-draft",
      name: "设置切换方案",
      target: {
        type: "weapon" as const,
        weaponId: "favonius-sword",
        currentPhase: 0,
        targetPhase: 6,
      },
      craftingCharacterId: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [savedPlan],
      recentPlanIds: [savedPlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: /设置切换方案/ }),
    );
    await user.click(screen.getByLabelText("当前阶段"));
    await user.click(screen.getByRole("option", { name: "Lv. 50+" }));
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: /设置切换方案/ }));
    expect(screen.getByLabelText("当前阶段")).toHaveTextContent("Lv. 50+");
  });

  it("supports light and system themes and reacts to the system preference", async () => {
    const user = userEvent.setup();
    let changeListener: (() => void) | undefined;
    const media = {
      matches: true,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn((_name: string, listener: () => void) => {
        changeListener = listener;
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(
      media as unknown as MediaQueryList,
    );
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "浅色" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: "跟随系统" }));
    media.matches = false;
    await act(() => changeListener?.());
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("cancels the save dialog from its close button and backdrop", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    await user.click(screen.getByRole("button", { name: "保存方案" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "保存方案" })).getByRole(
        "button",
        { name: "关闭" },
      ),
    );
    await user.click(screen.getByRole("button", { name: "保存方案" }));
    fireEvent.mouseDown(
      screen.getByRole("dialog", { name: "保存方案" }).parentElement!,
    );
    expect(
      screen.queryByRole("dialog", { name: "保存方案" }),
    ).not.toBeInTheDocument();
  });

  it("keeps rendering with built-in data when the preload API is unavailable", async () => {
    const user = userEvent.setup();
    window.desktopApi = undefined;
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "手动计算",
      }),
    );
    expect(document.querySelector(".calculator-page")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "关于" }));
    expect(screen.getByText("v1.1.0-test")).toBeVisible();
  });

  it("paginates long material and plan collections in both directions", async () => {
    const user = userEvent.setup();
    const largeData = structuredClone(builtinGameData);
    const seedFamily = largeData.materialFamilies.find(
      (family) => family.category === "talent-book",
    )!;
    for (let index = 0; index < 9; index += 1)
      largeData.materialFamilies.push({
        ...structuredClone(seedFamily),
        id: `extra-family-${index}`,
        names: { "zh-CN": `额外${index}`, "en-US": `Extra ${index}` },
      });
    const plans = Array.from({ length: 11 }, (_, index) => ({
      id: `plan-${index}`,
      name: `分页方案${index}`,
      target: {
        type: "manual" as const,
        materialFamilyId: seedFamily.id,
        required: {},
      },
      craftingCharacterId: null,
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    }));
    window.desktopApi!.loadGameData = vi.fn().mockResolvedValue(largeData);
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: plans,
      recentPlanIds: plans.map((plan) => plan.id),
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    const overview = document.querySelector<HTMLElement>(".overview")!;
    await user.click(
      within(overview).getByRole("button", { name: "Next page" }),
    );
    expect(within(overview).getByText("2 / 2")).toBeVisible();
    await user.click(
      within(overview).getByRole("button", { name: "Previous page" }),
    );
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "我的方案" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("2 / 2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
  });

  it("formats malformed legacy timestamps as unavailable instead of crashing", async () => {
    const brokenDatePlan = {
      id: "broken-date",
      name: "旧方案",
      target: {
        type: "manual" as const,
        materialFamilyId: "prosperity",
        required: {},
      },
      craftingCharacterId: null,
      createdAt: "invalid",
      updatedAt: "invalid",
    };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({
      ...profile,
      savedPlans: [brokenDatePlan],
      recentPlanIds: [brokenDatePlan.id],
    });
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    expect(screen.getByText("-")).toBeVisible();
  });

  it("falls back to the first available entities when previous defaults are absent", async () => {
    const user = userEvent.setup();
    const changedData = structuredClone(builtinGameData);
    changedData.weapons = changedData.weapons.filter(
      (weapon) => weapon.id !== "favonius-sword",
    );
    changedData.characters = changedData.characters.filter(
      (character) => character.id !== "xingqiu",
    );
    changedData.materialFamilies = changedData.materialFamilies.filter(
      (family) => family.id !== "prosperity",
    );
    window.desktopApi!.loadGameData = vi.fn().mockResolvedValue(changedData);
    window.desktopApi!.getGameDataStatus = vi.fn().mockResolvedValue(null);
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "武器突破",
      }),
    );
    expect(screen.getByRole("button", { name: "笛剑" })).toBeVisible();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "角色天赋",
      }),
    );
    expect(screen.getByRole("button", { name: "优菈" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "游戏资料" }));
    expect(screen.getAllByText("-")).not.toHaveLength(0);
  });

  it("supports keyboard selection and dismissal in entity pickers", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "手动计算",
      }),
    );
    await user.click(screen.getByRole("button", { name: "不使用角色" }));
    let dialog = screen.getByRole("dialog", { name: "合成角色" });
    const search = within(dialog).getByLabelText("搜索合成角色");
    await user.type(search, "行秋");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByText(/合成角色天赋素材时/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "行秋" }));
    dialog = screen.getByRole("dialog", { name: "合成角色" });
    fireEvent.keyDown(within(dialog).getByLabelText("搜索合成角色"), {
      key: "Escape",
    });
    expect(
      screen.queryByRole("dialog", { name: "合成角色" }),
    ).not.toBeInTheDocument();
  });

  it("saves and reopens a talent plan", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "角色天赋",
      }),
    );
    await user.click(screen.getByRole("button", { name: "保存方案" }));
    const dialog = screen.getByRole("dialog", { name: "保存方案" });
    const name = within(dialog).getByLabelText("方案名称");
    await user.clear(name);
    await user.type(name, "天赋方案");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));
    await user.click(screen.getAllByRole("button", { name: "总览" })[0]);
    const overview = document.querySelector<HTMLElement>(".overview");
    expect(overview).not.toBeNull();
    await user.click(
      within(overview!).getByRole("button", { name: /天赋方案/ }),
    );
    expect(document.querySelector(".workspace-tab.active")).toHaveTextContent(
      "天赋方案",
    );
  });

  it("renders English material names on the overview", async () => {
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByText("原神养成规划器");
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByLabelText("语言"));
    await user.click(screen.getByRole("option", { name: "English" }));
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Overview",
      }),
    );
    expect(screen.getByText("Prosperity")).toBeVisible();
    await user.click(
      within(document.querySelector<HTMLElement>(".overview")!).getByRole(
        "button",
        { name: "Materials" },
      ),
    );
    expect(screen.getByText("Decarabian")).toBeVisible();
  });
});
