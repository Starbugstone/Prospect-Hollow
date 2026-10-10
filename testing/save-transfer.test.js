import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { MAX_SAVE_FILE_BYTES, parseSaveFile, saveFileName } from '../src/services/saveTransfer';
import { OTHER_TOWN_BACKUP, townStorage } from '../src/services/townStorage';
import { LEVEL_COUNT } from '../src/data/campaign';
import { BUILDING_BY_ID } from '../src/data/town';
import { CHEST_DROPS, chestReward } from '../src/data/rewards';
import { useSaveImport } from '../src/composables/useSaveImport';
import { readFileSync } from 'node:fs';

// Real backups written by the game on main, so beta testers can carry their village
// from the old address to this one.
const mainBackup = (name) =>
  readFileSync(new URL(`./fixtures/main-beta-save-${name}.json`, import.meta.url), 'utf8');

let saved;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('exports live progress and restores it on a fresh device and after reload', () => {
  const campaign = useCampaignStore();
  campaign.records[1] = { score: 12345, stars: 3, bestTimeMs: 54000 };
  campaign.continuousRecords[1] = { coins: 20, score: 5000 };
  campaign.town.coins = 1234;
  campaign.town.buildings.saloon = 1;
  campaign.town.buildings.shop = 1;
  campaign.town.tourSeen = true;
  campaign.town.projects.bank = { id: 'bank', stage: 1, wins: 0, required: 1 };
  campaign.powers[0].quantity = 2;
  campaign.builderHammers = 1;
  campaign.shopStock = [{ id: 'tnt', sold: true }];
  campaign.shopVisit = 3;
  campaign.seenObstacles = ['stone'];
  campaign.chestsWithoutBuilderHammer = 4;
  campaign.issuedRun = 5;
  campaign.settledRun = 5;
  const text = campaign.exportSave();
  expect(saved.has(SAVE_KEY)).toBe(false);
  const expected = parseSaveFile(text);
  setActivePinia(createPinia());
  const fresh = useCampaignStore();
  fresh.records[2] = { score: 20, stars: 1 };
  fresh.importSave(text);
  expect(fresh.nextLevel).toBe(2);
  expect(fresh.records[2]).toBeUndefined();
  expect(parseSaveFile(fresh.exportSave())).toEqual(expected);
  setActivePinia(createPinia());
  expect(parseSaveFile(useCampaignStore().exportSave())).toEqual(expected);
});

it.each(['{broken', 'null', '[]', '{}', '{"town":{"coins":5}}'])(
  'rejects invalid JSON or unrelated data without changing progress: %s',
  (text) => {
    const campaign = useCampaignStore();
    campaign.town.coins = 99;
    campaign.save();
    const before = saved.get(SAVE_KEY);
    expect(() => campaign.importSave(text)).toThrow();
    expect(campaign.town.coins).toBe(99);
    expect(saved.get(SAVE_KEY)).toBe(before);
  },
);

it.each([
  (file) => {
    file.version = 2;
  },
  (file) => {
    file.format = 'crystal-cascade-profile-v2';
  },
  (file) => {
    file.profile.schemaVersion = 3;
  },
  (file) => {
    file.profile.town = {};
  },
  (file) => {
    file.profile.powers = {};
  },
  (file) => {
    file.profile.records = { 1: null };
  },
])('rejects incompatible or malformed save contents', (change) => {
  const campaign = useCampaignStore();
  campaign.town.coins = 55;
  campaign.save();
  const before = saved.get(SAVE_KEY);
  const file = JSON.parse(campaign.exportSave());
  change(file);
  expect(() => campaign.importSave(JSON.stringify(file))).toThrow();
  expect(campaign.town.coins).toBe(55);
  expect(saved.get(SAVE_KEY)).toBe(before);
});

