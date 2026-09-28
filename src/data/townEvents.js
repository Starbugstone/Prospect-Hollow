import { eraEvolution } from './eras';
// Old receipts without a kind remain Frontier raids, even after an era update.
export const eventKind = (event) => event?.kind ?? 'bandits';
export const eraEventKind = (era) => eraEvolution(era).incident;
export const civicIncident = (kind) => ['workshop-fire', 'storm-cleanup'].includes(kind);
export const fireProtection = (level = 0) => [0, 2 / 3, 5 / 6, 1][Math.min(3, Math.max(0, level))];
export const eventHeading = (event) =>
  ({
    bandits: 'FRONTIER ENCOUNTER',
    'cargo-theft': 'CARGO THEFT',
    'workshop-fire': 'WORKSHOP FIRE',
    'storm-cleanup': 'RIVER STORM',
  })[eventKind(event)];

// Era incidents play in story beats; the renderer maps them onto real seconds.
export const INCIDENT_BEATS = 30;
export const CARGO_CRATES = 4;
// Recorded cues each incident kind may play; credits: public/sound/village/credits.html.
export const INCIDENT_AUDIO = Object.freeze({
  bandits: Object.freeze(['bandit-shot', 'sheriff-shot', 'yeehaw']),
  'cargo-theft': Object.freeze(['crate-break', 'patrol-whistle']),
  'workshop-fire': Object.freeze(['fire-crackle', 'fire-bell', 'fire-hose', 'bucket-splash']),
  'storm-cleanup': Object.freeze(['thunder', 'chainsaw']),
});
// A cue plays at its beat; a loop with `until` stops at that beat.
const cue = (at, kind, until = null, id = kind) => ({ id, at, kind, until });
const cover = (level, gang) => Math.min(1, (2 * Math.max(0, level || 0)) / Math.max(1, gang || 2));
const CARGO_SCENES = {
  warehouse: 'Thieves break into the warehouse',
  railDepot: 'Thieves break into the rail depot',
  riverPort: 'Thieves break into the river port',
};

/**
 * One saved receipt drives the cast, the choreography and every caption, so the
 * scene can never show a different incident from the outcome the town received.
 * Responders always reach the scene before anyone is caught; only thieves the
 * defenses could not cover get away, and only unprotected goods leave with them.
 */
