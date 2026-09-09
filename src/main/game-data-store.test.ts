import { describe, expect, it } from 'vitest';
import { weaponRarityFromSource } from './game-data-store';

describe('weaponRarityFromSource', () => {
  it('classifies the stable 1X101 starter weapon IDs as one-star', () => {
    for (const id of ['11101', '12101', '13101', '14101', '15101']) {
      expect(weaponRarityFromSource(id, 'QUALITY_GREEN')).toBe(1);
    }
  });

  it('keeps other green weapons as two-star', () => {
    expect(weaponRarityFromSource('11201', 'QUALITY_GREEN')).toBe(2);
  });
});
