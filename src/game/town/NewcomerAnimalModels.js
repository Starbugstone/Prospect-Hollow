// The animals that join the valley in later eras. Like the garden cast they are built
// from the town's cached primitives and drawn in the shared actor instances; every one
// faces +Z, stands on the root's ground plane and returns the shared rig.
function eyes(d, head, x, y, z) {
  for (const side of [-1, 1]) d.ball(head, side * x, y, z, [0.014, 0.018, 0.012], '#2e3430');
}
function twoLegs(d, body, height, spread, color, z = 0) {
  return [-1, 1].map((side) => {
    const leg = d.group(body, side * spread, height, z);
    d.rod(leg, [0, 0, 0], [0, -height + 0.02, 0.01], 0.013, color);
    d.ball(leg, 0, -height + 0.015, 0.035, [0.04, 0.014, 0.06], color);
    return leg;
  });
}
function fourLegs(d, body, height, spread, length, coat, foot, width = 0.034) {
  const legs = [];
  for (const side of [-1, 1])
    for (const z of [-length, length]) {
      const leg = d.group(body, side * spread, height, z);
      d.rod(leg, [0, 0, 0], [0, -height + 0.04, 0], width, coat);
      d.ball(leg, 0, -height + 0.03, 0.02, [0.045, 0.03, 0.06], foot);
      legs.push(leg);
    }
  return legs;
}
// Parts of the coat a space suit covers along with the trunk (`addSpaceSuit`).
const suited = (mesh) => {
  mesh.userData.suited = true;
  return mesh;
};
const scaled = (d, root, look) => {
  const body = d.group(root);
  body.scale.setScalar(look.size);
  return body;
};

// Ducks and swans: a boat of a body, a neck that tells them apart, and paddle feet.
function waterfowl(d, root, { look }, neck) {
  const { coat, light, dark = coat } = look;
  const body = scaled(d, root, look);
  const lift = neck > 0.3 ? 0.27 : 0.2,
    girth = neck > 0.3 ? 1.3 : 1;
  d.ball(body, 0, lift, 0, [0.14 * girth, 0.13 * girth, 0.25 * girth], coat);
  suited(d.ball(body, 0, lift - 0.03, 0.05, [0.12 * girth, 0.1 * girth, 0.2 * girth], light));
  for (const side of [-1, 1])
    suited(
      d.ball(
        body,
        side * 0.11 * girth,
        lift + 0.03,
        -0.03,
        [0.05, 0.09 * girth, 0.19 * girth],
        coat,
      ),
    );
  const base = [0, lift + 0.05, 0.17 * girth];
  const crown = [0, lift + 0.08 + neck, 0.22 * girth + (neck > 0.3 ? 0.05 : 0)];
  if (neck > 0.3) {
    // A swan carries its neck in a curve.
    const bend = [0, lift + 0.05 + neck * 0.6, 0.13 * girth];
    suited(d.rod(body, base, bend, 0.04, coat));
    d.rod(body, bend, crown, 0.036, coat);
  } else d.rod(body, base, crown, 0.045, dark);
  const head = d.group(body, ...crown);
  d.ball(head, 0, 0.02, 0.02, [0.065, 0.06, 0.075], dark);
  d.ball(head, 0, 0, 0.09, [0.032, 0.018, 0.06], look.bill ?? '#d99a3c');
  eyes(d, head, 0.052, 0.035, 0.045);
  const legs = twoLegs(d, body, lift - 0.07, 0.06 * girth, look.bill ?? '#d99a3c');
  const tail = d.group(body, 0, lift + 0.03, -0.23 * girth);
  d.ball(tail, 0, 0.03, -0.03, [0.05, 0.035, 0.08], coat);
  return { root, body, head, legs, wings: [], tail };
}
const duck = (d, root, options) => waterfowl(d, root, options, 0.14);
const swan = (d, root, options) => waterfowl(d, root, options, 0.42);

