// The puzzle's dice. A level starts with its own seed, so a run replays exactly from that seed and
// the player's moves. Only rules use this: animation and sound keep Math.random so a sparkle can't
// shift a falling gem. Without a seed (the simulator, unit tests) it follows Math.random.
let stream = null;

export const gameRandom = () => (stream ? stream() : Math.random());

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function useSeed(seed) {
  stream = seed === null ? null : seededRandom(seed);
}
