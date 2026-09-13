/** 应用支持的界面语言标识 */
export type Locale = "zh-CN" | "en-US";
/** 应用支持的外观模式；system 表示跟随操作系统 */
export type ThemeMode = "system" | "light" | "dark";
/** 养成材料在合成链中的星级 */
export type MaterialRarity = 2 | 3 | 4 | 5;
/** 按材料星级记录的数量集合，缺失的星级表示数量为零 */
export type CountsByRarity = Partial<Record<MaterialRarity, number>>;
/** 当前计算功能支持的材料类别 */
export type MaterialCategory = "talent-book" | "weapon-ascension";
/** 合成时采用的角色被动策略标识 */
export type CraftStrategyId = "none" | "refund_25" | "double_10";
/** 角色的官方元素类型 */
export type CharacterElement =
  "pyro" | "hydro" | "anemo" | "electro" | "dendro" | "cryo" | "geo";
/** 武器的官方类型 */
export type WeaponType = "sword" | "claymore" | "polearm" | "bow" | "catalyst";

/** 同一业务文本的中英文显示值 */
export interface LocalizedText {
  /** 简体中文显示文本 */
  "zh-CN": string;
  /** 英文显示文本 */
  "en-US": string;
}

/** 材料系列中一个可独立计数的星级档位 */
export interface MaterialTier {
  /** 资料源提供的稳定材料 ID */
  id: string;
  /** 材料星级 */
  rarity: MaterialRarity;
  /** 本地化材料名称 */
  names: LocalizedText;
  /** 可选的本地图标资源 ID */
  iconId?: string;
}

/** 可按三合一规则转换的一组同类材料 */
export interface MaterialFamily {
  /** 材料系列的稳定 ID */
  id: string;
  /** 材料所属的养成用途 */
  category: MaterialCategory;
  /** 本地化材料系列名称 */
  names: LocalizedText;
  /** 能够参与逐级合成的星级列表 */
  craftableRarities: MaterialRarity[];
  /** 各星级对应的具体材料资料 */
  materialsByRarity: Partial<Record<MaterialRarity, MaterialTier>>;
}

/** 能为材料合成提供指定被动效果的角色 */
export interface CraftingCharacter {
  /** 资料源提供的稳定角色 ID */
  id: string;
  /** 本地化角色名称 */
  names: LocalizedText;
  /** 可选的本地角色图标资源 ID */
  iconId?: string;
  /** 角色对指定材料类别生效的合成被动 */
  passive: {
    /** 被动对应的计算策略 */
    strategy: CraftStrategyId;
    /** 被动能够作用的材料类别 */
    categories: MaterialCategory[];
    /** 本地化被动说明 */
    description: LocalizedText;
  };
}

/** 参与突破材料计算的武器资料 */
export interface Weapon {
  /** 资料源提供的稳定武器 ID */
  id: string;
  /** 本地化武器名称 */
  names: LocalizedText;
  /** 可选的本地武器图标资源 ID */
  iconId?: string;
  /** 武器星级 */
  rarity?: 1 | 2 | 3 | 4 | 5;
  /** 武器类型 */
  type?: WeaponType;
  /** 关联武器突破素材系列的稳定 ID */
  materialFamilyId?: string;
  /** 各突破阶段分别消耗的材料数量 */
  phaseRequirements: Record<number, CountsByRarity>;
  /** 来源资料能否支持当前突破计算 */
  calculationStatus?: "supported" | "unsupported-source-curve";
}

/** 参与天赋材料计算的角色资料 */
export interface Character {
  /** 资料源提供的稳定角色 ID */
  id: string;
  /** 本地化角色名称 */
  names: LocalizedText;
  /** 可选的本地角色图标资源 ID */
  iconId?: string;
  /** 角色元素 */
  element?: CharacterElement;
  /** 角色星级 */
  rarity?: 4 | 5;
  /** 关联角色天赋素材系列的稳定 ID */
  talentMaterialFamilyId: string;
}

/** 武器突破方案的目标范围 */
export interface WeaponPlanTarget {
  /** 用于区分方案目标的武器类型标记 */
  type: "weapon";
  /** 目标武器的稳定 ID */
  weaponId: string;
  /** 当前已经完成的突破阶段 */
  currentPhase: number;
  /** 计划达到的突破阶段 */
  targetPhase: number;
}

