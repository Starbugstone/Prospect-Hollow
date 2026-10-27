// The admin sync comparison: every value where the cloud save, the state the server
// replayed from it and the upload differ, with the rejected field first.
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
// The journal and Town Honours are the server's own: never compared or edited here.
const SERVER_OWNED = ['integrity', 'honours'];
// One row per differing value. An object present on only some sides (a project one save
// has and the other lacks) is one row holding the whole object, not one row per field.
function collect(trees, path, found) {
  const values = trees.map((tree) => valueAt(tree, path));
  if (path.length && !values.every((value) => container(value) && !empty(value))) {
    if (!values.every(blank)) found.push(path);
    return;
  }
  for (const key of new Set(values.flatMap((value) => Object.keys(value))))
    if (path.length || !SERVER_OWNED.includes(key)) collect(trees, [...path, key], found);
  return found;
}
export function compareRows({ cloud, expected, upload, field }) {
  const trees = expected ? [cloud, expected, upload] : [cloud, upload];
  const rejected = savedField(field);
  const rows = [];
  for (const path of collect(trees, [], [])) {
    const label = path.join('.');
    const row = {
      key: JSON.stringify(path),
      path,
      label,
      cloud: valueAt(cloud, path),
      expected: expected ? valueAt(expected, path) : undefined,
      upload: valueAt(upload, path),
    };
    const reference = expected ? row.expected : row.cloud;
    row.mismatch = !sameValue(reference, row.upload);
    // A whole object holding the rejected field counts as rejected too.
    row.rejected = within(label, rejected) || within(rejected, label);
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
