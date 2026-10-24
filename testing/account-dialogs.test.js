import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import { createRenderer, h, nextTick, reactive, ref, ssrContextKey } from 'vue';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from 'vue/compiler-sfc';
import TownDeleteDialog from '../src/components/account/TownDeleteDialog.vue';
import GameIcon from '../src/components/GameIcon.vue';
import TownCardArt from '../src/components/TownCardArt.vue';
import HonourCardRow from '../src/components/honours/HonourCardRow.vue';
import AccountPanel from '../src/components/account/AccountPanel.vue';
import TownSlots from '../src/components/account/TownSlots.vue';
import { provideAccountContext } from '../src/components/account/accountContext';
import { cloud, deleteAccountTown, refreshAccount, syncNow } from '../src/services/cloudProfile';
import { confirmEmailChange } from '../src/services/playerData';

const state = vi.hoisted(() => ({ game: null, selected: 'owner:playing', active: null }));
vi.mock('../src/services/cloudProfile', async () => {
  const { reactive } = await import('vue');
  return {
    cloud: reactive({ account: { id: 'owner' }, towns: [], storageVersion: 0, error: '' }),
    refreshAccount: vi.fn(),
    deleteAccountTown: vi.fn(),
    syncNow: vi.fn(),
    createAccountTown: vi.fn(),
    attachLocal: vi.fn(),
    cacheTown: vi.fn(),
    request: vi.fn(),
  };
});
vi.mock('../src/services/playerData', () => ({ confirmEmailChange: vi.fn() }));
vi.mock('../src/services/townStorage', () => ({
  townKey: (id, owner) => `${owner}:${id}`,
  townStorage: {
    active: () => state.active,
    activeMeta: () => state.active?.meta,
    selectedKey: () => state.selected,
    get: vi.fn(() => null),
  },
}));
vi.mock('../src/stores/gameStore', () => ({ useGameStore: () => state.game }));
vi.mock('../src/stores/campaignStore', () => ({
  useCampaignStore: () => ({ exportSave: vi.fn() }),
  freshProfile: vi.fn(),
}));
vi.mock('../src/composables/useNativeDialog', async () => {
  const { ref } = await import('vue');
  return { useNativeDialog: () => ({ dialog: ref(null), closeButton: ref(null) }) };
});
vi.mock('../src/components/account/AccountSignIn.vue', () => ({ default: { render: () => null } }));
vi.mock('../src/components/account/MayorOffice.vue', () => ({ default: { render: () => null } }));
vi.mock('../src/components/account/TownManage.vue', () => ({ default: { render: () => null } }));
vi.mock('../src/components/account/DeviceCopies.vue', () => ({ default: { render: () => null } }));

// Vite's Node transform supplies SSR components. Compile their client render
// functions so this renderer exercises the real event handlers and prop updates.
for (const [component, path] of [
  [AccountPanel, '../src/components/account/AccountPanel.vue'],
  [TownSlots, '../src/components/account/TownSlots.vue'],
  [TownDeleteDialog, '../src/components/account/TownDeleteDialog.vue'],
  [GameIcon, '../src/components/GameIcon.vue'],
  [TownCardArt, '../src/components/TownCardArt.vue'],
  [HonourCardRow, '../src/components/honours/HonourCardRow.vue'],
]) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const bindings = compileScript(descriptor, { id: path }).bindings;
  component.render = Vue.compile(descriptor.template.content, {
    prefixIdentifiers: true,
    bindingMetadata: bindings,
  });
}

// Render actual component events and reactive props without a browser DOM.
const node = (type, text = '') => ({
  type,
  tagName: type.toUpperCase(),
  text,
  props: {},
  children: [],
  parent: null,
  addEventListener() {},
  removeEventListener() {},
  getRootNode() {
    return this.parent ? this.parent.getRootNode() : this;
  },
});
const renderer = createRenderer({
  createElement: (type) => node(type),
  createText: (text) => node('#text', text),
  createComment: (text) => node('#comment', text),
  setText: (entry, text) => (entry.text = text),
  setElementText: (entry, text) => {
    entry.text = text;
    entry.children = [];
  },
  patchProp: (entry, key, _old, value) => (entry.props[key] = value),
  parentNode: (entry) => entry.parent,
  nextSibling: (entry) => entry.parent?.children[entry.parent.children.indexOf(entry) + 1],
  insert(entry, parent, anchor) {
    if (entry.parent) entry.parent.children.splice(entry.parent.children.indexOf(entry), 1);
    entry.parent = parent;
    const index = parent.children.indexOf(anchor);
    parent.children.splice(index < 0 ? parent.children.length : index, 0, entry);
  },
  remove(entry) {
    entry.parent?.children.splice(entry.parent.children.indexOf(entry), 1);
    entry.parent = null;
  },
});
let apps;
const text = (entry) => entry.text + entry.children.map(text).join('');
const find = (entry, match) =>
  match(entry) ? entry : entry.children.map((child) => find(child, match)).find(Boolean);
