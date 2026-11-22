// The period silhouettes villagers wear over the shared skeleton: each part is a few
// shared primitives, so every villager wearing one draws in the same instanced batches.
// Wardrobes name the parts (`looks` in data/townWardrobes.js); a part never changes the
// skeleton, the gait or the clothing lists a VIP outfit recolours.
//
// A figure `f` supplies the joints a part hangs on (`head`, `torso`, `body`), the coat
// length and torso width it wraps, and the colours of the villager wearing it.
const LEATHER = '#6b4f38',
  CLOTH = '#e9dcc0',
  DARK = '#2f3235';
const top = (f) => 0.13 + f.coat / 2,
  hem = (f) => 0.13 - f.coat / 2;

const PARTS = {
  beard(d, f) {
    d.ball(f.head, 0, -0.09, 0.04, [0.098, 0.085, 0.078], f.hair);
  },
  moustache(d, f) {
    d.box(f.head, 0.1, 0.026, 0.03, 0, -0.045, 0.104, f.hair, true);
  },
  vest(d, f) {
    for (const side of [-1, 1])
      d.box(f.torso, f.width * 0.36, f.coat * 0.86, 0.02, side * f.width * 0.3, 0.13, 0.1, LEATHER);
  },
  waistcoat(d, f) {
    d.box(f.torso, f.width * 0.62, f.coat * 0.72, 0.02, 0, 0.13 - f.coat * 0.08, 0.1, f.trousers);
    for (const y of [-0.2, 0.05, 0.3])
      d.box(f.torso, 0.022, 0.022, 0.012, 0, 0.13 + f.coat * (y - 0.08), 0.112, f.accent);
  },
  bandana(d, f) {
    const knot = d.mesh(f.torso, 'cone', [0.1, 0.1, 0.07], [0, top(f) - 0.035, 0.085], f.accent);
    knot.rotation.x = Math.PI;
  },
  shawl(d, f) {
    d.ball(f.torso, 0, top(f) - 0.035, 0, [f.width * 0.72, 0.085, 0.15], f.accent);
  },
  apron(d, f) {
    d.box(f.torso, f.width * 0.72, f.coat * 0.55, 0.02, 0, hem(f) + f.coat * 0.2, 0.1, CLOTH);
    // Over a skirt the apron falls along its slope instead of cutting through it.
    const fall = d.box(f.body, 0.2, 0.22, 0.02, 0, -0.11, f.skirt ? 0.135 : 0.105, CLOTH);
    if (f.skirt) fall.rotation.x = -0.2;
  },
  overalls(d, f) {
    d.box(f.torso, f.width * 0.6, f.coat * 0.5, 0.02, 0, hem(f) + f.coat * 0.3, 0.1, f.trousers);
    for (const side of [-1, 1])
      d.box(
        f.torso,
        0.035,
        f.coat * 0.5,
        0.02,
        side * f.width * 0.24,
        top(f) - f.coat * 0.24,
        0.1,
        f.trousers,
      );
  },
  bonnet(d, f) {
    d.ball(f.head, 0, 0.03, -0.035, [0.14, 0.15, 0.13], f.hat);
    d.mesh(f.head, 'cylinder', [0.155, 0.03, 0.06], [0, 0.085, 0.085], f.hat).rotation.x = 0.5;
  },
  topHat(d, f) {
    d.mesh(f.head, 'cylinder', [0.165, 0.022, 0.155], [0, 0.11, 0], DARK);
    d.mesh(f.head, 'cylinder', [0.105, 0.2, 0.098], [0, 0.215, 0], DARK);
    d.mesh(f.head, 'cylinder', [0.108, 0.03, 0.101], [0, 0.135, 0], f.accent);
  },
  cloche(d, f) {
    d.ball(f.head, 0, 0.06, -0.005, [0.14, 0.115, 0.135], f.hat);
    d.mesh(f.head, 'cylinder', [0.142, 0.028, 0.137], [0, 0.05, -0.005], f.accent);
  },
  bustle(d, f) {
    d.ball(f.body, 0, -0.07, -0.13, [0.15, 0.15, 0.12], f.shirt);
  },
  // Tails behind and at the sides: the legs stay free at the front.
  longCoat(d, f) {
    d.box(f.body, 0.3, 0.34, 0.03, 0, -0.14, -0.085, f.shirt);
    for (const side of [-1, 1])
      d.box(f.body, 0.03, 0.34, 0.15, side * 0.145, -0.14, -0.01, f.shirt);
  },
  popCollar(d, f) {
    d.mesh(f.torso, 'cylinder', [0.105, 0.075, 0.09], [0, top(f) + 0.015, -0.01], f.accent);
  },
  sunglasses(d, f) {
    d.box(f.head, 0.215, 0.04, 0.03, 0, 0.027, 0.1, DARK, true);
  },
  shoulderPads(d, f) {
    for (const side of [-1, 1])
      d.box(
        f.torso,
        0.12,
        0.06,
        0.2,
        side * (f.width * 0.5 + 0.02),
        top(f) - 0.02,
        0,
        f.shirt,
        true,
      );
  },
  headphones(d, f) {
    d.box(f.head, 0.27, 0.022, 0.035, 0, 0.15, -0.01, DARK, true);
    for (const side of [-1, 1]) {
      d.box(f.head, 0.022, 0.13, 0.03, side * 0.132, 0.09, -0.01, DARK);
      d.ball(f.head, side * 0.128, 0.015, -0.005, [0.03, 0.055, 0.055], f.accent);
    }
  },
  backpack(d, f) {
    d.box(f.torso, f.width * 0.72, f.coat * 0.78, 0.11, 0, 0.14, -0.14, f.accent, true);
    for (const side of [-1, 1])
      d.box(f.torso, 0.03, f.coat * 0.7, 0.02, side * f.width * 0.3, 0.16, 0.1, f.accent);
  },
  pack(d, f) {
    d.box(f.torso, f.width * 0.6, f.coat * 0.55, 0.09, 0, 0.17, -0.135, CLOTH, true);
    d.box(f.torso, f.width * 0.3, 0.04, 0.03, 0, 0.17 + f.coat * 0.2, -0.185, f.accent);
  },
  hood(d, f) {
    d.ball(f.torso, 0, top(f) + 0.02, -0.085, [0.115, 0.1, 0.08], f.shirt);
  },
  leafMantle(d, f) {
    for (const side of [-1, 1]) {
      const leaf = d.mesh(
        f.torso,
        'rock',
        [0.13, 0.03, 0.11],
        [side * f.width * 0.42, top(f) - 0.01, 0],
        '#8da572',
      );
      leaf.rotation.z = -side * 0.35;
    }
  },
  pendant(d, f) {
    d.box(f.torso, 0.012, 0.11, 0.012, 0, top(f) - 0.075, 0.098, CLOTH);
    d.mesh(f.torso, 'rock', [0.03, 0.045, 0.022], [0, top(f) - 0.15, 0.105], f.accent);
  },
  sailCape(d, f) {
    const cape = d.box(f.torso, f.width * 1.05, f.coat + 0.2, 0.018, 0, 0.06, -0.135, CLOTH);
    cape.rotation.x = 0.16;
    d.box(f.torso, f.width * 1.05, 0.035, 0.02, 0, top(f) - 0.02, -0.105, f.accent);
  },
  ticketBag(d, f) {
    const strap = d.box(f.torso, 0.025, f.coat + 0.14, 0.02, 0, 0.12, 0.1, LEATHER);
    strap.rotation.z = 0.62;
    d.box(f.body, 0.12, 0.13, 0.07, -0.19, -0.02, 0.02, LEATHER, true);
  },
  longScarf(d, f) {
    d.mesh(f.torso, 'cylinder', [0.1, 0.06, 0.088], [0, top(f) + 0.01, 0], f.accent);
    d.box(f.torso, 0.06, f.coat * 0.8, 0.025, 0.06, 0.13, 0.105, f.accent);
  },
};
// These change what the shared skeleton already draws rather than adding to it.
const TRAITS = {
  bonnet: { hat: false },
  topHat: { hat: false },
  cloche: { hat: false },
  hood: { hat: false },
  headphones: { hat: false },
  ponytail: { hairStyle: 2 },
  bigHair: { hairVolume: 1.3, hat: false },
  fullSkirt: { skirt: true, flare: 1.45 },
  bustle: { skirt: true },
  bareHead: { hat: false },
};
// A child wears the period's clothes, not its whiskers.
const ADULT_ONLY = ['beard', 'moustache'];
export const OUTFIT_PARTS = Object.freeze([
  ...new Set([...Object.keys(PARTS), ...Object.keys(TRAITS)]),
]);

/** What a look changes on the skeleton itself; unknown part names change nothing. */
export function outfitTraits(parts = []) {
  const traits = { hat: true, skirt: false, flare: 1, hairVolume: 1, hairStyle: null };
  for (const part of parts) if (Object.hasOwn(TRAITS, part)) Object.assign(traits, TRAITS[part]);
  return traits;
}
/** Draws a look's parts onto the figure. Unknown part names are skipped. */
export function addOutfitParts(d, figure, parts = []) {
  for (const part of parts)
    if (Object.hasOwn(PARTS, part) && !(figure.child && ADULT_ONLY.includes(part)))
      PARTS[part](d, figure);
}
