import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Bundle the actual browser rules once; PHP never accepts client catalogs or prices.
const bundled = await build({
  stdin: {
    contents: `
import { TOWN_PRESENTATIONS } from './src/data/townPresentations.js';
import { BUILDINGS, createTown } from './src/data/town.js';
import { ERAS, FORGE_PRODUCTION_RUNS } from './src/data/eras.js';
import { POWERS, CHEST_TIERS, SPEED_CHEST_TIERS, CHAPTERS, getStars } from './src/data/campaign.js';
import { SHOP_ITEMS, shopSlots } from './src/data/shop.js';
import { BONUS_CAPACITIES, CHEST_DROPS, HAMMER_CAPACITY, OVERFLOW_COINS } from './src/data/rewards.js';
import { chestCoinReward, miningChapter, CHEST_ECONOMY_VERSION, RIVER_RAIL_LEVEL_PRICES } from './src/data/economy.js';
import { chapterGift } from './src/data/journey.js';
import { generateLevelConfigs } from './src/game/engine/LevelGenerator.js';
import { modernization } from './src/game/town/TownEras.js';
import { population, happiness, foodCapacity, waterCapacity, housingCapacity, visitorCapacity, saloonIncomeRate, upgradeOffer, miningPayout } from './src/game/town/TownRules.js';
import { buildingServiceLevel } from './src/data/buildingProgression.js';
import { COMBO_COIN_STEP, MULTI_MATCH_COIN_STEP } from './src/game/engine/MatchRewards.js';
import { eraEventKind, fireProtection } from './src/data/townEvents.js';
const levels=generateLevelConfigs();
const samples=[];
const fixture=(name,town)=>samples.push({name,town,population:population(town),happiness:happiness(town),income:saloonIncomeRate(town),capacities:{food:foodCapacity(town),water:waterCapacity(town),housing:housingCapacity(town),visitors:visitorCapacity(town)},offers:Object.fromEntries(BUILDINGS.map(b=>{const offer=upgradeOffer(town,b.id);return [b.id,offer&&Object.fromEntries(['available','stage','cost','runs','type','targetEra','eraLevel','requiresPower'].filter(key=>key in offer).map(key=>[key,offer[key]]))]}))});
fixture('empty',createTown());
for(const era of ERAS.filter(e=>e.enabled)) for(let stage=1;stage<=3;stage++) {
 const town=createTown();town.era=era.id;town.coins=1000000;
 for(const b of BUILDINGS) if(ERAS.findIndex(e=>e.id===b.introducedEra)<=ERAS.findIndex(e=>e.id===era.id)) {
  town.buildings[b.id]=Math.min(stage,b.upgrades.length);town.buildingEras[b.id]=b.introducedEra;town.buildingEraLevels[b.id]=b.introducedEra==='frontier'?0:stage;
 }
 fixture(era.id+'-stage-'+stage,town);
 const modern=structuredClone(town);
 for(const b of BUILDINGS) if(modern.buildings[b.id]) {modern.buildings[b.id]=b.upgrades.length;modern.buildingEras[b.id]=era.id;modern.buildingEraLevels[b.id]=era.id==='frontier'?0:stage;}
 fixture(era.id+'-modern-'+stage,modern);
 if(era.id==='industrial') {const dark=structuredClone(modern);dark.buildings.powerHouse=0;fixture('no-power-'+stage,dark);}
}
// Individual stages catch short-progression services, leisure and late-era effects.
for(const b of BUILDINGS) for(let stage=0;stage<=b.upgrades.length;stage++) {
 const town=createTown();town.era=b.introducedEra;town.coins=1000000;
 for(const plot of BUILDINGS) if(ERAS.findIndex(e=>e.id===plot.introducedEra)<=ERAS.findIndex(e=>e.id===town.era)) town.buildings[plot.id]=plot.upgrades.length;
 town.buildings[b.id]=stage; fixture(b.id+'-'+stage,town);
}
const serviceCarry=Object.fromEntries(ERAS.filter(e=>e.enabled).map(era=>[era.id,Array.from({length:4},(_,level)=>{const town=createTown();town.buildings.well=1;town.buildings.farm=1;town.buildingEras.well=era.id;town.buildingEras.farm=era.id;town.buildingEraLevels.well=level;town.buildingEraLevels.farm=level;return {water:waterCapacity(town)-6,food:foodCapacity(town)-6};})]));
export default { presentations:TOWN_PRESENTATIONS, serviceCarry,eraEventKinds:Object.fromEntries(ERAS.map(era=>[era.id,eraEventKind(era.id)])),fireProtection:Array.from({length:4},(_,i)=>fireProtection(i)),buildings: BUILDINGS, town: createTown(), eras: ERAS, powers: POWERS,
chestTiers: CHEST_TIERS, speedChestTiers:SPEED_CHEST_TIERS, chestDrops:CHEST_DROPS, shop: SHOP_ITEMS, capacities: BONUS_CAPACITIES,
shopSlots:Array.from({length:6},(_,i)=>shopSlots(i)),forgeRuns:FORGE_PRODUCTION_RUNS,hammerCapacity:HAMMER_CAPACITY,overflowCoins:OVERFLOW_COINS,
chestEconomyVersion:CHEST_ECONOMY_VERSION,riverRailPrices:RIVER_RAIL_LEVEL_PRICES,comboCoinStep:COMBO_COIN_STEP,multiMatchCoinStep:MULTI_MATCH_COIN_STEP,
chapterGifts:CHAPTERS.map((_,i)=>chapterGift(i+1)),chestCoins:Object.fromEntries(levels.map(l=>[l.id,chestCoinReward(l.id)])),miningMultipliers:Object.fromEntries(levels.map(l=>[l.id,miningChapter(l.id)])),
services: Object.fromEntries(BUILDINGS.map(b => [b.id, Array.from({length:b.upgrades.length+1},(_,i)=>buildingServiceLevel(b.id,i))])),levels,
modernizations: Object.fromEntries(ERAS.filter(e=>e.enabled).map(e=>[e.id,Object.fromEntries(BUILDINGS.map(b=>[b.id,Array.from({length:3},(_,i)=>{const town=createTown();town.era=e.id;town.buildings[b.id]=b.upgrades.length;town.buildingEras[b.id]=i ? e.id : b.introducedEra;town.buildingEraLevels[b.id]=i;return modernization(town,b.id);})]))])),
parity:{towns:samples,stars:[0,900,1000,1349,1350,2000].flatMap(score=>[0,3,4].map(combo=>({score,target:1000,combo,expected:getStars(score,1000,combo)}))),payouts:[1,7,19,37,72,144,145,192,240].map(level=>({level,jewels:123,bonusGems:3,comboCounts:{2:4,3:1,5:2},multiMatchCounts:{2:3,4:1},expected:miningPayout(123,3,{2:4,3:1,5:2},{2:3,4:1},level)}))} };`,
    resolveDir: process.cwd(),
    loader: 'js',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { default: content } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);
// Generated level layouts use seeded RNG. Replace runtime gem IDs for reproducibility.
let nextId = 0;
for (const level of content.levels)
  for (const gem of level.board) if (gem) gem.id = `initial-${++nextId}`;
const parity = content.parity;
delete content.parity;
content.version = createHash('sha256').update(JSON.stringify(content)).digest('hex');
try {
  content.sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // Docker deliberately excludes Git metadata; retain the exported content provenance.
  try {
    content.sourceRevision = JSON.parse(
      readFileSync('backend/content/game.json', 'utf8'),
    ).sourceRevision;
  } catch {
    content.sourceRevision = 'unavailable';
  }
}
mkdirSync('backend/content', { recursive: true });
writeFileSync('backend/content/game.json', JSON.stringify(content));
writeFileSync(
  'backend/content/town-parity.json',
  JSON.stringify({ contentVersion: content.version, ...parity }),
);
