import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { UserProfileV1 } from '../../src/shared/types';

async function writeTestProfile(userData: string, overrides: Partial<UserProfileV1> = {}): Promise<void> {
  const now = new Date().toISOString();
  await writeFile(path.join(userData, 'profile.json'), JSON.stringify({
    schemaVersion: 1,
    locale: 'zh-CN',
    inventoryByMaterialFamily: {},
    savedPlans: [],
    recentPlanIds: [],
    updatedAt: now,
    theme: 'system',
    ...overrides
  } satisfies UserProfileV1), 'utf8');
}

function expectVisual(screenshot: Buffer, snapshot: string): void {
  // 截图基线仅保存在本地；CI 验证同一视觉流程能够生成非空 PNG
  if (process.env.CI) {
    expect(screenshot.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(screenshot.length).toBeGreaterThan(10_000);
    return;
  }
  expect(screenshot).toMatchSnapshot(snapshot);
}

test('应用可以在隔离数据目录中启动并切换主要页面', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'genshin-planner-e2e-'));
  await writeTestProfile(userData);
  const application = await electron.launch({
    args: ['.'],
    env: { ...process.env, GENSHIN_PLANNER_E2E: '1', GENSHIN_PLANNER_USER_DATA: userData }
  });

  try {
    const page = await application.firstWindow();
    await expect(page.getByText('原神养成规划器')).toBeVisible();
    await page.getByRole('button', { name: '手动计算' }).click();
    await expect(page.locator('.calculator-page')).toBeVisible();
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test('缺少游戏资料的方案先解释原因再由用户决定是否更新', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'genshin-planner-missing-data-e2e-'));
  const now = new Date().toISOString();
  await writeTestProfile(userData, {
    savedPlans: [{
      id: 'future-character-plan',
      name: '未来角色计划',
      target: { type: 'talent', characterId: 'missing-character', current: { normal: 1, skill: 1, burst: 1 }, target: { normal: 9, skill: 9, burst: 9 } },
      craftingCharacterId: null,
      createdAt: now,
      updatedAt: now
    }],
    recentPlanIds: ['future-character-plan'],
    updatedAt: now
  });
  const application = await electron.launch({
    args: ['.'],
    env: { ...process.env, GENSHIN_PLANNER_E2E: '1', GENSHIN_PLANNER_USER_DATA: userData }
  });

  try {
    const page = await application.firstWindow();
    await page.getByRole('button', { name: /未来角色计划/ }).click();
    const dialog = page.getByRole('alertdialog', { name: '暂时无法打开方案' });
    await expect(dialog).toContainText('所需资料尚未下载');
    await dialog.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('alertdialog', { name: '暂时无法打开方案' })).toBeHidden();
    await page.getByRole('button', { name: /未来角色计划/ }).click();
    await page.getByRole('alertdialog', { name: '暂时无法打开方案' }).getByRole('button', { name: '前往同步' }).click();
    await expect(page.getByRole('button', { name: '游戏资料', exact: true })).toHaveClass(/selected/);
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test('@visual 主要工作区在桌面视口保持稳定', async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'genshin-planner-visual-'));
  await writeTestProfile(userData);
  const application = await electron.launch({
    args: ['.'],
    env: { ...process.env, GENSHIN_PLANNER_E2E: '1', GENSHIN_PLANNER_VISUAL: '1', GENSHIN_PLANNER_USER_DATA: userData }
  });

  try {
    const page = await application.firstWindow();
    await expect(page.getByText('原神养成规划器')).toBeVisible();
    for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      const overviewWorkspace = page.locator('.overview-workspace');
      await expect(overviewWorkspace).toBeVisible();
      expect(
        await overviewWorkspace.evaluate((element) => element.scrollHeight <= element.clientHeight),
      ).toBe(true);
      const screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
      expectVisual(screenshot, `overview-${viewport.width}x${viewport.height}.png`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const navigation = page.getByRole('navigation');
    for (const section of [
      { name: '角色天赋', snapshot: 'talent-1440x900.png' },
      { name: '武器突破', snapshot: 'weapon-1440x900.png' },
      { name: '手动计算', snapshot: 'manual-1440x900.png' }
    ]) {
      await navigation.getByRole('button', { name: section.name }).click();
      await expect(page.locator('.calculator-page')).toBeVisible();
      expectVisual(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }), section.snapshot);
    }
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByRole('button', { name: '游戏资料' }).click();
    await expect(page.locator('.data-page')).toBeVisible();
    expectVisual(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }), 'game-data-1440x900.png');
    await page.getByRole('button', { name: '显示与语言' }).click();
    await page.getByRole('button', { name: '深色' }).click();
    expectVisual(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }), 'settings-dark-1440x900.png');
    await navigation.getByRole('button', { name: '总览' }).click();
    expectVisual(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }), 'overview-dark-1440x900.png');
    await navigation.getByRole('button', { name: '角色天赋' }).click();
    expectVisual(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }), 'talent-dark-1440x900.png');
    await page.locator('.calculator-page .entity-picker .picker-trigger').first().click();
    await expect(page.getByRole('dialog', { name: '角色' })).toBeVisible();
    expectVisual(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }), 'character-picker-dark-1440x900.png');
    await page.getByRole('dialog', { name: '角色' }).getByRole('button', { name: '关闭' }).click();
    await page.getByRole('button', { name: '保存方案' }).click();
    await expect(page.getByRole('dialog', { name: '保存方案' })).toBeVisible();
    expectVisual(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }), 'save-dialog-dark-1440x900.png');
  } finally {
    await application.close();
    await rm(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
