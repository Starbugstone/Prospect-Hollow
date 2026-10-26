import { afterEach, describe, expect, it } from 'vitest';
import { createTown } from '../src/data/town';
import { MOON_LOTS } from '../src/data/moonSettlement';
import {
  AREA_BY_ID,
  advanceMonumentWorks,
  areasForSettlement,
  landmarkOffer,
  monumentWork,
  purchaseLandmark,
} from '../src/data/townLandmarks';
import {
  canCollectMoonstones,
  moonLotDetail,
  moonLotLabel,
  moonLotName,
  moonLotInfo,
  moonLotStatus,
  moonMonumentChoice,
} from '../src/game/town/moon/MoonLotStatus';
import { setLocale } from '../src/i18n';
import { moonLabelAnchors } from '../src/game/town/moon/MoonMonuments';
import { monumentStatus } from '../src/game/town/TownBuildingFeedback';

const moonTown = () => ({ ...createTown(), era: 'twin-hollows', coins: 1e8 });
const site = areasForSettlement('moon')[0];
const chooseSite = (town) => {
  const choice = site.choices[0];
  return purchaseLandmark(town, {
    id: site.id,
    slot: 0,
    value: choice,
    ...landmarkOffer(town, site, choice),
  });
};

afterEach(() => setLocale('en'));
describe('New Hollow lot status, read through the valley’s shared status contracts', () => {
  it('labels every Moon lot, then only the monument sites the town has opened', () => {
    const ids = (town) => moonLabelAnchors(town).map(({ id }) => id);
    expect(ids({ ...createTown(), era: 'frontier' })).toEqual(Object.keys(MOON_LOTS));
    expect(ids()).toEqual(Object.keys(MOON_LOTS));
    expect(moonLabelAnchors(moonTown()).find(({ id }) => id === site.id).position.y).toBe(2);
    const opened = ids(moonTown());
    expect(opened.slice(0, Object.keys(MOON_LOTS).length)).toEqual(Object.keys(MOON_LOTS));
    expect(opened).toContain(site.id);
    expect(opened.every((id) => MOON_LOTS[id] || AREA_BY_ID[id]?.settlement === 'moon')).toBe(true);
  });

  it('follows a building from a locked plot through construction to its level', () => {
    const locked = { ...createTown(), era: 'frontier' };
    expect(moonLotStatus(locked, 'settlerDomes')).toBe('later');
    expect(moonLotInfo(locked, 'settlerDomes')).toEqual({ kind: 'later', text: 'Coming soon' });

    const town = moonTown();
    town.buildings.spaceElevator = 1;
    expect(moonLotStatus(town, 'settlerDomes')).toBe('open');
    expect(moonLotInfo(town, 'settlerDomes', { availableIds: ['settlerDomes'] })).toEqual({
      kind: 'available',
      text: 'Build',
    });
    // An open lot the town cannot pay for yet is a quiet empty plot, as in the valley.
    expect(moonLotInfo(town, 'settlerDomes').kind).toBe('empty');

    town.projects.settlerDomes = { id: 'settlerDomes', stage: 1, wins: 0, required: 2 };
    expect(moonLotStatus(town, 'settlerDomes')).toBe('work');
    // Buildings show the valley's shared feedback: construction progress and its title.
    expect(moonLotDetail(town, 'settlerDomes')).toBe('0/2');
    expect(moonLotInfo(town, 'settlerDomes')).toMatchObject({
      kind: 'work',
      title: 'Construction: 0 of 2 mining runs completed',
    });

    delete town.projects.settlerDomes;
    town.buildings.settlerDomes = 2;
    expect(moonLotStatus(town, 'settlerDomes')).toBe('built');
    expect(moonLotInfo(town, 'settlerDomes')).toEqual({ kind: 'built', text: 'Lv. 2' });
  });

  it('describes affordable buildings as the valley does', () => {
    const town = moonTown();
    town.buildings.spaceElevator = 1;
    expect(moonLotDetail(town, 'craterIceWell', { availableIds: ['craterIceWell'] })).toBe('Build');
    expect(moonLotDetail(town, 'craterIceWell')).toBe('Coming soon');
    expect(moonLotLabel(town, 'craterIceWell', { availableIds: ['craterIceWell'] })).toBe(
      `${moonLotName('craterIceWell')} · Build`,
    );
  });

  it('offers stored moonstones once the collection cooldown has passed', () => {
    const town = moonTown();
    town.buildings.moonstoneWorkshop = 1;
    expect(canCollectMoonstones(town, 0)).toBe(false);
    town.moonstoneProduction = { ...town.moonstoneProduction, stored: 4 };
    const now = 1_000_000;
    expect(canCollectMoonstones(town, now)).toBe(true);
    expect(moonLotInfo(town, 'moonstoneWorkshop', { collectable: true })).toEqual({
      kind: 'coins',
      text: 'Collect 4 moonstones',
    });
    town.lastCollections = { ...town.lastCollections, moonstoneWorkshop: now - 1000 };
    expect(canCollectMoonstones(town, now)).toBe(false);
    expect(moonLotDetail(town, 'moonstoneWorkshop')).toBe('Lv. 1');
  });

  it('follows a monument site from its open plot to an unveiling', () => {
    let town = moonTown();
    expect(moonLotStatus(town, site.id)).toBe('open');
    expect(moonLotDetail(town, site.id)).toBe('Choose a design');
    expect(moonMonumentChoice(town, site.id)).toBeFalsy();
    expect(moonLotName(site.id)).toBe(site.label);

    town = chooseSite(town);
    expect(moonMonumentChoice(town, site.id)).toBe(site.choices[0]);
    expect(moonLotStatus(town, site.id)).toBe('work');
    while (!monumentWork(town, site).ready) town = advanceMonumentWorks(town);
    expect(moonLotStatus(town, site.id)).toBe('ready');
    expect(moonLotDetail(town, site.id)).toBe('Ready to unveil');
  });

  it('uses the player language', () => {
    setLocale('fr');
    const town = moonTown();
    expect(moonLotDetail(town, site.id)).not.toBe('Choose a design');
    expect(moonMonumentChoice(town, 'settlerDomes')).toBeUndefined();
  });

  it('describes a monument site through the shared monument status, in every context', () => {
    let town = moonTown();
    expect(monumentStatus(town, site.id)).toEqual({ kind: 'available', text: 'Choose a design' });
    expect(monumentStatus(town, site.id, { context: 'card' }).text).toBe('Open site · optional');
    expect(monumentStatus(town, site.id, { context: 'list' }).text).toBe(
      `Open site · ${site.choices.length} designs`,
    );
    expect(monumentStatus(town, site.id, { readOnly: true })).toBeNull();
    town = chooseSite(town);
    expect(monumentStatus(town, site.id)).toEqual({ kind: 'work', text: 'Under construction' });
    expect(monumentStatus(town, site.id, { context: 'list' }).text).toMatch(
      new RegExp(`^${site.label} · Building: `),
    );
    expect(monumentStatus(town, site.id, { readOnly: true })).toEqual({
      kind: 'built',
      text: 'Monument',
    });
    while (!monumentWork(town, site).ready) town = advanceMonumentWorks(town);
    expect(monumentStatus(town, site.id).kind).toBe('ready');
    expect(monumentStatus(town, site.id, { context: 'list' }).text).toBe(
      `${site.label} · Ready to unveil`,
    );
    const later = { ...createTown(), era: 'frontier' };
    expect(monumentStatus(later, site.id, { context: 'card' }).text).toMatch(/^Opens in /);
    expect(monumentStatus(later, site.id)).toBeNull();
    expect(monumentStatus(town, 'settlerDomes')).toBeNull();
  });
});
