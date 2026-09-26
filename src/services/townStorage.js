// Each town is an atomic save + outbox record. Selection belongs to this tab;
// account identity is shared, but gameplay never rewrites another town's record.
export const SAVE_KEY = 'crystal-cascade-profile-v3';
export const TOWN_CHANGED = 'prospect-town-save-changed';
const copy = (value) => JSON.parse(JSON.stringify(value));
const profileOf = ({ _cloud, ...profile }) => profile;
// Advancing an idle income checkpoint alone is not new player progress. A changed
// stored balance or fractional earning still makes the snapshot dirty.
export const progressKey = (profile) =>
  JSON.stringify(
    {
      ...profile,
      town: profile.town
        ? {
            ...profile.town,
            income: profile.town.income ? { ...profile.town.income, at: null } : undefined,
          }
        : undefined,
    },
    // Loading normalizes object key order. That must not look like new gameplay
    // to either cloud synchronization or another tab's renderer.
    (_, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
  );
const freshMeta = (name = 'My town') => ({
  id: crypto.randomUUID(),
  name,
  owner: null,
  baseRevision: 0,
  dirty: true,
  sequence: 0,
  updatedAt: Date.now(),
  pending: null,
  conflict: null,
});
export const ACCOUNT_KEY = 'prospect-account-v2';
export const TOWN_PREFIX = 'prospect-town-v2:';
const SELECTION_KEY = 'prospect-selected-town-v2';
const CREATION_PREFIX = 'prospect-creation-v2:';
export const townKey = (id, owner) => (owner ? `${TOWN_PREFIX}${owner}:${id}` : SAVE_KEY);
const rootOf = (entry) => ({
  ...copy(entry.profile),
  _cloud: { version: 2, active: copy(entry.meta) },
});
const entryOf = (root) =>
  root?._cloud ? { profile: profileOf(root), meta: copy(root._cloud.active) } : null;

// Injectable stores let tests model separate tabs sharing the same durable storage.
export function createTownStorage({
  storage = () => globalThis.localStorage,
  session = () => globalThis.sessionStorage,
  changed = () => globalThis.window?.dispatchEvent(new Event(TOWN_CHANGED)),
} = {}) {
  let fallbackSelection = SAVE_KEY,
    previousStorage,
    guard = () => true;
  function read(key) {
    const raw = storage()?.getItem(key);
    const root = raw ? JSON.parse(raw) : null;
    return root;
  }
  function write(key, value) {
    if (!storage()) throw new Error('Local storage is unavailable.');
    const serialized = JSON.stringify(value);
    if (storage().getItem(key) === serialized) return;
    storage().setItem(key, serialized);
    changed();
  }
  function selected() {
    if (previousStorage !== storage()) {
      previousStorage = storage();
      fallbackSelection = SAVE_KEY;
    }
    const selectedKey = session()?.getItem(SELECTION_KEY) ?? fallbackSelection;
    const account = read(ACCOUNT_KEY)?.account;
    return account && selectedKey.startsWith(`${TOWN_PREFIX}${account.id}:`)
      ? selectedKey
      : SAVE_KEY;
  }
  function selectKey(key) {
    // Commit selection before notifying the view; a failed session write must not
    // leave the game saving into a town different from the displayed one.
    session()?.setItem(SELECTION_KEY, key);
    fallbackSelection = key;
    previousStorage = storage();
    changed();
  }
  function assertWrite(key = selected()) {
    if (!guard(key)) throw new Error('This town is open in another tab.');
  }
  function activeRoot() {
    return read(selected());
  }
  function persist(entry, key = selected()) {
    assertWrite(key);
    write(key, rootOf(entry));
  }
  const api = {
    // Run once under the browser migration lock before mounting the application.
    // The original combined save is replaced LAST, so a quota error or closed tab
    // leaves it recoverable. Retrying never overwrites an already migrated town.
    initialize() {
      const root = read(SAVE_KEY);
      if (root?.schemaVersion > 2) throw new Error('This save needs a newer version of the game.');
      if (!root || root._cloud?.version === 2) return;
      const legacy = root._cloud;
      if (!legacy) return;
      const current = entryOf(root);
      const slots = { ...legacy.slots };
      if (current.meta.owner) slots[`${current.meta.owner}:${current.meta.id}`] = current;
      for (const entry of Object.values(slots)) {
        const key = townKey(entry.meta.id, entry.meta.owner);
        if (!read(key)) write(key, rootOf(entry));
      }
      if (!read(ACCOUNT_KEY))
        write(ACCOUNT_KEY, { account: legacy.account, generation: crypto.randomUUID() });
      if (legacy.creation) write(`${CREATION_PREFIX}${legacy.creation.owner}`, legacy.creation);
      if (current.meta.owner) selectKey(townKey(current.meta.id, current.meta.owner));
      const local = current.meta.owner ? legacy.local : current;
      write(SAVE_KEY, rootOf(local ?? { profile: {}, meta: freshMeta() }));
    },
    setWriteGuard(next) {
      guard = next;
    },
    canWrite() {
      return guard(selected());
    },
    selectedKey: selected,
    auth() {
      return read(ACCOUNT_KEY) ?? { account: null, generation: null };
    },
    load() {
      return activeRoot();
    },
    ensure(profile) {
      const root = activeRoot();
      if (!root?._cloud) persist({ profile: root ?? profile, meta: freshMeta() });
      return this.state();
    },
    state() {
      const active = this.active();
      return active
        ? {
            version: 2,
            active: active.meta,
            account: this.auth().account,
            creation: read(`${CREATION_PREFIX}${this.auth().account?.id}`),
          }
        : null;
    },
    active() {
      return entryOf(activeRoot());
    },
    get(id, owner) {
      return entryOf(read(townKey(id, owner)));
    },
    records(owner) {
      const result = [];
      const store = storage();
      for (let i = 0; i < (store?.length ?? 0); i++) {
        const key = store.key(i);
        if (key?.startsWith(`${TOWN_PREFIX}${owner}:`)) {
          const entry = entryOf(read(key));
          if (entry) result.push(entry);
        }
      }
      return result;
    },
    save(profile) {
      const root = activeRoot();
      const entry = entryOf(root) ?? { profile: {}, meta: freshMeta() };
      if (progressKey(entry.profile) !== progressKey(profile)) {
        entry.meta = {
          ...entry.meta,
          dirty: true,
          sequence: entry.meta.sequence + 1,
          updatedAt: Date.now(),
        };
      }
      entry.profile = copy(profile);
      persist(entry);
    },
    account(account, newSession = false) {
      const previous = this.auth();
      write(ACCOUNT_KEY, {
        account,
        generation:
          newSession || account?.id !== previous.account?.id
            ? crypto.randomUUID()
            : previous.generation,
      });
    },
    logout() {
      this.account(null, true);
      selectKey(SAVE_KEY);
    },
    select(id, owner) {
      if (!owner || this.auth().account?.id !== owner)
        throw new Error('Sign in to use account town slots.');
      if (!this.get(id, owner)) throw new Error('Download this town before opening it.');
      selectKey(townKey(id, owner));
    },
    remember(cloud, owner) {
      if (this.get(cloud.townId, owner)) return;
      persist(
        {
          profile: cloud.profile,
          meta: {
            ...freshMeta(cloud.name),
            id: cloud.townId,
            owner,
            baseRevision: cloud.revision,
            dirty: false,
            cloudAt: cloud.updatedAt,
            isPublic: cloud.isPublic,
            publicId: cloud.publicId,
          },
        },
        townKey(cloud.townId, owner),
      );
    },
    attach(cloud, owner, sequence) {
      if (this.get(cloud.townId, owner))
        throw new Error(
          'This town is already on your account. Open it from your town list; your local town is kept.',
        );
      const current = this.active();
      if (current?.meta.id !== cloud.townId || this.auth().account?.id !== owner)
        throw new Error('The selected town changed. Sign in again to recover the attached copy.');
      assertWrite();
      persist(
        {
          profile: current.profile,
          meta: {
            ...current.meta,
            owner,
            name: cloud.name,
            baseRevision: cloud.revision,
            dirty: current.meta.sequence !== sequence,
            cloudAt: cloud.updatedAt,
            pending: null,
            attachment: null,
            isPublic: cloud.isPublic,
            publicId: cloud.publicId,
          },
        },
        townKey(cloud.townId, owner),
      );
      selectKey(townKey(cloud.townId, owner));
    },
    mutate(id, owner, operation) {
      if (this.auth().account?.id !== owner) return false;
      const next = this.get(id, owner);
      if (!next) return false;
      assertWrite(townKey(id, owner));
      if (operation(next) === false) return false;
      persist(next, townKey(id, owner));
      return true;
    },
    creation(body) {
      write(`${CREATION_PREFIX}${this.auth().account?.id}`, body);
    },
    attachment(body, sequence) {
      const current = this.active();
      current.meta.attachment = { body, sequence };
      persist(current);
    },
    renameLocal(name) {
      const current = this.active();
      if (current.meta.owner) throw new Error('Rename account towns from account settings.');
      current.meta.name = name;
      persist(current);
    },
    reset(profile) {
      if (this.active()?.meta.owner)
        throw new Error('Use account town management to create or delete a town.');
      persist({ profile, meta: freshMeta() });
    },
    import(profile, identity) {
      const current = this.active() ?? { profile: {}, meta: freshMeta() };
      if (current.meta.owner && identity && identity.id !== current.meta.id)
        throw new Error(
          'This backup belongs to another town. Sign out to load it into the local slot, then attach it to an available account slot.',
        );
      if (!current.meta.owner && identity)
        current.meta = { ...freshMeta(identity.name), id: identity.id };
      current.meta = {
        ...current.meta,
        dirty: true,
        sequence: current.meta.sequence + 1,
        pending: null,
        conflict: null,
        updatedAt: Date.now(),
      };
      current.profile = profile;
      persist(current);
    },
  };
  return api;
}
export const townStorage = createTownStorage();
