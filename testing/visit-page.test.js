import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import VisitPresence from '../src/components/community/VisitPresence.vue';
import PublicProfile from '../src/components/account/PublicProfile.vue';
import VillageVisit from '../src/components/community/VillageVisit.vue';
import { cloud } from '../src/services/cloudProfile';
import { SAVE_KEY } from '../src/services/townStorage';
import { createTown } from '../src/data/town';
import { clientComponent, mountComponent, nodeText, settle } from './helpers/componentMount';
import { find, sfc } from './helpers/componentFragments';

// The share-link page, as a first-time visitor opens it: no save on this device, maybe no
// readable storage at all, possibly a private profile on the server.
vi.mock('../src/composables/useVillageVisitors', async () => {
  const { ref } = await import('vue');
  return { useVillageVisitors: () => ({ snapshot: ref(null), error: ref('') }) };
});
let poller;
vi.mock('../src/services/villagePolling', () => ({
  createVillagePoller(options) {
    poller = options;
    return { start() {}, stop() {}, resume() {} };
  },
}));

const PRESENCE = 'src/components/community/VisitPresence.vue';
const PROFILE = 'src/components/account/PublicProfile.vue';
const VISIT = 'src/components/community/VillageVisit.vue';
// The fake DOM has no <select> options, so these render their real template without the
// town picker.
const withoutPicker = (path) => {
  const template = sfc(path).template;
  const picker = find(
    template.ast,
    (node) => node.tag === 'label' && node.children?.some((child) => child.tag === 'select'),
  );
  return template.content.replace(picker.loc.source, '');
};
const home = { townId: 'home-town', name: 'Silver Creek', publicId: 'home-public' };
let visitor, mounted, values;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  vi.stubGlobal('document', {
    hidden: false,
    body: { style: {} },
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });
  cloud.account = null;
  cloud.sessionExpired = false;
  cloud.csrf = '';
  mounted = [];
  visitor = { profile: null, towns: [] };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith('/account/profile')
          ? visitor
          : { active: true, visitId: 'stay-1', expiresAt: Date.now() + 30_000 },
    })),
  );
});
afterEach(() => {
  mounted.forEach((unmount) => unmount());
  vi.unstubAllGlobals();
});

const presenceCalls = () =>
  fetch.mock.calls.filter(
    ([url, options]) => url.endsWith('/presence') && options.method === 'POST',
  );
async function mount(component, path, props = {}) {
  const emitted = [];
  const { root, unmount } = mountComponent(clientComponent(component, path, withoutPicker(path)), {
    ...props,
    onTown: (town) => emitted.push(town),
  });
  mounted.push(unmount);
  await settle();
  return { root, emitted };
}

describe('a first-time visitor on a share link', () => {
  it('joins the visit anonymously without a town on this device', async () => {
    const { root } = await mount(VisitPresence, PRESENCE, { villageId: 'shared-town' });
    expect(nodeText(root)).not.toContain('Live visit unavailable');
    expect(nodeText(root)).toContain('You appear as Visitor while visiting.');
    expect(presenceCalls()).toHaveLength(1);
    expect(JSON.parse(presenceCalls()[0][1].body)).toMatchObject({ townId: null });
  });

  it('joins even when the save on this device cannot be read', async () => {
    values.set(SAVE_KEY, '{"damaged');
    const { root } = await mount(VisitPresence, PRESENCE, { villageId: 'shared-town' });
    expect(nodeText(root)).not.toContain('Live visit unavailable');
    expect(presenceCalls()).toHaveLength(1);
  });

  it('previews the public profile of a signed-in mayor whose town is not on this device', async () => {
    visitor = { profile: { displayName: 'Alice', visitingTownId: null }, towns: [home] };
    const { root } = await mount(PublicProfile, PROFILE);
    expect(nodeText(root)).toContain('Mayor of Silver Creek');
  });
});

describe('a private visit', () => {
  it('says the visitor appears as a plain visitor and still visits as their town', async () => {
    visitor = {
      profile: { displayName: 'Alice', anonymousVisits: true, visitingTownId: home.townId },
      towns: [home],
    };
    const { root, emitted } = await mount(VisitPresence, PRESENCE, { villageId: 'shared-town' });
    expect(nodeText(root)).toContain('You appear as Visitor while visiting.');
    expect(nodeText(root)).not.toContain('Alice');
    expect(emitted.at(-1)).toEqual({ townId: home.townId, name: home.name });
    expect(JSON.parse(presenceCalls()[0][1].body)).toMatchObject({ townId: home.townId });
  });

  it('names a public visitor with their town', async () => {
    visitor = { profile: { displayName: 'Alice', visitingTownId: home.townId }, towns: [home] };
    const { root } = await mount(VisitPresence, PRESENCE, { villageId: 'shared-town' });
    expect(nodeText(root)).toContain('You appear as Alice · Mayor of Silver Creek while visiting.');
  });
});

describe('the owner stops sharing during a full screen visit', () => {
  it('closes the open guestbook and gives the page its scrolling back', async () => {
    vi.useFakeTimers();
    try {
      let state;
      const village = { villageId: 'shared-town', name: 'Red Rock', appearance: createTown() };
      const Visit = clientComponent(
        VillageVisit,
        VISIT,
        '<p>{{ unshared }} {{ fullscreen }} {{ inspected }}</p>',
        (setup) => (state = setup),
      );
      const { unmount } = mountComponent(Visit, { village }, { pinia: createPinia() });
      mounted.push(unmount);
      await settle();
      document.body.style.overflow = 'auto';
      state.fullscreen.value = true;
      await settle();
      state.inspected.value = 'guestbook';
      await settle();
      expect(document.body.style.overflow).toBe('hidden');
      poller.gone();
      await settle();
      expect(state.unshared.value).toBe(true);
      expect(state.inspected.value).toBe('');
      expect(state.fullscreen.value).toBe(false);
      expect(document.body.style.overflow).toBe('auto');
    } finally {
      vi.useRealTimers();
    }
  });
});
