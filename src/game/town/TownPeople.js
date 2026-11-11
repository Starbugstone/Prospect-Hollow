import * as THREE from 'three';
import { eraEvolution } from '../../data/eras';
import { villagerBody, villagerIdentity, villagerRandom } from '../../data/villagers';
import { hasVisitorTransport } from '../../data/visitorArrivals';
import {
  VIP_MARKER,
  townWardrobe,
  residentOutfit,
  periodOutfit,
  vipOutfit,
  guestOutfit,
  liveVisitorOutfit,
} from '../../data/townWardrobes';
import { streetHeight, updateItinerary } from './TownItineraries';
import { prepareActorWalk, walkPose, placeSafely } from './TownNavigation';
import { SIDEWALK_OFFSET } from './TownTraffic';
import { updateWorkRoutine } from './TownWorkRoutine';
import { swingLimbs, VILLAGER_WALK_SPEED } from './TownGait';
import { addOutfitParts, outfitTraits } from './TownOutfitParts';

// Villagers, visitors and the stable's horses: articulated models built from the
// diorama's primitives, their era wardrobe and identity, and their walking pose.
// The locomotion system moves them; this module only shapes and animates them.
const point = (x, y, z) => new THREE.Vector3(x, y, z);

export function addPerson(
  d,
  {
    color,
    skin,
    hat,
    route,
    seed,
    work,
    dress,
    gender,
    parent = d.world,
    manual = false,
    visitor = false,
    liveVisitor = false,
    sheriff = false,
    loop = false,
    linear = false,
    era = d.town?.era,
    // Scripted actors (raiders, builders) keep the plain adult figure they were cast as.
    styled = !manual,
  },
) {
  const persistentKey = !manual && JSON.stringify([seed, work, visitor, sheriff, route]);
  const retained = d.retainedActors?.get(persistentKey);
  if (retained && retained.appearance.era === era) {
    d.retainedActors.delete(persistentKey);
    parent.add(retained.root);
    d.actors.push(retained);
    prepareActorWalk(d, retained);
    return retained;
  }
  const firstVIP = visitor && !manual ? d.drawVip(seed, 0) : null;
  const identity = firstVIP ?? villagerIdentity(seed, gender ?? (dress ? 'female' : undefined));
  const female = identity.gender === 'female';
  const profile = eraEvolution(era);
  const wardrobe = townWardrobe(profile);
  const resident = !visitor && !sheriff ? residentOutfit(profile, seed) : null;
  if (resident) {
    color = resident.shirt;
    dress ||= female && resident.variant === 1;
    hat = resident.hat;
  }
  // The period's palette and silhouette, and the villager's own body. Only ordinary
  // residents come as children or elders.
  const period = styled && !sheriff ? periodOutfit(profile, seed, identity.gender) : null;
  if (period && !resident) {
    color = period.shirt;
    hat = period.hat;
  }
  const traits = outfitTraits(period?.parts);
  // A scripted actor keeps the standard figure its props and poses were made for.
  const physique = period
    ? villagerBody(seed, !visitor && !work)
    : { age: 'adult', height: 1, build: 1, hairStyle: 0 };
  const child = physique.age === 'child',
    elder = physique.age === 'elder';
  if (sheriff && wardrobe.patrol) color = '#315d83';
  const root = d.group(parent);
  root.userData.villager = { ...identity, name: firstVIP?.name ?? null };
  // Manual incident actors still need the animated foreground renderer.
  root.userData.animated = true;
  if (sheriff) {
    root.name = wardrobe.patrol ? 'Town patrol officer' : 'Village sheriff';
    root.scale.setScalar(1.05);
  }
  // The whole figure scales to the villager's height; `root` stays at full size for the
  // doorway fade, the sheriff's stature and the contact shadow.
  const figure = d.group(root);
  figure.name = 'Villager figure';
  figure.scale.setScalar(physique.height);
  const body = d.group(figure, 0, 0.54, 0);
  const legColor = resident?.trousers ?? period?.trousers ?? wardrobe.trousers;
  d.box(body, 0.25, 0.19, 0.16, 0, 0, 0, period ? legColor : '#69654d', true);
  const torso = d.group(body, 0, 0.1, 0);
  torso.scale.x = physique.build;
  const shirt = d.box(torso, female ? 0.26 : 0.32, wardrobe.coat, 0.18, 0, 0.13, 0, color, true);
  // Rounded shoulders and a belt give the coat a shape of its own.
  const shoulders = d.ball(torso, 0, 0.13 + wardrobe.coat / 2 - 0.035, 0, [0.2, 0.062, 0.1], color);
  shoulders.name = 'Villager shoulders';
  const belt = d.box(
    torso,
    (female ? 0.26 : 0.32) + 0.014,
    0.04,
    0.19,
    0,
    0.13 - wardrobe.coat / 2 + 0.035,
    0,
    '#4c4338',
  );
  belt.name = 'Villager belt';
  belt.visible = !sheriff;
  const hips = d.mesh(body, 'cone', [0.17, 0.19, 0.13], [0, -0.015, 0], color);
  hips.visible = female;
  if (sheriff) {
    if (!d.geometries.badge) {
      const star = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const angle = Math.PI / 2 + (i * Math.PI) / 5,
          radius = i % 2 ? 0.45 : 1;
        star[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      star.closePath();
      d.geometries.badge = new THREE.ShapeGeometry(star);
    }
    d.mesh(torso, 'badge', [0.075, 0.075, 1], [-0.065, 0.2, 0.102], '#ffd15b');
    d.box(torso, 0.31, 0.05, 0.19, 0, -0.01, 0, '#4c4338');
    d.box(torso, 0.055, 0.04, 0.02, 0, -0.01, 0.105, '#ffd15b');
  }
  d.rod(torso, [0, 0.29, 0], [0, 0.39, 0], 0.055, skin);
  if (wardrobe.trim) {
    const collar = d.mesh(torso, 'cylinder', [0.13, 0.035, 0.1], [0, 0.29, 0], wardrobe.trim);
    collar.name = 'Glowing collar ring';
  }
  const residentDetails = d.group(torso);
  residentDetails.name = 'Neighbor garden clothing';
  if (resident) {
    root.userData.residentOutfit = resident;
    if (resident.apron) {
      const apron = d.box(residentDetails, 0.235, 0.34, 0.025, 0, 0.07, 0.112, resident.accent);
      apron.name = 'Gardener apron';
      for (const x of [-0.075, 0.075])
        d.box(residentDetails, 0.028, 0.19, 0.025, x, 0.24, 0.112, resident.accent);
    } else if (resident.variant === 1) {
      d.box(residentDetails, 0.205, 0.055, 0.215, 0, 0.29, 0, resident.accent, true);
      const scarf = d.box(
        residentDetails,
        0.055,
        0.16,
        0.028,
        0.065,
        0.195,
        0.117,
        resident.accent,
      );
      scarf.name = 'Neighbor linen scarf';
    }
    const pin = d.mesh(
      residentDetails,
      'rock',
      [0.025, 0.036, 0.012],
      [-0.09, 0.245, 0.121],
      resident.accent,
    );
    pin.name = 'Neighbor craft pin';
  }
  const head = d.group(torso, 0, 0.46, 0);
  // A child's head is large for its body; the head keeps its width on any build.
  const headSize = child ? 1.22 : 1;
  head.scale.set(headSize / physique.build, headSize, headSize);
  d.ball(head, 0, 0, 0, [0.12, 0.145, 0.115], skin);
  const hairColor = elder
    ? ['#d9d6cb', '#b9b5aa'][Math.floor(villagerRandom(seed + 977) * 2)]
    : (resident?.hair ?? period?.hair ?? '#73563d');
  const hairStyle = traits.hairStyle ?? physique.hairStyle;
  const balding = elder && !female && !!period;
  // An elder's hair has thinned to a fringe round the back of the head.
  const cap = balding
    ? d.ball(head, 0, 0.005, -0.045, [0.124, 0.085, 0.09], hairColor)
    : d.ball(head, 0, 0.045, -0.03, [0.123, 0.12, 0.097], hairColor);
  cap.name = 'Villager hair';
  if (!balding) cap.scale.multiplyScalar(traits.hairVolume);
  const hair = d.group(head);
  hair.name = 'Villager swept hair and bun';
  hair.scale.setScalar(traits.hairVolume);
  // Four ways to wear it: swept into a bun, a bob, a ponytail, or two plaits.
  const plaits = period && hairStyle === 3,
    bob = period && hairStyle === 1;
  for (const x of [-0.1, 0.1])
    if (plaits) d.ball(hair, x, -0.115, 0.02, [0.036, 0.17, 0.04], hairColor);
    else
      d.ball(hair, x, bob ? -0.04 : -0.015, -0.045, [0.045, bob ? 0.17 : 0.14, 0.085], hairColor);
  if (period && hairStyle === 2) {
    d.ball(hair, 0, 0.03, -0.125, [0.05, 0.05, 0.05], hairColor);
    d.ball(hair, 0, -0.1, -0.16, [0.045, 0.16, 0.05], hairColor);
  } else if (bob || plaits) d.ball(hair, 0, -0.035, -0.085, [0.11, 0.15, 0.065], hairColor);
  else d.ball(hair, 0, 0.015, -0.135, [0.085, 0.085, 0.07], hairColor);
  const crop = d.group(head);
  crop.name = 'Villager cropped hair';
  if (period && !balding) {
    if (hairStyle === 1) d.ball(crop, 0, 0.125, 0.055, [0.1, 0.05, 0.065], hairColor);
    else if (hairStyle === 2)
      d.ball(crop, 0.025, 0.105, -0.005, [0.125, 0.06, 0.105], hairColor).rotation.z = -0.22;
    else if (hairStyle === 3)
      for (const x of [-0.112, 0.112]) d.box(crop, 0.02, 0.1, 0.05, x, -0.02, 0.02, hairColor);
  }
  crop.visible = !female;
  const jaw = d.ball(head, 0, -0.06, 0.015, [0.105, 0.075, 0.095], skin);
  jaw.name = 'Villager broad jaw';
  hair.visible = female;
  jaw.visible = !female;
  d.ball(head, 0, -0.005, 0.111, [0.022, 0.028, 0.025], skin);
  for (const x of [-0.044, 0.044]) d.ball(head, x, 0.025, 0.105, 0.012, '#39392f');
  const headwear = d.group(head);
  headwear.visible = traits.hat;
  if (wardrobe.hat === 'cap' || (sheriff && wardrobe.patrol)) {
    d.ball(headwear, 0, 0.11, -0.005, [0.135, 0.065, 0.12], hat);
    d.box(headwear, 0.17, 0.025, 0.11, 0, 0.11, 0.105, hat, true);
  } else if (wardrobe.hat === 'visor') {
    // A wrap-around visor at eye level: one shared sphere, so it stays instanced.
    d.ball(headwear, 0, 0.03, 0.02, [0.128, 0.036, 0.118], wardrobe.visor ?? hat);
  } else if (wardrobe.hat !== 'none') {
    d.mesh(headwear, 'cylinder', [wardrobe.brim ?? 0.195, 0.025, 0.18], [0, 0.105, 0], hat);
    if (wardrobe.crown === 'round') d.ball(headwear, 0, 0.16, 0, [0.12, 0.11, 0.11], hat);
    else
      d.mesh(
        headwear,
        wardrobe.crown === 'flat' ? 'cylinder' : 'cone',
        [0.12, 0.115, 0.11],
        [0, 0.164, 0],
        hat,
      );
    d.mesh(headwear, 'cylinder', [0.122, 0.028, 0.112], [0, 0.129, 0], '#6a6050');
  }
  const vip = d.group(torso);
  vip.name = 'Honorary VIP visitor outfit';
  vip.visible = !!root.userData.villager.name;
  const accents = [];
  const scarf = d.group(vip),
    satchel = d.group(vip),
    sash = d.group(vip);
  scarf.visible = satchel.visible = sash.visible = false;
  if (visitor) {
    for (const x of [-0.065, 0.065])
      accents.push(d.box(vip, 0.035, wardrobe.coat * 0.62, 0.025, x, 0.15, 0.105, VIP_MARKER.trim));
    const badge = d.box(vip, 0.09, 0.09, 0.035, -0.1, 0.22, 0.125, VIP_MARKER.badge);
    badge.rotation.z = Math.PI / 4;
    badge.name = 'VIP gold badge';
    d.box(scarf, 0.25, 0.055, 0.025, 0, 0.305, 0.115, VIP_MARKER.trim);
    d.box(scarf, 0.055, 0.19, 0.025, 0.06, 0.19, 0.115, VIP_MARKER.trim);
    d.rod(satchel, [-0.1, 0.29, 0.11], [0.23, -0.14, 0.11], 0.015, '#8b674a');
    d.box(satchel, 0.15, 0.22, 0.15, 0.24, -0.15, 0.025, '#8b674a', true);
    d.box(satchel, 0.13, 0.06, 0.16, 0.24, -0.06, 0.03, '#ad8961', true);
    const ribbon = d.box(sash, 0.075, wardrobe.coat + 0.12, 0.035, 0, 0.13, 0.145, VIP_MARKER.trim);
    ribbon.rotation.z = -0.58;
    ribbon.name = 'Live visitor diagonal sash';
    const rosette = d.box(sash, 0.105, 0.105, 0.04, 0.11, -0.035, 0.15, VIP_MARKER.trim);
    rosette.rotation.z = Math.PI / 4;
  }
  const arms = [],
    legs = [],
    sleeves = [],
    trousers = [],
    boots = [];
  for (const side of [-1, 1]) {
    const arm = d.group(torso, side * 0.18, 0.24, 0);
    sleeves.push(d.rod(arm, [0, 0, 0], [side * 0.015, -0.2, 0], 0.05, color));
    const fore = d.group(arm, side * 0.015, -0.2, 0);
    d.rod(fore, [0, 0, 0], [0, -0.18, 0], 0.039, skin);
    d.ball(fore, 0, -0.19, 0, [0.045, 0.057, 0.04], skin);
    arms.push({ upper: arm, lower: fore });
    const thigh = d.group(body, side * 0.078, -0.065, 0);
    trousers.push(d.rod(thigh, [0, 0, 0], [0, -0.22, 0], 0.065, legColor));
    const shin = d.group(thigh, 0, -0.22, 0);
    trousers.push(d.rod(shin, [0, 0, 0], [0, -0.21, 0], 0.047, legColor));
    boots.push(
      d.box(
        shin,
        0.105,
        0.08,
        0.19,
        0,
        -0.215,
        0.035,
        resident?.boots ?? period?.boots ?? wardrobe.boots,
        true,
      ),
    );
    legs.push({ upper: thigh, lower: shin });
  }
  const skirt = d.mesh(body, 'cone', [0.2, 0.29, 0.17], [0, -0.085, 0], color);
  // The period decides who wears a skirt and how long; a dress is always one.
  dress ||= !!period && female && (!!wardrobe.skirt || traits.skirt);
  const skirtLength = period ? period.skirtLength : 0.29;
  // The period's silhouette hangs on the joints it follows. A named VIP wears the VIP
  // outfit instead, so these stay apart from the clothing a VIP recolours.
  const silhouette = [head, torso, body].map((joint) => d.group(joint));
  silhouette.forEach((group) => {
    group.name = 'Period silhouette';
  });
  if (period) {
    addOutfitParts(
      d,
      {
        head: silhouette[0],
        torso: silhouette[1],
        body: silhouette[2],
        coat: wardrobe.coat,
        width: female ? 0.26 : 0.32,
        shirt: color,
        trousers: resident?.trousers ?? period.trousers,
        hat,
        accent: period.accent,
        hair: hairColor,
        skirt: !!dress,
        child,
      },
      period.parts,
    );
    if (!wardrobe.trim)
      d.mesh(
        silhouette[1],
        'cylinder',
        [0.088, 0.036, 0.078],
        [0, 0.13 + wardrobe.coat / 2 + 0.008, 0],
        period.accent,
      ).name = 'Villager collar';
    // Some elders walk with a stick, held in the swinging hand.
    if (elder && villagerRandom(seed + 421) < 0.6)
      d.rod(arms[1].lower, [0, -0.19, 0.02], [0, -0.66, 0.1], 0.014, '#7b5b3c').name =
        'Walking stick';
  }
  const appearance = {
    hair,
    crop,
    jaw,
    hips,
    skirt,
    belt,
    dress,
    sheriff,
    era,
    residentDetails,
    silhouette,
    hat: traits.hat,
    flare: traits.flare,
    skirtLength,
    gender: identity.gender,
  };
  skirt.visible = !!dress || (female && !sheriff && eraEvolution(era).wardrobe === 'frontier');
  dressSkirt(appearance, skirtLength, traits.flare);
  const sampledRoute = [];
  route.forEach((p, i) => {
    const previous = route[i - 1];
    if (linear && previous?.[1] === 7.5 && p[1] === 7.5) {
      const count = Math.ceil(Math.abs(p[0] - previous[0]) * 4);
      for (let n = 1; n < count; n++)
        sampledRoute.push([previous[0] + ((p[0] - previous[0]) * n) / count, 7.5]);
    }
    sampledRoute.push(p);
  });
  const points = sampledRoute.map(([x, z]) => point(x, linear ? streetHeight(x, z) : 0.07, z));
  const journey = loop ? points : [...points, ...points.slice(1, -1).reverse()];
  const curve = linear
    ? new THREE.CurvePath()
    : new THREE.CatmullRomCurve3(journey, true, 'catmullrom', 0.15);
  if (linear)
    for (let i = 0; i < journey.length; i++)
      curve.add(new THREE.LineCurve3(journey[i], journey[(i + 1) % journey.length]));
  const duration = curve.getLength() / (sheriff ? 0.8 : VILLAGER_WALK_SPEED);
  const actor = {
    root,
    body,
    torso,
    head,
    arms,
    legs,
    curve,
    duration,
    seed,
    work,
    visitor,
    liveVisitor,
    manual,
    vip,
    shirt,
    appearance,
    stride: 0.58 * physique.height,
    stoop: elder ? 0.09 : 0,
    clothing: {
      shirt: [shirt, shoulders, hips, skirt, ...sleeves],
      trousers,
      boots,
      hat: headwear.children,
      accent: accents,
      headwear,
      accessories: { scarf, satchel, sash },
    },
    shirtColor: color,
    distance: 0,
  };
  actor.originalClothing = [
    shirt,
    shoulders,
    hips,
    skirt,
    ...sleeves,
    ...trousers,
    ...boots,
    ...headwear.children,
    ...accents,
  ].map((mesh) => [mesh, mesh.material]);
  if (!manual) d.actors.push(actor);

  root.traverse((object) => {
    if (object.isMesh) object.castShadow = false;
  });
  if (!manual) d.contactShadow(root, 0.27, 0.18);
  actor.persistentKey = persistentKey;
  if (retained) {
    d.retainedActors.delete(persistentKey);
    for (const key of ['id', 'motion', 'distance', 'acceptedDistance', 'visit', 'lastPoseTime'])
      if (retained[key] !== undefined) actor[key] = retained[key];
    root.position.copy(retained.root.position);
    root.rotation.copy(retained.root.rotation);
    root.scale.copy(retained.root.scale);
    setVillagerIdentity(d, actor, retained.root.userData.villager);
    d.clearGroup(retained.root);
  }
  root.userData.locomotionActor = actor;
  prepareActorWalk(d, actor);
  return actor;
}
// Every random VIP draw goes through here. A read-only shared town has no VIPs at all;
// the owner's share-link guest has its own arrival in TownVipArrivals.
// A skirt of this length hangs from the waist; `flare` widens a full skirt.
function dressSkirt(appearance, length, flare = 1) {
  const { skirt } = appearance;
  skirt.scale.set(0.2 * flare, length, 0.17 * flare);
  skirt.position.y = length === 0.29 ? -0.085 : 0.025 - length / 2;
}
export function setVillagerIdentity(d, actor, identity, outfitSeed = actor.seed ?? 0) {
  actor.root.userData.villager = identity;
  const female = identity.gender === 'female';
  const a = actor.appearance;
  a.hair.visible = a.hips.visible = female;
  a.jaw.visible = a.crop.visible = !female;
  a.skirt.visible = female && (a.dress || eraEvolution(a.era).wardrobe === 'frontier');
  actor.shirt.scale.x = female ? 0.26 : 0.32;
  a.belt.scale.x = actor.shirt.scale.x + 0.014;
  actor.vip.visible = !!identity.name;
  a.residentDetails.visible = !identity.name;
  // The silhouette was cut for the villager first drawn here: a named VIP, or a visit by
  // someone of the other gender, goes without it.
  const own = !identity.name && identity.gender === a.gender;
  a.silhouette.forEach((group) => {
    group.visible = own;
  });
  if (identity.name) {
    const profile = eraEvolution(a.era);
    const outfit = identity.live
      ? liveVisitorOutfit(profile)
      : identity.guest
        ? guestOutfit(profile)
        : vipOutfit(profile, outfitSeed);
    actor.root.userData.outfit = outfit;
    for (const part of ['shirt', 'trousers', 'boots', 'hat', 'accent'])
      for (const mesh of actor.clothing[part]) mesh.material = d.material(outfit[part]);
    actor.shirt.scale.y = outfit.coat;
    actor.clothing.headwear.visible = outfit.hatVisible;
    a.skirt.visible = female && outfit.skirt;
    dressSkirt(a, outfit.skirtLength);
    a.skirt.position.y = 0.025 - outfit.skirtLength / 2;
    for (const [type, group] of Object.entries(actor.clothing.accessories))
      group.visible = outfit.accessory === type;
    actor.clothing.accent.forEach((mesh) => {
      mesh.visible = outfit.accessory === 'lapels';
    });
    actor.clothing.accessories.scarf.children.forEach((mesh) => {
      mesh.material = d.material(outfit.accent);
    });
    actor.clothing.accessories.sash.children.forEach((mesh) => {
      mesh.material = d.material(outfit.accent);
    });
  } else {
    delete actor.root.userData.outfit;
    actor.originalClothing.forEach(([mesh, material]) => {
      mesh.material = material;
    });
    actor.shirt.scale.y = townWardrobe(eraEvolution(a.era)).coat;
    actor.clothing.headwear.visible = a.hat || !own;
    dressSkirt(a, a.skirtLength, a.flare);
  }
}
export function animatePerson(d, actor, time) {
  updateWorkRoutine(actor, time);
  updateItinerary(d, actor, time);
  time = actor.motion?.animationTime ?? time;
  const { root, body, torso, head, arms, legs, curve, duration, seed, work } = actor;
  const cycle = (time + seed) % (duration + 4);
  if (!actor.workRoutine && !actor.itinerary) actor.routeResting = !work && cycle >= duration;
  let walking = !work && cycle < duration;
  const progress = work?.length ? 0.1 : Math.min(cycle / duration, 0.9999);
  const placedWorker = work && (actor.motion || actor.workRoutine);
  if (!actor.walkPath && !placedWorker) root.position.copy(curve.getPointAt(progress));
  let routeProgress = actor.itinerary ? (actor.routeProgress ?? 0) : progress;
  if (actor.visitor && !actor.liveVisitor && !actor.transportVisitor && !actor.itinerary) {
    const phase = (time + seed) % (duration + 7);
    actor.routeResting = phase >= duration;
    const visit = Math.floor((time + seed) / (duration + 7));
    if (actor.visit !== visit) {
      actor.visit = visit;
      const chosen = hasVisitorTransport(d.town) ? null : d.drawVip(seed, visit);
      setVillagerIdentity(d, actor, chosen ?? villagerIdentity(seed), seed + visit * 997);
    }
    const isVIP = !!root.userData.villager.name;
    actor.vip.visible = isVIP;
    routeProgress = Math.min(0.9999, phase / duration);
    if (!actor.walkPath) root.position.copy(curve.getPointAt(routeProgress));
    // Visitors leave their host building, walk the town and return through
    // the same entrance. The quiet interval is indoors between visits.
    root.scale.setScalar(Math.max(0, Math.min(1, phase / 0.8, (duration - phase) / 0.8)));
    root.visible = root.scale.x > 0;
    walking = phase < duration;
  }

  if (
    actor.motion &&
    actor.walkPath?.total &&
    (!actor.manual || actor.transportVisitor || actor.liveVisitor)
  )
    routeProgress =
      actor.itinerary && actor.itinerary.phase !== 'finishing'
        ? Math.min(1, actor.motion.routeDistance / actor.walkPath.total)
        : (actor.motion.routeDistance % actor.walkPath.total) / actor.walkPath.total;
  if (!actor.workRoutine) actor.routeProgress = routeProgress;
  if (actor.walkPath && !placedWorker) {
    const pose = walkPose(actor.walkPath, routeProgress, actor.walkPose);
    root.position.set(pose.x, pose.y, pose.z);
    root.rotation.y = pose.heading;
  } else if (!placedWorker) {
    const tangent = curve.getTangentAt(Math.min(0.9999, routeProgress));
    root.rotation.y = Math.atan2(tangent.x, tangent.z);
    if (!work && (!actor.manual || actor.transportVisitor)) {
      const doorway = actor.transportVisitor
        ? Math.min(1, root.position.distanceTo(actor.door) / 2)
        : 1;
      const offset = SIDEWALK_OFFSET * (actor.visitor ? root.scale.x : 1) * doorway;
      root.position.x += tangent.z * offset;
      root.position.z -= tangent.x * offset;
    }
  }
  // Prepared route samples provide pose/height; locomotion owns their accepted
  // ground position, including after a retained-solid correction. Curve-only
  // walkers still need their new sampled position as the next locomotion target.
  if (actor.walkPath && Number.isFinite(actor.motion?.x) && Number.isFinite(actor.motion?.z)) {
    root.position.x = actor.motion.x;
    root.position.z = actor.motion.z;
  }
  // Do not repeat an established worker's placement search every frame.
  if (work && !actor.motion && !actor.workRoutine) placeSafely(d, root);
  if (!actor.motion && actor.lastPosition && time >= actor.lastPoseTime)
    actor.distance += root.position.distanceTo(actor.lastPosition);
  actor.lastPosition ??= new THREE.Vector3();
  actor.lastPosition.copy(root.position);
  actor.lastPoseTime = time;
  if (actor.motion) walking = actor.motion.state === 'moving';
  const step = (actor.distance / (actor.stride ?? 0.58)) * Math.PI * 2;
  body.position.y =
    0.54 + (walking ? Math.cos(step * 2) * 0.013 : Math.sin(time * 1.8 + seed) * 0.005);
  torso.rotation.z = walking ? Math.sin(step) * 0.025 : 0;
  head.rotation.y = walking
    ? Math.sin(time * 0.7 + seed) * 0.1
    : Math.sin(time * 0.8 + seed) * 0.25;
  swingLimbs(arms, legs, step, walking);
  if (!walking) {
    const activity = actor.workRoutine && !actor.workActive ? null : work;
    if (activity === 'farm') {
      torso.rotation.x = 0.22 + Math.sin(time * 1.9) * 0.12;
      arms[0].upper.rotation.x = -0.7 + Math.sin(time * 1.9) * 0.3;
    } else if (activity === 'fishing') {
      torso.rotation.x = 0.04;
      arms[1].upper.rotation.x = -0.65 + Math.sin(time * 0.7) * 0.05;
      arms[1].lower.rotation.x = -0.5;
    } else {
      torso.rotation.x = 0;
      arms[1].upper.rotation.z = activity === 'greet' ? -0.12 : 0;
      arms[1].lower.rotation.x =
        activity === 'greet' ? -0.45 + Math.sin(time * 1.2 + seed) * 0.16 : -0.16;
    }
  } else {
    torso.rotation.x = 0;
    arms[1].upper.rotation.z = 0;
  }
  if (actor.stoop) torso.rotation.x += actor.stoop;
}
// Coat, upper leg, lower leg and mane.
const HORSE_COATS = [
  ['#a97950', '#986b46', '#b38c63', '#594b34'],
  ['#8a5a3c', '#7a4f35', '#e9dfcb', '#3d3028'],
  ['#b9b4a8', '#a6a195', '#8f8a80', '#e8e3d8'],
  ['#4a4039', '#3f3631', '#4a4039', '#2b2522'],
  ['#d9b77c', '#c9a76e', '#efe5cf', '#f1e7d0'],
];
export function addHorse(d, x, z, rotation, scale = 1) {
  const root = d.group(d.world, x, 0.07, z);
  root.userData.animated = true;
  root.rotation.y = rotation;
  root.scale.setScalar(scale);
  // Each horse has its own coat, fixed by where it stands: bay, chestnut, grey or black.
  const [coat, leg, sock, mane] =
    HORSE_COATS[Math.floor(villagerRandom(Math.round(x * 31 + z * 17)) * HORSE_COATS.length)];
  d.ball(root, 0, 0.73, 0, [0.24, 0.31, 0.55], coat);
  for (const dx of [-0.15, 0.15])
    for (const dz of [-0.33, 0.33]) {
      d.rod(root, [dx, 0.64, dz], [dx, 0.3, dz + 0.02], 0.055, leg);
      d.rod(root, [dx, 0.3, dz + 0.02], [dx, 0.05, dz + 0.04], 0.04, sock);
      d.box(root, 0.1, 0.08, 0.13, dx, 0.05, dz + 0.06, '#574b36', true);
    }
  const head = d.group(root, 0, 0.84, 0.39);
  d.ball(head, 0, 0.22, 0.05, [0.13, 0.38, 0.18], coat);
  d.ball(head, 0, 0.44, 0.18, [0.13, 0.14, 0.23], coat);
  d.ball(head, 0, 0.3, -0.08, [0.04, 0.3, 0.09], mane).name = 'Horse mane';
  for (const dx of [-0.075, 0.075]) {
    d.ball(head, dx, 0.64, 0.11, [0.035, 0.1, 0.06], coat);
    d.ball(head, dx * 1.7, 0.49, 0.22, 0.018, '#393d30');
  }
  d.box(root, 0.35, 0.09, 0.28, 0, 1.04, -0.02, '#637e79', true);
  const tail = d.group(root, 0, 0.86, -0.47);
  d.rod(tail, [0, 0, 0], [0, -0.46, -0.19], 0.055, mane);
  d.motions.push((time) => {
    head.rotation.x = 0.18 + Math.sin(time * 0.9 + rotation) * 0.14;
    tail.rotation.z = Math.sin(time * 1.5 + rotation) * 0.3;
    root.rotation.z = Math.sin(time * 0.65 + rotation) * 0.025;
  });

  root.traverse((object) => {
    if (object.isMesh) object.castShadow = false;
  });
  d.contactShadow(root, 0.3, 0.63);
}
