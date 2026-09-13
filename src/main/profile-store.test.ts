import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultProfile, loadProfileFile, saveProfileFile, supportedLocale, validateProfile } from './profile-store';

const temporaryDirectories: string[] = [];
const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'genshin-planner-profile-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('profile store', () => {
  it('creates localized defaults for a missing file', async () => {
    const directory = await createTemporaryDirectory();
    const profile = await loadProfileFile(path.join(directory, 'profile.json'), 'zh-CN');
    expect(profile.locale).toBe('zh-CN');
    expect(profile.theme).toBe('system');
    expect(createDefaultProfile('en-US', new Date('2026-01-01T00:00:00Z')).locale).toBe('en-US');
    expect(supportedLocale('zh-TW')).toBe('zh-CN');
  });

  it('backs up a v1.0 profile before applying compatible defaults', async () => {
    const directory = await createTemporaryDirectory();
    const file = path.join(directory, 'profile.json');
    const legacy = { ...createDefaultProfile('zh-CN'), theme: undefined };
    delete legacy.theme;
    await writeFile(file, JSON.stringify(legacy), 'utf8');

    const loaded = await loadProfileFile(file, 'en-US');
    expect(loaded.theme).toBe('system');
    expect(JSON.parse(await readFile(path.join(directory, 'backups', 'profile-pre-v1.1.0.json'), 'utf8'))).toEqual(legacy);
    await loadProfileFile(file, 'en-US');
  });

  it('atomically saves and reloads a valid profile', async () => {
    const directory = await createTemporaryDirectory();
    const file = path.join(directory, 'profile.json');
    const profile = { ...createDefaultProfile('en-US'), theme: 'dark' as const };
    await saveProfileFile(file, profile);
    expect((await loadProfileFile(file, 'zh-CN')).theme).toBe('dark');
  });

  it('rejects invalid data and duplicate normalized plan names', () => {
    expect(() => validateProfile({ schemaVersion: 2 })).toThrow('用户档案格式无效');
    const base = createDefaultProfile('zh-CN');
    const target = { type: 'manual' as const, materialFamilyId: 'sample', required: {} };
    const first = { id: '1', name: '计划', target, craftingCharacterId: null, createdAt: 'x', updatedAt: 'x' };
    expect(() => validateProfile({ ...base, savedPlans: [first, { ...first, id: '2', name: ' 计划 ' }] })).toThrow('用户档案格式无效');
  });

  it('rejects malformed JSON instead of replacing it', async () => {
    const directory = await createTemporaryDirectory();
    const file = path.join(directory, 'profile.json');
    await writeFile(file, '{broken', 'utf8');
    await expect(loadProfileFile(file, 'zh-CN')).rejects.toThrow();
  });
});
