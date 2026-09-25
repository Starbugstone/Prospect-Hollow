import { villagerRandom } from './villagers';

// Shared silhouettes and three coordinated visitor palettes per period.
// Palette order: jacket/dress, trousers, hat, shoes, lapel/collar.
const WARDROBES = {
  frontier: {
    skirtLength: 0.49,
    crown: 'cowboy',
    hat: 'brim',
    brim: 0.195,
    trousers: '#68674f',
    boots: '#5c4c39',
    coat: 0.38,
    patrol: false,
    skirt: true,
    palettes: [
      ['#527c78', '#65553e', '#ac8051', '#574030', '#ddc798'],
      ['#945746', '#564f45', '#7b5b3c', '#453d32', '#ead7b2'],
      ['#6d6482', '#5c5e54', '#c3a16b', '#584330', '#d8c9ae'],
    ],
  },
  rail: {
    skirtLength: 0.49,
    crown: 'round',
    hat: 'brim',
    brim: 0.17,
    trousers: '#575c5b',
    boots: '#463c35',
    coat: 0.46,
    patrol: false,
    skirt: true,
    palettes: [
      ['#485c70', '#434c55', '#615044', '#3f342d', '#d9c5a2'],
      ['#755267', '#514954', '#8a7363', '#403638', '#e2d2b9'],
      ['#587567', '#4c5148', '#b19976', '#493c2f', '#e3cfa9'],
    ],
  },
  workwear: {
    skirtLength: 0.46,
    crown: 'cap',
    hat: 'cap',
    trousers: '#526775',
    boots: '#514a42',
    coat: 0.44,
    patrol: true,
    skirt: true,
    palettes: [
      ['#516d79', '#4a5356', '#897a61', '#493e33', '#d1c6a5'],
      ['#866d4c', '#4d5658', '#686956', '#4f4437', '#e2ceb0'],
      ['#78585c', '#515460', '#a2947b', '#433d3b', '#d7c9ba'],
    ],
  },
  tailored: {
    skirtLength: 0.4,
    crown: 'flat',
    hat: 'brim',
    brim: 0.16,
    trousers: '#657783',
    boots: '#4c4f4c',
    coat: 0.4,
    patrol: true,
    skirt: true,
    palettes: [
      ['#526e75', '#475a66', '#a89c80', '#454446', '#e1cba7'],
      ['#8b667d', '#655967', '#b6a17f', '#514146', '#e6d8bf'],
      ['#9c805e', '#676150', '#7f7161', '#4c4137', '#e7d9b6'],
    ],
  },
  motor: {
    skirtLength: 0.4,
    crown: 'flat',
    hat: 'brim',
    brim: 0.15,
    trousers: '#657783',
    boots: '#49473e',
    coat: 0.36,
    patrol: true,
    skirt: true,
    palettes: [
      ['#507e83', '#4c6070', '#b9aa87', '#414b49', '#e9d7b4'],
      ['#a47760', '#665c53', '#8c7965', '#4f4037', '#eed9b7'],
      ['#68768f', '#525d6b', '#c4b89d', '#43434b', '#d9dece'],
    ],
  },
  aviation: {
    skirtLength: 0.38,
    crown: 'flat',
    hat: 'brim',
    brim: 0.145,
    trousers: '#657d87',
    boots: '#dfd4b9',
    coat: 0.32,
    patrol: true,
    skirt: true,
    palettes: [
      ['#62a1a4', '#576e80', '#d2b690', '#eee2c8', '#f4e8d0'],
      ['#cc8c87', '#697889', '#a9a386', '#ddc6aa', '#f2d8c5'],
      ['#b6a564', '#63766e', '#aa8d70', '#f0e3c9', '#f5e3b6'],
    ],
  },
  broadcast: {
    skirtLength: 0.29,
    crown: 'cap',
    hat: 'cap',
    trousers: '#52768a',
    boots: '#e2dbca',
    coat: 0.3,
    patrol: true,
    palettes: [
      ['#698ea5', '#536b86', '#648991', '#eee5d3', '#d7d2bc'],
      ['#aa799f', '#606c91', '#827898', '#ebdccb', '#e7cbd6'],
      ['#c08a71', '#526e86', '#8baf9c', '#eee4d4', '#d9e5ce'],
    ],
  },
  contemporary: {
    skirtLength: 0.29,
    crown: 'none',
    hat: 'none',
    trousers: '#435764',
    boots: '#e5ddcb',
    coat: 0.3,
    patrol: true,
    palettes: [
      ['#4d858c', '#435968', '#748c83', '#eee6d9', '#c3d9c7'],
      ['#9b6585', '#525363', '#847991', '#e5dbd0', '#e5c8d7'],
      ['#82936e', '#525f6c', '#7e9277', '#eee7d7', '#d7debc'],
    ],
  },
};
// Existing/future city profiles that omit a period wardrobe use the casual set.
WARDROBES.casual = WARDROBES.broadcast;
export const townWardrobe = (profile) => WARDROBES[profile?.wardrobe] ?? WARDROBES.frontier;
export function vipOutfit(profile, seed = 0) {
  const wardrobe = townWardrobe(profile);
  const variant = Math.floor(villagerRandom(seed + 15427) * wardrobe.palettes.length);
  const [shirt, trousers, hat, boots, accent] = wardrobe.palettes[variant];
  return {
    variant,
    accessory: ['lapels', 'scarf', 'satchel'][variant],
    skirtLength: wardrobe.skirtLength,
    shirt,
    trousers,
    hat,
    boots,
    accent,
    coat: wardrobe.coat + (variant === 1 ? 0.025 : variant === 2 ? -0.02 : 0),
    skirt: !!wardrobe.skirt || variant === 1,
    hatVisible: wardrobe.hat !== 'none' && !(profile?.wardrobe === 'aviation' && variant === 2),
  };
}
