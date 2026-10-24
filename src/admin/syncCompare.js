// The admin sync comparison: every value where the cloud save, the state the server
// replayed from it and the rejected upload differ, with the rejected field first.
const container = (value) => value !== null && typeof value === 'object';
const empty = (value) => container(value) && !Object.keys(value).length;
// PHP sends an empty map as [], and a save may omit an empty one: all count as the same.
const blank = (value) => value === undefined || empty(value);
const sameValue = (a, b) => (blank(a) && blank(b)) || JSON.stringify(a) === JSON.stringify(b);
export const shownValue = (value) => (value === undefined ? '—' : JSON.stringify(value));
// What an admin types: JSON when it parses, otherwise plain text.
function typedValue(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function leaves(value, path, found) {
  if (container(value) && !empty(value))
    for (const [key, entry] of Object.entries(value)) leaves(entry, [...path, key], found);
  else if (path.length) found.set(JSON.stringify(path), value);
  return found;
}
// The replay compares town landmarks under another name than the save stores them.
const SAVED_PATHS = [
  ['town.landmarks.areas', 'town.personalisation.areas'],
  ['town.landmarks.levels', 'town.personalisation.areaLevels'],
];
export function savedField(field) {
  if (!field) return '';
  const alias = SAVED_PATHS.find(
    ([compared]) => field === compared || field.startsWith(`${compared}.`),
  );
  return alias ? alias[1] + field.slice(alias[0].length) : field;
}
const valueAt = (tree, path) =>
  path.reduce((value, key) => (container(value) ? value[key] : undefined), tree);
const within = (label, field) => !!field && (label === field || label.startsWith(`${field}.`));
// The journal is server-owned and never edited, so it is not compared.
export function compareRows({ cloud, expected, upload, field }) {
  const trees = expected ? { cloud, expected, upload } : { cloud, upload };
  const keys = new Set();
  for (const tree of Object.values(trees))
    for (const key of leaves(tree, [], new Map()).keys()) keys.add(key);
  // An empty map on one side is shown through the entries the other side has in it.
  const parents = new Set();
  for (const key of keys) {
    const path = JSON.parse(key);
    for (let end = 1; end < path.length; end++) parents.add(JSON.stringify(path.slice(0, end)));
  }
  const rejected = savedField(field);
  const rows = [];
  for (const key of keys) {
    const path = JSON.parse(key);
    if (path[0] === 'integrity' || parents.has(key)) continue;
    const row = {
      key,
      path,
      label: path.join('.'),
      cloud: valueAt(cloud, path),
      expected: expected ? valueAt(expected, path) : undefined,
      upload: valueAt(upload, path),
    };
    const reference = expected ? row.expected : row.cloud;
    row.mismatch = !sameValue(reference, row.upload);
    row.rejected = within(row.label, rejected);
    if (row.rejected || row.mismatch || !sameValue(row.cloud, row.upload)) rows.push(row);
  }
  const rank = (row) => (row.rejected ? 0 : row.mismatch ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b));
}
// A row is edited when its typed value differs from the save the admin starts from.
// A blank input keeps that save's value.
export const isEdited = (row, base, inputs) =>
  (inputs[row.key] ?? '') !== '' && !sameValue(typedValue(inputs[row.key]), row[base]);
export const editedValues = (rows, base, inputs) =>
  rows
    .filter((row) => isEdited(row, base, inputs))
    .map((row) => ({ path: row.path, value: typedValue(inputs[row.key]) }));