it('keeps the current live and stored progress when importing cannot write to storage', () => {
  const campaign = useCampaignStore();
  const backup = campaign.exportSave();
  campaign.town.coins = 99;
  campaign.save();
  const before = saved.get(SAVE_KEY);
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(() => campaign.importSave(backup)).toThrow('Your current progress has not changed');
  expect(campaign.town.coins).toBe(99);
  expect(saved.get(SAVE_KEY)).toBe(before);
  expect(parseSaveFile(campaign.exportSave()).town.coins).toBe(99);
});

it.each([...CHEST_DROPS.map((drop) => drop.id), 'hammer'])(
  'recovers pending %s chest rewards exactly once during import',
  (id) => {
    const campaign = useCampaignStore();
    campaign.issuedRun = 1;
    campaign.settledRun = 1;
    campaign.pendingChests = [{ runId: 1, source: 'completion', levelId: 1, items: [{ id }] }];
    const backup = campaign.exportSave();
    campaign.importSave(backup);
    const reward = chestReward(id === 'hammer' ? 'tnt' : id, 1);
    const quantity = (state) =>
      reward.kind === 'coins'
        ? state.town.coins
        : reward.kind === 'builder-hammer'
          ? state.builderHammers
          : state.powers.find((power) => power.id === reward.id).quantity;
    expect(campaign.pendingChests).toEqual([]);
    expect(quantity(campaign)).toBe(reward.quantity);
    setActivePinia(createPinia());
    expect(quantity(useCampaignStore())).toBe(reward.quantity);
  },
);

it.each([
  ['null receipt', null],
  ['missing items', {}],
  ['non-array items', { items: { 0: { id: 'tnt' } } }],
  ['empty items', { items: [] }],
  ['null item', { items: [null] }],
  ['missing reward ID', { items: [{}] }],
  ['non-string reward ID', { items: [{ id: 1 }] }],
  ['unknown reward ID', { items: [{ id: 'unknown-reward' }] }],
  ['extra reward', { items: [{ id: 'tnt' }, { id: 'coins' }] }],
  ['zero run', { runId: 0, items: [{ id: 'tnt' }] }],
  ['string run', { runId: '1', items: [{ id: 'tnt' }] }],
  ['unsettled run', { runId: 2, items: [{ id: 'tnt' }] }],
  ['unknown source', { source: 'unknown', items: [{ id: 'tnt' }] }],
  ['missing level', { levelId: undefined, items: [{ id: 'coins' }] }],
  ['invalid level', { levelId: 0, items: [{ id: 'coins' }] }],
  ['out-of-range level', { levelId: LEVEL_COUNT + 1, items: [{ id: 'coins' }] }],
])('rejects a pending chest with %s without changing live or stored progress', (_, fields) => {
  const campaign = useCampaignStore();
  campaign.town.coins = 99;
  campaign.save();
  const before = saved.get(SAVE_KEY);
  const file = JSON.parse(campaign.exportSave());
  file.profile.issuedRun = 2;
  file.profile.settledRun = 1;
  file.profile.pendingChests = [
    fields === null ? null : { runId: 1, source: 'completion', levelId: 1, ...fields },
  ];
  const text = JSON.stringify(file);
  expect(() => parseSaveFile(text)).toThrow('Choose a valid');
  expect(() => campaign.importSave(text)).toThrow('Choose a valid');
  expect(campaign.town.coins).toBe(99);
  expect(campaign.issuedRun).toBe(0);
  expect(saved.get(SAVE_KEY)).toBe(before);
});

it('accepts a UTF-8 BOM and rejects oversized files', () => {
  expect(parseSaveFile('\uFEFF' + useCampaignStore().exportSave()).schemaVersion).toBe(2);
  expect(() => parseSaveFile(' '.repeat(MAX_SAVE_FILE_BYTES + 1))).toThrow();
});