/** 角色三个战斗天赋各自的等级 */
export interface TalentLevels {
  /** 普通攻击天赋等级 */
  normal: number;
  /** 元素战技天赋等级 */
  skill: number;
  /** 元素爆发天赋等级 */
  burst: number;
}

/** 角色天赋方案的当前等级与目标等级 */
export interface TalentPlanTarget {
  /** 用于区分方案目标的天赋类型标记 */
  type: "talent";
  /** 目标角色的稳定 ID */
  characterId: string;
  /** 三个战斗天赋的当前等级 */
  current: TalentLevels;
  /** 三个战斗天赋的目标等级 */
  target: TalentLevels;
}

/** 用户直接填写材料需求的手动方案目标 */
export interface ManualPlanTarget {
  /** 用于区分方案目标的手动类型标记 */
  type: "manual";
  /** 用户选择的材料系列稳定 ID */
  materialFamilyId: string;
  /** 用户直接填写的各星级需求 */
  required: CountsByRarity;
}

/** 当前版本能够保存的方案目标联合类型 */
export type PlanTarget = WeaponPlanTarget | TalentPlanTarget | ManualPlanTarget;

/** 已持久化的单个养成计算方案 */
export interface SavedPlan {
  /** 方案稳定 ID */
  id: string;
  /** 用户可见且在档案内唯一的方案名称 */
  name: string;
  /** 方案对应的计算目标 */
  target: PlanTarget;
  /** 用户选择的合成被动角色 ID，未选择时为 null */
  craftingCharacterId: string | null;
  /** 方案创建时间的 ISO 8601 字符串 */
  createdAt: string;
  /** 方案最近更新时间的 ISO 8601 字符串 */
  updatedAt: string;
}

/** Schema v1 用户档案及其兼容字段 */
export interface UserProfileV1 {
  /** 固定为 1 的档案结构版本 */
  schemaVersion: 1;
  /** 用户选择的界面语言 */
  locale: Locale;
  /** 按材料系列和星级记录的实际库存 */
  inventoryByMaterialFamily: Record<string, CountsByRarity>;
  /** 用户已经保存的计算方案 */
  savedPlans: SavedPlan[];
  /** 用于总览排序的最近方案 ID */
  recentPlanIds: string[];
  /** 档案最近写入时间的 ISO 8601 字符串 */
  updatedAt: string;
  /** 用户选择的应用外观，旧版 Profile 缺少该字段时按 system 处理 */
  theme?: ThemeMode;
}

/** Schema v1 游戏资料包的来源与版本清单 */
export interface DataManifestV1 {
  /** 固定为 1 的游戏资料结构版本 */
  schemaVersion: 1;
  /** 资料适用的原神游戏版本 */
  gameDataVersion: string;
  /** 资料提供方 */
  provider: "lunaris" | "builtin";
  /** 资料来源地址 */
  providerUrl: string;
  /** 原始资料获取时间的 ISO 8601 字符串 */
  fetchedAt: string;
  /** 当前资料包生成时间的 ISO 8601 字符串 */
  generatedAt: string;
  /** 资料包完整支持的语言 */
  locales: Locale[];
}

/** 经过校验后供计算和界面共同消费的游戏资料包 */
export interface GameDataBundle {
  /** 资料包的来源与版本清单 */
  manifest: DataManifestV1;
  /** 已建模并校验的材料系列 */
  materialFamilies: MaterialFamily[];
  /** 已建模并校验的角色 */
  characters: Character[];
  /** 已建模并校验的武器 */
  weapons: Weapon[];
  /** 已建模并校验的合成被动角色 */
  craftingCharacters: CraftingCharacter[];
}

/** 当前生效游戏资料的版本、来源、数量与操作记录 */
export interface GameDataStatus {
  /** 当前生效资料包的来源与版本清单 */
  manifest: DataManifestV1;
  /** 当前资料来自内置包还是用户主动安装的完整包 */
  source: "builtin" | "active";
  /** 当前资料各类业务对象和图标的数量 */
  counts: {
    /** 角色数量 */
    characters: number;
    /** 武器数量 */
    weapons: number;
    /** 角色天赋素材系列数量 */
    talentMaterials: number;
    /** 武器突破素材系列数量 */
    weaponMaterials: number;
    /** 已安装图标数量 */
    icons: number;
  };
  /** 最近的资料导入、同步与恢复记录 */
  operations: GameDataOperation[];
}

