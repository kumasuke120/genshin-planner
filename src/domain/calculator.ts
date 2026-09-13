import type { CountsByRarity, CraftStrategyId, MaterialFamily, MaterialRarity } from '../shared/types';

/** 材料合成计算的规范化输入、转换明细与最终缺口 */
export interface CalculationResult {
  /** 经过非负整数规范化后的方案需求 */
  required: CountsByRarity;
  /** 经过非负整数规范化后的实际库存 */
  inventory: CountsByRarity;
  /** 执行合成及被动效果后各星级可用的材料数量 */
  availableAfterConversion: CountsByRarity;
  /** 不含角色被动额外产出的各星级合成数量 */
  baseCrafted: CountsByRarity;
  /** 角色合成被动带来的返还或额外产出数量 */
  passiveBonus: CountsByRarity;
  /** 合成后仍未满足的各星级材料数量 */
  deficits: CountsByRarity;
  /** 满足需求后剩余的各星级材料数量 */
  surplus: CountsByRarity;
  /** 是否已经满足材料系列中全部星级的需求 */
  isComplete: boolean;
}

const normalize = (value: number | undefined): number => Math.max(0, Math.floor(value ?? 0));

const copyCounts = (counts: CountsByRarity): CountsByRarity => ({
  2: normalize(counts[2]),
  3: normalize(counts[3]),
  4: normalize(counts[4]),
  5: normalize(counts[5])
});

/**
 * 按材料系列和角色被动策略计算合成后的可用数量与缺口
 * @param family 定义可合成星级的材料系列
 * @param inventory 当前实际库存
 * @param required 方案所需材料数量
 * @param strategy 本次计算采用的合成被动策略
 * @returns 规范化库存、合成结果、额外产出及缺口
 */
export function calculateMaterials(
  family: MaterialFamily,
  inventory: CountsByRarity,
  required: CountsByRarity,
  strategy: CraftStrategyId = 'none'
): CalculationResult {
  const normalizedInventory = copyCounts(inventory);
  const normalizedRequired = copyCounts(required);
  const base = copyCounts(inventory);
  const passiveBonus: CountsByRarity = {};
  const baseCrafted: CountsByRarity = {};
  const ascending = [...family.craftableRarities].sort((a, b) => a - b);

  // 先保留当前星级的确定需求，只把富余材料投入三合一，避免低级需求被过度消耗
  // 材料数量始终取整，被动返还仍进入原星级，只有再次凑齐三个时才继续合成
  for (const rarity of ascending) {
    const higherRarity = (rarity + 1) as MaterialRarity;
    if (!family.craftableRarities.includes(higherRarity)) continue;

    const reserved = normalize(normalizedRequired[rarity]);
    while (true) {
      const crafts = Math.floor(Math.max(0, normalize(base[rarity]) - reserved) / 3);
      if (crafts === 0) break;

      base[rarity] = normalize(base[rarity]) - crafts * 3;
      base[higherRarity] = normalize(base[higherRarity]) + crafts;
      baseCrafted[higherRarity] = normalize(baseCrafted[higherRarity]) + crafts;

      if (strategy === 'double_10') {
        // 双倍产出按本批合成次数统一向下取整，额外产物不会再次触发被动
        const extraOutput = Math.floor(crafts * 0.1);
        if (extraOutput > 0) {
          base[higherRarity] = normalize(base[higherRarity]) + extraOutput;
          passiveBonus[higherRarity] = normalize(passiveBonus[higherRarity]) + extraOutput;
        }
        break;
      }

      if (strategy !== 'refund_25') break;
      // 返还发生在原星级，因此继续循环直到不足三份，完整计入可再次合成的材料
      const refundedInput = Math.floor(crafts * 0.25);
      if (refundedInput === 0) break;
      base[rarity] = normalize(base[rarity]) + refundedInput;
      passiveBonus[rarity] = normalize(passiveBonus[rarity]) + refundedInput;
    }
  }

  const deficits: CountsByRarity = {};
  const surplus: CountsByRarity = {};
  for (const rarity of family.craftableRarities) {
    deficits[rarity] = Math.max(0, normalize(normalizedRequired[rarity]) - normalize(base[rarity]));
    surplus[rarity] = Math.max(0, normalize(base[rarity]) - normalize(normalizedRequired[rarity]));
  }

  return {
    required: normalizedRequired,
    inventory: normalizedInventory,
    availableAfterConversion: base,
    baseCrafted,
    passiveBonus,
    deficits,
    surplus,
    isComplete: family.craftableRarities.every((rarity) => normalize(deficits[rarity]) === 0)
  };
}

/**
 * 将多组材料数量按星级相加，并把小数和负数规范为非负整数
 * @param counts 待合并的一组或多组材料数量
 * @returns 合并后的各星级材料数量
 */
export function addCounts(...counts: CountsByRarity[]): CountsByRarity {
  return counts.reduce<CountsByRarity>((total, current) => {
    for (const rarity of [2, 3, 4, 5] as const) total[rarity] = normalize(total[rarity]) + normalize(current[rarity]);
    return total;
  }, {});
}
