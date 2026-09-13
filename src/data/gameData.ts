import fixture from './gameData.fixture.json';
import type { GameDataBundle, MaterialFamily } from '../shared/types';

/** 测试或开发资料目录缺失时使用的最小 JSON 后备资料 */
export const builtinGameData = fixture as GameDataBundle;
/** 内置资料中的全部材料系列 */
export const materialFamilies = builtinGameData.materialFamilies;

/**
 * 按稳定 ID 查找内置材料系列
 * @param id 材料系列的稳定 ID
 * @returns 与 ID 对应的材料系列
 * @throws 找不到材料系列时抛出错误
 */
export function familyById(id: string): MaterialFamily {
  const family = materialFamilies.find((item) => item.id === id);
  if (!family) throw new Error(`Unknown material family: ${id}`);
  return family;
}
