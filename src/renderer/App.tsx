import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import { Archive, BookOpen, Calculator, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, Languages, RefreshCw, RotateCcw, Save, Settings, Sparkles, Sword, Trash2, Upload, X, XCircle } from 'lucide-react';
import { builtinGameData } from '../data/gameData';
import { calculateMaterials } from '../domain/calculator';
import { talentRequirements, weaponRequirement } from '../domain/requirements';
import type { Character, CharacterElement, CountsByRarity, CraftingCharacter, DataSyncProgress, GameDataBundle, GameDataStatus, Locale, MaterialCategory, MaterialFamily, MaterialRarity, PlanTarget, SavedPlan, TalentLevels, UserProfileV1, Weapon, WeaponType } from '../shared/types';

type Page = 'overview' | 'weapon' | 'talent' | 'manual' | 'settings';
type SettingsTab = 'plans' | 'game-data' | 'about';

const rarities = [2, 3, 4, 5] as const;
const emptyProfile = (): UserProfileV1 => ({ schemaVersion: 1, locale: 'zh-CN', inventoryByMaterialFamily: {}, savedPlans: [], recentPlanIds: [], updatedAt: new Date().toISOString() });
const numberValue = (value: string) => Math.max(0, Math.floor(Number(value) || 0));
const fixedDateTime = (value: string) => { const date = new Date(value); const pad = (number: number) => String(number).padStart(2, '0'); return Number.isNaN(date.getTime()) ? '-' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`; };
const compareStableIdDescending = (left: { id: string }, right: { id: string }) => right.id.padStart(20, '0').localeCompare(left.id.padStart(20, '0'));
const weaponTypeOrder: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
const compareWeaponsByTypeAndId = (left: Weapon, right: Weapon) => (weaponTypeOrder.indexOf(left.type ?? 'catalyst') - weaponTypeOrder.indexOf(right.type ?? 'catalyst')) || compareStableIdDescending(left, right);
const normalizedPlanName = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase();
const uniquePlanName = (baseName: string, existingNames: string[]) => { const normalized = new Set(existingNames.map(normalizedPlanName)); if (!normalized.has(normalizedPlanName(baseName))) return baseName; for (let index = 2; ; index += 1) { const candidate = `${baseName} (${index})`; if (!normalized.has(normalizedPlanName(candidate))) return candidate; } };
const formatMaterialCount = (value: number | undefined): string => {
  const normalized = Math.round((value ?? 0) * 100) / 100;
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2).replace(/0+$/u, '').replace(/\.$/u, '');
};

function isMaterialFamily(item: { names: Record<Locale, string> }): item is MaterialFamily { return 'materialsByRarity' in item; }
function localName(item: { names: Record<Locale, string> }, locale: Locale): string {
  if (locale === 'zh-CN' && isMaterialFamily(item) && item.category === 'talent-book') {
    const firstTier = Object.values(item.materialsByRarity).find(Boolean);
    const match = firstTier?.names['zh-CN'].match(/^「([^」]+)」/u);
    if (match) return match[1];
  }
  return item.names[locale];
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<UserProfileV1>(emptyProfile);
  const [gameData, setGameData] = useState<GameDataBundle>(builtinGameData);
  const [dataStatus, setDataStatus] = useState<GameDataStatus | null>(null);
  const [syncProgress, setSyncProgress] = useState<DataSyncProgress | null>(null);
  const [, setLanguageRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>('overview');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('plans');
  const [familyCategory, setFamilyCategory] = useState<MaterialCategory>('talent-book');
  const [familyPage, setFamilyPage] = useState(0);
  const [weaponId, setWeaponId] = useState('favonius-sword');
  const [characterId, setCharacterId] = useState('xingqiu');
  const [manualFamilyId, setManualFamilyId] = useState('prosperity');
  const [manualCategory, setManualCategory] = useState<MaterialCategory>('talent-book');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [targetPhase, setTargetPhase] = useState(6);
  const [currentLevels, setCurrentLevels] = useState<TalentLevels>({ normal: 1, skill: 1, burst: 1 });
  const [targetLevels, setTargetLevels] = useState<TalentLevels>({ normal: 9, skill: 9, burst: 9 });
  const [manualRequired, setManualRequired] = useState<CountsByRarity>({});
  const [craftingCharacterId, setCraftingCharacterId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveName, setSaveName] = useState<string | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);

  const locale = profile.locale;
  const { characters, craftingCharacters, materialFamilies, weapons } = gameData;
  const familyById = (id: string) => materialFamilies.find((item) => item.id === id) ?? materialFamilies[0];
  const selectedWeapon = weapons.find((weapon) => weapon.id === weaponId) ?? weapons[0];
  const selectedCharacter = characters.find((character) => character.id === characterId) ?? characters[0];
  const family = useMemo<MaterialFamily>(() => {
    if (page === 'weapon') return familyById(selectedWeapon.materialFamilyId ?? materialFamilies.find((item) => item.category === 'weapon-ascension')?.id ?? materialFamilies[0].id);
    if (page === 'talent') return familyById(selectedCharacter.talentMaterialFamilyId);
    return familyById(manualFamilyId);
  }, [page, selectedWeapon.materialFamilyId, selectedCharacter.talentMaterialFamilyId, manualFamilyId]);

  const required = useMemo<CountsByRarity>(() => {
    if (page === 'weapon') return weaponRequirement(selectedWeapon, currentPhase, targetPhase);
    if (page === 'talent') return talentRequirements(currentLevels, targetLevels);
    return manualRequired;
  }, [page, selectedWeapon, currentPhase, targetPhase, currentLevels, targetLevels, manualRequired]);

  const craftingCharacter = craftingCharacters.find((item) => item.id === craftingCharacterId) ?? null;
  const editingPlan = profile.savedPlans.find((item) => item.id === editingPlanId) ?? null;
  const strategy = craftingCharacter?.passive.categories.includes(family.category) ? craftingCharacter.passive.strategy : 'none';
  const inventory = profile.inventoryByMaterialFamily[family.id] ?? {};
  const calculation = useMemo(() => calculateMaterials(family, inventory, required, strategy), [family, inventory, required, strategy]);
  const applicableCraftingCharacters = craftingCharacters.filter((item) => item.passive.categories.includes(family.category));
  const invalidTalentLevel = (['normal', 'skill', 'burst'] as const).some((key) => targetLevels[key] < currentLevels[key]);

  useEffect(() => {
    let cancelled = false;
    const initializeProfile = async () => {
      try {
        const [loaded, loadedData, status] = await Promise.all([window.desktopApi?.loadProfile(), window.desktopApi?.loadGameData(), window.desktopApi?.getGameDataStatus()]);
        if (!loaded || !loadedData || cancelled) return;
        setProfile(loaded);
        setGameData(loadedData);
        setDataStatus(status ?? null);
        setWeaponId((current) => loadedData.weapons.some((item) => item.id === current) ? current : loadedData.weapons[0]?.id ?? current);
        setCharacterId((current) => loadedData.characters.some((item) => item.id === current) ? current : loadedData.characters[0]?.id ?? current);
        setManualFamilyId((current) => loadedData.materialFamilies.some((item) => item.id === current) ? current : loadedData.materialFamilies[0]?.id ?? current);
        await i18n.changeLanguage(loaded.locale);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void initializeProfile();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => window.desktopApi?.onGameDataProgress((progress) => setSyncProgress(progress)), []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => window.desktopApi?.saveProfile(profile).catch(() => setNotice(t('saveFailed'))), 450);
    return () => window.clearTimeout(timer);
  }, [profile, ready, t]);

  useEffect(() => {
    document.title = t('appName');
  }, [locale, t]);

  useEffect(() => {
    if (craftingCharacterId && !applicableCraftingCharacters.some((item) => item.id === craftingCharacterId)) setCraftingCharacterId(null);
  }, [family.category, craftingCharacterId, applicableCraftingCharacters]);

  const updateLocale = (nextLocale: Locale) => {
    setProfile((current) => ({ ...current, locale: nextLocale }));
    void i18n.changeLanguage(nextLocale).then(() => setLanguageRevision((revision) => revision + 1));
  };

  const updateInventory = (rarity: MaterialRarity, value: string) => {
    const count = numberValue(value);
    setProfile((current) => ({ ...current, inventoryByMaterialFamily: { ...current.inventoryByMaterialFamily, [family.id]: { ...(current.inventoryByMaterialFamily[family.id] ?? {}), [rarity]: count } } }));
  };

  const updateManualRequirement = (rarity: MaterialRarity, value: string) => setManualRequired((current) => ({ ...current, [rarity]: numberValue(value) }));

  const buildTarget = (): PlanTarget => {
    if (page === 'weapon') return { type: 'weapon', weaponId, currentPhase, targetPhase };
    if (page === 'talent') return { type: 'talent', characterId, current: currentLevels, target: targetLevels };
    return { type: 'manual', materialFamilyId: manualFamilyId, required: manualRequired };
  };

  const defaultPlanName = () => {
    const defaultName = page === 'weapon'
      ? t('weaponPlanName', { name: localName(selectedWeapon, locale) })
      : page === 'talent'
        ? t('talentPlanName', { name: localName(selectedCharacter, locale) })
        : t('manualPlanName', { name: localName(family, locale) });
    return defaultName;
  };

  const savePlan = (name: string) => {
    if (!name.trim()) return;
    if (profile.savedPlans.some((item) => normalizedPlanName(item.name) === normalizedPlanName(name))) { setNotice(t('duplicatePlanName')); return; }
    const now = new Date().toISOString();
    const plan: SavedPlan = { id: crypto.randomUUID(), name: name.trim(), target: buildTarget(), craftingCharacterId, createdAt: now, updatedAt: now };
    setProfile((current) => ({ ...current, savedPlans: [plan, ...current.savedPlans], recentPlanIds: [plan.id, ...current.recentPlanIds.filter((id) => id !== plan.id)].slice(0, 8) }));
    setEditingPlanId(plan.id);
    setNotice(t('saved'));
  };

  const savePlanChanges = () => {
    if (!editingPlan) return;
    const now = new Date().toISOString();
    setProfile((current) => ({ ...current, savedPlans: current.savedPlans.map((item) => item.id === editingPlan.id ? { ...item, target: buildTarget(), craftingCharacterId, updatedAt: now } : item), recentPlanIds: [editingPlan.id, ...current.recentPlanIds.filter((id) => id !== editingPlan.id)].slice(0, 8) }));
    setNotice(t('planUpdated'));
  };

  const openPlan = (plan: SavedPlan) => {
    setEditingPlanId(plan.id);
    setCraftingCharacterId(plan.craftingCharacterId);
    if (plan.target.type === 'weapon') { setPage('weapon'); setWeaponId(plan.target.weaponId); setCurrentPhase(plan.target.currentPhase); setTargetPhase(plan.target.targetPhase); }
    if (plan.target.type === 'talent') { setPage('talent'); setCharacterId(plan.target.characterId); setCurrentLevels(plan.target.current); setTargetLevels(plan.target.target); }
    if (plan.target.type === 'manual') { setPage('manual'); setManualFamilyId(plan.target.materialFamilyId); setManualRequired(plan.target.required); }
  };

  const openManualFamily = (materialFamily: MaterialFamily) => {
    setEditingPlanId(null);
    setPage('manual');
    setManualCategory(materialFamily.category);
    setManualFamilyId(materialFamily.id);
    setManualRequired({});
  };

  const importProfile = async () => {
    try {
      const imported = await window.desktopApi?.importProfile();
      if (imported) { setProfile(imported); i18n.changeLanguage(imported.locale); setNotice(t('saved')); }
    } catch { setNotice(t('importFailed')); }
  };

  const refreshGameData = async (status?: GameDataStatus | null) => {
    const [bundle, nextStatus] = await Promise.all([window.desktopApi?.loadGameData(), status ? Promise.resolve(status) : window.desktopApi?.getGameDataStatus()]);
    if (bundle) setGameData(bundle);
    setDataStatus(nextStatus ?? null);
  };

  const nav: { page: Exclude<Page, 'settings'>; label: string; icon: typeof Archive }[] = [
    { page: 'overview', label: t('overview'), icon: Archive }, { page: 'weapon', label: t('weapon'), icon: Sword }, { page: 'talent', label: t('talents'), icon: Sparkles }, { page: 'manual', label: t('manual'), icon: Calculator }
  ];
  const startNewPage = (nextPage: Exclude<Page, 'settings'>) => { setEditingPlanId(null); setPage(nextPage); };
  const cannotSaveCurrentWeapon = page === 'weapon' && (!selectedWeapon.materialFamilyId || selectedWeapon.calculationStatus === 'unsupported-source-curve');

  if (!ready) return <div className="loading-screen">{t('loading')}</div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><BookOpen size={23} /><span>{t('appName')}</span></div>
      <nav>{nav.map(({ page: navPage, label, icon: Icon }) => <button key={navPage} className={page === navPage ? 'nav-item active' : 'nav-item'} onClick={() => startNewPage(navPage)}><Icon size={18} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => { setPage('settings'); setSettingsTab('plans'); }}><Settings size={18} />{t('settings')}</button></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div className="crumb">{nav.find((item) => item.page === page)?.label}</div><label className="language"><Languages size={17} /><span>{t('language')}</span><select value={locale} onChange={(event) => updateLocale(event.target.value as Locale)}><option value="zh-CN">中文</option><option value="en-US">English</option></select></label></header>
      {notice && <Notice message={notice} onDismiss={setNotice} />}
      {page === 'overview' && <Overview t={t} locale={locale} plans={profile.savedPlans} families={materialFamilies} category={familyCategory} familyPage={familyPage} onCategory={(category) => { setFamilyCategory(category); setFamilyPage(0); }} onPage={setFamilyPage} onOpen={openPlan} onOpenMaterial={openManualFamily} />}
      {page !== 'overview' && page !== 'settings' && <section className="calculator-page">
        <div className="page-heading"><div><h1>{nav.find((item) => item.page === page)?.label}</h1>{editingPlan ? <p className="editing-plan">{t('currentPlan', { name: editingPlan.name })}</p> : null}{page === 'weapon' && selectedWeapon.calculationStatus === 'unsupported-source-curve' ? <p>{t('unsupportedWeapon')}</p> : null}</div><div className="page-actions"><DeficitSummary t={t} family={family} deficits={calculation.deficits} complete={calculation.isComplete && !invalidTalentLevel} /><div className="save-action-group"><button className="button primary save-plan-button" onClick={() => editingPlan ? savePlanChanges() : setSaveName(uniquePlanName(defaultPlanName(), profile.savedPlans.map((item) => item.name)))} disabled={cannotSaveCurrentWeapon}><Save size={17} />{editingPlan ? t('saveChanges') : t('savePlan')}</button>{editingPlan && <div className="save-menu-area" onMouseEnter={() => setSaveMenuOpen(true)} onMouseLeave={() => window.setTimeout(() => setSaveMenuOpen(false), 150)}><button className="save-menu-trigger" type="button" aria-label={t('saveAs')} aria-haspopup="menu" aria-expanded={saveMenuOpen} onClick={() => setSaveMenuOpen(true)} onFocus={() => setSaveMenuOpen(true)} disabled={cannotSaveCurrentWeapon}><ChevronDown size={16} /></button>{saveMenuOpen && <div className="save-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setSaveName(uniquePlanName(defaultPlanName(), profile.savedPlans.map((item) => item.name))); setSaveMenuOpen(false); }}>{t('saveAs')}</button></div>}</div>}</div></div></div>
        <section className="form-band"><h2>{t('target')}</h2>{page === 'weapon' && <WeaponTarget t={t} locale={locale} weapons={weapons} weaponId={weaponId} currentPhase={currentPhase} targetPhase={targetPhase} onWeapon={setWeaponId} onCurrent={setCurrentPhase} onTarget={setTargetPhase} />}{page === 'talent' && <TalentTarget t={t} locale={locale} characters={characters} characterId={characterId} current={currentLevels} target={targetLevels} onCharacter={setCharacterId} onCurrent={setCurrentLevels} onTarget={setTargetLevels} />}{page === 'manual' && <ManualTarget t={t} locale={locale} families={materialFamilies} category={manualCategory} familyId={manualFamilyId} onCategory={(category) => { setManualCategory(category); setManualFamilyId(materialFamilies.find((item) => item.category === category)!.id); }} onFamily={setManualFamilyId} />}</section>
        {invalidTalentLevel && <p className="validation">{t('invalidLevel')}</p>}
        <MaterialGrid t={t} family={family} locale={locale} inventory={inventory} required={required} calculation={calculation} manual={page === 'manual'} hasPassive={strategy !== 'none'} onInventory={updateInventory} onRequired={updateManualRequirement} />
        <section className="form-band crafting"><div className="form-row"><EntityPicker label={t('craftingCharacter')} items={applicableCraftingCharacters} value={craftingCharacterId} onChange={setCraftingCharacterId} locale={locale} emptyLabel={t('noCraftingCharacter')} /><div className="passive-description"><strong>{craftingCharacter ? localName(craftingCharacter, locale) : t('noCraftingCharacter')}</strong><span>{craftingCharacter ? craftingCharacter.passive.description[locale] : t('noBonus')}</span></div></div><p className="hint">{t('expected')}</p></section>
      </section>}
      {page === 'settings' && <SettingsPage t={t} locale={locale} settingsTab={settingsTab} onTab={setSettingsTab} profile={profile} plans={profile.savedPlans} status={dataStatus} progress={syncProgress} onLocale={updateLocale} onOpen={openPlan} onDelete={(id) => setProfile((current) => ({ ...current, savedPlans: current.savedPlans.filter((plan) => plan.id !== id) }))} onImportPlans={importProfile} onExportPlans={() => window.desktopApi?.exportProfile(profile)} onRefresh={refreshGameData} onError={setNotice} />}
      {saveName !== null && <SavePlanDialog t={t} initialName={saveName} existingNames={profile.savedPlans.map((item) => item.name)} onCancel={() => setSaveName(null)} onSave={(name) => { savePlan(name); setSaveName(null); }} />}
    </main>
  </div>;
}

function DeficitSummary({ t, family, deficits, complete }: { t: TFunction; family: MaterialFamily; deficits: CountsByRarity; complete: boolean }) {
  const entries = family.craftableRarities.filter((rarity) => (deficits[rarity] ?? 0) > 0);
  return <div className={complete ? 'status complete' : 'status missing'}>{complete ? <CheckCircle2 size={18} /> : <XCircle size={18} />}<span className="status-label">{complete ? t('complete') : t('missingMaterials')}</span>{!complete && <span className="deficit-tags">{entries.map((rarity) => <span key={rarity} className={`deficit-tag r${rarity}`}><span>{t('rarity', { count: rarity })}</span><b>x{formatMaterialCount(deficits[rarity])}</b></span>)}</span>}</div>;
}

function Notice({ message, onDismiss }: { message: string; onDismiss: (value: string | null) => void }) {
  useEffect(() => { const timer = window.setTimeout(() => onDismiss(null), 3500); return () => window.clearTimeout(timer); }, [message, onDismiss]);
  return <div className="notice" role="status">{message}</div>;
}

function SavePlanDialog({ t, initialName, existingNames, onCancel, onSave }: { t: TFunction; initialName: string; existingNames: string[]; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const duplicate = existingNames.some((existingName) => normalizedPlanName(existingName) === normalizedPlanName(name));
  return createPortal(<div className="picker-backdrop" onMouseDown={onCancel}><form className="picker-dialog save-dialog" role="dialog" aria-modal="true" aria-label={t('savePlan')} onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (!duplicate) onSave(name); }}><div className="picker-title"><strong>{t('savePlan')}</strong><button type="button" className="icon-button" aria-label={t('close')} onClick={onCancel}>x</button></div><label>{t('planName')}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} />{duplicate && <small className="duplicate-plan-name">{t('duplicatePlanName')}</small>}</label><div className="actions dialog-actions"><button type="button" className="button secondary" onClick={onCancel}>{t('cancelSave')}</button><button className="button primary" disabled={!name.trim() || duplicate}><Save size={17} />{t('confirmSave')}</button></div></form></div>, document.body);
}

function GameIcon({ iconId, label }: { iconId?: string; label: string }) { const source = window.desktopApi?.iconUrl(iconId); return <span className="game-icon" aria-hidden="true">{source ? <img src={source} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : null}<b>{label.slice(0, 1)}</b></span>; }
type PickerItem = Character | CraftingCharacter | Weapon;
function EntityPicker({ label, items, value, onChange, locale, emptyLabel }: { label: string; items: PickerItem[]; value: string | null; onChange: (value: string | null) => void; locale: Locale; emptyLabel?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = items.find((item) => item.id === value) ?? null;
  const filtered = items.filter((item) => `${item.names['zh-CN']} ${item.names['en-US']}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  const choose = (id: string | null) => { onChange(id); setOpen(false); setQuery(''); };
  const crafting = Boolean(emptyLabel);
  return <div className="entity-picker"><span className="picker-label">{label}</span><button type="button" className="picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>{selected ? <><GameIcon iconId={selected.iconId} label={localName(selected, locale)} />{localName(selected, locale)}</> : emptyLabel ?? label}</button>{open && <div className="picker-backdrop" onMouseDown={() => setOpen(false)}><div className="picker-dialog stable-picker-dialog" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && filtered[0]) choose(filtered[0].id); }}><div className="picker-title"><strong>{label}</strong><button type="button" className="icon-button" aria-label={t('close')} onClick={() => setOpen(false)}>x</button></div><input ref={searchRef} className="picker-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search', { label })} aria-label={t('search', { label })} />{emptyLabel && <button type="button" className="picker-option none-option" onClick={() => choose(null)}><span className="empty-character-icon" aria-hidden="true"><X size={20} /></span><span><strong>{emptyLabel}</strong><small>{t('noBonus')}</small></span></button>}<div className={crafting ? 'picker-options crafting-options' : 'picker-options'}>{filtered.map((item) => <button type="button" className={item.id === value ? 'picker-option selected' : 'picker-option'} key={item.id} onClick={() => choose(item.id)}><GameIcon iconId={item.iconId} label={localName(item, locale)} /><span><strong>{localName(item, locale)}</strong>{crafting && 'passive' in item ? <small>{item.passive.description[locale]}</small> : null}</span></button>)}{filtered.length === 0 && <p className="empty">{t('noResults')}</p>}</div></div></div>}</div>;
}
const assetIcon = (name: string) => window.desktopApi?.iconUrl(`filter-${name}`) || `https://api.lunaris.moe/data/assets/icons/${name}.webp`;
const elementFilters: Array<{ id: CharacterElement; zh: string; en: string; asset: string }> = [
  { id: 'pyro', zh: '火', en: 'Pyro', asset: 'pyro' }, { id: 'hydro', zh: '水', en: 'Hydro', asset: 'hydro' }, { id: 'anemo', zh: '风', en: 'Anemo', asset: 'anemo' }, { id: 'electro', zh: '雷', en: 'Electro', asset: 'electro' }, { id: 'dendro', zh: '草', en: 'Dendro', asset: 'dendro' }, { id: 'cryo', zh: '冰', en: 'Cryo', asset: 'cryo' }, { id: 'geo', zh: '岩', en: 'Geo', asset: 'geo' }
];
const weaponFilters: Array<{ id: WeaponType; zh: string; en: string; asset: string }> = [
  { id: 'sword', zh: '单手剑', en: 'Sword', asset: 'sword' }, { id: 'claymore', zh: '双手剑', en: 'Claymore', asset: 'claymore' }, { id: 'polearm', zh: '长柄武器', en: 'Polearm', asset: 'polearm' }, { id: 'bow', zh: '弓', en: 'Bow', asset: 'bow' }, { id: 'catalyst', zh: '法器', en: 'Catalyst', asset: 'catalyst' }
];
function TargetPicker({ label, kind, items, value, onChange, locale }: { label: string; kind: 'character' | 'weapon'; items: Character[] | Weapon[]; value: string; onChange: (value: string) => void; locale: Locale }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [attribute, setAttribute] = useState<CharacterElement | WeaponType | 'all'>('all');
  const [rarity, setRarity] = useState<number | 'all'>('all');
  const [nameTooltip, setNameTooltip] = useState<{ name: string; left: number; top: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = items.find((item) => item.id === value);
  const orderedItems = [...items].sort(kind === 'weapon' ? (left, right) => compareWeaponsByTypeAndId(left as Weapon, right as Weapon) : compareStableIdDescending);
  const filters = kind === 'character' ? elementFilters : weaponFilters;
  const rareOptions = kind === 'character' ? [4, 5] : [1, 2, 3, 4, 5];
  const filtered = orderedItems.filter((item) => {
    const matchesSearch = `${item.names['zh-CN']} ${item.names['en-US']}`.toLowerCase().includes(query.trim().toLowerCase());
    const itemAttribute = kind === 'character' ? (item as Character).element : (item as Weapon).type;
    return matchesSearch && (attribute === 'all' || itemAttribute === attribute) && (rarity === 'all' || item.rarity === rarity);
  });
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  const labelFor = (filter: { zh: string; en: string }) => locale === 'zh-CN' ? filter.zh : filter.en;
  const showNameTooltip = (name: string, element: HTMLElement) => { const rect = element.getBoundingClientRect(); setNameTooltip({ name, left: Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2)), top: rect.bottom + 7 }); };
  const close = () => { setOpen(false); setNameTooltip(null); };
  const dialog = <div className="picker-backdrop" onMouseDown={close}><div className="picker-dialog target-picker-dialog stable-picker-dialog" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}><div className="picker-title"><strong>{label}</strong><button type="button" className="icon-button" aria-label={t('close')} onClick={close}>x</button></div><input ref={searchRef} className="picker-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search', { label })} aria-label={t('search', { label })} /><div className="picker-filters"><div className="icon-filter-group"><button className={attribute === 'all' ? 'filter-icon selected tooltip' : 'filter-icon tooltip'} aria-label={t('all')} data-tooltip={t('all')} onClick={() => setAttribute('all')}>{t('all')}</button>{filters.map(({ id, asset, ...filter }) => <button key={id} className={attribute === id ? 'filter-icon selected tooltip' : 'filter-icon tooltip'} aria-label={labelFor(filter)} data-tooltip={labelFor(filter)} onClick={() => setAttribute(id)}><img src={assetIcon(asset)} alt="" /></button>)}</div><div className="rarity-filter-group"><button className={rarity === 'all' ? 'selected' : ''} onClick={() => setRarity('all')}>{t('all')}</button>{rareOptions.map((value) => <button key={value} className={rarity === value ? 'selected' : ''} onClick={() => setRarity(value)}>{t('rarity', { count: value })}</button>)}</div></div><p className="filter-summary">{t('filter')}: {attribute === 'all' ? t('all') : labelFor(filters.find((item) => item.id === attribute)!) } · {rarity === 'all' ? t('all') : t('rarity', { count: rarity })}</p><div className="picker-options target-options">{filtered.map((item) => { const name = localName(item, locale); return <button type="button" className={item.id === value ? 'picker-option selected' : 'picker-option'} key={item.id} onMouseEnter={(event) => showNameTooltip(name, event.currentTarget)} onMouseLeave={() => setNameTooltip(null)} onFocus={(event) => showNameTooltip(name, event.currentTarget)} onBlur={() => setNameTooltip(null)} onClick={() => { onChange(item.id); close(); setQuery(''); }}><GameIcon iconId={item.iconId} label={name} /><span><strong>{name}</strong></span></button>; })}{filtered.length === 0 && <p className="empty">{t('noResults')}</p>}</div></div></div>;
  return <div className="entity-picker"><span className="picker-label">{label}</span><button type="button" className="picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>{selected && <><GameIcon iconId={selected.iconId} label={localName(selected, locale)} />{localName(selected, locale)}</>}</button>{open && createPortal(dialog, document.body)}{nameTooltip && createPortal(<span className="target-name-tooltip" style={{ left: nameTooltip.left, top: nameTooltip.top }} role="tooltip">{nameTooltip.name}</span>, document.body)}</div>;
}
function Overview({ t, locale, plans, families, category, familyPage, onCategory, onPage, onOpen, onOpenMaterial }: { t: TFunction; locale: Locale; plans: SavedPlan[]; families: MaterialFamily[]; category: MaterialCategory; familyPage: number; onCategory: (category: MaterialCategory) => void; onPage: (page: number) => void; onOpen: (plan: SavedPlan) => void; onOpenMaterial: (family: MaterialFamily) => void }) {
  const pageSize = 8;
  const filtered = families.filter((family) => family.category === category);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(familyPage, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <section className="overview"><div className="page-heading"><div><h1>{t('overview')}</h1><p>{t('chooseTarget')}</p></div></div><div className="overview-grid"><div className="overview-section"><h2>{t('recent')}</h2>{plans.slice(0, 5).map((plan) => <button className="plan-row" key={plan.id} onClick={() => onOpen(plan)}><span>{plan.name}</span><small>{new Intl.DateTimeFormat(locale).format(new Date(plan.updatedAt))}</small></button>)}{plans.length === 0 && <p className="empty">{t('noPlans')}</p>}</div><div className="overview-section"><div className="section-heading"><h2>{t('materialFamily')}</h2><div className="compact-tabs"><button className={category === 'talent-book' ? 'selected' : ''} onClick={() => onCategory('talent-book')}>{t('overviewTalentTab')}</button><button className={category === 'weapon-ascension' ? 'selected' : ''} onClick={() => onCategory('weapon-ascension')}>{t('overviewWeaponTab')}</button></div></div>{visible.map((item) => <button className="family-row" key={item.id} onClick={() => onOpenMaterial(item)}><span className="family-name"><GameIcon iconId={item.materialsByRarity[item.craftableRarities[0]]?.iconId} label={localName(item, locale)} />{locale === 'zh-CN' ? `「${localName(item, locale)}」${t('series')}` : localName(item, locale)}</span><span className="rarity-dots">{item.craftableRarities.map((rarity) => <i className={`rarity r${rarity}`} key={rarity}>{rarity}</i>)}</span></button>)}<Pagination page={currentPage} pageCount={pageCount} onPage={onPage} /></div></div></section>;
}
function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) { return <div className="pagination"><button aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></button><span>{page + 1} / {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></button></div>; }
function SettingsPage({ t, settingsTab, onTab, plans, status, progress, onOpen, onDelete, onImportPlans, onExportPlans, onRefresh, onError }: { t: TFunction; locale: Locale; settingsTab: SettingsTab; onTab: (tab: SettingsTab) => void; profile: UserProfileV1; plans: SavedPlan[]; status: GameDataStatus | null; progress: DataSyncProgress | null; onLocale: (locale: Locale) => void; onOpen: (plan: SavedPlan) => void; onDelete: (id: string) => void; onImportPlans: () => void; onExportPlans: () => void; onRefresh: (status?: GameDataStatus | null) => Promise<void>; onError: (message: string | null) => void }) {
  const tabs: { id: SettingsTab; label: string }[] = [{ id: 'plans', label: t('myPlans') }, { id: 'game-data', label: t('gameData') }, { id: 'about', label: t('about') }];
  return <section className="plans-page settings-page"><div className="page-heading"><div><h1>{t('settings')}</h1></div></div><div className="settings-tabs">{tabs.map((tab) => <button key={tab.id} className={settingsTab === tab.id ? 'selected' : ''} onClick={() => onTab(tab.id)}>{tab.label}</button>)}</div>{settingsTab === 'plans' && <PlanManager t={t} plans={plans} onOpen={onOpen} onDelete={onDelete} onImport={onImportPlans} onExport={onExportPlans} />}{settingsTab === 'game-data' && <GameDataPage t={t} status={status} progress={progress} onRefresh={onRefresh} onError={onError} />}{settingsTab === 'about' && <div className="settings-panel about-panel"><h2>{t('appName')}</h2><p>{t('aboutText')}</p><dl><div><dt>{t('version')}</dt><dd>{__APP_VERSION__}</dd></div><div><dt>{t('author')}</dt><dd>{__APP_AUTHOR__}</dd></div><div><dt>{t('build')}</dt><dd>{__BUILD_ID__}</dd></div></dl></div>}</section>;
}
function PlanManager({ t, plans, onOpen, onDelete, onImport, onExport }: { t: TFunction; plans: SavedPlan[]; onOpen: (plan: SavedPlan) => void; onDelete: (id: string) => void; onImport: () => void; onExport: () => void }) { const [query, setQuery] = useState(''); const [page, setPage] = useState(0); const filtered = plans.filter((plan) => plan.name.toLowerCase().includes(query.toLowerCase())); const pageCount = Math.max(1, Math.ceil(filtered.length / 10)); const current = Math.min(page, pageCount - 1); const visible = filtered.slice(current * 10, current * 10 + 10); return <div className="settings-panel"><div className="plan-tools"><div className="actions"><button className="button secondary" onClick={onImport}><Upload size={17} />{t('importPlans')}</button><button className="button secondary" onClick={onExport}><Download size={17} />{t('exportPlans')}</button></div><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={t('searchPlans')} aria-label={t('searchPlans')} /></div>{visible.length ? <div className="plans-list">{visible.map((plan) => <article key={plan.id}><button className="plan-main" onClick={() => onOpen(plan)}><strong>{plan.name}</strong><span>{new Date(plan.updatedAt).toLocaleString()}</span></button><button className="icon-button danger" onClick={() => onDelete(plan.id)} aria-label={t('delete')}><Trash2 size={18} /></button></article>)}</div> : <p className="empty">{t('noPlans')}</p>}<Pagination page={current} pageCount={pageCount} onPage={setPage} /></div>; }

function GameDataPage({ t, status, progress, onRefresh, onError }: { t: TFunction; status: GameDataStatus | null; progress: DataSyncProgress | null; onRefresh: (status?: GameDataStatus | null) => Promise<void>; onError: (message: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<GameDataStatus | null | undefined>) => { setBusy(true); try { const next = await action(); await onRefresh(next); } catch { onError(t('dataActionFailed')); } finally { setBusy(false); } };
  const syncing = busy && progress?.stage !== 'cancelled' && progress?.stage !== 'error';
  const operationText = (operation: NonNullable<GameDataStatus['operations']>[number]) => t(`op${operation.action[0].toUpperCase()}${operation.action.slice(1)}${operation.outcome[0].toUpperCase()}${operation.outcome.slice(1)}`, { version: operation.version ?? '-' });
  const counts = status?.counts;
  return <section className="data-page">
    <dl className="data-facts"><div><dt>{t('gameDataVersion')}</dt><dd>{status?.manifest.gameDataVersion ?? '-'}</dd></div><div><dt>{t('dataStatus')}</dt><dd>{t('verified')}</dd></div><div><dt>{t('dataSource')}</dt><dd><button className="external-link" onClick={() => void window.desktopApi?.openExternal('https://lunaris.moe/')}>Lunaris</button></dd></div><div><dt>{t('installedAt')}</dt><dd>{status ? fixedDateTime(status.manifest.generatedAt) : '-'}</dd></div></dl>
    <table className="data-counts"><caption>{t('dataContents')}</caption><thead><tr><th>{t('characters')}</th><th>{t('weapons')}</th><th>{t('talentMaterialsFull')}</th><th>{t('weaponMaterialsFull')}</th><th>{t('icons')}</th></tr></thead><tbody><tr><td>{counts?.characters ?? 0}</td><td>{counts?.weapons ?? 0}</td><td>{counts?.talentMaterials ?? 0}</td><td>{counts?.weaponMaterials ?? 0}</td><td>{counts?.icons ?? 0}</td></tr></tbody></table>
    {progress && progress.stage !== 'idle' && progress.stage !== 'complete' ? <p className="sync-progress"><RefreshCw size={16} /> {progress.message} {progress.total > 0 ? `${progress.completed}/${progress.total}` : ''}</p> : null}
    <div className="actions data-actions">{syncing ? <button className="button secondary" onClick={() => window.desktopApi?.cancelGameDataSync()}>{t('cancel')}</button> : <button className="button primary" disabled={busy} onClick={() => run(() => window.desktopApi!.syncGameData())}><RefreshCw size={17} />{t('syncLunaris')}</button>}<button className="button secondary" disabled={busy} onClick={() => run(() => window.desktopApi!.importGameData())}><Upload size={17} />{t('importGameData')}</button><button className="button secondary" disabled={busy} onClick={() => window.desktopApi?.exportGameData()}><Download size={17} />{t('exportGameData')}</button><button className="button secondary" disabled={busy} onClick={() => run(() => window.desktopApi!.restoreBuiltinGameData())}><RotateCcw size={17} />{t('restoreBuiltin')}</button></div>
    <section className="operation-history"><h2>{t('operationHistory')}</h2>{status?.operations.length ? status.operations.map((operation) => <div key={`${operation.at}-${operation.action}`}><time>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(operation.at))}</time><span>{operationText(operation)}</span></div>) : <p className="empty">-</p>}</section>
  </section>;
}

