import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspace = path.resolve(import.meta.dirname, '..');
const destination = path.join(workspace, 'resources', 'game-data', 'builtin');
const staging = path.join(workspace, 'out', 'game-data', 'builtin-sample');
const expectedDestination = path.join(workspace, 'resources', 'game-data', 'builtin');

if (destination !== expectedDestination || !path.relative(workspace, destination).startsWith(`resources${path.sep}`)) {
  throw new Error(`拒绝替换未经验证的内置资料目录：${destination}`);
}

const sourceFile = process.env.GENSHIN_PLANNER_FULL_DATA
  ? path.resolve(process.env.GENSHIN_PLANNER_FULL_DATA)
  : path.join(destination, 'bundle.json');
const source = JSON.parse(await readFile(sourceFile, 'utf8'));
const characterIds = new Set(['10000002']);
const weaponIds = new Set(['11101', '11201', '11301', '11402', '11509']);
const characters = source.characters.filter((item) => characterIds.has(item.id));
const weapons = source.weapons.filter((item) => weaponIds.has(item.id));
const familyIds = new Set([
  ...characters.map((item) => item.talentMaterialFamilyId),
  ...weapons.map((item) => item.materialFamilyId).filter(Boolean)
]);
const materialFamilies = source.materialFamilies.filter((item) => familyIds.has(item.id));

if (characters.length !== characterIds.size || weapons.length !== weaponIds.size || materialFamilies.length !== familyIds.size) {
  throw new Error('完整资料中缺少示例对象或其素材关系，拒绝生成不完整的内置资料');
}

const stripIcon = (item) => {
  const result = { ...item };
  delete result.iconId;
  return result;
};
const bundle = {
  manifest: { ...source.manifest, provider: 'builtin', gameDataVersion: 'builtin-sample-v1', generatedAt: new Date().toISOString() },
  characters: characters.map(stripIcon),
  weapons: weapons.map(stripIcon),
  materialFamilies: materialFamilies.map((family) => ({
    ...family,
    materialsByRarity: Object.fromEntries(Object.entries(family.materialsByRarity).map(([rarity, material]) => [rarity, stripIcon(material)]))
  })),
  craftingCharacters: source.craftingCharacters.map(stripIcon)
};

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await writeFile(path.join(staging, 'bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
await rm(destination, { recursive: true, force: true });
await mkdir(path.dirname(destination), { recursive: true });
await rename(staging, destination);

process.stdout.write(`Generated built-in sample: ${characters.length} character, ${weapons.length} weapons, ${materialFamilies.length} material families\n`);