const button = (root, label) =>
  find(root, (entry) => entry.type === 'button' && text(entry).includes(label));
const settle = async () => {
  for (let i = 0; i < 8; i++) await nextTick();
};
function mount(component) {
  const root = node('root');
  const app = renderer.createApp(component);
  app.provide(ssrContextKey, { modules: new Set() });
  apps.push(app);
  app.mount(root);
  return root;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('document', { activeElement: null });
  // v-model checks whether a document or shadow root focuses the input.
  vi.stubGlobal('Document', class {});
  vi.stubGlobal('ShadowRoot', class {});
  vi.stubGlobal('location', { origin: 'https://example.test' });
  apps = [];
  state.game = reactive({ sessionActive: false });
  state.selected = 'owner:playing';
  state.active = {
    meta: { id: 'playing', owner: 'owner' },
    profile: { town: { era: 'frontier' } },
  };
  cloud.account = { id: 'owner' };
  cloud.sessionExpired = false;
  cloud.towns = [];
  cloud.error = '';
  refreshAccount.mockResolvedValue();
  syncNow.mockResolvedValue(true);
});
afterEach(() => {
  apps.forEach((app) => app.unmount());
  vi.unstubAllGlobals();
});

it('refreshes the deleting card after a conflict and requires confirmation of its latest progress', async () => {
  const card = (revision, coins) => ({
    townId: 'other',
    name: 'Other Town',
    revision,
    summary: { era: 'frontier', coins, buildings: 3 },
  });
  cloud.towns = [card(1, 10)];
  deleteAccountTown
    .mockImplementationOnce(async () => {
      cloud.towns = [card(2, 999)];
      throw Object.assign(new Error('conflict'), { status: 409 });
    })
    .mockImplementationOnce(async () => {
      cloud.towns = [];
      await nextTick();
    });
  const root = mount({
    setup() {
      const context = provideAccountContext({ changed() {}, close() {}, community() {} });
      return () => h('div', [h('p', context.message.value), h(TownSlots, { writable: true })]);
    },
  });
  find(root, (entry) => entry.props['aria-label'] === 'More for Other Town').props.onClick();
  await settle();
  button(root, 'Delete from the cloud').props.onClick();
  await settle();
  const confirmation = () =>
    find(root, (entry) => entry.type === 'input' && entry.props.placeholder === 'Other Town');
  confirmation().props['onUpdate:modelValue']('Other Town');
  await settle();
  const submit = () =>
    find(
      root,
      (entry) => entry.type === 'form' && entry.props.class === 'account-body',
    ).props.onSubmit({ preventDefault() {} });
  submit();
  await settle();
  expect(deleteAccountTown.mock.calls[0][0].revision).toBe(1);
  expect(text(root)).toContain('999 coins');
  expect(text(root)).toContain('Check its latest details before deleting.');
  expect(confirmation().value).toBe('');
  expect(button(root, 'Delete this town forever').props.disabled).toBe(true);
  confirmation().props['onUpdate:modelValue']('Other Town');
  await settle();
  submit();
  await settle();
  expect(deleteAccountTown.mock.calls[1][0]).toMatchObject({ revision: 2, card: { coins: 999 } });
  expect(find(root, (entry) => entry.type === 'dialog')).toBeUndefined();
  expect(text(root)).toContain('“Other Town” was deleted from your account.');
});

