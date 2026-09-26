import { townStorage, SAVE_KEY } from './townStorage';
export { SAVE_KEY };
let paused = 0,
  loadedId = null,
  loadedStorage;
export const localProfile = {
  get writesSuspended() {
    return paused > 0;
  },
  load() {
    loadedId = null;
    loadedStorage = globalThis.localStorage;
    try {
      const storage = globalThis.localStorage;
      if (!storage)
        return { data: null, warning: 'Progress can only be kept until this page closes.' };
      const current = storage.getItem(SAVE_KEY);
      if (current != null) {
        const data = JSON.parse(current);
        loadedId = data?._cloud?.active.id ?? null;
        if (data?.schemaVersion > 2)
          return {
            data,
            readOnly: true,
            warning: 'This save needs a newer version of the game. Your saved copy is safe.',
          };
        return { data };
      }
      return { data: null };
    } catch {
      return {
        data: null,
        warning: 'Your save could not be read. Progress will stay in this session.',
        readOnly: true,
      };
    }
  },
  suspendWrites() {
    paused++;
    return () => {
      paused--;
    };
  },
  save(data) {
    try {
      if (paused) return false;
      const active = townStorage.state()?.active;
      if (loadedStorage === globalThis.localStorage && loadedId && active?.id !== loadedId)
        return false;
      townStorage.save(data);
      loadedId = townStorage.state()?.active.id;
      loadedStorage = globalThis.localStorage;
      return true;
    } catch {
      return false;
    }
  },
};
