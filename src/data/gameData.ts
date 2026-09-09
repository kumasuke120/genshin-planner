import fixture from './gameData.fixture.json';
import type { GameDataBundle, MaterialFamily } from '../shared/types';

/** Small JSON-only fallback for tests and a missing development data directory. */
export const builtinGameData = fixture as GameDataBundle;
export const materialFamilies = builtinGameData.materialFamilies;
export const weapons = builtinGameData.weapons;
export const characters = builtinGameData.characters;
export const craftingCharacters = builtinGameData.craftingCharacters;

export function familyById(id: string): MaterialFamily {
  const family = materialFamilies.find((item) => item.id === id);
  if (!family) throw new Error(`Unknown material family: ${id}`);
  return family;
}