it('closes a deletion dialog if the town vanishes from the refreshed list', async () => {
  cloud.towns = [{ townId: 'other', name: 'Other Town', revision: 1 }];
  const root = mount({
    setup() {
      provideAccountContext({ changed() {}, close() {}, community() {} });
      return () => h(TownSlots);
    },
  });
  find(root, (entry) => entry.props['aria-label'] === 'More for Other Town').props.onClick();
  await settle();
  button(root, 'Delete from the cloud').props.onClick();
  await settle();
  expect(find(root, (entry) => entry.type === 'dialog')).toBeTruthy();
  cloud.towns = [];
  await settle();
  expect(find(root, (entry) => entry.type === 'dialog')).toBeUndefined();
  let finishRefresh;
  refreshAccount.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRefresh = resolve;
      }),
  );
  find(root, (entry) => entry.props['aria-label'] === 'Refresh towns').props.onClick();
  await settle();
  expect(find(root, (entry) => entry.type === 'dialog')).toBeUndefined();
  finishRefresh();
  await settle();
});

it('keeps deletion of the selected town disabled while its puzzle is active', async () => {
  state.game.sessionActive = true;
  cloud.towns = [{ townId: 'playing', name: 'Playing Town', revision: 1 }];
  const root = mount({
    setup() {
      provideAccountContext({ changed() {}, close() {}, community() {} });
      return () => h(TownSlots, { writable: true });
    },
  });
  find(root, (entry) => entry.props['aria-label'] === 'More for Playing Town').props.onClick();
  await settle();
  button(root, 'Delete from the cloud').props.onClick();
  await settle();
  find(root, (entry) => entry.type === 'input').props['onUpdate:modelValue']('Playing Town');
  await settle();
  expect(button(root, 'Delete this town forever').props.disabled).toBe(true);
  expect(deleteAccountTown).not.toHaveBeenCalled();
});

it('syncs the town being played after a conflict so a retry uses its latest revision', async () => {
  cloud.towns = [{ townId: 'playing', name: 'Playing Town', revision: 1 }];
  deleteAccountTown.mockRejectedValueOnce(Object.assign(new Error('conflict'), { status: 409 }));
  const root = mount({
    setup() {
      provideAccountContext({ changed() {}, close() {}, community() {} });
      return () => h(TownSlots, { writable: true });
    },
  });
  find(root, (entry) => entry.props['aria-label'] === 'More for Playing Town').props.onClick();
  await settle();
  button(root, 'Delete from the cloud').props.onClick();
  await settle();
  find(root, (entry) => entry.type === 'input').props['onUpdate:modelValue']('Playing Town');
  await settle();
  find(
    root,
    (entry) => entry.type === 'form' && entry.props.class === 'account-body',
  ).props.onSubmit({ preventDefault() {} });
  await settle();
  expect(deleteAccountTown).toHaveBeenCalledOnce();
  expect(syncNow).toHaveBeenCalledOnce();
  expect(text(root)).toContain('Check its latest details before deleting.');
});

it.each([401, 409, 422])(
  'consumes a permanently rejected email link (%s) across panel remounts',
  async (status) => {
    confirmEmailChange.mockRejectedValue(
      Object.assign(new Error('This link has expired or was already used.'), { status }),
    );
    const token = ref('dead-token'),
      open = ref(true);
    const root = mount({
      setup: () => () =>
        open.value
          ? h(AccountPanel, {
              emailLink: token.value,
              onEmailLinkUsed: () => {
                token.value = '';
              },
            })
          : null,
    });
    await settle();
    expect(token.value).toBe('');
    expect(text(root)).toContain('This link has expired or was already used.');
    open.value = false;
    await settle();
    open.value = true;
    await settle();
    expect(confirmEmailChange).toHaveBeenCalledOnce();
  },
);

it.each([undefined, 403, 408, 429, 500, 503])(
  'retains email links after a retryable error (%s)',
  async (status) => {
    confirmEmailChange.mockRejectedValue(Object.assign(new Error('Try again later.'), { status }));
    const used = vi.fn();
    mount({ render: () => h(AccountPanel, { emailLink: 'retry-token', onEmailLinkUsed: used }) });
    await settle();
    expect(used).not.toHaveBeenCalled();
  },
);

it('consumes a confirmed email link even if refreshing the account fails afterward', async () => {
  confirmEmailChange.mockResolvedValue({ email: 'new@example.test' });
  refreshAccount.mockRejectedValue(new Error('Offline'));
  const used = vi.fn();
  mount({ render: () => h(AccountPanel, { emailLink: 'good-token', onEmailLinkUsed: used }) });
  await settle();
  expect(used).toHaveBeenCalledOnce();
});