// Herons and cranes: stilts, a folded neck and a spear of a bill.
function wader(d, root, { look }) {
  const { coat, light, dark = coat, form } = look;
  const body = scaled(d, root, look);
  d.ball(body, 0, 0.52, -0.02, [0.14, 0.15, 0.27], coat);
  suited(d.ball(body, 0, 0.49, 0.07, [0.11, 0.115, 0.19], light));
  for (const side of [-1, 1])
    suited(d.ball(body, side * 0.12, 0.54, -0.07, [0.045, 0.1, 0.22], dark));
  suited(d.rod(body, [0, 0.56, 0.19], [0, 0.76, 0.1], 0.038, light));
  d.rod(body, [0, 0.76, 0.1], [0, 0.92, 0.19], 0.034, light);
  const head = d.group(body, 0, 0.95, 0.21);
  d.ball(head, 0, 0, 0, [0.062, 0.062, 0.082], light);
  d.rod(head, [0, -0.005, 0.05], [0, -0.03, 0.26], 0.014, look.bill ?? '#d9a445');
  eyes(d, head, 0.045, 0.012, 0.03);
  if (form === 'crane') d.ball(head, 0, 0.045, -0.005, [0.04, 0.022, 0.05], '#c9463f');
  else d.rod(head, [0, 0.03, -0.03], [0, 0.0, -0.2], 0.01, dark).name = 'Heron plume';
  const legs = twoLegs(d, body, 0.41, 0.05, '#6f6a55');
  const tail = d.group(body, 0, 0.52, -0.27);
  d.ball(tail, 0, -0.03, -0.05, [0.07, 0.05, 0.11], form === 'crane' ? dark : coat);
  return { root, body, head, legs, wings: [], tail };
}

function tortoise(d, root, { look }) {
  const { coat, light, dark = coat } = look;
  const body = scaled(d, root, look);
  d.ball(body, 0, 0.21, 0, [0.22, 0.17, 0.27], coat);
  suited(d.ball(body, 0, 0.13, 0, [0.2, 0.06, 0.25], light));
  // Five broad scutes read as a shell from the town's camera.
  for (const [x, z] of [
    [0, 0],
    [-0.11, 0.1],
    [0.11, 0.1],
    [-0.11, -0.11],
    [0.11, -0.11],
  ])
    d.ball(body, x, 0.3 - Math.abs(x) * 0.35, z, [0.085, 0.07, 0.095], dark);
  const head = d.group(body, 0, 0.19, 0.27);
  d.rod(head, [0, -0.03, -0.08], [0, 0, 0], 0.04, light);
  d.ball(head, 0, 0.01, 0.03, [0.06, 0.055, 0.075], light);
  eyes(d, head, 0.048, 0.03, 0.05);
  const legs = fourLegs(d, body, 0.12, 0.15, 0.16, light, dark, 0.04);
  const tail = d.group(body, 0, 0.13, -0.25);
  d.ball(tail, 0, 0, -0.03, [0.025, 0.02, 0.05], light);
  return { root, body, head, legs, wings: [], tail };
}

function peacock(d, root, { look }) {
  const { coat, light, dark = coat, form } = look;
  const body = scaled(d, root, look);
  d.ball(body, 0, 0.42, 0, [0.13, 0.15, 0.24], coat);
  for (const side of [-1, 1])
    suited(d.ball(body, side * 0.1, 0.43, -0.04, [0.045, 0.1, 0.18], dark));
  d.rod(body, [0, 0.47, 0.15], [0, 0.76, 0.2], 0.038, coat);
  const head = d.group(body, 0, 0.8, 0.21);
  d.ball(head, 0, 0, 0, [0.055, 0.058, 0.065], coat);
  d.ball(head, 0, -0.012, 0.07, [0.022, 0.016, 0.04], '#d8cfb4');
  eyes(d, head, 0.044, 0.012, 0.03);
  d.rod(head, [0, 0.04, -0.01], [0, 0.13, -0.03], 0.006, dark);
  d.ball(head, 0, 0.14, -0.03, [0.04, 0.016, 0.014], light);
  const legs = twoLegs(d, body, 0.3, 0.055, '#8c8068');
  const tail = d.group(body, 0, 0.44, -0.2);
  tail.name = 'Peacock train';
  if (form === 'fan')
    // A displaying bird: five feathers stand in a fan behind it.
    for (let n = -2; n <= 2; n++) {
      const feather = d.group(tail, 0, 0, 0);
      feather.rotation.z = -n * 0.42;
      feather.rotation.x = -0.25;
      d.ball(feather, 0, 0.3, 0, [0.075, 0.3, 0.012], light);
      d.ball(feather, 0, 0.5, 0.012, [0.04, 0.05, 0.008], dark);
    }
  else {
    const train = d.ball(tail, 0, -0.1, -0.3, [0.11, 0.035, 0.36], light);
    train.rotation.x = 0.28;
    for (const z of [-0.2, -0.38, -0.54])
      d.ball(tail, 0, -0.1 + z * 0.3, z, [0.04, 0.012, 0.045], dark);
  }
  return { root, body, head, legs, wings: [], tail };
}

