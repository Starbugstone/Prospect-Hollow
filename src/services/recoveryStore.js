// Immutable recovery and pending-upload snapshots live outside the synchronous town record.
// A transaction must commit before sync is allowed to replace local progress.
function createRecoveryStore(indexedDB = () => globalThis.indexedDB) {
  let opening;
  function open() {
    if (!opening)
      opening = new Promise((resolve, reject) => {
        if (!indexedDB())
          return reject(
            new Error('Local backup storage is unavailable. Your current save has been kept.'),
          );
        const request = indexedDB().open('prospect-recovery-v1', 2);
        request.onupgradeneeded = () => {
          for (const name of ['copies', 'uploads']) {
            if (request.result.objectStoreNames.contains(name)) continue;
            const store = request.result.createObjectStore(name, { keyPath: 'id' });
            store.createIndex('town', ['owner', 'townId']);
            store.createIndex('owner', 'owner');
          }
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error('Close older game windows to open local backup storage.'));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            opening = null;
          };
          resolve(db);
        };
      }).catch((error) => {
        opening = null;
        throw error;
      });
    return opening;
  }
  async function transaction(mode, operation, bucket = 'copies') {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(bucket, mode),
        store = tx.objectStore(bucket);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error('The local backup could not be stored. Your current save has been kept.', {
            cause: tx.error,
          }),
        );
      try {
        operation(store, (value) => {
          result = value;
        });
      } catch (error) {
        tx.abort();
        reject(
          new Error('The local backup could not be stored. Your current save has been kept.', {
            cause: error,
          }),
        );
      }
    });
  }
  function read(bucket, id, owner, townId) {
    return transaction(
      'readonly',
      (store, done) => {
        store.get(id).onsuccess = (event) => {
          const copy = event.target.result;
          done(copy?.owner === owner && copy?.townId === townId ? copy : null);
        };
      },
      bucket,
    );
  }
  function clear(index, key) {
    return Promise.all(
      ['copies', 'uploads'].map((bucket) =>
        transaction(
          'readwrite',
          (store) => {
            store.index(index).openCursor(key).onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              }
            };
          },
          bucket,
        ),
      ),
    );
  }
  return {
    put(copy) {
      return transaction('readwrite', (store) => store.put(copy));
    },
    get: (id, owner, townId) => read('copies', id, owner, townId),
    putUpload: (value) => transaction('readwrite', (store) => store.put(value), 'uploads'),
    getUpload: (id, owner, townId) => read('uploads', id, owner, townId),
    async removeUpload(id, owner, townId) {
      if (await read('uploads', id, owner, townId))
        await transaction('readwrite', (store) => store.delete(id), 'uploads');
    },
    list(owner, townId) {
      return transaction('readonly', (store, done) => {
        const entries = [];
        store.index('town').openCursor([owner, townId]).onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) return done(entries.sort((a, b) => b.createdAt - a.createdAt));
          const { profile, ...descriptor } = cursor.value;
          entries.push({ ...descriptor, coins: profile?.town?.coins ?? 0 });
          cursor.continue();
        };
      });
    },
    async remove(id, owner, townId) {
      if (await this.get(id, owner, townId))
        await transaction('readwrite', (store) => store.delete(id));
    },
    clearOwner: (owner) => clear('owner', owner),
    clearTown: (owner, townId) => clear('town', [owner, townId]),
  };
}
export const recoveryStore = createRecoveryStore();
