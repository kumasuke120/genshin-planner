import type { CountsByRarity, TalentLevels, Weapon } from '../shared/types';
import { addCounts } from './calculator';

/** 单个战斗天赋从一级提升到各等级所需的累计角色天赋素材 */
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

/**
 * 汇总武器在指定突破阶段区间内所需的材料
 * @param weapon 提供逐阶段材料需求的武器资料
 * @param currentPhase 当前已经完成的突破阶段
 * @param targetPhase 计划达到的突破阶段
 * @returns 各星级武器突破素材的合计数量
 */
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

/**
 * 汇总三个战斗天赋从当前等级提升到目标等级所需的材料
 * @param current 三个战斗天赋的当前等级
 * @param target 三个战斗天赋的目标等级
 * @returns 各星级角色天赋素材的合计数量
 */
export function talentRequirements(current: TalentLevels, target: TalentLevels): CountsByRarity {
  return addCounts(
    talentRequirement(current.normal, target.normal),
    talentRequirement(current.skill, target.skill),
    talentRequirement(current.burst, target.burst)
  );
}
