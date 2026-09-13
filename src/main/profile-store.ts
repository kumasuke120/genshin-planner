import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Locale, UserProfileV1 } from '../shared/types';

const countsSchema = z.partialRecord(z.enum(['2', '3', '4', '5']), z.number().int().nonnegative());
const talentLevelsSchema = z.object({ normal: z.number().int().min(1).max(10), skill: z.number().int().min(1).max(10), burst: z.number().int().min(1).max(10) });
const targetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weapon'), weaponId: z.string().min(1), currentPhase: z.number().int().min(0).max(6), targetPhase: z.number().int().min(0).max(6) }),
  z.object({ type: z.literal('talent'), characterId: z.string().min(1), current: talentLevelsSchema, target: talentLevelsSchema }),
  z.object({ type: z.literal('manual'), materialFamilyId: z.string().min(1), required: countsSchema })
]);
const savedPlanSchema = z.object({ id: z.string().min(1), name: z.string().min(1).max(100), target: targetSchema, craftingCharacterId: z.string().min(1).nullable(), createdAt: z.string(), updatedAt: z.string() });
const normalizedPlanName = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase();
const profileSchema = z.object({
  schemaVersion: z.literal(1),
  locale: z.enum(['zh-CN', 'en-US']),
  inventoryByMaterialFamily: z.record(z.string(), countsSchema).default({}),
  savedPlans: z.array(savedPlanSchema).default([]),
  recentPlanIds: z.array(z.string()).default([]),
  updatedAt: z.string(),
  theme: z.enum(['system', 'light', 'dark']).optional().default('system')
}).superRefine((profile, context) => {
  const names = new Set<string>();
  profile.savedPlans.forEach((plan, index) => {
    const normalized = normalizedPlanName(plan.name);
    if (names.has(normalized)) context.addIssue({ code: 'custom', path: ['savedPlans', index, 'name'], message: '方案名称必须唯一' });
    names.add(normalized);
  });
});

/**
 * 创建尚未落盘的新用户档案
 * @param locale Electron 返回的系统语言
 * @param now 用于生成更新时间的当前时间
 * @returns 带默认外观和空方案集合的用户档案
 */
export function createDefaultProfile(locale: string, now = new Date()): UserProfileV1 {
  return { schemaVersion: 1, locale: locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US', inventoryByMaterialFamily: {}, savedPlans: [], recentPlanIds: [], updatedAt: now.toISOString(), theme: 'system' };
}

/**
 * 校验外部读取或导入的用户档案，拒绝结构错误和重名方案
 * @param raw 尚未可信的 JSON 数据
 * @returns 校验并补齐兼容字段后的用户档案
 */
export function validateProfile(raw: unknown): UserProfileV1 {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) throw new Error('用户档案格式无效');
  return parsed.data as UserProfileV1;
}

/**
 * 从指定文件读取档案；旧版档案首次读取时先建立幂等备份
 * @param filePath Profile JSON 的绝对路径
 * @param systemLocale Electron 返回的系统语言
 * @returns 校验并补齐兼容字段后的档案
 */
export async function loadProfileFile(filePath: string, systemLocale: string): Promise<UserProfileV1> {
  try {
    const text = await readFile(filePath, 'utf8');
    const raw = JSON.parse(text) as unknown;
    if (raw && typeof raw === 'object' && !('theme' in raw)) {
      // 只为首次读取的旧结构创建固定名称备份，COPYFILE_EXCL 保证重复启动不会覆盖原备份
      const backup = path.join(path.dirname(filePath), 'backups', 'profile-pre-v1.1.0.json');
      await mkdir(path.dirname(backup), { recursive: true });
      try { await copyFile(filePath, backup, constants.COPYFILE_EXCL); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    return validateProfile(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return createDefaultProfile(systemLocale);
    throw error;
  }
}

/**
 * 以同目录临时文件加原子重命名写入用户档案
 * @param filePath Profile JSON 的绝对路径
 * @param profile 待校验并保存的档案
 * @returns 写入完成后的 Promise
 */
export async function saveProfileFile(filePath: string, profile: UserProfileV1): Promise<void> {
  const valid = validateProfile(profile);
  await mkdir(path.dirname(filePath), { recursive: true });
  // 先写入同目录临时文件，再用重命名原子替换，写入失败时原档案保持不变
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify({ ...valid, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  await rename(temporary, filePath);
}

/**
 * 将 Electron locale 约束为应用支持的语言
 * @param locale Electron 返回的系统语言
 * @returns 应用支持的语言标识
 */
export function supportedLocale(locale: string): Locale {
  return locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}
