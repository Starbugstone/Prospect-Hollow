// Plain sentences for the findings the server records with a sync event: what it skipped
// or corrected, and why. Unknown kinds and checks still read, from their raw names.
import { buildingLabel, powerLabel } from './labels';

const shown = (value) =>
  value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

// What the game asked for, by action kind; the subject (building, level, item) follows.
const ACTIONS = {
  'building-buy': ['Buy', buildingLabel],
  'building-finish': ['Finish', buildingLabel],
  'building-hammer': ['Use a builder hammer on', buildingLabel],
  victory: ['Win level', String],
  continuous: ['Continuous play on level', String],
  'run-start': ['Start level', String],
  'power-spend': ['Use', powerLabel],
  'shop-buy': ['Buy', powerLabel],
  'chest-claim': ['Open chest', String],
  'vip-spend': ['VIP visit to', buildingLabel],
  'era-advance': ['Advance from era', String],
};
const actionName = (kind) => ACTIONS[kind]?.[0] ?? kind.replaceAll('-', ' ');

// Why the replay refused an action, with the server's and the game's values.
const CHECKS = {
  project_missing: () => 'nothing was under construction there on the server',
  stage: (f) => `the stage differed (server ${shown(f.server)}, game ${shown(f.client)})`,
  wins: (f) => `the project had ${shown(f.server)} of the ${shown(f.client)} puzzle wins it needs`,
  no_offer: () => 'the server had nothing on offer there',
  no_hammer: () => 'no builder hammer was left on the server',
  coins: (f) => `the server had ${shown(f.server)} coins for a ${shown(f.client)}-coin price`,
  unknown_building: () => 'the building is unknown to the server',
  unknown_item: () => 'the item is unknown to the server',
  none_left: () => 'none were left on the server',
  visit: () => 'the shop visit differed',
  sold_out: () => 'it was already sold',
  full: (f) => `storage was full (${shown(f.server)} of ${shown(f.client)})`,
  chest_missing: () => 'no such chest was waiting on the server',
  cooldown: () => 'it was still cooling down',
  nothing_stored: () => 'nothing was stored to collect',
};
// A journal that could not continue from the cloud checkpoint.
const JOURNALS = {
  missing: () => 'The upload had no action journal',
  epoch: () => 'The upload’s journal belongs to another history than the cloud save',
  ahead: (f) =>
    `The upload’s journal starts at action ${shown(f.client)}, after the cloud checkpoint (${shown(f.server)})`,
  behind: (f) =>
    `The upload’s journal ends at action ${shown(f.client)}, before the cloud checkpoint (${shown(f.server)})`,
};

export function findingText(finding) {
  if (finding.kind === 'value')
    return `${finding.field}: the server kept ${shown(finding.server)}, the game had ${shown(finding.client)}.`;
  if (finding.kind === 'journal') {
    const describe = JOURNALS[finding.check] ?? (() => `Journal problem (${finding.check})`);
    return `${describe(finding)}, so nothing in it was replayed and the protected values came from the cloud save.`;
  }
  const subject =
    finding.subject === undefined
      ? ''
      : ` ${(ACTIONS[finding.kind]?.[1] ?? String)(finding.subject)}`;
  const number = finding.sequence === undefined ? '' : `#${finding.sequence} `;
  const check = CHECKS[finding.check];
  const why = check
    ? check(finding)
    : finding.check
      ? `check ${finding.check} failed`
      : `the replay refused it (${finding.field ?? 'no detail'})`;
  return `${number}${actionName(finding.kind)}${subject}: skipped because ${why}.`;
}

// The headline of a sync event: its first finding, or the error the server gave.
export const eventCause = (event) =>
  event.findings?.length ? findingText(event.findings[0]) : event.message;
