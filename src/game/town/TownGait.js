// A valley villager's walking pace in world units per second: residents, visitors,
// VIPs and anyone leaving a worksite. The sheriff patrols faster; Moon settlers keep
// their own pace along the ring.
export const VILLAGER_WALK_SPEED = 0.55;

// The walk cycle every villager shares, in the valley and on the Moon: legs stride
// with a bending knee and arms swing against them. `step` advances by a full turn per
// stride; standing figures relax their arms. Figures follow the villager skeleton:
// two `arms` and two `legs`, each an `{ upper, lower }` pair of joint groups.
export function swingLimbs(arms, legs, step, walking) {
  for (let n = 0; n < 2; n++) {
    const swing = Math.sin(step + n * Math.PI);
    legs[n].upper.rotation.x = walking ? swing * 0.36 : 0;
    legs[n].lower.rotation.x = walking ? Math.max(0, -swing) * 0.6 : 0;
    arms[n].upper.rotation.x = walking ? -swing * 0.28 : -0.12;
    arms[n].lower.rotation.x = -0.16;
  }
}
