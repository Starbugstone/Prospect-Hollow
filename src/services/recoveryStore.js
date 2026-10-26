import { recoveryStore as database } from './recoveryDatabase';
import { backgroundJson } from './backgroundJson';
// IndexedDB also synchronously clones values at put()/get() boundaries. Keep large
// immutable snapshots in the worker, using the same database and durable transactions.
export const recoveryStore = {
  ...database,
  removeUpload: (id, owner, townId) =>
    backgroundJson.run('removeUpload', { id, owner, townId }, () =>
      database.removeUpload(id, owner, townId),
    ),
  put: (value) => backgroundJson.run('putRecovery', value, () => database.put(value)),
  get: (id, owner, townId) =>
    backgroundJson.run('getRecovery', { id, owner, townId }, () => database.get(id, owner, townId)),
  putUpload: (value) => backgroundJson.run('putUpload', value, () => database.putUpload(value)),
  getUpload: (id, owner, townId) =>
    backgroundJson.run('getUpload', { id, owner, townId }, () =>
      database.getUpload(id, owner, townId),
    ),
};
