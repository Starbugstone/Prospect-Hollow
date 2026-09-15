import { CITY_DESCRIPTIONS } from '../src/data/city';
import { afterEach, describe, expect, it } from 'vitest';
import { browserLocale, locale, setLocale, t, number } from '../src/i18n';
import fr from '../src/i18n/fr.json';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { LEVEL_NAMES } from '../src/data/levelNames';
import { CHAPTERS, POWERS, CHEST_TIERS } from '../src/data/campaign';
import { CHEST_DROPS } from '../src/data/rewards';
import { FUSION_STYLES } from '../src/game/engine/BonusFusion';
import { BUILDINGS, INITIAL_STORY } from '../src/data/town';
import { OBSTACLES } from '../src/data/obstacles';
import { ERAS } from '../src/data/eras';
import { MOTOR_AGE_VARIANTS } from '../src/data/motorAge';
import { INDUSTRIAL_VARIANTS } from '../src/data/industrial';
import { RIVER_RAIL_VARIANTS } from '../src/data/riverRail';

afterEach(() => setLocale('en'));
describe('One browser language across the game and town', () => {
  it.each([
    [['fr-FR', 'en-US'], 'fr'],
    [['fr-CA'], 'fr'],
    [['en-GB', 'fr'], 'en'],
    [['de-DE', 'fr-BE'], 'fr'],
    [['de-DE'], 'en'],
    [[], 'en'],
  ])('chooses the first supported browser preference from %s', (languages, expected) => {
    expect(browserLocale(languages)).toBe(expected);
  });
  it('translates game, settings, construction, and variable messages consistently', () => {
    setLocale('fr-FR');
    expect(locale.value).toBe('fr');
    expect(t('NEXT LEVEL')).toBe('NIVEAU SUIVANT');
    expect(t('Start building')).toBe('Lancer la construction');
    expect(t('Reset all progress')).toBe('Tout réinitialiser');
    expect(t('Enter the mine: play level {level}', { level: 3 })).toBe(
      'Entrer dans la mine : jouer au niveau 3',
    );
    expect(number(1234)).toBe(new Intl.NumberFormat('fr').format(1234));
    setLocale('en-US');
    expect(t('Start building')).toBe('Start building');
  });
  it('keeps a translated catalog for all levels, chapters, rewards, and town content', () => {
    const messages = [
      ...LEVEL_NAMES,
      ...Object.values(CITY_DESCRIPTIONS).flat(),
      ...generateLevelConfigs().map((level) => level.tip),
      ...OBSTACLES.flatMap((item) => [item.name, item.instruction]),
      ...CHAPTERS.flatMap((c) => [c.name, c.description]),
      ...POWERS.map((p) => p.label),
      ...CHEST_TIERS.map((c) => c.label),
      ...Object.values(INITIAL_STORY),
      ...ERAS.flatMap((era) => [era.label, era.yearLabel, ...(era.story ? [era.story] : [])]),
      ...Object.values(RIVER_RAIL_VARIANTS).flat(),
      ...Object.values(INDUSTRIAL_VARIANTS).flat(),
      ...Object.values(MOTOR_AGE_VARIANTS).flat(),
      ...CHEST_DROPS.map((drop) => drop.label),
      ...Object.values(FUSION_STYLES).flatMap((style) => [style.label, style.detail]),
    ];
    for (const building of BUILDINGS)
      messages.push(
        building.name,
        building.shortName,
        building.purpose,
        ...building.stages,
        ...building.upgrades.flatMap((u) => [u.title, u.benefit, u.story, u.speaker]),
      );
    expect(messages.filter((message) => !Object.hasOwn(fr, message))).toEqual([]);
  });
  it('preserves placeholders and safely falls back for proper names and unknown messages', () => {
    setLocale('fr');
    expect(t('Prospect Hollow')).toBe('Prospect Hollow');
    expect(t('constructor')).toBe('constructor');
    expect(t(123)).toBe(123);
    for (const [english, french] of Object.entries(fr))
      expect((french.match(/\{\w+\}/g) ?? []).sort()).toEqual(
        (english.match(/\{\w+\}/g) ?? []).sort(),
      );
  });
});
