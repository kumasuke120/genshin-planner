import { describe, expect, it } from 'vitest';
import { familyById, materialFamilies } from './gameData';

describe('built-in game data access', () => {
  it('returns a material family by its stable id', () => {
    expect(familyById(materialFamilies[0].id)).toBe(materialFamilies[0]);
  });

  it('rejects an unknown material family id', () => {
    expect(() => familyById('missing-family')).toThrow('Unknown material family');
  });
});