export function incidentScript(event) {
  const kind = eventKind(event),
    loss = Math.max(0, event?.loss ?? 0),
    safe = event?.outcome === 'protected';
  if (kind === 'bandits') {
    const patrol = (event?.sheriffLevel ?? 0) > 0;
    return {
      kind,
      responders: patrol ? 1 : 0,
      damage: loss > 0,
      cues: [],
      phases: [
        [0, 'Riders on the ridge'],
        [8, 'Warning shots'],
        [12, safe ? 'The law holds the line' : 'Bandits at the mine'],
        [
          17,
          patrol ? 'Hands up!' : loss ? 'Nobody stops the gang' : 'The gang finds nothing to take',
        ],
        [22, 'Back to the open trail'],
      ],
    };
  }
  if (civicIncident(kind)) {
    const fire = kind === 'workshop-fire';
    // Receipts from before station levels were saved keep their recorded result.
    const level = Math.min(3, Math.max(0, event?.fireStationLevel ?? (safe ? 3 : 0)));
    const brigade = level > 0,
      intensity = safe ? 0 : 1 - fireProtection(level),
      arrive = brigade ? 11 : 12,
      // A stronger station stops the fire (or clears debris) sooner and smaller.
      resolved = arrive + (brigade ? 2.5 + 6 * intensity : 8);
    // Sound follows what is on screen: flames until they are out, the brigade's
    // bell and hose, or buckets thrown in rhythm by the neighbors' line.
    const cues = fire
      ? [
          cue(0.2, 'fire-crackle', resolved + (loss ? 1.5 : 0)),
          ...(brigade
            ? [
                cue(2, 'fire-bell', null, 'bell-dispatch'),
                cue(arrive - 2.5, 'fire-bell', null, 'bell-arrival'),
                cue(arrive + 1, 'fire-hose', resolved),
              ]
            : Array.from({ length: Math.ceil((resolved - arrive - 1.1) / 1.8) }, (_, n) =>
                cue(arrive + 0.8 + n * 1.8, 'bucket-splash', null, `bucket-${n}`),
              )),
        ]
      : [cue(0.3, 'thunder'), cue(arrive + 0.5, 'chainsaw', resolved)];
    return {
      kind,
      responders: 3,
      brigade,
      intensity,
      damage: loss > 0,
      dispatch: 2,
      arrive,
      resolved,
      leave: resolved + 1.5,
      cues,
      phases: [
        [0, fire ? 'Smoke at the workshop' : 'Branches across the promenade'],
        [
          4,
          fire
            ? brigade
              ? 'The fire brigade is on its way'
              : 'Neighbors run for buckets'
            : brigade
              ? 'The city crew is on its way'
              : 'Neighbors come to help',
        ],
        [
          arrive,
          fire
            ? brigade
              ? 'Hoses on the flames'
              : 'A bucket line fights the fire'
            : 'Clearing the promenade',
        ],
        [
          resolved,
          fire
            ? loss
              ? 'The fire is out · cleanup needed'
              : 'The workshop is saved'
            : 'The promenade is clear',
        ],
      ],
    };
  }
  // Cargo theft: the patrol, the bank and the thieves share one set of facts.
  const gang = event?.gangSize ?? 2,
    officers = Math.min(3, Math.max(safe ? 1 : 0, event?.sheriffLevel ?? 0)),
    thieves = Math.min(4, Math.max(2, Math.ceil(gang / 2)));
  let caught = !officers
    ? 0
    : safe
      ? thieves
      : Math.max(1, Math.round(thieves * cover(event?.sheriffLevel, gang)));
  // A loss always has someone carrying it away from the scene.
  if (loss && caught >= thieves) caught = thieves - 1;
  const escaped = thieves - caught,
    locked = Math.min(
      loss ? CARGO_CRATES - 1 : CARGO_CRATES,
      Math.round(CARGO_CRATES * cover(event?.bankLevel, gang)),
    ),
    carried = loss ? Math.min(escaped, CARGO_CRATES - locked) : 0,
    arrive = 13,
    // Uncovered thieves bolt when the patrol comes into sight, never before.
    scatter = officers && escaped ? arrive - 2.5 : officers ? null : 14,
    escort = officers ? arrive + 4 : null,
    target = event?.targets?.find((id) => Object.hasOwn(CARGO_SCENES, id));
  const phases = [
    [0, CARGO_SCENES[target] ?? 'Thieves near the freight yard'],
    [4, officers ? 'The patrol races to the scene' : 'No patrol answers the alarm'],
  ];
  if (officers) {
    if (escaped) phases.push([scatter, 'The thieves scatter!']);
    phases.push(
      [arrive, 'Hands up!'],
      [escort, 'Marched off to the lock-up'],
      [escort + 5, safe ? 'The cargo is safe' : loss ? 'Some cargo got away' : 'Nothing was taken'],
    );
  } else
    phases.push([
      scatter,
      loss ? 'The thieves get away with cargo' : 'The thieves leave empty-handed',
    ]);
  // The break-in, then the patrol's whistle as it sets off and as it closes in.
  const cues = [cue(0.6, 'crate-break')];
  if (officers)
    cues.push(
      cue(2.3, 'patrol-whistle', null, 'whistle-dispatch'),
      cue(scatter ?? arrive - 1, 'patrol-whistle', null, 'whistle-arrival'),
    );
  else cues.push(cue(6, 'crate-break', null, 'crate-pried'));
  return {
    kind,
    responders: officers,
    cues,
    damage: loss > 0,
    thieves,
    caught,
    escaped,
    locked,
    carried,
    dispatch: 2,
    arrive,
    scatter,
    escort,
    phases,
  };
}
export const phaseAt = (script, time) =>
  script.phases.reduce(
    (current, [at, phase]) => (time >= at ? phase : current),
    script.phases[0][1],
  );
export const incidentPhase = (event, time) => phaseAt(incidentScript(event), time);

export const incidentStory = (event) => {
  const script = incidentScript(event);
  if (eventKind(event) === 'storm-cleanup')
    return {
      speaker: 'Ada · the caretaker',
      title: event.loss ? 'After the river storm' : 'The city crew kept everyone safe',
      text: event.loss
        ? 'Storm cleanup cost {coins} coins. All buildings remain intact. The fire station coordinates the response.'
        : script.brigade
          ? 'The city crew cleared the promenade. Every coin is safe and all buildings stay open.'
          : 'Neighbors cleared the promenade. Every coin is safe and all buildings stay open.',
    };
  if (eventKind(event) === 'workshop-fire')
    return {
      speaker: 'Ada · the caretaker',
      title: event.loss
        ? 'A small workshop fire'
        : script.brigade
          ? 'The brigade kept the town safe'
          : 'Neighbors put out the fire',
      text: event.loss
        ? script.brigade
          ? 'Cleanup cost {coins} coins. Every building is intact. Upgrade the fire station to protect more of your savings.'
          : 'Cleanup cost {coins} coins. Every building is intact. A fire station sends a brigade before the flames spread.'
        : script.brigade
          ? 'The fire brigade protected every coin. The workshop is safe and every building stays open.'
          : 'A bucket line saved the workshop. No coins were lost and every building stays open.',
    };
  return {
    speaker: 'Sam · the sheriff',
    title: event.loss
      ? 'Trouble at the freight yard'
      : event.outcome === 'protected'
        ? 'The cargo is safe'
        : 'Nothing worth taking',
    text: event.loss
      ? 'Cargo thieves took {coins} coins. Upgrade the police and bank to protect your savings.'
      : event.outcome === 'protected'
        ? 'The town patrol secured the cargo. Every coin is safe.'
        : 'The thieves found no spare coins. Your last savings are safe.',
  };
};
