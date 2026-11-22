import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { publicPage } from '../src/services/publicPages';
import { findNode, mountComponent, nodeText, settle } from './helpers/componentMount';

// A release replaces the hashed chunks: a tab opened before it asks for a chunk that is
// gone, which the host answers with HTML. The import then fails like this.
vi.mock('../src/components/privacy/PrivacyPage.vue', () => {
  throw new TypeError('Failed to fetch dynamically imported module');
});
vi.mock('../src/components/community/VisitRoot.vue', () => {
  throw new TypeError('Failed to fetch dynamically imported module');
});
// The reload notice renders its real template on the test's client renderer.
vi.mock('../src/components/GameViewStatus.vue', async (importOriginal) => {
  const { clientComponent } = await import('./helpers/componentMount');
  const status = (await importOriginal()).default;
  return { default: clientComponent(status, 'src/components/GameViewStatus.vue') };
});

let mounted;
beforeEach(() => {
  mounted = [];
  vi.stubGlobal('location', { reload: vi.fn() });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  mounted.forEach((unmount) => unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const at = (path) => new URL(`https://prospecthollow.test${path}`);

it('mounts the share-link visit and the privacy notice as public pages, not the game', () => {
  expect(publicPage(at('/visit#town=abc'))).not.toBeNull();
  expect(publicPage(at('/privacy'))).not.toBeNull();
  expect(publicPage(at('/'))).toBeNull();
  expect(publicPage(at('/play'))).toBeNull();
});

it.each(['/privacy', '/visit#town=abc'])(
  'offers a reload when the %s page fails to load',
  async (path) => {
    const { root, unmount } = mountComponent(publicPage(at(path)));
    mounted.push(unmount);
    for (let i = 0; i < 5 && !nodeText(root).includes('could not load'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await settle();
    }
    const status = findNode(root, (entry) => entry.props.role === 'alert');
    expect(nodeText(status)).toContain('This view could not load');
    const reload = findNode(status, (entry) => entry.type === 'button');
    expect(nodeText(reload)).toBe('Reload the game');
    reload.props.onClick();
    expect(location.reload).toHaveBeenCalledOnce();
  },
);
