import { villagerRandom } from './villagers';

// Shared silhouettes and three coordinated visitor palettes per period.
// Palette order: jacket/dress, trousers, hat, shoes, lapel/collar.
// `guest` is the share-link guest's suit for the period: a plum and gold family that
// never matches an ordinary VIP palette, so returning visitors stand out.
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
    guest: ['#5b2d5e', '#3d2b36', '#2c2230', '#2e2420', '#d9b24c'],
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
    guest: ['#63284f', '#35283a', '#2b2330', '#2a2226', '#e0bb55'],
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
    guest: ['#6a3a6e', '#3f3444', '#4a3550', '#34292b', '#d8b04a'],
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
    guest: ['#58306b', '#3a2f45', '#2e2638', '#2c2528', '#e4c35e'],
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
    guest: ['#6d2f5f', '#3c3040', '#3a2a3e', '#2f2a2c', '#e2bf52'],
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
    guest: ['#7a4a8c', '#4d4460', '#e8d6a0', '#e9e1cd', '#f0c95a'],
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
    guest: ['#8a4f94', '#4f4a66', '#6b4b78', '#ece3d2', '#f2cd5c'],
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
    guest: ['#6e3f7d', '#3f3b52', '#5a3d66', '#ece5d8', '#e8c35a'],
    palettes: [
      ['#4d858c', '#435968', '#748c83', '#eee6d9', '#c3d9c7'],
      ['#9b6585', '#525363', '#847991', '#e5dbd0', '#e5c8d7'],
      ['#82936e', '#525f6c', '#7e9277', '#eee7d7', '#d7debc'],
    ],
  },
  tomorrow: {
    skirtLength: 0.3,
    crown: 'none',
    hat: 'visor',
    visor: '#a6d3d4',
    trim: '#f3dc92',
    trousers: '#4f6f78',
    boots: '#eef0e8',
    coat: 0.34,
    patrol: true,
    guest: ['#8e62b0', '#4d4a6e', '#d9c6f0', '#f1eef6', '#f3d27a'],
    palettes: [
      ['#6fb5b0', '#4f6f78', '#a6d3d4', '#f1efe6', '#f3dc92'],
      ['#d99a82', '#5a6477', '#e7c4b8', '#eeeae2', '#a6d3d4'],
      ['#9cbf86', '#56676a', '#d8e4c4', '#f2efe4', '#e9b9c9'],
    ],
  },
  canopy: {
    skirtLength: 0.36,
    crown: 'none',
    hat: 'none',
    trousers: '#52685b',
    boots: '#eee2cb',
    coat: 0.35,
    patrol: true,
    resident: 'garden',
    guest: ['#856b96', '#575166', '#b7a4be', '#eee4d2', '#ead49a'],
    palettes: [
      ['#d89e86', '#52685b', '#8a9e79', '#eee2cb', '#83a478'],
      ['#efe2c6', '#657460', '#a5b28b', '#d9c8b0', '#ad99bb'],
      ['#c9ac74', '#526b64', '#a4b692', '#eee3ce', '#96ae82'],
    ],
  },
  riverlight: {
    skirtLength: 0.36,
    crown: 'none',
    hat: 'none',
    trousers: '#566873',
    boots: '#eee7d9',
    coat: 0.35,
    patrol: true,
    resident: 'garden',
    guest: ['#8c69a3', '#514763', '#bdabce', '#f0e6db', '#edc877'],
    palettes: [
      ['#658e91', '#546779', '#b2a0c2', '#eee7d9', '#ac9bc1'],
      ['#d1b478', '#eee2cb', '#b3a1be', '#ded0bc', '#efe3c9'],
      ['#ab98bd', '#596c69', '#baa9c9', '#eee7d9', '#e0bd77'],
    ],
  },
  // Sailcloth jackets and aviator scarves: a nod to the 1958 airport crowd.
  skysail: {
    skirtLength: 0.34,
    crown: 'cap',
    hat: 'cap',
    trousers: '#3f6b7a',
    boots: '#d4b98e',
    coat: 0.38,
    patrol: true,
    resident: 'garden',
    guest: ['#c4553b', '#47566b', '#f1c7a8', '#f7f1e4', '#4fa3a5'],
    palettes: [
      ['#f3ecdc', '#3f6b7a', '#e8a64a', '#d4b98e', '#4fa3a5'],
      ['#4fa3a5', '#5b5a4f', '#f3ecdc', '#e9dcc0', '#e8a64a'],
      ['#e8a64a', '#46607a', '#b8dce6', '#f1e8d6', '#e57f62'],
    ],
  },
  // Midnight coats with copper buttons and starry violet trims.
  stargazer: {
    skirtLength: 0.4,
    crown: 'none',
    hat: 'none',
    trousers: '#283458',
    boots: '#c07a4e',
    coat: 0.44,
    patrol: true,
    resident: 'garden',
    guest: ['#d8a43c', '#2c2a44', '#f4e2a8', '#eae6f4', '#8fd0cb'],
    palettes: [
      ['#3f4f84', '#283458', '#9c86d0', '#d9dfef', '#f5d77e'],
      ['#9c86d0', '#33405e', '#d9dfef', '#c07a4e', '#8fd0cb'],
      ['#8fd0cb', '#2f3a5c', '#f5d77e', '#d6dae6', '#9c86d0'],
    ],
  },
  // Homestead flight suits: patched work jackets, gold visors and barn-red scarves.
  moonward: {
    skirtLength: 0.32,
    crown: 'none',
    hat: 'visor',
    visor: '#e8b84a',
    trim: '#b85a44',
    trousers: '#5d6577',
    boots: '#efebe2',
    coat: 0.36,
    patrol: true,
    resident: 'garden',
    guest: ['#3d7f8f', '#5a3f37', '#cfe3e6', '#f4efe4', '#e8b84a'],
    palettes: [
      ['#efebe2', '#5d6577', '#b85a44', '#e8e2d4', '#e8b84a'],
      ['#b85a44', '#4a5262', '#efebe2', '#d9cdb5', '#bfd6df'],
      ['#33405e', '#7a6a58', '#e8b84a', '#efebe2', '#b85a44'],
    ],
  },
};
// Existing/future city profiles that omit a period wardrobe use the casual set.
WARDROBES.casual = WARDROBES.broadcast;
export const townWardrobe = (profile) => WARDROBES[profile?.wardrobe] ?? WARDROBES.frontier;
// Stable ordinary neighbors share an era palette without borrowing VIP outfits.
// Wardrobe capabilities let later garden eras inherit this visual contract.
export function residentOutfit(profile, seed = 0) {
  const wardrobe = townWardrobe(profile);
  if (!wardrobe.resident) return null;
  const variant = Math.floor(villagerRandom(seed + 5039) * wardrobe.palettes.length);
  const [shirt, trousers, hat, boots, accent] = wardrobe.palettes[variant];
  const hair = ['#63493b', '#977b57', '#423b36', '#ddd9ca'][
    Math.floor(villagerRandom(seed + 811) * 4)
  ];
  return { shirt, trousers, hat, boots, accent, hair, variant, apron: variant === 0 };
}
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
// Eras that do not define a guest suit use this one.
const GUEST_SUIT = ['#5b2d5e', '#3d2b36', '#2c2230', '#2e2420', '#d9b24c'];
export const guestSuit = (wardrobe) => wardrobe?.guest ?? GUEST_SUIT;
export function guestOutfit(profile) {
  const wardrobe = townWardrobe(profile);
  const [shirt, trousers, hat, boots, accent] = guestSuit(wardrobe);
  return {
    variant: 'guest',
    accessory: 'scarf',
    skirtLength: wardrobe.skirtLength,
    shirt,
    trousers,
    hat,
    boots,
    accent,
    coat: wardrobe.coat + 0.03,
    skirt: !!wardrobe.skirt,
    hatVisible: wardrobe.hat !== 'none',
  };
}

// Live players retain the period's suit, with a diagonal gold visitor sash that
// distinguishes their silhouette from honorary/random VIPs and legacy guests.
export const liveVisitorOutfit = (profile) => ({
  ...guestOutfit(profile),
  variant: 'live-visitor',
  accessory: 'sash',
});
