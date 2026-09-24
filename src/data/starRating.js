import { STAR_SCORE_TARGETS } from './starScoreTargets.js';

export const STAR_SCORE_MULTIPLIER = 1.5;
export const STAR_CASCADE_TARGET = 4;
export const starGoals = (target) => ({
  score: target,
  bonusScore: Math.ceil(target * STAR_SCORE_MULTIPLIER),
  cascade: STAR_CASCADE_TARGET,
});

export const getStars = (score, target, combo) =>
  1 +
  Number(target > 0 && score >= target) +
  Number(combo >= STAR_CASCADE_TARGET || (target > 0 && score >= starGoals(target).bonusScore));

// Future or incomplete level definitions retain a usable score target.
export const getLevelStarTarget = (id, fallback) => {
  const authored = Number.isInteger(id) && id > 0 ? STAR_SCORE_TARGETS[id - 1] : null;
  return Number.isFinite(authored) && authored > 0 ? authored : fallback;
};
