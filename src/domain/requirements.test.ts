import { describe, expect, it } from 'vitest';
import { talentRequirements, weaponRequirement } from './requirements';
import type { Weapon } from '../shared/types';

describe('requirement aggregation', () => {
  it('sums only weapon ascension transitions after the current phase', () => {
    const weapon: Weapon = { id: 'test', names: { 'zh-CN': '测试', 'en-US': 'Test' }, materialFamilyId: 'test', phaseRequirements: { 1: { 2: 3 }, 2: { 3: 2 }, 3: { 4: 4 } } };
    expect(weaponRequirement(weapon, 1, 3)).toMatchObject({ 2: 0, 3: 2, 4: 4 });
    expect(weaponRequirement(weapon, 3, 3)).toEqual({});
  });

  it('sums the three requested talent intervals', () => {
    expect(talentRequirements({ normal: 1, skill: 1, burst: 1 }, { normal: 2, skill: 3, burst: 1 })).toMatchObject({ 2: 6, 3: 2, 4: 0 });
  });
});
