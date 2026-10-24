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
  moonLotIds,
  moonLotLabel,
  moonLotName,
  moonLotStatus,
  moonLotStatusLabel,
  moonMonumentChoice,
} from '../src/game/town/moon/MoonLotStatus';
import { setLocale } from '../src/i18n';

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
describe('New Hollow lot status, shared by the Moon map and the Build tab', () => {
  it('lists every Moon lot, then only the monument sites the town has opened', () => {
    expect(moonLotIds({ ...createTown(), era: 'frontier' })).toEqual(Object.keys(MOON_LOTS));
    const ids = moonLotIds(moonTown());
    expect(ids.slice(0, Object.keys(MOON_LOTS).length)).toEqual(Object.keys(MOON_LOTS));
    expect(ids).toContain(site.id);
    expect(ids.every((id) => MOON_LOTS[id] || AREA_BY_ID[id]?.settlement === 'moon')).toBe(true);
  });

  it('follows a building from a locked plot through construction to its level', () => {
    const locked = { ...createTown(), era: 'frontier' };
    expect(moonLotStatus(locked, 'settlerDomes')).toBe('later');
    expect(moonLotStatusLabel(locked, 'settlerDomes')).toBe('Coming soon');

    const town = moonTown();
    town.buildings.spaceElevator = 1;
    expect(moonLotStatus(town, 'settlerDomes')).toBe('open');
    expect(moonLotStatusLabel(town, 'settlerDomes')).toBe('Build');

    town.projects.settlerDomes = { id: 'settlerDomes', stage: 1, wins: 0, required: 2 };
    expect(moonLotStatus(town, 'settlerDomes')).toBe('work');
    expect(moonLotStatusLabel(town, 'settlerDomes')).toBe('Under construction');
    // Buildings show the valley's shared feedback: construction progress.
    expect(moonLotDetail(town, 'settlerDomes')).toBe('0/2');

    delete town.projects.settlerDomes;
    town.buildings.settlerDomes = 2;
    expect(moonLotStatus(town, 'settlerDomes')).toBe('built');
    expect(moonLotStatusLabel(town, 'settlerDomes')).toBe('Lv. 2');
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
    expect(moonLotDetail(town, 'moonstoneWorkshop', { collectable: true })).toBe(
      'Collect 4 moonstones',
    );
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
    expect(moonLotStatusLabel(town, site.id)).not.toBe('Choose a design');
    expect(moonMonumentChoice(town, 'settlerDomes')).toBeUndefined();
  });
});
