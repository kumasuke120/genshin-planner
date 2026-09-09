import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import i18n from './i18n';
import type { UserProfileV1 } from '../shared/types';
import { builtinGameData } from '../data/gameData';

const profile: UserProfileV1 = { schemaVersion: 1, locale: 'zh-CN', inventoryByMaterialFamily: {}, savedPlans: [], recentPlanIds: [], updatedAt: new Date().toISOString() };

describe('planner interface', () => {
  afterEach(cleanup);
  beforeEach(() => {
    i18n.changeLanguage('zh-CN');
    window.desktopApi = {
      loadProfile: vi.fn().mockResolvedValue(profile), saveProfile: vi.fn().mockResolvedValue(undefined), exportProfile: vi.fn().mockResolvedValue(true), importProfile: vi.fn().mockResolvedValue(null),
      loadGameData: vi.fn().mockResolvedValue(builtinGameData), getGameDataStatus: vi.fn().mockResolvedValue({ manifest: builtinGameData.manifest, source: 'builtin', counts: { characters: 6, weapons: 3, talentMaterials: 24, weaponMaterials: 8, icons: 0 } }),
      syncGameData: vi.fn(), cancelGameDataSync: vi.fn(), importGameData: vi.fn(), exportGameData: vi.fn(), restoreBuiltinGameData: vi.fn(), openExternal: vi.fn(), iconUrl: vi.fn().mockReturnValue(''), onGameDataProgress: vi.fn().mockReturnValue(() => {})
    };
  });

  it('matches a crafting character passive', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    expect(document.title).toBe('原神养成材料规划器');
    await user.click(screen.getByRole('button', { name: '手动计算' }));
    await user.click(screen.getByRole('button', { name: '不使用角色' }));
    await user.click(screen.getByRole('button', { name: /行秋.*返还部分合成材料/ }));
    expect(screen.getByText(/合成角色天赋素材时/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('语言'), 'en-US');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manual Calculation' })).toBeInTheDocument());
    expect(document.title).toBe('Genshin Material Planner');
  });

  it('provides Chinese and English resources', async () => {
    await i18n.changeLanguage('en-US');
    expect(i18n.t('manual')).toBe('Manual Calculation');
  });

  it('opens a material family in manual calculation', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    const materialEntry = await screen.findByText('「繁荣」系列');
    await user.click(materialEntry.closest('button')!);

    expect(screen.getByRole('heading', { name: '手动计算' })).toBeInTheDocument();
    expect((screen.getByLabelText('材料系列') as HTMLSelectElement).value).toBe('prosperity');
    expect(within(screen.getByRole('group', { name: '材料类别' })).getByRole('button', { name: '角色天赋' })).toHaveClass('selected');
  });

  it('opens the weapon picker and applies a selected weapon', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    const trigger = screen.getByRole('button', { name: '西风剑' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '武器' });
    expect(within(dialog).getByRole('button', { name: '笛剑' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '笛剑' }));
    expect(screen.queryByRole('dialog', { name: '武器' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '笛剑' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a one-star weapon visible through the weapon rarity filter', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    await user.click(screen.getByRole('button', { name: '西风剑' }));
    const dialog = screen.getByRole('dialog', { name: '武器' });
    await user.click(within(dialog).getByRole('button', { name: '1★' }));
    expect(within(dialog).getByRole('button', { name: '训练大剑' })).toBeVisible();
  });

  it('opens the character picker, filters it, and selects a character', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '角色天赋' }));
    await user.click(screen.getByRole('button', { name: '行秋' }));
    const dialog = screen.getByRole('dialog', { name: '角色' });
    await user.click(within(dialog).getByRole('button', { name: '冰' }));
    expect(within(dialog).getByRole('button', { name: '优菈' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '优菈' }));
    expect(screen.queryByRole('dialog', { name: '角色' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '优菈' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('saves through an editable in-app dialog', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    await user.click(screen.getByRole('button', { name: '保存方案' }));
    const dialog = screen.getByRole('dialog', { name: '保存方案' });
    const input = within(dialog).getByLabelText('方案名称');
    expect(input).toHaveValue('「西风剑」突破方案');
    await user.clear(input);
    await user.type(input, '我的武器计划');
    await user.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(window.desktopApi?.saveProfile).toHaveBeenCalled(), { timeout: 1_000 });
    expect(screen.queryByRole('dialog', { name: '保存方案' })).not.toBeInTheDocument();
    expect(screen.getByText('当前方案：我的武器计划')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
  });

  it('uses compact rarity deficits and does not repeat a material subtitle', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    expect(screen.queryByText('高塔孤王')).not.toBeInTheDocument();
    expect(screen.getByText('缺少素材')).toBeInTheDocument();
    expect(document.querySelectorAll('.deficit-tag')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: '保存方案' })).toHaveClass('save-plan-button');
  });

  it('replaces a zero inventory value when entering a material count', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    const input = screen.getByLabelText('库存 高塔孤王的破瓦 2★');
    await user.click(input);
    await user.type(input, '9');
    expect(input).toHaveValue(9);
  });

  it('keeps picker dimensions stable and provides the no-bonus crafting option', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    await user.click(screen.getByRole('button', { name: '西风剑' }));
    const weaponDialog = screen.getByRole('dialog', { name: '武器' });
    expect(weaponDialog).toHaveClass('stable-picker-dialog');
    await user.click(within(weaponDialog).getByRole('button', { name: '1★' }));
    expect(weaponDialog).toHaveClass('stable-picker-dialog');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '手动计算' }));
    await user.click(screen.getByRole('button', { name: '不使用角色' }));
    const craftingDialog = screen.getByRole('dialog', { name: '合成角色' });
    expect(within(craftingDialog).getByRole('button', { name: /不使用角色.*无加成/ })).toBeVisible();
  });

  it('shows an enlarged material preview on hover', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    await user.hover(screen.getByRole('button', { name: '预览 高塔孤王的破瓦' }));
    expect(document.querySelector('.material-preview-card')).toHaveTextContent('高塔孤王的破瓦');
  });

  it('shows a crafting character expectation in manual calculation', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '手动计算' }));
    const guideInventory = screen.getByLabelText('库存 「繁荣」的指引 3★');
    await user.clear(guideInventory);
    await user.type(guideInventory, '30');
    await user.click(screen.getByRole('button', { name: '不使用角色' }));
    const dialog = screen.getByRole('dialog', { name: '合成角色' });
    await user.click(within(dialog).getByRole('button', { name: /优菈.*双倍产物/ }));
    expect(screen.getByText('合成 +10')).toBeVisible();
    expect(screen.getByText('被动 +1')).toBeVisible();
    expect(screen.getAllByText('被动 +0')).not.toHaveLength(0);
  });

  it('updates an opened plan instead of creating a new one', async () => {
    const user = userEvent.setup();
    const savedPlan = { id: 'saved-weapon-plan', name: '「西风剑」突破方案', target: { type: 'weapon' as const, weaponId: 'favonius-sword', currentPhase: 0, targetPhase: 6 }, craftingCharacterId: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({ ...profile, savedPlans: [savedPlan], recentPlanIds: [savedPlan.id] });
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(screen.getByRole('button', { name: /「西风剑」突破方案/ }));
    expect(screen.getByText('当前方案：「西风剑」突破方案')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.queryByRole('dialog', { name: '保存方案' })).not.toBeInTheDocument();
    await waitFor(() => expect(window.desktopApi?.saveProfile).toHaveBeenCalled());
    const latestProfile = (window.desktopApi!.saveProfile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as UserProfileV1;
    expect(latestProfile.savedPlans).toHaveLength(1);
    expect(latestProfile.savedPlans[0].id).toBe(savedPlan.id);
  });

  it('generates the next unique name when saving an opened plan as a new plan', async () => {
    const user = userEvent.setup();
    const savedPlan = { id: 'saved-weapon-plan', name: '「西风剑」突破方案', target: { type: 'weapon' as const, weaponId: 'favonius-sword', currentPhase: 0, targetPhase: 6 }, craftingCharacterId: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
    const currentTargetPlan = { ...savedPlan, id: 'current-weapon-plan', name: '「笛剑」突破方案', target: { ...savedPlan.target, weaponId: 'the-flute' } };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({ ...profile, savedPlans: [savedPlan, currentTargetPlan], recentPlanIds: [savedPlan.id, currentTargetPlan.id] });
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(screen.getByRole('button', { name: /「西风剑」突破方案/ }));
    await user.click(screen.getByRole('button', { name: '西风剑' }));
    await user.click(within(screen.getByRole('dialog', { name: '武器' })).getByRole('button', { name: '笛剑' }));
    await user.click(screen.getByRole('button', { name: '另存为' }));
    await user.click(screen.getByRole('menuitem', { name: '另存为' }));
    const dialog = screen.getByRole('dialog', { name: '保存方案' });
    expect(within(dialog).getByLabelText('方案名称')).toHaveValue('「笛剑」突破方案 (2)');
  });

  it('blocks manually entered duplicate plan names', async () => {
    const user = userEvent.setup();
    const savedPlan = { id: 'saved-weapon-plan', name: '「西风剑」突破方案', target: { type: 'weapon' as const, weaponId: 'favonius-sword', currentPhase: 0, targetPhase: 6 }, craftingCharacterId: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
    window.desktopApi!.loadProfile = vi.fn().mockResolvedValue({ ...profile, savedPlans: [savedPlan], recentPlanIds: [savedPlan.id] });
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    await user.click(screen.getByRole('button', { name: '保存方案' }));
    const dialog = screen.getByRole('dialog', { name: '保存方案' });
    const input = within(dialog).getByLabelText('方案名称');
    await user.clear(input);
    await user.type(input, '「西风剑」突破方案');
    expect(within(dialog).getByText('方案名称已存在。')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('disables saving only for weapons without ascension materials', async () => {
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><App /></I18nextProvider>);
    await screen.findByText('原神养成材料规划器');
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: '武器突破' }));
    await user.click(screen.getByRole('button', { name: '西风剑' }));
    const dialog = screen.getByRole('dialog', { name: '武器' });
    await user.click(within(dialog).getByRole('button', { name: '1★' }));
    await user.click(within(dialog).getByRole('button', { name: '训练大剑' }));
    expect(screen.getByRole('button', { name: '保存方案' })).toBeDisabled();
  });
});
