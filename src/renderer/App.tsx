import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import type { TFunction } from "i18next";
import {
  Archive,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Sun,
  Sword,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { builtinGameData } from "../data/gameData";
import { calculateMaterials } from "../domain/calculator";
import { talentRequirements, weaponRequirement } from "../domain/requirements";
import type {
  Character,
  CharacterElement,
  CountsByRarity,
  CraftingCharacter,
  DataSyncProgress,
  GameDataBundle,
  GameDataOperation,
  GameDataStatus,
  Locale,
  MaterialCategory,
  MaterialFamily,
  MaterialRarity,
  PlanTarget,
  SavedPlan,
  TalentLevels,
  ThemeMode,
  UserProfileV1,
  Weapon,
  WeaponType,
} from "../shared/types";

type Page = "overview" | "weapon" | "talent" | "manual" | "settings";
type SettingsTab = "display" | "plans" | "game-data" | "about";
type PlanDraft = { target: PlanTarget; craftingCharacterId: string | null };
type BaseWorkspace = { page: Page; draft?: PlanDraft };

const rarities = [2, 3, 4, 5] as const;
const emptyProfile = (): UserProfileV1 => ({
  schemaVersion: 1,
  locale: "zh-CN",
  inventoryByMaterialFamily: {},
  savedPlans: [],
  recentPlanIds: [],
  updatedAt: new Date().toISOString(),
  theme: "system",
});
const numberValue = (value: string) =>
  Math.max(0, Math.floor(Number(value) || 0));
const fixedDateTime = (value: string) => {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return Number.isNaN(date.getTime())
    ? "-"
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
const fixedDateTimeToMinute = (value: string) =>
  fixedDateTime(value).replace(/:\d{2}$/, "");
const compareStableIdDescending = (
  left: { id: string },
  right: { id: string },
) => right.id.padStart(20, "0").localeCompare(left.id.padStart(20, "0"));
const weaponTypeOrder: WeaponType[] = [
  "sword",
  "claymore",
  "polearm",
  "bow",
  "catalyst",
];
const compareWeaponsByTypeAndId = (left: Weapon, right: Weapon) =>
  weaponTypeOrder.indexOf(left.type ?? "catalyst") -
    weaponTypeOrder.indexOf(right.type ?? "catalyst") ||
  compareStableIdDescending(left, right);
const normalizedPlanName = (name: string) =>
  name.trim().normalize("NFKC").toLocaleLowerCase();
const uniquePlanName = (baseName: string, existingNames: string[]) => {
  const normalized = new Set(existingNames.map(normalizedPlanName));
  if (!normalized.has(normalizedPlanName(baseName))) return baseName;
  for (let index = 2; ; index += 1) {
    const candidate = `${baseName} (${index})`;
    if (!normalized.has(normalizedPlanName(candidate))) return candidate;
  }
};
const formatMaterialCount = (value: number | undefined): string => {
  const normalized = Math.round((value ?? 0) * 100) / 100;
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
};

function isMaterialFamily(item: {
  names: Record<Locale, string>;
}): item is MaterialFamily {
  return "materialsByRarity" in item;
}
function localName(
  item: { names: Record<Locale, string> },
  locale: Locale,
): string {
  if (
    locale === "zh-CN" &&
    isMaterialFamily(item) &&
    item.category === "talent-book"
  ) {
    const firstTier = Object.values(item.materialsByRarity).find(Boolean);
    const match = firstTier?.names["zh-CN"].match(/^「([^」]+)」/u);
    if (match) return match[1];
  }
  return item.names[locale];
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<UserProfileV1>(emptyProfile);
  const [gameData, setGameData] = useState<GameDataBundle>(builtinGameData);
  const [dataStatus, setDataStatus] = useState<GameDataStatus | null>(null);
  const [syncProgress, setSyncProgress] = useState<DataSyncProgress | null>(
    null,
  );
  const [, setLanguageRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>("overview");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("plans");
  const [familyCategory, setFamilyCategory] =
    useState<MaterialCategory>("talent-book");
  const [familyPage, setFamilyPage] = useState(0);
  const [weaponId, setWeaponId] = useState("favonius-sword");
  const [characterId, setCharacterId] = useState("xingqiu");
  const [manualFamilyId, setManualFamilyId] = useState("prosperity");
  const [manualCategory, setManualCategory] =
    useState<MaterialCategory>("talent-book");
  const [currentPhase, setCurrentPhase] = useState(0);
  const [targetPhase, setTargetPhase] = useState(6);
  const [currentLevels, setCurrentLevels] = useState<TalentLevels>({
    normal: 1,
    skill: 1,
    burst: 1,
  });
  const [targetLevels, setTargetLevels] = useState<TalentLevels>({
    normal: 9,
    skill: 9,
    burst: 9,
  });
  const [manualRequired, setManualRequired] = useState<CountsByRarity>({});
  const [craftingCharacterId, setCraftingCharacterId] = useState<string | null>(
    null,
  );
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [baseWorkspace, setBaseWorkspace] = useState<BaseWorkspace>({
    page: "overview",
  });
  const [openPlanIds, setOpenPlanIds] = useState<string[]>([]);
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const pendingSaveNotice = useRef<{
    profile: UserProfileV1;
    message: string;
  } | null>(null);
  const [saveName, setSaveName] = useState<string | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [sampleGuideDismissed, setSampleGuideDismissed] = useState(false);
  const [unavailablePlanName, setUnavailablePlanName] = useState<string | null>(
    null,
  );
  const [syncActionHighlighted, setSyncActionHighlighted] = useState(false);
  const [pendingSyncNavigation, setPendingSyncNavigation] = useState<
    (() => void) | null
  >(null);
  const [syncConfirmationMode, setSyncConfirmationMode] = useState<
    "leave" | "cancel"
  >("leave");
  const [prepareSyncCancellation, setPrepareSyncCancellation] = useState<
    (() => void) | null
  >(null);
  const [leavingSync, setLeavingSync] = useState(false);
  const [workspaceTooltip, setWorkspaceTooltip] = useState<{
    name: string;
    left: number;
    top: number;
  } | null>(null);

  const locale = profile.locale;
  const { characters, craftingCharacters, materialFamilies, weapons } =
    gameData;
  const familyById = (id: string) =>
    materialFamilies.find((item) => item.id === id) ?? materialFamilies[0];
  const selectedWeapon =
    weapons.find((weapon) => weapon.id === weaponId) ?? weapons[0];
  const selectedCharacter =
    characters.find((character) => character.id === characterId) ??
    characters[0];
  const family = useMemo<MaterialFamily>(() => {
    if (page === "weapon")
      return familyById(
        selectedWeapon.materialFamilyId ??
          materialFamilies.find((item) => item.category === "weapon-ascension")
            ?.id ??
          materialFamilies[0].id,
      );
    if (page === "talent")
      return familyById(selectedCharacter.talentMaterialFamilyId);
    return familyById(manualFamilyId);
  }, [
    page,
    selectedWeapon.materialFamilyId,
    selectedCharacter.talentMaterialFamilyId,
    manualFamilyId,
  ]);

  const required = useMemo<CountsByRarity>(() => {
    if (page === "weapon")
      return weaponRequirement(selectedWeapon, currentPhase, targetPhase);
    if (page === "talent")
      return talentRequirements(currentLevels, targetLevels);
    return manualRequired;
  }, [
    page,
    selectedWeapon,
    currentPhase,
    targetPhase,
    currentLevels,
    targetLevels,
    manualRequired,
  ]);

  const craftingCharacter =
    craftingCharacters.find((item) => item.id === craftingCharacterId) ?? null;
  const editingPlan =
    profile.savedPlans.find((item) => item.id === editingPlanId) ?? null;
  const strategy = craftingCharacter?.passive.categories.includes(
    family.category,
  )
    ? craftingCharacter.passive.strategy
    : "none";
  const inventory = profile.inventoryByMaterialFamily[family.id] ?? {};
  const calculation = useMemo(
    () => calculateMaterials(family, inventory, required, strategy),
    [family, inventory, required, strategy],
  );
  const applicableCraftingCharacters = craftingCharacters.filter((item) =>
    item.passive.categories.includes(family.category),
  );
  const invalidTalentLevel = (["normal", "skill", "burst"] as const).some(
    (key) => targetLevels[key] < currentLevels[key],
  );
  const syncIsActive = Boolean(
    syncProgress &&
    syncProgress.stage !== "idle" &&
    syncProgress.stage !== "complete" &&
    syncProgress.stage !== "cancelled" &&
    syncProgress.stage !== "error",
  );

  useEffect(() => {
    setWeaponId((current) =>
      gameData.weapons.some((item) => item.id === current)
        ? current
        : (gameData.weapons[0]?.id ?? current),
    );
    setCharacterId((current) =>
      gameData.characters.some((item) => item.id === current)
        ? current
        : (gameData.characters[0]?.id ?? current),
    );
    setManualFamilyId((current) =>
      gameData.materialFamilies.some((item) => item.id === current)
        ? current
        : (gameData.materialFamilies[0]?.id ?? current),
    );
  }, [gameData]);

  useEffect(() => {
    return window.desktopApi?.onWindowCloseRequested(() => {
      if (!syncIsActive) {
        window.desktopApi?.confirmWindowClose();
        return;
      }
      setSyncConfirmationMode("leave");
      setPendingSyncNavigation(
        () => () => window.desktopApi?.confirmWindowClose(),
      );
    });
  }, [syncIsActive]);

  useEffect(() => {
    let cancelled = false;
    const initializeProfile = async () => {
      try {
        const [loaded, loadedData, status] = await Promise.all([
          window.desktopApi?.loadProfile(),
          window.desktopApi?.loadGameData(),
          window.desktopApi?.getGameDataStatus(),
        ]);
        if (!loaded || !loadedData || cancelled) return;
        setProfile(loaded);
        setGameData(loadedData);
        setDataStatus(status ?? null);
        setWeaponId((current) =>
          loadedData.weapons.some((item) => item.id === current)
            ? current
            : (loadedData.weapons[0]?.id ?? current),
        );
        setCharacterId((current) =>
          loadedData.characters.some((item) => item.id === current)
            ? current
            : (loadedData.characters[0]?.id ?? current),
        );
        setManualFamilyId((current) =>
          loadedData.materialFamilies.some((item) => item.id === current)
            ? current
            : (loadedData.materialFamilies[0]?.id ?? current),
        );
        await i18n.changeLanguage(loaded.locale);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void initializeProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      window.desktopApi?.onGameDataProgress((progress) =>
        setSyncProgress(progress),
      ),
    [],
  );

  useEffect(() => {
    if (!ready) return;
    const profileBeingSaved = profile;
    const timer = window.setTimeout(
      () =>
        window.desktopApi
          ?.saveProfile(profileBeingSaved)
          .then(() => {
            if (pendingSaveNotice.current?.profile !== profileBeingSaved)
              return;
            setNotice(pendingSaveNotice.current.message);
            pendingSaveNotice.current = null;
          })
          .catch(() => {
            if (pendingSaveNotice.current?.profile === profileBeingSaved)
              pendingSaveNotice.current = null;
            setNotice(t("saveFailed"));
          }),
      450,
    );
    return () => window.clearTimeout(timer);
  }, [profile, ready, t]);

  useEffect(() => {
    document.title = t("appName");
  }, [locale, t]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const selected = profile.theme ?? "system";
      document.documentElement.dataset.theme =
        selected === "system" ? (media.matches ? "dark" : "light") : selected;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [profile.theme]);

  useEffect(() => {
    if (
      craftingCharacterId &&
      !applicableCraftingCharacters.some(
        (item) => item.id === craftingCharacterId,
      )
    )
      setCraftingCharacterId(null);
  }, [family.category, craftingCharacterId, applicableCraftingCharacters]);

  const updateLocale = (nextLocale: Locale) => {
    setProfile((current) => ({ ...current, locale: nextLocale }));
    void i18n
      .changeLanguage(nextLocale)
      .then(() => setLanguageRevision((revision) => revision + 1));
  };

  const updateInventory = (rarity: MaterialRarity, value: string) => {
    const count = numberValue(value);
    setProfile((current) => ({
      ...current,
      inventoryByMaterialFamily: {
        ...current.inventoryByMaterialFamily,
        [family.id]: {
          ...(current.inventoryByMaterialFamily[family.id] ?? {}),
          [rarity]: count,
        },
      },
    }));
  };

  const updateManualRequirement = (rarity: MaterialRarity, value: string) =>
    setManualRequired((current) => ({
      ...current,
      [rarity]: numberValue(value),
    }));

  const buildTarget = (): PlanTarget => {
    if (page === "weapon")
      return { type: "weapon", weaponId, currentPhase, targetPhase };
    if (page === "talent")
      return {
        type: "talent",
        characterId,
        current: currentLevels,
        target: targetLevels,
      };
    return {
      type: "manual",
      materialFamilyId: manualFamilyId,
      required: manualRequired,
    };
  };

  const defaultPlanName = () => {
    const defaultName =
      page === "weapon"
        ? t("weaponPlanName", { name: localName(selectedWeapon, locale) })
        : page === "talent"
          ? t("talentPlanName", { name: localName(selectedCharacter, locale) })
          : t("manualPlanName", { name: localName(family, locale) });
    return defaultName;
  };

  const savePlan = (name: string) => {
    if (!name.trim()) return;
    if (
      profile.savedPlans.some(
        (item) => normalizedPlanName(item.name) === normalizedPlanName(name),
      )
    ) {
      setNotice(t("duplicatePlanName"));
      return;
    }
    const now = new Date().toISOString();
    const plan: SavedPlan = {
      id: crypto.randomUUID(),
      name: name.trim(),
      target: buildTarget(),
      craftingCharacterId,
      createdAt: now,
      updatedAt: now,
    };
    const nextProfile: UserProfileV1 = {
      ...profile,
      savedPlans: [plan, ...profile.savedPlans],
      recentPlanIds: [
        plan.id,
        ...profile.recentPlanIds.filter((id) => id !== plan.id),
      ].slice(0, 8),
    };
    pendingSaveNotice.current = { profile: nextProfile, message: t("saved") };
    setProfile(nextProfile);
    setBaseWorkspace({
      page,
      draft: { target: plan.target, craftingCharacterId },
    });
    setEditingPlanId(plan.id);
    setOpenPlanIds((current) => [...current, plan.id]);
  };

  const savePlanChanges = () => {
    if (!editingPlan) return;
    const now = new Date().toISOString();
    const nextProfile: UserProfileV1 = {
      ...profile,
      savedPlans: profile.savedPlans.map((item) =>
        item.id === editingPlan.id
          ? {
              ...item,
              target: buildTarget(),
              craftingCharacterId,
              updatedAt: now,
            }
          : item,
      ),
      recentPlanIds: [
        editingPlan.id,
        ...profile.recentPlanIds.filter((id) => id !== editingPlan.id),
      ].slice(0, 8),
    };
    pendingSaveNotice.current = {
      profile: nextProfile,
      message: t("planUpdated"),
    };
    setProfile(nextProfile);
    setPlanDrafts((current) => {
      const next = { ...current };
      delete next[editingPlan.id];
      return next;
    });
  };

  const applyDraft = (draft: PlanDraft) => {
    const { target } = draft;
    setCraftingCharacterId(draft.craftingCharacterId);
    if (target.type === "weapon") {
      setPage("weapon");
      setWeaponId(target.weaponId);
      setCurrentPhase(target.currentPhase);
      setTargetPhase(target.targetPhase);
    }
    if (target.type === "talent") {
      setPage("talent");
      setCharacterId(target.characterId);
      setCurrentLevels(target.current);
      setTargetLevels(target.target);
    }
    if (target.type === "manual") {
      setPage("manual");
      setManualFamilyId(target.materialFamilyId);
      setManualRequired(target.required);
    }
  };

  const openPlan = (plan: SavedPlan) => {
    const planTarget = plan.target;
    const available =
      planTarget.type === "weapon"
        ? weapons.some((item) => item.id === planTarget.weaponId)
        : planTarget.type === "talent"
          ? characters.some((item) => item.id === planTarget.characterId)
          : materialFamilies.some(
              (item) => item.id === planTarget.materialFamilyId,
            );
    if (!available) {
      setUnavailablePlanName(plan.name);
      return;
    }
    if (editingPlanId)
      setPlanDrafts((current) => ({
        ...current,
        [editingPlanId]: { target: buildTarget(), craftingCharacterId },
      }));
    else
      setBaseWorkspace({
        page,
        draft:
          page === "weapon" || page === "talent" || page === "manual"
            ? { target: buildTarget(), craftingCharacterId }
            : undefined,
      });
    setOpenPlanIds((current) =>
      current.includes(plan.id) ? current : [...current, plan.id],
    );
    setEditingPlanId(plan.id);
    const draft = planDrafts[plan.id];
    applyDraft({
      target: draft?.target ?? plan.target,
      craftingCharacterId:
        draft?.craftingCharacterId ?? plan.craftingCharacterId,
    });
  };

  const openBaseWorkspace = () => {
    setEditingPlanId(null);
    if (baseWorkspace.draft) applyDraft(baseWorkspace.draft);
    else setPage(baseWorkspace.page);
  };

  const isCurrentPlanDirty = Boolean(
    editingPlan &&
    (JSON.stringify(buildTarget()) !== JSON.stringify(editingPlan.target) ||
      craftingCharacterId !== editingPlan.craftingCharacterId),
  );
  const closePlanTab = (planId: string) => {
    if (
      planId === editingPlanId &&
      isCurrentPlanDirty &&
      !window.confirm(t("unsavedCloseWarning"))
    )
      return;
    setOpenPlanIds((current) => current.filter((id) => id !== planId));
    setPlanDrafts((current) => {
      const next = { ...current };
      delete next[planId];
      return next;
    });
    if (planId === editingPlanId) {
      openBaseWorkspace();
    }
  };

  const openManualFamily = (materialFamily: MaterialFamily) => {
    setEditingPlanId(null);
    setPage("manual");
    setManualCategory(materialFamily.category);
    setManualFamilyId(materialFamily.id);
    setManualRequired({});
  };

  const importProfile = async () => {
    try {
      const imported = await window.desktopApi?.importProfile();
      if (imported) {
        setProfile(imported);
        i18n.changeLanguage(imported.locale);
        setNotice(t("saved"));
      }
    } catch {
      setNotice(t("importFailed"));
    }
  };

  const refreshGameData = async (status?: GameDataStatus | null) => {
    const [bundle, nextStatus] = await Promise.all([
      window.desktopApi?.loadGameData(),
      status ? Promise.resolve(status) : window.desktopApi?.getGameDataStatus(),
    ]);
    if (bundle) setGameData(bundle);
    setDataStatus(nextStatus ?? null);
  };

  const nav: {
    page: Exclude<Page, "settings">;
    label: string;
    icon: typeof Archive;
  }[] = [
    { page: "overview", label: t("overview"), icon: Archive },
    { page: "weapon", label: t("weapon"), icon: Sword },
    { page: "talent", label: t("talents"), icon: Sparkles },
    { page: "manual", label: t("manual"), icon: Calculator },
  ];
  const navigateWithSyncGuard = (action: () => void) => {
    if (page === "settings" && settingsTab === "game-data" && syncIsActive) {
      setSyncConfirmationMode("leave");
      setPendingSyncNavigation(() => action);
      return;
    }
    action();
  };
  const startNewPage = (nextPage: Exclude<Page, "settings">) => {
    navigateWithSyncGuard(() => {
      if (nextPage === "overview") {
        if (editingPlanId)
          setPlanDrafts((current) => ({
            ...current,
            [editingPlanId]: { target: buildTarget(), craftingCharacterId },
          }));
        setEditingPlanId(null);
        setPage("overview");
        setBaseWorkspace({ page: "overview" });
        return;
      }
      const recentOpen = [...openPlanIds]
        .reverse()
        .map((id) => profile.savedPlans.find((plan) => plan.id === id))
        .find((plan) => plan?.target.type === nextPage);
      if (recentOpen) {
        openPlan(recentOpen);
        return;
      }
      setEditingPlanId(null);
      setPage(nextPage);
      setBaseWorkspace({ page: nextPage });
    });
  };
  const goToGameDataSync = () => {
    setPage("settings");
    setSettingsTab("game-data");
    setSyncActionHighlighted(true);
  };
  const cannotSaveCurrentWeapon =
    page === "weapon" &&
    (!selectedWeapon.materialFamilyId ||
      selectedWeapon.calculationStatus === "unsupported-source-curve");
  const calculationAvailable = !cannotSaveCurrentWeapon;
  const baseWorkspaceLabel =
    baseWorkspace.page === "weapon"
      ? t("newWeaponWorkspace")
      : baseWorkspace.page === "talent"
        ? t("newTalentWorkspace")
        : baseWorkspace.page === "manual"
          ? t("manual")
          : baseWorkspace.page === "settings"
            ? t("settings")
            : t("overview");
  const saveActions =
    page !== "overview" && page !== "settings" && page !== "manual" ? (
      <div className="save-action-group">
        <button
          className="button primary save-plan-button"
          onClick={() =>
            editingPlan
              ? savePlanChanges()
              : setSaveName(
                  uniquePlanName(
                    defaultPlanName(),
                    profile.savedPlans.map((item) => item.name),
                  ),
                )
          }
          disabled={cannotSaveCurrentWeapon}
        >
          <Save size={17} />
          {editingPlan ? t("saveChanges") : t("savePlan")}
        </button>
        {editingPlan && (
          <div
            className="save-menu-area"
            onMouseEnter={() => setSaveMenuOpen(true)}
            onMouseLeave={() =>
              window.setTimeout(() => setSaveMenuOpen(false), 150)
            }
          >
            <button
              className="save-menu-trigger"
              type="button"
              aria-label={t("saveAs")}
              aria-haspopup="menu"
              aria-expanded={saveMenuOpen}
              onClick={() => setSaveMenuOpen(true)}
              onFocus={() => setSaveMenuOpen(true)}
              disabled={cannotSaveCurrentWeapon}
            >
              <ChevronDown size={16} />
            </button>
            {saveMenuOpen && (
              <div className="save-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSaveName(
                      uniquePlanName(
                        defaultPlanName(),
                        profile.savedPlans.map((item) => item.name),
                      ),
                    );
                    setSaveMenuOpen(false);
                  }}
                >
                  {t("saveAs")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    ) : null;

  if (!ready) return <div className="loading-screen">{t("loading")}</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="./app-icon.svg" alt="" />
          <span>{t("appName")}</span>
        </div>
        <nav>
          {nav.map(({ page: navPage, label, icon: Icon }) => (
            <button
              key={navPage}
              className={page === navPage ? "nav-item active" : "nav-item"}
              onClick={() => startNewPage(navPage)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={page === "settings" ? "nav-item active" : "nav-item"}
            onClick={() =>
              navigateWithSyncGuard(() => {
                if (editingPlanId)
                  setPlanDrafts((current) => ({
                    ...current,
                    [editingPlanId]: {
                      target: buildTarget(),
                      craftingCharacterId,
                    },
                  }));
                setEditingPlanId(null);
                setPage("settings");
                setBaseWorkspace({ page: "settings" });
                setSettingsTab("display");
              })
            }
          >
            <Settings size={18} />
            {t("settings")}
          </button>
        </div>
      </aside>
      <main
        className={
          page === "overview" ? "workspace overview-workspace" : "workspace"
        }
      >
        <header className="topbar">
          <div className="workspace-tabs">
            <button
              className={
                !editingPlanId ? "workspace-tab active" : "workspace-tab"
              }
              onClick={() => {
                if (!editingPlanId) return;
                openBaseWorkspace();
              }}
              onMouseEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setWorkspaceTooltip({
                  name: baseWorkspaceLabel,
                  left: rect.left + rect.width / 2,
                  top: rect.bottom + 7,
                });
              }}
              onMouseLeave={() => setWorkspaceTooltip(null)}
              onFocus={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setWorkspaceTooltip({
                  name: baseWorkspaceLabel,
                  left: rect.left + rect.width / 2,
                  top: rect.bottom + 7,
                });
              }}
              onBlur={() => setWorkspaceTooltip(null)}
            >
              {baseWorkspaceLabel}
            </button>
            {openPlanIds.map((id) => {
              const plan = profile.savedPlans.find((item) => item.id === id);
              if (!plan) return null;
              return (
                <button
                  key={id}
                  className={
                    editingPlanId === id
                      ? "workspace-tab active"
                      : "workspace-tab"
                  }
                  onClick={() => openPlan(plan)}
                  onMouseEnter={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setWorkspaceTooltip({
                      name: plan.name,
                      left: rect.left + rect.width / 2,
                      top: rect.bottom + 7,
                    });
                  }}
                  onMouseLeave={() => setWorkspaceTooltip(null)}
                  onFocus={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setWorkspaceTooltip({
                      name: plan.name,
                      left: rect.left + rect.width / 2,
                      top: rect.bottom + 7,
                    });
                  }}
                  onBlur={() => setWorkspaceTooltip(null)}
                >
                  <span>{plan.name}</span>
                  <X
                    size={14}
                    role="img"
                    aria-label={t("close")}
                    onClick={(event) => {
                      event.stopPropagation();
                      closePlanTab(id);
                    }}
                  />
                </button>
              );
            })}
          </div>
        </header>
        <div className="workspace-content">
          {notice && <Notice message={notice} onDismiss={setNotice} />}
          {dataStatus?.source === "builtin" && !sampleGuideDismissed && (
            <div className="sample-data-guide" role="status">
              <span>{t("sampleDataGuide")}</span>
              <button className="sample-data-action" onClick={goToGameDataSync}>
                {t("goToUpdate")}
              </button>
              <button
                className="sample-data-close"
                aria-label={t("close")}
                title={t("close")}
                onClick={() => setSampleGuideDismissed(true)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "overview" && (
            <Overview
              t={t}
              locale={locale}
              plans={profile.savedPlans}
              families={materialFamilies}
              category={familyCategory}
              familyPage={familyPage}
              onCategory={(category) => {
                setFamilyCategory(category);
                setFamilyPage(0);
              }}
              onPage={setFamilyPage}
              onOpen={openPlan}
              onOpenMaterial={openManualFamily}
            />
          )}
          {page !== "overview" && page !== "settings" && (
            <section className="calculator-page">
              <section className="form-band">
                <div className="target-heading">
                  <h2>{t("target")}</h2>
                  {calculationAvailable && (
                    <div className="target-actions">
                      <DeficitSummary
                        t={t}
                        family={family}
                        deficits={calculation.deficits}
                        complete={calculation.isComplete && !invalidTalentLevel}
                      />
                      {saveActions}
                    </div>
                  )}
                </div>
                {page === "weapon" && (
                  <>
                    <WeaponTarget
                      t={t}
                      locale={locale}
                      weapons={weapons}
                      weaponId={weaponId}
                      currentPhase={currentPhase}
                      targetPhase={targetPhase}
                      onWeapon={setWeaponId}
                      onCurrent={setCurrentPhase}
                      onTarget={setTargetPhase}
                    />
                    {selectedWeapon.calculationStatus ===
                      "unsupported-source-curve" && (
                      <p className="unsupported-target">
                        {t("unsupportedWeapon")}
                      </p>
                    )}
                  </>
                )}
                {page === "talent" && (
                  <TalentTarget
                    t={t}
                    locale={locale}
                    characters={characters}
                    characterId={characterId}
                    current={currentLevels}
                    target={targetLevels}
                    onCharacter={setCharacterId}
                    onCurrent={setCurrentLevels}
                    onTarget={setTargetLevels}
                  />
                )}
                {page === "manual" && (
                  <ManualTarget
                    t={t}
                    locale={locale}
                    families={materialFamilies}
                    category={manualCategory}
                    familyId={manualFamilyId}
                    onCategory={(category) => {
                      setManualCategory(category);
                      setManualFamilyId(
                        materialFamilies.find(
                          (item) => item.category === category,
                        )!.id,
                      );
                    }}
                    onFamily={setManualFamilyId}
                  />
                )}
              </section>
              {invalidTalentLevel && (
                <p className="validation">{t("invalidLevel")}</p>
              )}
              {calculationAvailable && (
                <>
                  <MaterialGrid
                    t={t}
                    family={family}
                    locale={locale}
                    inventory={inventory}
                    required={required}
                    calculation={calculation}
                    manual={page === "manual"}
                    hasPassive={strategy !== "none"}
                    onInventory={updateInventory}
                    onRequired={updateManualRequirement}
                  />
                  <section className="form-band crafting">
                    <div className="form-row">
                      <EntityPicker
                        label={t("craftingCharacter")}
                        items={applicableCraftingCharacters}
                        value={craftingCharacterId}
                        onChange={setCraftingCharacterId}
                        locale={locale}
                        emptyLabel={t("noCraftingCharacter")}
                      />
                      <div className="passive-description">
                        <strong>
                          {craftingCharacter
                            ? localName(craftingCharacter, locale)
                            : t("noCraftingCharacter")}
                        </strong>
                        <span>
                          {craftingCharacter
                            ? craftingCharacter.passive.description[locale]
                            : t("noBonus")}
                        </span>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </section>
          )}
          {page === "settings" && (
            <SettingsPage
              t={t}
              locale={locale}
              settingsTab={settingsTab}
              onTab={(tab) =>
                tab === "game-data"
                  ? setSettingsTab(tab)
                  : navigateWithSyncGuard(() => setSettingsTab(tab))
              }
              profile={profile}
              plans={profile.savedPlans}
              status={dataStatus}
              progress={syncProgress}
              onLocale={updateLocale}
              onTheme={(theme) =>
                setProfile((current) => ({ ...current, theme }))
              }
              onOpen={openPlan}
              onDelete={(id) =>
                setProfile((current) => ({
                  ...current,
                  savedPlans: current.savedPlans.filter(
                    (plan) => plan.id !== id,
                  ),
                }))
              }
              onImportPlans={importProfile}
              onExportPlans={() => window.desktopApi?.exportProfile(profile)}
              onRefresh={refreshGameData}
              onError={setNotice}
              highlightSyncAction={syncActionHighlighted}
              onSyncHighlightEnd={() => setSyncActionHighlighted(false)}
              onCancelRequest={(prepare) => {
                setSyncConfirmationMode("cancel");
                setPrepareSyncCancellation(() => prepare);
                setPendingSyncNavigation(() => () => undefined);
              }}
            />
          )}
          {saveName !== null && (
            <SavePlanDialog
              t={t}
              initialName={saveName}
              existingNames={profile.savedPlans.map((item) => item.name)}
              onCancel={() => setSaveName(null)}
              onSave={(name) => {
                savePlan(name);
                setSaveName(null);
              }}
            />
          )}
          {workspaceTooltip &&
            createPortal(
              <span
                className="target-name-tooltip"
                style={{
                  left: workspaceTooltip.left,
                  top: workspaceTooltip.top,
                }}
                role="tooltip"
              >
                {workspaceTooltip.name}
              </span>,
              document.body,
            )}
          {unavailablePlanName !== null &&
            createPortal(
              <div className="modal-backdrop">
                <div
                  className="dialog confirm-dialog"
                  role="alertdialog"
                  aria-modal="true"
                  aria-label={t("unavailablePlanTitle")}
                >
                  <h2>{t("unavailablePlanTitle")}</h2>
                  <p className="unavailable-plan-message">
                    <span className="unavailable-plan-highlight">
                      {unavailablePlanName}
                    </span>
                    <span>{t("unavailablePlanMessageBeforeSync")}</span>
                    <span className="unavailable-plan-highlight">
                      {t("syncLunarisShort")}
                    </span>
                    <span>{t("unavailablePlanMessageAfterSync")}</span>
                  </p>
                  <div className="dialog-actions">
                    <button
                      className="button secondary"
                      autoFocus
                      onClick={() => setUnavailablePlanName(null)}
                    >
                      {t("cancelSave")}
                    </button>
                    <button
                      className="button primary"
                      onClick={() => {
                        setUnavailablePlanName(null);
                        setEditingPlanId(null);
                        goToGameDataSync();
                      }}
                    >
                      {t("updateGameData")}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
          {pendingSyncNavigation !== null &&
            createPortal(
              <div className="modal-backdrop">
                <div
                  className="dialog confirm-dialog"
                  role="alertdialog"
                  aria-modal="true"
                  aria-label={t(
                    syncConfirmationMode === "leave"
                      ? "leaveSyncTitle"
                      : "cancelSyncTitle",
                  )}
                >
                  <h2>
                    {t(
                      syncConfirmationMode === "leave"
                        ? "leaveSyncTitle"
                        : "cancelSyncTitle",
                    )}
                  </h2>
                  <p>
                    {t(
                      syncConfirmationMode === "leave"
                        ? "leaveSyncMessage"
                        : "cancelSyncMessage",
                    )}
                  </p>
                  <div className="dialog-actions">
                    <button
                      className="button danger-button"
                      disabled={leavingSync}
                      onClick={() => {
                        const navigate = pendingSyncNavigation;
                        setLeavingSync(true);
                        void (async () => {
                          try {
                            prepareSyncCancellation?.();
                            await window.desktopApi?.cancelGameDataSync();
                          } finally {
                            setPendingSyncNavigation(null);
                            setPrepareSyncCancellation(null);
                            setLeavingSync(false);
                            navigate();
                          }
                        })();
                      }}
                    >
                      {t(
                        syncConfirmationMode === "leave"
                          ? "cancelSyncAndLeave"
                          : "confirmCancelSync",
                      )}
                    </button>
                    <button
                      className="button secondary"
                      autoFocus
                      disabled={leavingSync}
                      onClick={() => setPendingSyncNavigation(null)}
                    >
                      {t("continueSync")}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </main>
    </div>
  );
}

function DeficitSummary({
  t,
  family,
  deficits,
  complete,
}: {
  t: TFunction;
  family: MaterialFamily;
  deficits: CountsByRarity;
  complete: boolean;
}) {
  const entries = family.craftableRarities.filter(
    (rarity) => (deficits[rarity] ?? 0) > 0,
  );
  return (
    <div className={complete ? "status complete" : "status missing"}>
      {complete ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <span className="status-label">
        {complete ? t("complete") : t("missingMaterials")}
      </span>
      {!complete && (
        <span className="deficit-tags">
          {entries.map((rarity) => (
            <span key={rarity} className={`deficit-tag r${rarity}`}>
              <span>{t("rarity", { count: rarity })}</span>
              <b>x{formatMaterialCount(deficits[rarity])}</b>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function Notice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: (value: string | null) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(null), 3500);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);
  return (
    <div className="notice" role="status">
      {message}
    </div>
  );
}

function SavePlanDialog({
  t,
  initialName,
  existingNames,
  onCancel,
  onSave,
}: {
  t: TFunction;
  initialName: string;
  existingNames: string[];
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const duplicate = existingNames.some(
    (existingName) =>
      normalizedPlanName(existingName) === normalizedPlanName(name),
  );
  return createPortal(
    <div className="picker-backdrop" onMouseDown={onCancel}>
      <form
        className="picker-dialog save-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("savePlan")}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!duplicate) onSave(name);
        }}
      >
        <div className="picker-title">
          <strong>{t("savePlan")}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label={t("close")}
            onClick={onCancel}
          >
            x
          </button>
        </div>
        <label>
          {t("planName")}
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {duplicate && (
            <small className="duplicate-plan-name">
              {t("duplicatePlanName")}
            </small>
          )}
        </label>
        <div className="actions dialog-actions">
          <button type="button" className="button secondary" onClick={onCancel}>
            {t("cancelSave")}
          </button>
          <button
            className="button primary"
            disabled={!name.trim() || duplicate}
          >
            <Save size={17} />
            {t("confirmSave")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function GameIcon({ iconId, label }: { iconId?: string; label: string }) {
  const source = window.desktopApi?.iconUrl(iconId);
  return (
    <span className="game-icon" aria-hidden="true">
      {source ? (
        <img
          src={source}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <b>{label.slice(0, 1)}</b>
    </span>
  );
}
type PickerItem = Character | CraftingCharacter | Weapon;
function EntityPicker({
  label,
  items,
  value,
  onChange,
  locale,
  emptyLabel,
}: {
  label: string;
  items: PickerItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  locale: Locale;
  emptyLabel?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = items.find((item) => item.id === value) ?? null;
  const filtered = items.filter((item) =>
    `${item.names["zh-CN"]} ${item.names["en-US"]}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);
  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };
  const crafting = Boolean(emptyLabel);
  return (
    <div className="entity-picker">
      <span className="picker-label">{label}</span>
      <button
        type="button"
        className="picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {selected ? (
          <>
            <GameIcon
              iconId={selected.iconId}
              label={localName(selected, locale)}
            />
            {localName(selected, locale)}
          </>
        ) : (
          (emptyLabel ?? label)
        )}
      </button>
      {open && (
        <div className="picker-backdrop" onMouseDown={() => setOpen(false)}>
          <div
            className="picker-dialog stable-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && filtered[0]) choose(filtered[0].id);
            }}
          >
            <div className="picker-title">
              <strong>{label}</strong>
              <button
                type="button"
                className="icon-button"
                aria-label={t("close")}
                onClick={() => setOpen(false)}
              >
                x
              </button>
            </div>
            <input
              ref={searchRef}
              className="picker-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search", { label })}
              aria-label={t("search", { label })}
            />
            {emptyLabel && (
              <button
                type="button"
                className="picker-option none-option"
                onClick={() => choose(null)}
              >
                <span className="empty-character-icon" aria-hidden="true">
                  <X size={20} />
                </span>
                <span>
                  <strong>{emptyLabel}</strong>
                  <small>{t("noBonus")}</small>
                </span>
              </button>
            )}
            <div
              className={
                crafting ? "picker-options crafting-options" : "picker-options"
              }
            >
              {filtered.map((item) => (
                <button
                  type="button"
                  className={
                    item.id === value
                      ? "picker-option selected"
                      : "picker-option"
                  }
                  key={item.id}
                  onClick={() => choose(item.id)}
                >
                  <GameIcon
                    iconId={item.iconId}
                    label={localName(item, locale)}
                  />
                  <span>
                    <strong>{localName(item, locale)}</strong>
                    {crafting && "passive" in item ? (
                      <small>{item.passive.description[locale]}</small>
                    ) : null}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="empty">{t("noResults")}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const assetIcon = (name: string) =>
  window.desktopApi?.iconUrl(`filter-${name}`) ||
  `https://api.lunaris.moe/data/assets/icons/${name}.webp`;
const elementFilters: Array<{
  id: CharacterElement;
  zh: string;
  en: string;
  asset: string;
}> = [
  { id: "pyro", zh: "火", en: "Pyro", asset: "pyro" },
  { id: "hydro", zh: "水", en: "Hydro", asset: "hydro" },
  { id: "anemo", zh: "风", en: "Anemo", asset: "anemo" },
  { id: "electro", zh: "雷", en: "Electro", asset: "electro" },
  { id: "dendro", zh: "草", en: "Dendro", asset: "dendro" },
  { id: "cryo", zh: "冰", en: "Cryo", asset: "cryo" },
  { id: "geo", zh: "岩", en: "Geo", asset: "geo" },
];
const weaponFilters: Array<{
  id: WeaponType;
  zh: string;
  en: string;
  asset: string;
}> = [
  { id: "sword", zh: "单手剑", en: "Sword", asset: "sword" },
  { id: "claymore", zh: "双手剑", en: "Claymore", asset: "claymore" },
  { id: "polearm", zh: "长柄武器", en: "Polearm", asset: "polearm" },
  { id: "bow", zh: "弓", en: "Bow", asset: "bow" },
  { id: "catalyst", zh: "法器", en: "Catalyst", asset: "catalyst" },
];
function TargetPicker({
  label,
  kind,
  items,
  value,
  onChange,
  locale,
}: {
  label: string;
  kind: "character" | "weapon";
  items: Character[] | Weapon[];
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [attribute, setAttribute] = useState<
    CharacterElement | WeaponType | "all"
  >("all");
  const [rarity, setRarity] = useState<number | "all">("all");
  const [nameTooltip, setNameTooltip] = useState<{
    name: string;
    left: number;
    top: number;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = items.find((item) => item.id === value);
  const orderedItems = [...items].sort(
    kind === "weapon"
      ? (left, right) =>
          compareWeaponsByTypeAndId(left as Weapon, right as Weapon)
      : compareStableIdDescending,
  );
  const filters = kind === "character" ? elementFilters : weaponFilters;
  const rareOptions = kind === "character" ? [4, 5] : [1, 2, 3, 4, 5];
  const filtered = orderedItems.filter((item) => {
    const matchesSearch = `${item.names["zh-CN"]} ${item.names["en-US"]}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const itemAttribute =
      kind === "character"
        ? (item as Character).element
        : (item as Weapon).type;
    return (
      matchesSearch &&
      (attribute === "all" || itemAttribute === attribute) &&
      (rarity === "all" || item.rarity === rarity)
    );
  });
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);
  const labelFor = (filter: { zh: string; en: string }) =>
    locale === "zh-CN" ? filter.zh : filter.en;
  const showNameTooltip = (name: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setNameTooltip({
      name,
      left: Math.max(
        12,
        Math.min(window.innerWidth - 12, rect.left + rect.width / 2),
      ),
      top: rect.bottom + 7,
    });
  };
  const close = () => {
    setOpen(false);
    setNameTooltip(null);
  };
  const dialog = (
    <div className="picker-backdrop" onMouseDown={close}>
      <div
        className={`picker-dialog target-picker-dialog ${kind}-picker-dialog stable-picker-dialog`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="picker-title">
          <strong>{label}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label={t("close")}
            onClick={close}
          >
            x
          </button>
        </div>
        <input
          ref={searchRef}
          className="picker-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search", { label })}
          aria-label={t("search", { label })}
        />
        <div className="picker-filters">
          <div className="icon-filter-group">
            <button
              className={
                attribute === "all"
                  ? "filter-icon selected tooltip"
                  : "filter-icon tooltip"
              }
              aria-label={t("all")}
              data-tooltip={t("all")}
              onClick={() => setAttribute("all")}
            >
              {t("all")}
            </button>
            {filters.map(({ id, asset, ...filter }) => (
              <button
                key={id}
                className={
                  attribute === id
                    ? "filter-icon selected tooltip"
                    : "filter-icon tooltip"
                }
                aria-label={labelFor(filter)}
                data-tooltip={labelFor(filter)}
                onClick={() => setAttribute(id)}
              >
                <img
                  src={assetIcon(asset)}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                    const fallback = event.currentTarget.nextElementSibling;
                    if (fallback instanceof HTMLElement)
                      fallback.hidden = false;
                  }}
                />
                <span className="filter-fallback" aria-hidden="true" hidden>
                  {locale === "zh-CN"
                    ? filter.zh.slice(0, 1)
                    : filter.en.slice(0, 1)}
                </span>
              </button>
            ))}
          </div>
          <div className="rarity-filter-group">
            <button
              className={rarity === "all" ? "selected" : ""}
              onClick={() => setRarity("all")}
            >
              {t("all")}
            </button>
            {rareOptions.map((value) => (
              <button
                key={value}
                className={rarity === value ? "selected" : ""}
                onClick={() => setRarity(value)}
              >
                {t("rarity", { count: value })}
              </button>
            ))}
          </div>
        </div>
        <p className="filter-summary">
          {t("filter")}:{" "}
          {attribute === "all"
            ? t("all")
            : labelFor(filters.find((item) => item.id === attribute)!)}{" "}
          · {rarity === "all" ? t("all") : t("rarity", { count: rarity })}
        </p>
        <div className="picker-options target-options">
          {filtered.map((item) => {
            const name = localName(item, locale);
            return (
              <button
                type="button"
                className={
                  item.id === value ? "picker-option selected" : "picker-option"
                }
                key={item.id}
                onMouseEnter={(event) =>
                  showNameTooltip(name, event.currentTarget)
                }
                onMouseLeave={() => setNameTooltip(null)}
                onFocus={(event) => showNameTooltip(name, event.currentTarget)}
                onBlur={() => setNameTooltip(null)}
                onClick={() => {
                  onChange(item.id);
                  close();
                  setQuery("");
                }}
              >
                <GameIcon iconId={item.iconId} label={name} />
                <span>
                  <strong>{name}</strong>
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="empty">{t("noResults")}</p>}
        </div>
      </div>
    </div>
  );
  return (
    <div className="entity-picker">
      <span className="picker-label">{label}</span>
      <button
        type="button"
        className="picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {selected && (
          <>
            <GameIcon
              iconId={selected.iconId}
              label={localName(selected, locale)}
            />
            {localName(selected, locale)}
          </>
        )}
      </button>
      {open && createPortal(dialog, document.body)}
      {nameTooltip &&
        createPortal(
          <span
            className="target-name-tooltip"
            style={{ left: nameTooltip.left, top: nameTooltip.top }}
            role="tooltip"
          >
            {nameTooltip.name}
          </span>,
          document.body,
        )}
    </div>
  );
}
function Overview({
  t,
  locale,
  plans,
  families,
  category,
  familyPage,
  onCategory,
  onPage,
  onOpen,
  onOpenMaterial,
}: {
  t: TFunction;
  locale: Locale;
  plans: SavedPlan[];
  families: MaterialFamily[];
  category: MaterialCategory;
  familyPage: number;
  onCategory: (category: MaterialCategory) => void;
  onPage: (page: number) => void;
  onOpen: (plan: SavedPlan) => void;
  onOpenMaterial: (family: MaterialFamily) => void;
}) {
  const pageSize = 8;
  const filtered = families.filter((family) => family.category === category);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(familyPage, pageCount - 1);
  const visible = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <section className="overview">
      <p className="page-intro">{t("chooseTarget")}</p>
      <div className="overview-grid">
        <div className="overview-section">
          <h2>{t("recent")}</h2>
          {plans.slice(0, 5).map((plan) => (
            <button
              className="plan-row"
              key={plan.id}
              onClick={() => onOpen(plan)}
            >
              <span>{plan.name}</span>
              <small>{fixedDateTime(plan.updatedAt)}</small>
            </button>
          ))}
          {plans.length === 0 && <p className="empty">{t("noPlans")}</p>}
        </div>
        <div className="overview-section">
          <div className="section-heading">
            <h2>{t("materialFamily")}</h2>
            <div className="compact-tabs">
              <button
                className={category === "talent-book" ? "selected" : ""}
                onClick={() => onCategory("talent-book")}
              >
                {t("overviewTalentTab")}
              </button>
              <button
                className={category === "weapon-ascension" ? "selected" : ""}
                onClick={() => onCategory("weapon-ascension")}
              >
                {t("overviewWeaponTab")}
              </button>
            </div>
          </div>
          {visible.map((item) => (
            <button
              className="family-row"
              key={item.id}
              onClick={() => onOpenMaterial(item)}
            >
              <span className="family-name">
                <GameIcon
                  iconId={
                    item.materialsByRarity[item.craftableRarities[0]]?.iconId
                  }
                  label={localName(item, locale)}
                />
                {locale === "zh-CN"
                  ? `「${localName(item, locale)}」${t("series")}`
                  : localName(item, locale)}
              </span>
              <span className="rarity-dots">
                {item.craftableRarities.map((rarity) => (
                  <i className={`rarity r${rarity}`} key={rarity}>
                    {rarity}
                  </i>
                ))}
              </span>
            </button>
          ))}
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPage={onPage}
          />
        </div>
      </div>
    </section>
  );
}
function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <button
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        {page + 1} / {pageCount}
      </span>
      <button
        aria-label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
function SettingsPage({
  t,
  locale,
  settingsTab,
  onTab,
  profile,
  plans,
  status,
  progress,
  onLocale,
  onTheme,
  onOpen,
  onDelete,
  onImportPlans,
  onExportPlans,
  onRefresh,
  onError,
  highlightSyncAction,
  onSyncHighlightEnd,
  onCancelRequest,
}: {
  t: TFunction;
  locale: Locale;
  settingsTab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  profile: UserProfileV1;
  plans: SavedPlan[];
  status: GameDataStatus | null;
  progress: DataSyncProgress | null;
  onLocale: (locale: Locale) => void;
  onTheme: (theme: ThemeMode) => void;
  onOpen: (plan: SavedPlan) => void;
  onDelete: (id: string) => void;
  onImportPlans: () => void;
  onExportPlans: () => void;
  onRefresh: (status?: GameDataStatus | null) => Promise<void>;
  onError: (message: string | null) => void;
  highlightSyncAction: boolean;
  onSyncHighlightEnd: () => void;
  onCancelRequest: (prepare: () => void) => void;
}) {
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "display", label: t("displayAndLanguage") },
    { id: "plans", label: t("myPlans") },
    { id: "game-data", label: t("gameData") },
    { id: "about", label: t("about") },
  ];
  return (
    <section className="plans-page settings-page">
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={settingsTab === tab.id ? "selected" : ""}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {settingsTab === "display" && (
        <DisplaySettings
          t={t}
          locale={locale}
          theme={profile.theme ?? "system"}
          onLocale={onLocale}
          onTheme={onTheme}
        />
      )}
      {settingsTab === "plans" && (
        <PlanManager
          t={t}
          plans={plans}
          onOpen={onOpen}
          onDelete={onDelete}
          onImport={onImportPlans}
          onExport={onExportPlans}
        />
      )}
      {settingsTab === "game-data" && (
        <GameDataPage
          t={t}
          locale={locale}
          status={status}
          progress={progress}
          onRefresh={onRefresh}
          onError={onError}
          highlightSyncAction={highlightSyncAction}
          onSyncHighlightEnd={onSyncHighlightEnd}
          onCancelRequest={onCancelRequest}
        />
      )}
      {settingsTab === "about" && <AboutPanel t={t} />}
    </section>
  );
}

function DisplaySettings({
  t,
  locale,
  theme,
  onLocale,
  onTheme,
}: {
  t: TFunction;
  locale: Locale;
  theme: ThemeMode;
  onLocale: (locale: Locale) => void;
  onTheme: (theme: ThemeMode) => void;
}) {
  const themes: { id: ThemeMode; label: string; icon: typeof Monitor }[] = [
    { id: "system", label: t("themeSystem"), icon: Monitor },
    { id: "light", label: t("themeLight"), icon: Sun },
    { id: "dark", label: t("themeDark"), icon: Moon },
  ];
  return (
    <div className="settings-panel display-settings">
      <label>
        {t("language")}
        <AppSelect
          ariaLabel={t("language")}
          value={locale}
          onChange={(value) => onLocale(value as Locale)}
          options={[
            { value: "zh-CN", label: "简体中文" },
            { value: "en-US", label: "English" },
          ]}
        />
      </label>
      <fieldset>
        <legend>{t("theme")}</legend>
        <div className="theme-options">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={theme === id ? "selected" : ""}
              aria-pressed={theme === id}
              onClick={() => onTheme(id)}
            >
              <span className={`theme-swatch ${id}`} aria-hidden="true">
                <i className="theme-swatch-sidebar" />
                <i className="theme-swatch-content" />
                <b />
              </span>
              <span className="theme-option-label">
                <Icon size={18} />
                {label}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function AboutPanel({ t }: { t: TFunction }) {
  const versionInfo = `${t("appName")} ${__APP_VERSION__}\n${t("build")}: ${__BUILD_ID__}`;
  return (
    <div className="settings-panel about-panel">
      <img className="about-logo" src="./app-icon.svg" alt="" />
      <h2>{t("appName")}</h2>
      <p>{t("aboutText")}</p>
      <dl>
        <div>
          <dt>{t("version")}</dt>
          <dd>v{__APP_VERSION__}</dd>
        </div>
        <div>
          <dt>{t("build")}</dt>
          <dd>{__BUILD_ID__}</dd>
        </div>
        <div>
          <dt>{t("author")}</dt>
          <dd>
            <button
              className="external-link"
              onClick={() =>
                void window.desktopApi?.openExternal(
                  "https://github.com/kumasuke120",
                )
              }
            >
              {__APP_AUTHOR__}
              <ExternalLink size={14} />
            </button>
          </dd>
        </div>
      </dl>
      <div className="about-actions">
        <button
          className="button secondary"
          onClick={() =>
            void window.desktopApi?.openExternal(
              "https://github.com/kumasuke120/genshin-planner",
            )
          }
        >
          {t("projectHome")}
        </button>
        <button
          className="button secondary"
          onClick={() => void navigator.clipboard.writeText(versionInfo)}
        >
          {t("copyVersion")}
        </button>
      </div>
      <small>MIT License · Unofficial project</small>
    </div>
  );
}
function PlanManager({
  t,
  plans,
  onOpen,
  onDelete,
  onImport,
  onExport,
}: {
  t: TFunction;
  plans: SavedPlan[];
  onOpen: (plan: SavedPlan) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = plans.filter((plan) =>
    plan.name.toLowerCase().includes(query.toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * 10, current * 10 + 10);
  return (
    <div className="settings-panel">
      <div className="plan-tools">
        <div className="actions">
          <button className="button secondary" onClick={onImport}>
            <Upload size={17} />
            {t("importPlans")}
          </button>
          <button className="button secondary" onClick={onExport}>
            <Download size={17} />
            {t("exportPlans")}
          </button>
          <button
            className="button secondary"
            onClick={() => void window.desktopApi?.openUserDataDirectory()}
          >
            <FolderOpen size={17} />
            {t("openUserData")}
          </button>
        </div>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder={t("searchPlans")}
          aria-label={t("searchPlans")}
        />
      </div>
      {visible.length ? (
        <div className="plans-list">
          {visible.map((plan) => (
            <article key={plan.id}>
              <button className="plan-main" onClick={() => onOpen(plan)}>
                <strong>{plan.name}</strong>
                <span>{new Date(plan.updatedAt).toLocaleString()}</span>
              </button>
              <button
                className="icon-button danger"
                onClick={() => onDelete(plan.id)}
                aria-label={t("delete")}
                title={t("delete")}
              >
                <Trash2 size={18} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">{t("noPlans")}</p>
      )}
      <Pagination page={current} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}

function GameDataPage({
  t,
  locale,
  status,
  progress,
  onRefresh,
  onError,
  highlightSyncAction,
  onSyncHighlightEnd,
  onCancelRequest,
}: {
  t: TFunction;
  locale: Locale;
  status: GameDataStatus | null;
  progress: DataSyncProgress | null;
  onRefresh: (status?: GameDataStatus | null) => Promise<void>;
  onError: (message: string | null) => void;
  highlightSyncAction: boolean;
  onSyncHighlightEnd: () => void;
  onCancelRequest: (prepare: () => void) => void;
}) {
  const [busyAction, setBusyAction] = useState<
    "sync" | "import" | "restore" | null
  >(null);
  const [syncStartedAt, setSyncStartedAt] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const cancellationRequested = useRef(false);
  const run = async (
    actionName: "sync" | "import" | "restore",
    action: () => Promise<GameDataStatus | null | undefined>,
  ) => {
    setBusyAction(actionName);
    if (actionName === "sync") setSyncStartedAt(new Date().toISOString());
    try {
      const next = await action();
      await onRefresh(next);
    } catch {
      if (!cancellationRequested.current) onError(t("dataActionFailed"));
      await onRefresh();
    } finally {
      cancellationRequested.current = false;
      if (actionName === "sync") setSyncStartedAt(null);
      setBusyAction(null);
    }
  };
  const progressSyncing = Boolean(
    progress &&
    progress.stage !== "idle" &&
    progress.stage !== "complete" &&
    progress.stage !== "cancelled" &&
    progress.stage !== "error",
  );
  const syncing =
    (busyAction === "sync" || progressSyncing) &&
    progress?.stage !== "cancelled" &&
    progress?.stage !== "error";
  const busy = busyAction !== null || progressSyncing;
  const progressVisible = progressSyncing;
  const progressLabel = progress ? t(`syncStage.${progress.stage}`) : "";
  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.max(0, (progress.completed / progress.total) * 100))
      : null;
  const operationText = (
    operation: NonNullable<GameDataStatus["operations"]>[number],
  ) =>
    t(
      `op${operation.action[0].toUpperCase()}${operation.action.slice(1)}${operation.outcome[0].toUpperCase()}${operation.outcome.slice(1)}`,
      { version: operation.version ?? "-" },
    );
  const counts = status?.counts;
  const visibleOperations: GameDataOperation[] = [
    ...(busyAction === "sync" && syncStartedAt
      ? [
          {
            action: "sync" as const,
            outcome: "started" as const,
            at: syncStartedAt,
          },
        ]
      : []),
    ...(status?.operations ?? []),
  ].slice(0, 3);
  return (
    <section className="data-page">
      <dl className="data-facts">
        <div>
          <dt>{t("gameDataVersion")}</dt>
          <dd>
            {status
              ? status.source === "builtin"
                ? t("builtinSampleVersion")
                : status.manifest.gameDataVersion
              : "-"}
          </dd>
        </div>
        <div>
          <dt>{t("dataStatus")}</dt>
          <dd>{t("verified")}</dd>
        </div>
        <div>
          <dt>{t("dataSource")}</dt>
          <dd>
            {status?.manifest.provider === "lunaris" ? (
              <button
                className="external-link"
                onClick={() =>
                  void window.desktopApi?.openExternal("https://lunaris.moe/")
                }
              >
                Lunaris
              </button>
            ) : (
              "-"
            )}
          </dd>
        </div>
        <div>
          <dt>{t("installedAt")}</dt>
          <dd>{status ? fixedDateTime(status.manifest.generatedAt) : "-"}</dd>
        </div>
      </dl>
      <table className="data-counts">
        <caption>{t("dataContents")}</caption>
        <thead>
          <tr>
            <th>{t("characters")}</th>
            <th>{t("weapons")}</th>
            <th>{t("talentMaterialsFull")}</th>
            <th>{t("weaponMaterialsFull")}</th>
            <th>{t("icons")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{counts?.characters ?? 0}</td>
            <td>{counts?.weapons ?? 0}</td>
            <td>{counts?.talentMaterials ?? 0}</td>
            <td>{counts?.weaponMaterials ?? 0}</td>
            <td>{counts?.icons ?? 0}</td>
          </tr>
        </tbody>
      </table>
      {progressVisible && progress ? (
        <div className="sync-progress">
          <p>
            <span>{progressLabel}</span>
            {progress.total > 0 ? (
              <span>{`${progress.completed}/${progress.total}`}</span>
            ) : null}
          </p>
          <div
            className="sync-progress-track"
            role="progressbar"
            aria-label={progressLabel}
            aria-valuemin={0}
            aria-valuemax={progress.total > 0 ? progress.total : undefined}
            aria-valuenow={progress.total > 0 ? progress.completed : undefined}
          >
            <span
              className={
                progressPercent === null
                  ? "sync-progress-fill indeterminate"
                  : "sync-progress-fill"
              }
              style={
                progressPercent === null
                  ? undefined
                  : { width: `${progressPercent}%` }
              }
            />
          </div>
        </div>
      ) : null}
      <div className="actions data-actions">
        {syncing ? (
          <button
            className="button secondary"
            onClick={() => {
              onCancelRequest(() => {
                cancellationRequested.current = true;
              });
            }}
          >
            {t("cancel")}
          </button>
        ) : (
          <button
            className={
              highlightSyncAction
                ? "button primary sync-action-highlight"
                : "button primary"
            }
            autoFocus={highlightSyncAction}
            onAnimationEnd={onSyncHighlightEnd}
            disabled={busy}
            onClick={() => run("sync", () => window.desktopApi!.syncGameData())}
          >
            <RefreshCw size={17} />
            {t("syncLunaris")}
          </button>
        )}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            run("import", () => window.desktopApi!.importGameData(locale))
          }
        >
          <Upload size={17} />
          {t("importGameData")}
        </button>
        <button
          className="button secondary"
          disabled={busy || !status || status.manifest.provider === "builtin"}
          onClick={() => window.desktopApi?.exportGameData(locale)}
        >
          <Download size={17} />
          {t("exportGameData")}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setConfirmRestore(true)}
        >
          <RotateCcw size={17} />
          {t("restoreBuiltin")}
        </button>
        <button
          className="button secondary"
          onClick={() => void window.desktopApi?.openGameDataDirectory()}
        >
          <FolderOpen size={17} />
          {t("openGameData")}
        </button>
      </div>
      <section className="operation-history">
        <h2>{t("operationHistory")}</h2>
        {visibleOperations.length > 0 ? (
          visibleOperations.map((operation) => (
            <div key={`${operation.at}-${operation.action}`}>
              <time>{fixedDateTimeToMinute(operation.at)}</time>
              <span>{operationText(operation)}</span>
            </div>
          ))
        ) : (
          <p className="empty">-</p>
        )}
      </section>
      {confirmRestore &&
        createPortal(
          <div className="modal-backdrop">
            <div
              className="dialog confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="restore-title"
            >
              <h2 id="restore-title">{t("restoreBuiltinTitle")}</h2>
              <p>{t("restoreBuiltinWarning")}</p>
              <div className="dialog-actions">
                <button
                  autoFocus
                  className="button secondary"
                  onClick={() => setConfirmRestore(false)}
                >
                  {t("cancelSave")}
                </button>
                <button
                  className="button danger-button"
                  onClick={() => {
                    setConfirmRestore(false);
                    void run("restore", () =>
                      window.desktopApi!.restoreBuiltinGameData(),
                    );
                  }}
                >
                  {t("restoreBuiltin")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

function WeaponTarget({
  t,
  locale,
  weapons,
  weaponId,
  currentPhase,
  targetPhase,
  onWeapon,
  onCurrent,
  onTarget,
}: {
  t: TFunction;
  locale: Locale;
  weapons: Weapon[];
  weaponId: string;
  currentPhase: number;
  targetPhase: number;
  onWeapon: (value: string) => void;
  onCurrent: (value: number) => void;
  onTarget: (value: number) => void;
}) {
  return (
    <div className="form-row">
      <TargetPicker
        label={t("weaponName")}
        kind="weapon"
        items={weapons}
        value={weaponId}
        onChange={onWeapon}
        locale={locale}
      />
      <label>
        {t("currentPhase")}
        <PhaseSelect value={currentPhase} onChange={onCurrent} />
      </label>
      <label>
        {t("targetPhase")}
        <PhaseSelect value={targetPhase} onChange={onTarget} />
      </label>
    </div>
  );
}
type AppSelectOption = {
  value: string;
  label: string;
};

function AppSelect({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const optionsElement = optionsRef.current;
    const selectedElement = selectedOptionRef.current;
    if (optionsElement && selectedElement) {
      optionsElement.scrollTop =
        selectedElement.offsetTop -
        (optionsElement.clientHeight - selectedElement.offsetHeight) / 2;
    }
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const move = (offset: number) => {
    if (options.length === 0) return;
    const next = (selectedIndex + offset + options.length) % options.length;
    onChange(options[next].value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      move(event.key === "ArrowDown" ? 1 : -1);
    }
  };

  return (
    <div className="app-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span>{selected?.label ?? ""}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="app-select-options"
          id={listboxId}
          role="listbox"
          ref={optionsRef}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              ref={option.value === value ? selectedOptionRef : undefined}
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <AppSelect
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      options={[0, 1, 2, 3, 4, 5, 6].map((phase) => ({
        value: String(phase),
        label:
          phase === 0 ? "Lv. 1" : `Lv. ${[20, 40, 50, 60, 70, 80][phase - 1]}+`,
      }))}
    />
  );
}
function TalentTarget({
  t,
  locale,
  characters,
  characterId,
  current,
  target,
  onCharacter,
  onCurrent,
  onTarget,
}: {
  t: TFunction;
  locale: Locale;
  characters: Character[];
  characterId: string;
  current: TalentLevels;
  target: TalentLevels;
  onCharacter: (value: string) => void;
  onCurrent: (value: TalentLevels) => void;
  onTarget: (value: TalentLevels) => void;
}) {
  const fields: { key: keyof TalentLevels; name: string }[] = [
    { key: "normal", name: t("normal") },
    { key: "skill", name: t("skill") },
    { key: "burst", name: t("burst") },
  ];
  return (
    <div className="talent-target">
      <TargetPicker
        label={t("character")}
        kind="character"
        items={characters}
        value={characterId}
        onChange={onCharacter}
        locale={locale}
      />
      <div className="talent-rows">
        <div className="talent-row talent-header">
          <span>{t("talent")}</span>
          <span>{t("current")}</span>
          <span>{t("targetLevel")}</span>
        </div>
        {fields.map(({ key, name }) => (
          <div className="talent-row" key={key}>
            <span>{name}</span>
            <NumberSelect
              value={current[key]}
              onChange={(value) => onCurrent({ ...current, [key]: value })}
            />
            <NumberSelect
              value={target[key]}
              onChange={(value) => onTarget({ ...target, [key]: value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
function NumberSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <AppSelect
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      options={Array.from({ length: 10 }, (_, index) => index + 1).map(
        (level) => ({ value: String(level), label: String(level) }),
      )}
    />
  );
}
function ManualTarget({
  t,
  locale,
  families: allFamilies,
  category,
  familyId,
  onCategory,
  onFamily,
}: {
  t: TFunction;
  locale: Locale;
  families: MaterialFamily[];
  category: MaterialCategory;
  familyId: string;
  onCategory: (value: MaterialCategory) => void;
  onFamily: (value: string) => void;
}) {
  const families = allFamilies.filter((family) => family.category === category);
  return (
    <div className="form-row">
      <div
        className="category-control"
        role="group"
        aria-label={t("materialCategory")}
      >
        <span>{t("materialCategory")}</span>
        <div>
          <button
            className={category === "talent-book" ? "selected" : ""}
            onClick={() => onCategory("talent-book")}
          >
            {t("talentBooks")}
          </button>
          <button
            className={category === "weapon-ascension" ? "selected" : ""}
            onClick={() => onCategory("weapon-ascension")}
          >
            {t("weaponMaterials")}
          </button>
        </div>
      </div>
      <label>
        {t("materialFamily")}
        <AppSelect
          ariaLabel={t("materialFamily")}
          value={familyId}
          onChange={onFamily}
          options={families.map((family) => ({
            value: family.id,
            label: localName(family, locale),
          }))}
        />
      </label>
    </div>
  );
}
function TruncatedMaterialName({ name }: { name: string }) {
  const ref = useRef<HTMLElement>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(
    null,
  );
  const showTooltip = () => {
    const element = ref.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    const rect = element.getBoundingClientRect();
    setTooltip({
      left: Math.max(
        12,
        Math.min(window.innerWidth - 12, rect.left + rect.width / 2),
      ),
      top: rect.bottom + 6,
    });
  };
  return (
    <>
      <strong
        ref={ref}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltip(null)}
      >
        {name}
      </strong>
      {tooltip &&
        createPortal(
          <span
            className="material-name-tooltip"
            role="tooltip"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            {name}
          </span>,
          document.body,
        )}
    </>
  );
}

function MaterialGrid({
  t,
  family,
  locale,
  inventory,
  required,
  calculation,
  manual,
  hasPassive,
  onInventory,
  onRequired,
}: {
  t: TFunction;
  family: MaterialFamily;
  locale: Locale;
  inventory: CountsByRarity;
  required: CountsByRarity;
  calculation: ReturnType<typeof calculateMaterials>;
  manual: boolean;
  hasPassive: boolean;
  onInventory: (rarity: MaterialRarity, value: string) => void;
  onRequired: (rarity: MaterialRarity, value: string) => void;
}) {
  const [preview, setPreview] = useState<{
    rarity: MaterialRarity;
    left: number;
    top: number;
  } | null>(null);
  const active = rarities.filter((rarity) =>
    family.craftableRarities.includes(rarity),
  );
  const row = (
    label: string,
    render: (rarity: MaterialRarity) => React.ReactNode,
  ) => (
    <div className="material-row">
      <div className="row-label">{label}</div>
      {active.map(render)}
    </div>
  );
  const inputLabel = (label: string, rarity: MaterialRarity) =>
    `${label} ${family.materialsByRarity[rarity]?.names[locale]} ${t("rarity", { count: rarity })}`;
  const showPreview = (rarity: MaterialRarity, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPreview({
      rarity,
      left: Math.max(
        210,
        Math.min(window.innerWidth - 210, rect.left + rect.width / 2),
      ),
      top: rect.bottom + 8,
    });
  };
  const material = preview
    ? family.materialsByRarity[preview.rarity]
    : undefined;
  return (
    <>
      <section
        className="material-grid"
        style={{ "--columns": active.length } as React.CSSProperties}
      >
        {row("", (rarity) => (
          <div key={rarity} className={`material-head r${rarity}`}>
            <button
              type="button"
              className="material-preview-trigger"
              aria-label={t("materialPreview", {
                name: family.materialsByRarity[rarity]?.names[locale] ?? "",
              })}
              onMouseEnter={(event) => showPreview(rarity, event.currentTarget)}
              onMouseLeave={() => setPreview(null)}
              onFocus={(event) => showPreview(rarity, event.currentTarget)}
              onBlur={() => setPreview(null)}
            >
              <GameIcon
                iconId={family.materialsByRarity[rarity]?.iconId}
                label={family.materialsByRarity[rarity]?.names[locale] ?? ""}
              />
              {t("rarity", { count: rarity })}
            </button>
            <TruncatedMaterialName
              name={family.materialsByRarity[rarity]?.names[locale] ?? ""}
            />
          </div>
        ))}
        {row(t("inventory"), (rarity) => (
          <input
            key={rarity}
            aria-label={inputLabel(t("inventory"), rarity)}
            type="number"
            min="0"
            value={inventory[rarity] ?? 0}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (
                event.currentTarget.value === "0" &&
                /^[1-9]$/.test(event.key)
              ) {
                event.preventDefault();
                onInventory(rarity, event.key);
              }
            }}
            onChange={(event) => onInventory(rarity, event.target.value)}
          />
        ))}
        {row(t("required"), (rarity) =>
          manual ? (
            <input
              key={rarity}
              aria-label={inputLabel(t("required"), rarity)}
              type="number"
              min="0"
              value={required[rarity] ?? 0}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (
                  event.currentTarget.value === "0" &&
                  /^[1-9]$/.test(event.key)
                ) {
                  event.preventDefault();
                  onRequired(rarity, event.key);
                }
              }}
              onChange={(event) => onRequired(rarity, event.target.value)}
            />
          ) : (
            <output key={rarity}>{required[rarity] ?? 0}</output>
          ),
        )}
        {row(t("afterConversion"), (rarity) => (
          <output
            key={rarity}
            className={`material-result${calculation.deficits[rarity] ? " deficit" : ""}`}
          >
            <strong>
              {formatMaterialCount(
                calculation.availableAfterConversion[rarity],
              )}
            </strong>
            <span className="material-sources">
              <small className="base-crafted">
                {t("baseCrafted", {
                  count: calculation.baseCrafted[rarity] ?? 0,
                })}
              </small>
              {hasPassive && (
                <small className="passive-crafted">
                  {t("passiveCrafted", {
                    count: calculation.passiveBonus[rarity] ?? 0,
                  })}
                </small>
              )}
            </span>
            {calculation.deficits[rarity] ? (
              <small className="missing-count">
                ({t("remaining", { count: calculation.deficits[rarity] })})
              </small>
            ) : null}
          </output>
        ))}
      </section>
      {preview &&
        material &&
        createPortal(
          <aside
            className={`material-preview-card r${preview.rarity}`}
            style={{ left: preview.left, top: preview.top }}
            aria-live="polite"
          >
            <GameIcon iconId={material.iconId} label={material.names[locale]} />
            <div>
              <strong>{material.names[locale]}</strong>
              <span>{t("rarity", { count: preview.rarity })}</span>
            </div>
          </aside>,
          document.body,
        )}
    </>
  );
}
