import { describe, expect, it } from 'vitest';
import { calculateMaterials } from './calculator';
import type { MaterialFamily } from '../shared/types';

const family: MaterialFamily = {
  id: 'test', category: 'weapon-ascension', names: { 'zh-CN': '测试', 'en-US': 'Test' },
  craftableRarities: [2, 3, 4, 5], materialsByRarity: {},
};

describe('calculateMaterials', () => {
  it('uses only surplus three-star material to craft upward, never downward', () => {
    const result = calculateMaterials(family, { 2: 0, 3: 18, 4: 2, 5: 0 }, { 3: 14, 4: 2 });
    expect(result.availableAfterConversion).toMatchObject({ 2: 0, 3: 15, 4: 3, 5: 0 });
    expect(result.baseCrafted).toMatchObject({ 4: 1 });
    expect(result.baseCrafted[2] ?? 0).toBe(0);
  });

  it('chains lower-rarity material upward through every available tier', () => {
    const result = calculateMaterials(family, { 2: 81 }, {});
    expect(result.availableAfterConversion).toMatchObject({ 2: 0, 3: 0, 4: 0, 5: 3 });
  });

  it('keeps direct material requirements before crafting higher tiers', () => {
    const result = calculateMaterials(family, { 2: 8, 3: 2 }, { 2: 3, 3: 2 });
    expect(result.availableAfterConversion).toMatchObject({ 2: 5, 3: 3 });
    expect(result.baseCrafted).toMatchObject({ 3: 1 });
  });

  it('uses whole-material double-product estimates and retains a final total', () => {
    const result = calculateMaterials(family, { 3: 30 }, {}, 'double_10');
    expect(result.inventory[3]).toBe(30);
    expect(result.baseCrafted[4]).toBe(10);
    expect(result.passiveBonus[4]).toBe(1);
    expect(result.availableAfterConversion).toMatchObject({ 4: 2, 5: 3 });
  });

  it('repeatedly crafts whole refunded materials without a geometric-series estimate', () => {
    const result = calculateMaterials(family, { 3: 36 }, {}, 'refund_25');
    expect(result.passiveBonus[3]).toBe(3);
    expect(result.baseCrafted[4]).toBe(13);
    expect(result.availableAfterConversion).toMatchObject({ 3: 0, 4: 2, 5: 4 });
  });
});
