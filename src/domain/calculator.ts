import type { CountsByRarity, CraftStrategyId, MaterialFamily, MaterialRarity } from '../shared/types';

export interface CalculationResult {
  required: CountsByRarity;
  inventory: CountsByRarity;
  availableAfterConversion: CountsByRarity;
  baseCrafted: CountsByRarity;
  passiveBonus: CountsByRarity;
  deficits: CountsByRarity;
  surplus: CountsByRarity;
  isComplete: boolean;
}

const normalize = (value: number | undefined): number => Math.max(0, Math.floor(value ?? 0));

const copyCounts = (counts: CountsByRarity): CountsByRarity => ({
  2: normalize(counts[2]),
  3: normalize(counts[3]),
  4: normalize(counts[4]),
  5: normalize(counts[5])
});

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

  // Materials are always integers. Refunds return to the same tier and are
  // repeatedly crafted only after enough whole materials accumulate.
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
        const extraOutput = Math.floor(crafts * 0.1);
        if (extraOutput > 0) {
          base[higherRarity] = normalize(base[higherRarity]) + extraOutput;
          passiveBonus[higherRarity] = normalize(passiveBonus[higherRarity]) + extraOutput;
        }
        break;
      }

      if (strategy !== 'refund_25') break;
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

export function addCounts(...counts: CountsByRarity[]): CountsByRarity {
  return counts.reduce<CountsByRarity>((total, current) => {
    for (const rarity of [2, 3, 4, 5] as const) total[rarity] = normalize(total[rarity]) + normalize(current[rarity]);
    return total;
  }, {});
}