/** 一次游戏资料操作的最终状态记录 */
export interface GameDataOperation {
  /** 资料操作类型 */
  action: "sync" | "import" | "restore";
  /** 资料操作结果 */
  outcome: "started" | "success" | "failed" | "cancelled";
  /** 操作涉及的游戏资料版本 */
  version?: string;
  /** 操作发生时间的 ISO 8601 字符串 */
  at: string;
}

/** 游戏资料同步任务向渲染进程报告的阶段进度 */
export interface DataSyncProgress {
  /** 当前同步阶段 */
  stage:
    | "idle"
    | "checking"
    | "catalogs"
    | "details"
    | "icons"
    | "validating"
    | "installing"
    | "complete"
    | "error"
    | "cancelled";
  /** 当前阶段已经完成的工作项数量 */
  completed: number;
  /** 当前阶段的工作项总数 */
  total: number;
  /** 提供给界面展示的同步状态消息 */
  message: string;
}

/** preload 向渲染进程暴露的最小桌面能力边界 */
export interface DesktopApi {
  /**
   * 读取并校验当前用户档案
   * @returns 当前用户档案
   */
  loadProfile(): Promise<UserProfileV1>;
  /**
   * 原子保存当前用户档案
   * @param profile 待校验并保存的用户档案
   * @returns 保存完成后的 Promise
   */
  saveProfile(profile: UserProfileV1): Promise<void>;
  /**
   * 让用户选择位置并导出档案
   * @param profile 待导出的用户档案
   * @returns 用户完成导出时为 true，取消时为 false
   */
  exportProfile(profile: UserProfileV1): Promise<boolean>;
  /**
   * 让用户选择档案文件并完成校验
   * @returns 导入的用户档案，用户取消时为 null
   */
  importProfile(): Promise<UserProfileV1 | null>;
  /**
   * 加载当前生效的游戏资料
   * @returns 已通过校验的游戏资料包
   */
  loadGameData(): Promise<GameDataBundle>;
  /**
   * 读取当前资料来源、数量与最近操作
   * @returns 当前游戏资料状态
   */
  getGameDataStatus(): Promise<GameDataStatus>;
  /**
   * 主动同步并安装最新游戏资料
   * @returns 同步完成后的游戏资料状态
   */
  syncGameData(): Promise<GameDataStatus>;
  /**
   * 取消当前游戏资料同步任务
   * @returns 同步任务完全停止后的 Promise
   */
  cancelGameDataSync(): Promise<void>;
  /**
   * 让用户选择并安装本地游戏资料包
   * @param locale 原生文件选择器使用的界面语言
   * @returns 安装完成后的资料状态，用户取消时为 null
   */
  importGameData(locale: string): Promise<GameDataStatus | null>;
  /**
   * 让用户选择位置并导出当前游戏资料包
   * @param locale 原生文件选择器使用的界面语言
   * @returns 用户完成导出时为 true，取消时为 false
   */
  exportGameData(locale: string): Promise<boolean>;
  /**
   * 使用内置资料替换当前活动资料
   * @returns 恢复完成后的游戏资料状态
   */
  restoreBuiltinGameData(): Promise<GameDataStatus>;
  /**
   * 通过系统默认程序打开受信任的外部地址
   * @param url 待打开的绝对 URL
   * @returns 系统打开请求完成后的 Promise
   */
  openExternal(url: string): Promise<void>;
  /**
   * 在文件管理器中打开用户数据目录
   * @returns 系统打开请求完成后的 Promise
   */
  openUserDataDirectory(): Promise<void>;
  /**
   * 在文件管理器中打开游戏资料目录
   * @returns 系统打开请求完成后的 Promise
   */
  openGameDataDirectory(): Promise<void>;
  /**
   * 把稳定图标 ID 转换为渲染进程可访问的协议地址
   * @param iconId 可选的稳定图标 ID
   * @returns 图标协议地址，缺少 ID 时返回空字符串
   */
  iconUrl(iconId: string | undefined): string;
  /**
   * 订阅游戏资料同步进度
   * @param listener 接收同步进度的监听器
   * @returns 用于取消当前订阅的函数
   */
  onGameDataProgress(
    listener: (progress: DataSyncProgress) => void,
  ): () => void;
  /**
   * 订阅主进程发出的窗口关闭请求
   * @param listener 处理关闭请求的监听器
   * @returns 用于取消当前订阅的函数
   */
  onWindowCloseRequested(listener: () => void): () => void;
  /** 确认渲染进程已处理未保存状态并允许关闭窗口 */
  confirmWindowClose(): void;
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}