function goat(d, root, { look }) {
  const { coat, light, dark = coat } = look;
  const body = scaled(d, root, look);
  d.ball(body, 0, 0.56, -0.02, [0.17, 0.2, 0.33], coat);
  suited(d.ball(body, 0, 0.5, 0.0, [0.14, 0.14, 0.27], light));
  suited(d.rod(body, [0, 0.62, 0.24], [0, 0.82, 0.33], 0.08, coat));
  const head = d.group(body, 0, 0.87, 0.36);
  d.ball(head, 0, 0, 0, [0.1, 0.11, 0.13], coat);
  d.ball(head, 0, -0.045, 0.12, [0.062, 0.06, 0.11], light);
  d.ball(head, 0, -0.14, 0.1, [0.03, 0.07, 0.035], light).name = 'Goat beard';
  eyes(d, head, 0.088, 0.02, 0.06);
  for (const side of [-1, 1]) {
    // Horns sweep back and out, below the crown of the head.
    d.rod(head, [side * 0.045, 0.08, -0.01], [side * 0.09, 0.2, -0.1], 0.02, dark);
    d.rod(head, [side * 0.09, 0.2, -0.1], [side * 0.12, 0.2, -0.2], 0.014, dark);
    const ear = d.ball(head, side * 0.12, 0.02, -0.03, [0.06, 0.03, 0.04], coat);
    ear.rotation.z = side * 0.4;
  }
  const legs = fourLegs(d, body, 0.46, 0.11, 0.21, coat, dark);
  const tail = d.group(body, 0, 0.66, -0.32);
  d.ball(tail, 0, 0.04, -0.02, [0.035, 0.07, 0.04], light);
  return { root, body, head, legs, wings: [], tail };
}

function lynx(d, root, { look }) {
  const { coat, light, dark = coat } = look;
  const body = scaled(d, root, look);
  d.ball(body, 0, 0.36, -0.02, [0.18, 0.19, 0.36], coat);
  suited(d.ball(body, 0, 0.31, 0.2, [0.13, 0.15, 0.13], light));
  for (const [x, z] of [
    [-0.1, -0.16],
    [0.11, -0.04],
    [-0.09, 0.08],
    [0.08, -0.26],
  ])
    d.ball(body, x, 0.47, z, [0.03, 0.02, 0.035], dark);
  const head = d.group(body, 0, 0.53, 0.31);
  d.ball(head, 0, 0, 0, [0.14, 0.135, 0.14], coat);
  d.ball(head, 0, -0.045, 0.1, [0.075, 0.055, 0.07], light);
  d.ball(head, 0, -0.03, 0.165, [0.022, 0.018, 0.018], '#4a3b36');
  eyes(d, head, 0.085, 0.025, 0.1);
  for (const side of [-1, 1]) {
    // Cheek ruffs and tufted ears are what make a lynx.
    d.ball(head, side * 0.12, -0.06, 0.03, [0.055, 0.07, 0.06], light);
    d.mesh(head, 'cone', [0.06, 0.14, 0.05], [side * 0.09, 0.14, -0.03], coat);
    d.rod(head, [side * 0.09, 0.2, -0.03], [side * 0.1, 0.245, -0.035], 0.009, dark);
  }
  const legs = fourLegs(d, body, 0.26, 0.12, 0.23, coat, light, 0.046);
  const tail = d.group(body, 0, 0.4, -0.36);
  d.ball(tail, 0, 0, -0.04, [0.045, 0.045, 0.075], coat);
  d.ball(tail, 0, 0, -0.1, [0.035, 0.035, 0.035], dark);
  return { root, body, head, legs, wings: [], tail };
}

export const NEWCOMER_MODELS = {
  duck,
  swan,
  heron: wader,
  crane: wader,
  tortoise,
  peacock,
  goat,
  lynx,
};
