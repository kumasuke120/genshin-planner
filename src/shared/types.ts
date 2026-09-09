export type Locale = 'zh-CN' | 'en-US';
export type MaterialRarity = 2 | 3 | 4 | 5;
export type CountsByRarity = Partial<Record<MaterialRarity, number>>;
export type MaterialCategory = 'talent-book' | 'weapon-ascension';
export type CraftStrategyId = 'none' | 'refund_25' | 'double_10';
export type CharacterElement = 'pyro' | 'hydro' | 'anemo' | 'electro' | 'dendro' | 'cryo' | 'geo';
export type WeaponType = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst';

export interface LocalizedText {
  'zh-CN': string;
  'en-US': string;
}

export interface MaterialTier {
  id: string;
  rarity: MaterialRarity;
  names: LocalizedText;
  iconId?: string;
}

export interface MaterialFamily {
  id: string;
  category: MaterialCategory;
  names: LocalizedText;
  craftableRarities: MaterialRarity[];
  materialsByRarity: Partial<Record<MaterialRarity, MaterialTier>>;
}

export interface CraftingCharacter {
  id: string;
  names: LocalizedText;
  iconId?: string;
  passive: {
    strategy: CraftStrategyId;
    categories: MaterialCategory[];
    description: LocalizedText;
  };
}

export interface Weapon {
  id: string;
  names: LocalizedText;
  iconId?: string;
  rarity?: 1 | 2 | 3 | 4 | 5;
  type?: WeaponType;
  materialFamilyId?: string;
  phaseRequirements: Record<number, CountsByRarity>;
  calculationStatus?: 'supported' | 'unsupported-source-curve';
}

export interface Character {
  id: string;
  names: LocalizedText;
  iconId?: string;
  element?: CharacterElement;
  rarity?: 4 | 5;
  talentMaterialFamilyId: string;
}

export interface WeaponPlanTarget {
  type: 'weapon';
  weaponId: string;
  currentPhase: number;
  targetPhase: number;
}

export interface TalentLevels {
  normal: number;
  skill: number;
  burst: number;
}

export interface TalentPlanTarget {
  type: 'talent';
  characterId: string;
  current: TalentLevels;
  target: TalentLevels;
}

export interface ManualPlanTarget {
  type: 'manual';
  materialFamilyId: string;
  required: CountsByRarity;
}

export type PlanTarget = WeaponPlanTarget | TalentPlanTarget | ManualPlanTarget;

export interface SavedPlan {
  id: string;
  name: string;
  target: PlanTarget;
  craftingCharacterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileV1 {
  schemaVersion: 1;
  locale: Locale;
  inventoryByMaterialFamily: Record<string, CountsByRarity>;
  savedPlans: SavedPlan[];
  recentPlanIds: string[];
  updatedAt: string;
}

export interface DataManifestV1 {
  schemaVersion: 1;
  gameDataVersion: string;
  provider: 'lunaris' | 'builtin';
  providerUrl: string;
  fetchedAt: string;
  generatedAt: string;
  locales: Locale[];
}

export interface GameDataBundle {
  manifest: DataManifestV1;
  materialFamilies: MaterialFamily[];
  characters: Character[];
  weapons: Weapon[];
  craftingCharacters: CraftingCharacter[];
}

export interface GameDataStatus {
  manifest: DataManifestV1;
  source: 'builtin' | 'active';
  counts: { characters: number; weapons: number; talentMaterials: number; weaponMaterials: number; icons: number };
  operations: GameDataOperation[];
}

export interface GameDataOperation {
  action: 'sync' | 'import' | 'restore';
  outcome: 'success' | 'failed' | 'cancelled';
  version?: string;
  at: string;
}

export interface DataSyncProgress {
  stage: 'idle' | 'checking' | 'catalogs' | 'details' | 'materials' | 'icons' | 'validating' | 'installing' | 'complete' | 'error' | 'cancelled';
  completed: number;
  total: number;
  message: string;
}

export interface DesktopApi {
  loadProfile(): Promise<UserProfileV1>;
  saveProfile(profile: UserProfileV1): Promise<void>;
  exportProfile(profile: UserProfileV1): Promise<boolean>;
  importProfile(): Promise<UserProfileV1 | null>;
  loadGameData(): Promise<GameDataBundle>;
  getGameDataStatus(): Promise<GameDataStatus>;
  syncGameData(): Promise<GameDataStatus>;
  cancelGameDataSync(): Promise<void>;
  importGameData(): Promise<GameDataStatus | null>;
  exportGameData(): Promise<boolean>;
  restoreBuiltinGameData(): Promise<GameDataStatus>;
  openExternal(url: string): Promise<void>;
  iconUrl(iconId: string | undefined): string;
  onGameDataProgress(listener: (progress: DataSyncProgress) => void): () => void;
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}
