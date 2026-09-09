import type { CountsByRarity, TalentLevels, Weapon } from '../shared/types';
import { addCounts } from './calculator';

export const TALENT_CUMULATIVE_REQUIREMENTS: Record<number, CountsByRarity> = {
  1: {},
  2: { 2: 3 },
  3: { 2: 3, 3: 2 },
  4: { 2: 3, 3: 6 },
  5: { 2: 3, 3: 12 },
  6: { 2: 3, 3: 21 },
  7: { 2: 3, 3: 21, 4: 4 },
  8: { 2: 3, 3: 21, 4: 10 },
  9: { 2: 3, 3: 21, 4: 22 },
  10: { 2: 3, 3: 21, 4: 38 }
};

function subtractCounts(target: CountsByRarity, current: CountsByRarity): CountsByRarity {
  const result: CountsByRarity = {};
  for (const rarity of [2, 3, 4, 5] as const) result[rarity] = Math.max(0, (target[rarity] ?? 0) - (current[rarity] ?? 0));
  return result;
}

export function weaponRequirement(weapon: Weapon, currentPhase: number, targetPhase: number): CountsByRarity {
  if (targetPhase <= currentPhase) return {};
  const requirements: CountsByRarity[] = [];
  for (let phase = currentPhase + 1; phase <= targetPhase; phase += 1) requirements.push(weapon.phaseRequirements[phase] ?? {});
  return addCounts(...requirements);
}

function talentRequirement(currentLevel: number, targetLevel: number): CountsByRarity {
  const current = Math.max(1, Math.min(10, Math.floor(currentLevel)));
  const target = Math.max(current, Math.min(10, Math.floor(targetLevel)));
  return subtractCounts(TALENT_CUMULATIVE_REQUIREMENTS[target], TALENT_CUMULATIVE_REQUIREMENTS[current]);
}

export function talentRequirements(current: TalentLevels, target: TalentLevels): CountsByRarity {
  return addCounts(
    talentRequirement(current.normal, target.normal),
    talentRequirement(current.skill, target.skill),
    talentRequirement(current.burst, target.burst)
  );
}