function WeaponTarget({ t, locale, weapons, weaponId, currentPhase, targetPhase, onWeapon, onCurrent, onTarget }: { t: TFunction; locale: Locale; weapons: Weapon[]; weaponId: string; currentPhase: number; targetPhase: number; onWeapon: (value: string) => void; onCurrent: (value: number) => void; onTarget: (value: number) => void }) { return <div className="form-row"><TargetPicker label={t('weaponName')} kind="weapon" items={weapons} value={weaponId} onChange={onWeapon} locale={locale} /><label>{t('currentPhase')}<PhaseSelect value={currentPhase} onChange={onCurrent} /></label><label>{t('targetPhase')}<PhaseSelect value={targetPhase} onChange={onTarget} /></label></div>; }
function PhaseSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <select value={value} onChange={(event) => onChange(Number(event.target.value))}>{[0, 1, 2, 3, 4, 5, 6].map((phase) => <option value={phase} key={phase}>{phase === 0 ? 'Lv. 1' : `Lv. ${[20, 40, 50, 60, 70, 80][phase - 1]}+`}</option>)}</select>; }
function TalentTarget({ t, locale, characters, characterId, current, target, onCharacter, onCurrent, onTarget }: { t: TFunction; locale: Locale; characters: Character[]; characterId: string; current: TalentLevels; target: TalentLevels; onCharacter: (value: string) => void; onCurrent: (value: TalentLevels) => void; onTarget: (value: TalentLevels) => void }) { const fields: { key: keyof TalentLevels; name: string }[] = [{ key: 'normal', name: t('normal') }, { key: 'skill', name: t('skill') }, { key: 'burst', name: t('burst') }]; return <div className="talent-target"><TargetPicker label={t('character')} kind="character" items={characters} value={characterId} onChange={onCharacter} locale={locale} /><div className="talent-rows"><div className="talent-row talent-header"><span>{t('talent')}</span><span>{t('current')}</span><span>{t('targetLevel')}</span></div>{fields.map(({ key, name }) => <div className="talent-row" key={key}><span>{name}</span><NumberSelect value={current[key]} onChange={(value) => onCurrent({ ...current, [key]: value })} /><NumberSelect value={target[key]} onChange={(value) => onTarget({ ...target, [key]: value })} /></div>)}</div></div>; }
function NumberSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <select value={value} onChange={(event) => onChange(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map((level) => <option value={level} key={level}>{level}</option>)}</select>; }
function ManualTarget({ t, locale, families: allFamilies, category, familyId, onCategory, onFamily }: { t: TFunction; locale: Locale; families: MaterialFamily[]; category: MaterialCategory; familyId: string; onCategory: (value: MaterialCategory) => void; onFamily: (value: string) => void }) { const families = allFamilies.filter((family) => family.category === category); return <div className="form-row"><div className="category-control" role="group" aria-label={t('materialCategory')}><span>{t('materialCategory')}</span><div><button className={category === 'talent-book' ? 'selected' : ''} onClick={() => onCategory('talent-book')}>{t('talentBooks')}</button><button className={category === 'weapon-ascension' ? 'selected' : ''} onClick={() => onCategory('weapon-ascension')}>{t('weaponMaterials')}</button></div></div><label>{t('materialFamily')}<select value={familyId} onChange={(event) => onFamily(event.target.value)}>{families.map((family) => <option key={family.id} value={family.id}>{localName(family, locale)}</option>)}</select></label></div>; }
function TruncatedMaterialName({ name }: { name: string }) {
  const ref = useRef<HTMLElement>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null);
  const showTooltip = () => { const element = ref.current; if (!element || element.scrollWidth <= element.clientWidth) return; const rect = element.getBoundingClientRect(); setTooltip({ left: Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2)), top: rect.bottom + 6 }); };
  return <><strong ref={ref} onMouseEnter={showTooltip} onMouseLeave={() => setTooltip(null)}>{name}</strong>{tooltip && createPortal(<span className="material-name-tooltip" role="tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{name}</span>, document.body)}</>;
}

function MaterialGrid({ t, family, locale, inventory, required, calculation, manual, hasPassive, onInventory, onRequired }: { t: TFunction; family: MaterialFamily; locale: Locale; inventory: CountsByRarity; required: CountsByRarity; calculation: ReturnType<typeof calculateMaterials>; manual: boolean; hasPassive: boolean; onInventory: (rarity: MaterialRarity, value: string) => void; onRequired: (rarity: MaterialRarity, value: string) => void }) {
  const [preview, setPreview] = useState<{ rarity: MaterialRarity; left: number; top: number } | null>(null);
  const active = rarities.filter((rarity) => family.craftableRarities.includes(rarity));
  const row = (label: string, render: (rarity: MaterialRarity) => React.ReactNode) => <div className="material-row"><div className="row-label">{label}</div>{active.map(render)}</div>;
  const inputLabel = (label: string, rarity: MaterialRarity) => `${label} ${family.materialsByRarity[rarity]?.names[locale]} ${t('rarity', { count: rarity })}`;
  const showPreview = (rarity: MaterialRarity, element: HTMLElement) => { const rect = element.getBoundingClientRect(); setPreview({ rarity, left: Math.max(210, Math.min(window.innerWidth - 210, rect.left + rect.width / 2)), top: rect.bottom + 8 }); };
  const material = preview ? family.materialsByRarity[preview.rarity] : undefined;
  return <><section className="material-grid" style={{ '--columns': active.length } as React.CSSProperties}>
    {row('', (rarity) => <div key={rarity} className={`material-head r${rarity}`}><button type="button" className="material-preview-trigger" aria-label={t('materialPreview', { name: family.materialsByRarity[rarity]?.names[locale] ?? '' })} onMouseEnter={(event) => showPreview(rarity, event.currentTarget)} onMouseLeave={() => setPreview(null)} onFocus={(event) => showPreview(rarity, event.currentTarget)} onBlur={() => setPreview(null)}><GameIcon iconId={family.materialsByRarity[rarity]?.iconId} label={family.materialsByRarity[rarity]?.names[locale] ?? ''} />{t('rarity', { count: rarity })}</button><TruncatedMaterialName name={family.materialsByRarity[rarity]?.names[locale] ?? ''} /></div>)}
    {row(t('inventory'), (rarity) => <input key={rarity} aria-label={inputLabel(t('inventory'), rarity)} type="number" min="0" value={inventory[rarity] ?? 0} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (event.currentTarget.value === '0' && /^[1-9]$/.test(event.key)) { event.preventDefault(); onInventory(rarity, event.key); } }} onChange={(event) => onInventory(rarity, event.target.value)} />)}
    {row(t('required'), (rarity) => manual ? <input key={rarity} aria-label={inputLabel(t('required'), rarity)} type="number" min="0" value={required[rarity] ?? 0} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (event.currentTarget.value === '0' && /^[1-9]$/.test(event.key)) { event.preventDefault(); onRequired(rarity, event.key); } }} onChange={(event) => onRequired(rarity, event.target.value)} /> : <output key={rarity}>{required[rarity] ?? 0}</output>)}
    {row(t('afterConversion'), (rarity) => <output key={rarity} className={`material-result${calculation.deficits[rarity] ? ' deficit' : ''}`}><strong>{formatMaterialCount(calculation.availableAfterConversion[rarity])}</strong><span className="material-sources"><small className="base-crafted">{t('baseCrafted', { count: calculation.baseCrafted[rarity] ?? 0 })}</small>{hasPassive && <small className="passive-crafted">{t('passiveCrafted', { count: calculation.passiveBonus[rarity] ?? 0 })}</small>}</span>{calculation.deficits[rarity] ? <small className="missing-count">({t('remaining', { count: calculation.deficits[rarity] })})</small> : null}</output>)}
  </section>{preview && material && createPortal(<aside className={`material-preview-card r${preview.rarity}`} style={{ left: preview.left, top: preview.top }} aria-live="polite"><GameIcon iconId={material.iconId} label={material.names[locale]} /><div><strong>{material.names[locale]}</strong><span>{t('rarity', { count: preview.rarity })}</span></div></aside>, document.body)}</>;
}
function Plans({ t, plans, onOpen, onDelete }: { t: TFunction; plans: SavedPlan[]; onOpen: (plan: SavedPlan) => void; onDelete: (id: string) => void }) { return <section className="plans-page"><div className="page-heading"><div><h1>{t('plans')}</h1></div></div>{plans.length === 0 ? <p className="empty">{t('noPlans')}</p> : <div className="plans-list">{plans.map((plan) => <article key={plan.id}><button className="plan-main" onClick={() => onOpen(plan)}><strong>{plan.name}</strong><span>{new Date(plan.updatedAt).toLocaleString()}</span></button><button className="icon-button danger" onClick={() => onDelete(plan.id)} aria-label={t('delete')}><Trash2 size={18} /></button></article>)}</div>}</section>; }