it.each(['industrial', 'contemporary'])(
  'loads a %s village exported by the old game and keeps it after reload',
  (name) => {
    const text = mainBackup(name);
    const old = JSON.parse(text).profile;
    const campaign = useCampaignStore();
    campaign.importSave(text);
    const tntBefore = old.powers.find((power) => power.id === 'tnt').quantity;
    const tntChests = old.pendingChests.filter((chest) => chest.items[0].id === 'tnt').length;
    setActivePinia(createPinia());
    const loaded = useCampaignStore();
    expect(loaded.records).toEqual(old.records);
    expect(loaded.continuousRecords).toEqual(old.continuousRecords);
    expect(loaded.nextLevel).toBe(Object.keys(old.records).length + 1);
    expect(loaded.town.era).toBe(old.town.era);
    expect(loaded.town.coins).toBeGreaterThanOrEqual(old.town.coins);
    // Buildings shortened since the old game keep every benefit at their final stage.
    expect(loaded.town.buildings).toMatchObject(
      Object.fromEntries(
        Object.entries(old.town.buildings).map(([id, level]) => [
          id,
          Math.min(level, BUILDING_BY_ID[id].upgrades.length),
        ]),
      ),
    );
    expect(loaded.builderHammers).toBe(old.builderHammers);
    // Unopened chests from the old game are paid out once instead of being lost.
    expect(loaded.pendingChests).toEqual([]);
    expect(loaded.powers.find((power) => power.id === 'tnt').quantity).toBe(tntBefore + tntChests);
  },
);

it('offers the old-game backup for confirmation before replacing the village', async () => {
  const text = mainBackup('industrial');
  const campaign = useCampaignStore();
  campaign.town.coins = 7;
  campaign.save();
  const imported = vi.fn();
  const importer = useSaveImport(imported);
  const event = (file) => ({ target: { files: [file], value: 'chosen' } });
  const choice = event({ name: 'old.json', size: text.length, text: async () => text });
  await importer.selectSave(choice);
  expect(choice.target.value).toBe('');
  expect(importer.pendingSave.value.name).toBe('old.json');
  expect(campaign.town.coins).toBe(7);
  importer.importProgress();
  expect(imported).toHaveBeenCalledOnce();
  expect(importer.pendingSave.value).toBeNull();
  expect(campaign.town.era).toBe('industrial');

  await importer.selectSave(event({ name: 'x.json', size: 5, text: async () => '{bad' }));
  expect(importer.pendingSave.value).toBeNull();
  expect(importer.saveError.value).toBe('That file is not a Prospect Hollow backup.');
  await importer.selectSave(
    event({ name: 'big.json', size: MAX_SAVE_FILE_BYTES + 1, text: async () => text }),
  );
  expect(importer.saveError.value).toBe('Choose a backup file smaller than 5 MB.');
  expect(imported).toHaveBeenCalledOnce();
});

it('names backup files after their town with only file-safe characters', () => {
  const at = new Date('2026-09-29T10:20:30.456Z');
  expect(saveFileName('Ruée vers l’or', at)).toBe(
    'prospect-hollow-Ruée-vers-l’or-2026-09-29T10-20-30-456Z.json',
  );
  expect(saveFileName('  ../Gold: Creek?  ', at)).toBe(
    'prospect-hollow-Gold-Creek-2026-09-29T10-20-30-456Z.json',
  );
  expect(saveFileName(undefined, at)).toBe('prospect-hollow-2026-09-29T10-20-30-456Z.json');
  expect(saveFileName('x'.repeat(100), at)).toBe(
    `prospect-hollow-${'x'.repeat(40)}-2026-09-29T10-20-30-456Z.json`,
  );
});

it('explains when an account town is offered another town’s backup', async () => {
  const campaign = useCampaignStore();
  const text = campaign.exportSave();
  campaign.town.coins = 7;
  vi.spyOn(townStorage, 'import').mockImplementation(() => {
    throw new Error(OTHER_TOWN_BACKUP);
  });
  const imported = vi.fn();
  const importer = useSaveImport(imported);
  await importer.selectSave({
    target: { files: [{ name: 'other.json', size: text.length, text: async () => text }] },
  });
  importer.importProgress();
  expect(importer.saveError.value).toBe(OTHER_TOWN_BACKUP);
  expect(imported).not.toHaveBeenCalled();
  expect(campaign.town.coins).toBe(7);
});
