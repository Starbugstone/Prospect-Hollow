// A single atomic localStorage record holds the active save and its sync metadata.
// Game fields stay at the top level to preserve existing device saves and backups.
export const SAVE_KEY = 'crystal-cascade-profile-v3';
export const TOWN_CHANGED = 'prospect-town-save-changed';
const copy = (value) => JSON.parse(JSON.stringify(value));
const profileOf = ({ _cloud, ...profile }) => profile;
// Advancing an idle income checkpoint alone is not new player progress. A changed
// stored balance or fractional earning still makes the snapshot dirty.
const progressKey = (profile) =>
  JSON.stringify({
    ...profile,
    town: profile.town
      ? {
          ...profile.town,
          income: profile.town.income ? { ...profile.town.income, at: null } : undefined,
        }
      : undefined,
  });
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
function read() {
  const raw = globalThis.localStorage?.getItem(SAVE_KEY);
  const root = raw ? JSON.parse(raw) : {};
  if (root.schemaVersion > 2) throw new Error('This save needs a newer version of the game.');
  return root;
}
function metadata(root) {
  return (root._cloud ??= {
    version: 1,
    active: freshMeta(),
    account: null,
    slots: {},
    local: null,
  });
}
function persist(root) {
  if (!globalThis.localStorage) throw new Error('Local storage is unavailable.');
  globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(root));
  globalThis.window?.dispatchEvent(new Event(TOWN_CHANGED));
}
const key = (meta) => `${meta.owner}:${meta.id}`;
function record(root) {
  return { profile: profileOf(root), meta: copy(metadata(root).active) };
}
function stash(root) {
  const state = metadata(root),
    current = record(root);
  if (current.meta.owner) state.slots[key(current.meta)] = current;
  else state.local = current;
}
function replace(root, next) {
  return { ...copy(next.profile), _cloud: { ...metadata(root), active: copy(next.meta) } };
}
function find(root, id, owner) {
  const state = metadata(root);
  return state.active.id === id && state.active.owner === owner
    ? record(root)
    : state.slots[`${owner}:${id}`];
}
function update(root, next) {
  const state = metadata(root);
  if (state.active.id === next.meta.id && state.active.owner === next.meta.owner)
    return replace(root, next);
  state.slots[key(next.meta)] = next;
  return root;
}
export const townStorage = {
  ensure(profile) {
    const root = read();
    if (!root._cloud) persist({ ...profile, _cloud: metadata(root) });
    return this.state();
  },
  state() {
    const root = read();
    return root._cloud ? copy(root._cloud) : null;
  },
  active() {
    const root = read();
    return root._cloud ? record(root) : null;
  },
  records(owner) {
    const root = read(),
      state = metadata(root),
      result = { ...state.slots };
    if (state.active.owner) result[key(state.active)] = record(root);
    return Object.values(result)
      .filter((entry) => entry.meta.owner === owner)
      .map(copy);
  },
  save(profile) {
    const root = read(),
      state = metadata(root);
    if (progressKey(profileOf(root)) !== progressKey(profile)) {
      state.active = {
        ...state.active,
        dirty: true,
        sequence: state.active.sequence + 1,
        updatedAt: Date.now(),
      };
    }
    persist({ ...copy(profile), _cloud: state });
  },
  account(account) {
    let root = read();
    const state = metadata(root);
    if (!state.account) stash(root);
    state.account = account;
    persist(root);
  },
  logout() {
    let root = read();
    const state = metadata(root);
    if (state.local?.meta.id === state.active.id)
      state.local = {
        profile: profileOf(root),
        meta: { ...state.local.meta, dirty: true, sequence: state.local.meta.sequence + 1 },
      };
    stash(root);
    state.account = null;
    if (state.local) root = replace(root, state.local);
    persist(root);
  },
  select(id, owner) {
    const root = read(),
      state = metadata(root);
    if (!state.account || state.account.id !== owner)
      throw new Error('Sign in to use account town slots.');
    const next = find(root, id, owner);
    if (!next) throw new Error('Download this town before opening it.');
    stash(root);
    persist(replace(root, next));
  },
  remember(cloud, owner) {
    const root = read(),
      state = metadata(root);
    const existing = find(root, cloud.townId, owner);
    if (existing) return;
    state.slots[`${owner}:${cloud.townId}`] = {
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
    };
    persist(root);
  },
  attach(cloud, owner, sequence) {
    const root = read(),
      state = metadata(root);
    if (
      state.active.id !== cloud.townId ||
      state.active.sequence !== sequence ||
      state.account?.id !== owner
    ) {
      // Preserve any gameplay that occurred while attachment was uploading.
      if (state.active.id !== cloud.townId || state.account?.id !== owner)
        throw new Error('The selected town changed. Sign in again to recover the attached copy.');
    }
    state.active = {
      ...state.active,
      owner,
      name: cloud.name,
      baseRevision: cloud.revision,
      dirty: state.active.sequence !== sequence,
      cloudAt: cloud.updatedAt,
      pending: null,
      isPublic: cloud.isPublic,
      publicId: cloud.publicId,
    };
    persist(root);
  },
  mutate(id, owner, operation) {
    const root = read();
    if (metadata(root).account?.id !== owner) return false;
    const next = find(root, id, owner);
    if (!next) return false;
    const result = operation(next);
    if (result === false) return false;
    persist(update(root, next));
    return true;
  },
  creation(body) {
    const root = read();
    metadata(root).creation = body;
    persist(root);
  },
  attachment(body, sequence) {
    const root = read();
    metadata(root).active.attachment = { body, sequence };
    persist(root);
  },
  renameLocal(name) {
    const root = read(),
      state = metadata(root);
    if (state.active.owner) throw new Error('Rename account towns from account settings.');
    state.active.name = name;
    persist(root);
  },
  reset(profile) {
    const root = read(),
      state = metadata(root);
    if (state.active.owner)
      throw new Error('Use account town management to create or delete a town.');
    state.active = freshMeta();
    state.local = null;
    persist({ ...profile, _cloud: state });
  },
  import(profile, identity) {
    const root = read(),
      state = metadata(root);
    if (state.active.owner && identity && identity.id !== state.active.id)
      throw new Error(
        'This backup belongs to another town. Sign out to load it into the local slot, then attach it to an available account slot.',
      );
    if (!state.active.owner && identity)
      state.active = { ...freshMeta(identity.name), id: identity.id };
    state.active = {
      ...state.active,
      dirty: true,
      sequence: state.active.sequence + 1,
      pending: null,
      conflict: null,
      updatedAt: Date.now(),
    };
    persist({ ...profile, _cloud: state });
  },
};
