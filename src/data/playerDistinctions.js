// Player distinctions: limited badges that belong to a player's account, not to a town.
// Event distinctions mark being there at a key moment of the game (Alpha Player, later
// Beta Player and special events). The time distinction follows the time since the
// player's first sign-in and climbs on its own: weekly, then monthly, then yearly.
// Players only ever see the distinctions they received.
//
// The server alone decides who holds which distinction and at which time step
// (backend/src/PlayerDistinctions.php): the game never computes or grants one, it only
// shows what GET /account and shared towns report. A town may show at most one of them,
// in one of its three showcase slots. Distinctions are presentation only: they never
// change rewards, progression or puzzles.
//
// Like honours, a shipped ID is permanent: never reuse, rename or remove one.
// testing/fixtures/shipped-player-distinctions.json records them.

export const PLAYER_DISTINCTION_PREFIX = 'player-';
// `event`: granted by the server to the players present at that moment.
// `tenure`: the server's time step since the account's first sign-in, never stored.
export const DISTINCTION_KINDS = Object.freeze(['event', 'tenure']);

export const PLAYER_DISTINCTIONS = Object.freeze([
  {
    id: 'player-alpha',
    kind: 'event',
    name: 'Alpha Player',
    description: 'Played Prospect Hollow during its alpha, before the beta began.',
    popup: 'You played during the alpha. Thank you!',
    art: { letter: 'α' },
    palette: 'amethyst',
  },
  {
    id: 'player-time',
    kind: 'tenure',
    name: 'Loyal Prospector',
    description:
      'Time since your first sign-in. It grows every week, then every month after the first month, then every year after the first year.',
    // The popup reads "{time} since your first sign-in" (honourDisplay.js).
    art: { glyph: 'hourglass' },
    palette: 'midnight',
  },
]);
const DISTINCTION_BY_ID = Object.freeze(
  Object.fromEntries(PLAYER_DISTINCTIONS.map((definition) => [definition.id, definition])),
);
export const isPlayerDistinction = (id) =>
  typeof id === 'string' && id.startsWith(PLAYER_DISTINCTION_PREFIX);

// The time steps the server reports (PlayerDistinctions::STEPS). A new server unit
// needs its labels here (TENURE_TEXT in honourDisplay.js) before it can show.
const TENURE_UNITS = new Set(['week', 'month', 'year']);
const validAt = (at) => (Number.isSafeInteger(at) && at > 0 ? at : null);
const validStep = (step) =>
  !!step && TENURE_UNITS.has(step.unit) && Number.isSafeInteger(step.count) && step.count >= 1;

// One distinction as the server reported it, or null when unknown or malformed: `{ at }`
// for an event, `{ at, tenure: { unit, count, next? } }` for the time distinction.
function receivedEntry(id, saved) {
  const definition = DISTINCTION_BY_ID[id];
  if (!definition || !saved || typeof saved !== 'object') return null;
  if (definition.kind === 'event') return { at: validAt(saved.at) };
  if (!validStep(saved.tenure)) return null;
  const { unit, count, next } = saved.tenure;
  return {
    at: validAt(saved.at),
    tenure: {
      unit,
      count,
      ...(validStep(next) && validAt(next.at)
        ? { next: { unit: next.unit, count: next.count, at: next.at } }
        : {}),
    },
  };
}

/**
 * The owner's distinctions, keyed by ID, from their account (`distinctions` of
 * GET /account, kept with the account record for offline play). IDs this version
 * does not know are ignored.
 */
export function receivedDistinctions(account) {
  const received = {};
  for (const definition of PLAYER_DISTINCTIONS) {
    const entry = receivedEntry(definition.id, account?.distinctions?.[definition.id]);
    if (entry) received[definition.id] = entry;
  }
  return received;
}

/**
 * The one distinction a visited town shows, as the server publishes it
 * (`honours.distinction`: `{ id, at, tenure? }`), keyed by ID like
 * receivedDistinctions(). Empty when missing, unknown or malformed.
 */
export function publishedDistinction(saved) {
  const entry = receivedEntry(saved?.id, saved);
  return entry ? { [saved.id]: entry } : {};
}

// Received distinctions in catalog order, each with its definition.
export const distinctionList = (received = {}) =>
  PLAYER_DISTINCTIONS.filter((definition) => received[definition.id]).map((definition) => ({
    id: definition.id,
    definition,
    ...received[definition.id],
  }));

// A received distinction as a badge definition: HonourBadge draws its own shape and glow
// for `player`, and engraves the time step.
export function distinctionBadge(id, entry) {
  const definition = DISTINCTION_BY_ID[id];
  return definition ? { ...definition, player: true, tenure: entry?.tenure ?? null } : null;
}

// A key per received step, so a new time step reads as new while an older one does not.
export const distinctionKey = (id, entry) =>
  entry?.tenure ? `${id}@${entry.tenure.unit}-${entry.tenure.count}` : id;
